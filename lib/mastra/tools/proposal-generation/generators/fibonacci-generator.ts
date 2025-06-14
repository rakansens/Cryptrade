/**
 * Fibonacci Generator
 * 
 * フィボナッチリトレースメント提案を生成する専用モジュール
 * スイングポイント検出、リトレースメント計算を含む
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { ProposalData } from '@/types/proposal-generator.types';
import type { PeakTroughPoint } from '../types';
// DrawingProposal type is not used directly due to mismatch
import type { 
  IProposalGenerator, 
  GeneratorParams,
  ProposalGroup
} from '../types';
import { 
  ANALYSIS_PARAMS, 
  COLOR_PALETTE,
  THRESHOLDS,
  TIME_CONSTANTS
} from '../utils/constants';
import { calculateFibonacciConfidence } from '../analyzers/confidence-calculator';
import { validateDrawingData } from '../validators/drawing-validator';
import { generateProposalId, calculatePriceChangePercent } from '../utils/helpers';

interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'high' | 'low';
  strength: number;
}

export class FibonacciGenerator implements IProposalGenerator {
  readonly name = 'FibonacciGenerator';
  readonly analysisType = 'fibonacci' as const;

  async generate(
    data: CandlestickData[],
    params: GeneratorParams
  ): Promise<ProposalGroup['proposals']> {
    logger.info('[FibonacciGenerator] Starting fibonacci generation', {
      dataLength: data.length,
      symbol: params.symbol,
      interval: params.interval,
    });

    const proposals: ProposalData[] = [];
    
    // 1. スイングポイントの検出
    const swingPoints = this.findSwingPoints(data);
    
    if (swingPoints.length < 2) {
      logger.warn('[FibonacciGenerator] Not enough swing points found');
      return proposals;
    }

    // 2. 有効なフィボナッチペアを生成
    const fibonacciPairs = this.generateFibonacciPairs(swingPoints, data);

    // 3. 各ペアから提案を生成
    for (const pair of fibonacciPairs) {
      const proposal = this.createProposal(pair, data, params);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    // 4. 最終的な選択
    const finalProposals = proposals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, params.maxProposals);

    logger.info('[FibonacciGenerator] Fibonacci generation completed', {
      swingPointsCount: swingPoints.length,
      pairsCount: fibonacciPairs.length,
      finalProposals: finalProposals.length,
    });

    return finalProposals;
  }

  /**
   * スイングポイントの検出
   */
  private findSwingPoints(data: CandlestickData[]): SwingPoint[] {
    const swingPoints: SwingPoint[] = [];
    const window = ANALYSIS_PARAMS.PEAK_WINDOW_SIZE;
    
    for (let i = window; i < data.length - window; i++) {
      const swingHigh = this.isSwingHigh(data, i, window);
      const swingLow = this.isSwingLow(data, i, window);
      
      if (swingHigh) {
        const strength = this.calculateSwingStrength(data, i, 'high', window);
        swingPoints.push({
          index: i,
          time: data[i].time,
          price: data[i].high,
          type: 'high',
          strength,
        });
      }
      
      if (swingLow) {
        const strength = this.calculateSwingStrength(data, i, 'low', window);
        swingPoints.push({
          index: i,
          time: data[i].time,
          price: data[i].low,
          type: 'low',
          strength,
        });
      }
    }
    
    return swingPoints;
  }

  /**
   * スイングハイの判定
   */
  private isSwingHigh(
    data: CandlestickData[],
    index: number,
    window: number
  ): boolean {
    const currentHigh = data[index].high;
    
    for (let i = index - window; i <= index + window; i++) {
      if (i !== index && data[i].high >= currentHigh) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * スイングローの判定
   */
  private isSwingLow(
    data: CandlestickData[],
    index: number,
    window: number
  ): boolean {
    const currentLow = data[index].low;
    
    for (let i = index - window; i <= index + window; i++) {
      if (i !== index && data[i].low <= currentLow) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * スイングの強度計算
   */
  private calculateSwingStrength(
    data: CandlestickData[],
    index: number,
    type: 'high' | 'low',
    window: number
  ): number {
    let strength = 0;
    const price = data[index][type];
    
    // 前後の価格差
    for (let i = index - window; i <= index + window; i++) {
      if (i === index) continue;
      
      const diff = type === 'high' 
        ? (price - data[i].high) / price
        : (data[i].low - price) / price;
      
      strength += Math.max(0, diff);
    }
    
    // ボリューム要因
    const avgVolume = data.slice(index - window, index + window + 1)
      .reduce((sum, d) => sum + d.volume, 0) / (window * 2 + 1);
    const volumeRatio = data[index].volume / avgVolume;
    
    strength *= volumeRatio;
    
    return Math.min(1, strength);
  }

  /**
   * フィボナッチペアの生成
   */
  private generateFibonacciPairs(
    swingPoints: SwingPoint[],
    data: CandlestickData[]
  ): Array<{
    start: SwingPoint;
    end: SwingPoint;
    direction: 'up' | 'down';
    score: number;
  }> {
    const pairs: Array<{
      start: SwingPoint;
      end: SwingPoint;
      direction: 'up' | 'down';
      score: number;
    }> = [];
    
    // 最近の重要なスイングポイントに焦点
    const recentSwings = swingPoints.slice(-10);
    
    for (let i = 0; i < recentSwings.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 5, recentSwings.length); j++) {
        const swing1 = recentSwings[i];
        const swing2 = recentSwings[j];
        
        // 最小距離チェック
        if (swing2.index - swing1.index < 10) continue;
        
        // 上昇トレンド（安値→高値）
        if (swing1.type === 'low' && swing2.type === 'high') {
          const score = this.calculatePairScore(swing1, swing2, data);
          pairs.push({
            start: swing1,
            end: swing2,
            direction: 'up',
            score,
          });
        }
        
        // 下降トレンド（高値→安値）
        if (swing1.type === 'high' && swing2.type === 'low') {
          const score = this.calculatePairScore(swing1, swing2, data);
          pairs.push({
            start: swing1,
            end: swing2,
            direction: 'down',
            score,
          });
        }
      }
    }
    
    // スコア順でソート
    return pairs.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * ペアのスコア計算
   */
  private calculatePairScore(
    swing1: SwingPoint,
    swing2: SwingPoint,
    data: CandlestickData[]
  ): number {
    // 価格変動幅
    const priceChange = Math.abs(swing2.price - swing1.price) / swing1.price;
    
    // 時間的な近さ
    const recency = (data.length - swing2.index) / data.length;
    
    // スイングの強度
    const avgStrength = (swing1.strength + swing2.strength) / 2;
    
    // トレンドの明確さ
    const clarity = this.calculateTrendClarity(
      data.slice(swing1.index, swing2.index + 1)
    );
    
    return (
      priceChange * 0.3 +
      recency * 0.3 +
      avgStrength * 0.2 +
      clarity * 0.2
    );
  }

  /**
   * トレンドの明確さを計算
   */
  private calculateTrendClarity(segment: CandlestickData[]): number {
    if (segment.length < 2) return 0;
    
    const startPrice = segment[0].close;
    const endPrice = segment[segment.length - 1].close;
    const expectedChange = endPrice - startPrice;
    
    let actualProgress = 0;
    for (let i = 1; i < segment.length; i++) {
      const progress = segment[i].close - startPrice;
      if (Math.sign(progress) === Math.sign(expectedChange)) {
        actualProgress += Math.abs(progress);
      }
    }
    
    const idealProgress = Math.abs(expectedChange) * segment.length / 2;
    return Math.min(1, actualProgress / idealProgress);
  }

  /**
   * 提案の作成
   */
  private createProposal(
    pair: {
      start: SwingPoint;
      end: SwingPoint;
      direction: 'up' | 'down';
      score: number;
    },
    data: CandlestickData[],
    params: GeneratorParams
  ): ProposalData | null {
    const { start, end, direction } = pair;
    
    // 信頼度計算
    const confidence = calculateFibonacciConfidence(
      { high: Math.max(start.price, end.price), low: Math.min(start.price, end.price) },
      data[data.length - 1].close,
      data
    );
    
    if (confidence < THRESHOLDS.MIN_CONFIDENCE) {
      return null;
    }
    
    // リトレースメントレベルの計算
    const currentPrice = data[data.length - 1].close;
    const priceRange = Math.abs(end.price - start.price);
    const currentRetracement = direction === 'up'
      ? (end.price - currentPrice) / priceRange
      : (currentPrice - end.price) / priceRange;
    
    const proposal: ProposalData = {
      id: generateProposalId(`fib_${direction}`),
      type: 'fibonacci',
      title: `${direction === 'up' ? '上昇' : '下降'}フィボナッチリトレースメント`,
      description: this.generateDescription(start, end, currentRetracement),
      reason: this.generateReason(pair, data, currentRetracement, params),
      drawingData: validateDrawingData({
        type: 'fibonacci',
        points: [
          { time: start.time, value: start.price },
          { time: end.time, value: end.price },
        ],
        levels: ANALYSIS_PARAMS.FIBONACCI_LEVELS,
        style: {
          color: COLOR_PALETTE.FIBONACCI.RETRACEMENT,
          lineWidth: 1,
          lineStyle: 'dashed',
          showLabels: true,
        },
      }),
      confidence,
      priority: this.calculatePriority(confidence, pair, currentRetracement),
      createdAt: Date.now(),
      symbol: params.symbol,
      interval: params.interval,
      metadata: {
        direction,
        swingStrength: (start.strength + end.strength) / 2,
        priceChange: calculatePriceChangePercent(start.price, end.price),
        currentRetracement,
        nearestLevel: this.findNearestFibLevel(currentRetracement),
      },
    };
    
    return proposal;
  }

  /**
   * 説明文の生成
   */
  private generateDescription(
    start: SwingPoint,
    end: SwingPoint,
    currentRetracement: number
  ): string {
    const priceChange = calculatePriceChangePercent(start.price, end.price);
    const direction = start.price < end.price ? '上昇' : '下降';
    
    return `${start.price.toFixed(2)}から${end.price.toFixed(2)}への${direction} (${Math.abs(priceChange).toFixed(1)}%)`;
  }

  /**
   * 理由文の生成
   */
  private generateReason(
    pair: { point1: PeakTroughPoint; point2: PeakTroughPoint; isUptrend: boolean },
    data: CandlestickData[],
    currentRetracement: number,
    params: GeneratorParams
  ): string {
    const { start, end, direction } = pair;
    const timeSpan = end.index - start.index;
    const priceChange = calculatePriceChangePercent(start.price, end.price);
    
    let reason = `過去${timeSpan}本のローソク足で${Math.abs(priceChange).toFixed(2)}%の${direction === 'up' ? '上昇' : '下降'}を検出。`;
    
    // 現在のリトレースメント状況
    const nearestLevel = this.findNearestFibLevel(currentRetracement);
    if (nearestLevel) {
      reason += `現在は${(nearestLevel * 100).toFixed(1)}%のリトレースメントレベル付近にあります。`;
    }
    
    reason += `主要なリトレースメントレベルが今後の${direction === 'up' ? 'サポート' : 'レジスタンス'}として機能する可能性があります。`;
    
    // スイングの強度
    if (start.strength > 0.7 || end.strength > 0.7) {
      reason += `明確なスイングポイントが確認されており、信頼性の高いフィボナッチレベルです。`;
    }
    
    return reason;
  }

  /**
   * 最も近いフィボナッチレベルを検索
   */
  private findNearestFibLevel(retracement: number): number | null {
    const levels = ANALYSIS_PARAMS.FIBONACCI_LEVELS;
    let nearest = null;
    let minDistance = Infinity;
    
    for (const level of levels) {
      const distance = Math.abs(retracement - level);
      if (distance < minDistance && distance < 0.05) {
        minDistance = distance;
        nearest = level;
      }
    }
    
    return nearest;
  }

  /**
   * 優先度の計算
   */
  private calculatePriority(
    confidence: number,
    pair: { point1: PeakTroughPoint; point2: PeakTroughPoint; isUptrend: boolean },
    currentRetracement: number
  ): 'high' | 'medium' | 'low' {
    // 主要なフィボナッチレベル付近
    const isNearMajorLevel = [0.382, 0.5, 0.618].some(
      level => Math.abs(currentRetracement - level) < 0.02
    );
    
    if (
      confidence >= THRESHOLDS.HIGH_CONFIDENCE &&
      pair.score > 0.7 &&
      isNearMajorLevel
    ) {
      return 'high';
    }
    
    if (
      confidence >= THRESHOLDS.MIN_CONFIDENCE &&
      pair.score > 0.5
    ) {
      return 'medium';
    }
    
    return 'low';
  }
}