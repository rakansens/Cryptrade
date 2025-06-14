/**
 * Support/Resistance Generator
 * 
 * サポート・レジスタンスライン提案を生成する専用モジュール
 * 価格レベルのクラスタリング、タッチポイント分析を含む
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { ProposalData } from '@/types/proposal-generator.types';
// DrawingProposal type is not used directly due to mismatch
import type { 
  IProposalGenerator, 
  GeneratorParams,
  ProposalGroup
} from '../types';
import { 
  ANALYSIS_PARAMS, 
  COLOR_PALETTE,
  MESSAGE_TEMPLATES,
  THRESHOLDS,
  TIME_CONSTANTS
} from '../utils/constants';
import { calculateSupportResistanceConfidence } from '../analyzers/confidence-calculator';
import { validateDrawingData } from '../validators/drawing-validator';
import { generateProposalId, calculatePercentile, unique } from '../utils/helpers';

interface PriceLevel {
  price: number;
  touches: Array<{
    time: number;
    value: number;
    volume: number;
    type: 'support' | 'resistance' | 'both';
  }>;
  strength: number;
  type: 'support' | 'resistance' | 'both';
}

export class SupportResistanceGenerator implements IProposalGenerator {
  readonly name = 'SupportResistanceGenerator';
  readonly analysisType = 'support-resistance' as const;

  async generate(
    data: CandlestickData[],
    params: GeneratorParams
  ): Promise<ProposalGroup['proposals']> {
    logger.info('[SupportResistanceGenerator] Starting S/R generation', {
      dataLength: data.length,
      symbol: params.symbol,
      interval: params.interval,
    });

    const proposals: ProposalData[] = [];
    
    // 1. 価格レベルの検出
    const priceLevels = this.detectPriceLevels(data);
    
    // 2. レベルのクラスタリング
    const clusteredLevels = this.clusterPriceLevels(priceLevels, data);
    
    // 3. 強度でソート
    const sortedLevels = clusteredLevels
      .sort((a, b) => b.strength - a.strength)
      .slice(0, params.maxProposals * 2); // 多めに取得

    // 4. 各レベルから提案を生成
    for (const level of sortedLevels) {
      const proposal = this.createProposal(level, data, params);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    // 5. 最終的な選択
    const finalProposals = proposals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, params.maxProposals);

    logger.info('[SupportResistanceGenerator] S/R generation completed', {
      totalLevels: priceLevels.length,
      clusteredLevels: clusteredLevels.length,
      finalProposals: finalProposals.length,
    });

    return finalProposals;
  }

  /**
   * 価格レベルの検出
   */
  private detectPriceLevels(data: CandlestickData[]): PriceLevel[] {
    const levels: PriceLevel[] = [];
    const pricePoints: number[] = [];
    
    // 高値・安値を収集
    for (let i = 0; i < data.length; i++) {
      pricePoints.push(data[i].high, data[i].low);
    }
    
    // 価格のヒストグラムを作成
    const priceHistogram = this.createPriceHistogram(pricePoints, 100);
    
    // ピークを検出
    const peaks = this.findHistogramPeaks(priceHistogram);
    
    // 各ピークに対してレベルを作成
    for (const peak of peaks) {
      const touches = this.findTouchPoints(data, peak.price);
      
      if (touches.length >= 2) {
        levels.push({
          price: peak.price,
          touches,
          strength: peak.count / data.length,
          type: this.determineLevelType(touches),
        });
      }
    }
    
    return levels;
  }

  /**
   * 価格ヒストグラムの作成
   */
  private createPriceHistogram(
    prices: number[],
    bins: number
  ): Array<{ price: number; count: number }> {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const binSize = (max - min) / bins;
    
    const histogram: Map<number, number> = new Map();
    
    for (const price of prices) {
      const binIndex = Math.floor((price - min) / binSize);
      const binPrice = min + binIndex * binSize + binSize / 2;
      histogram.set(binPrice, (histogram.get(binPrice) || 0) + 1);
    }
    
    return Array.from(histogram.entries())
      .map(([price, count]) => ({ price, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * ヒストグラムのピーク検出
   */
  private findHistogramPeaks(
    histogram: Array<{ price: number; count: number }>
  ): Array<{ price: number; count: number }> {
    const threshold = calculatePercentile(histogram.map(h => h.count), 70);
    return histogram.filter(h => h.count >= threshold);
  }

  /**
   * タッチポイントの検出
   */
  private findTouchPoints(
    data: CandlestickData[],
    level: number
  ): PriceLevel['touches'] {
    const touches: PriceLevel['touches'] = [];
    const tolerance = level * ANALYSIS_PARAMS.SUPPORT_RESISTANCE_TOLERANCE;
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      let touchType: 'support' | 'resistance' | 'both' | null = null;
      
      // サポートとしてのタッチ
      if (Math.abs(candle.low - level) <= tolerance) {
        if (candle.close > candle.open) {
          touchType = 'support';
        }
      }
      
      // レジスタンスとしてのタッチ
      if (Math.abs(candle.high - level) <= tolerance) {
        if (candle.close < candle.open) {
          touchType = touchType === 'support' ? 'both' : 'resistance';
        }
      }
      
      if (touchType) {
        touches.push({
          time: candle.time,
          value: level,
          volume: candle.volume,
          type: touchType,
        });
      }
    }
    
    return touches;
  }

  /**
   * レベルタイプの判定
   */
  private determineLevelType(
    touches: PriceLevel['touches']
  ): 'support' | 'resistance' | 'both' {
    const supportCount = touches.filter(t => t.type === 'support' || t.type === 'both').length;
    const resistanceCount = touches.filter(t => t.type === 'resistance' || t.type === 'both').length;
    
    if (supportCount > resistanceCount * 2) return 'support';
    if (resistanceCount > supportCount * 2) return 'resistance';
    return 'both';
  }

  /**
   * 価格レベルのクラスタリング
   */
  private clusterPriceLevels(
    levels: PriceLevel[],
    data: CandlestickData[]
  ): PriceLevel[] {
    if (levels.length === 0) return [];
    
    const clustered: PriceLevel[] = [];
    const used = new Set<number>();
    const avgPrice = data[data.length - 1].close;
    const clusterThreshold = avgPrice * 0.005; // 0.5%
    
    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;
      
      const cluster: PriceLevel[] = [levels[i]];
      used.add(i);
      
      // 近接レベルをクラスタに追加
      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;
        
        if (Math.abs(levels[j].price - levels[i].price) <= clusterThreshold) {
          cluster.push(levels[j]);
          used.add(j);
        }
      }
      
      // クラスタを統合
      if (cluster.length > 0) {
        clustered.push(this.mergeCluster(cluster));
      }
    }
    
    return clustered;
  }

  /**
   * クラスタの統合
   */
  private mergeCluster(cluster: PriceLevel[]): PriceLevel {
    // 加重平均価格
    const totalTouches = cluster.reduce((sum, level) => sum + level.touches.length, 0);
    const weightedPrice = cluster.reduce((sum, level) => 
      sum + level.price * level.touches.length, 0
    ) / totalTouches;
    
    // 全タッチポイントを統合
    const allTouches = cluster.flatMap(level => level.touches);
    
    // タイプの再判定
    const type = this.determineLevelType(allTouches);
    
    // 強度の計算
    const strength = Math.min(1, allTouches.length / 10);
    
    return {
      price: weightedPrice,
      touches: unique(allTouches, t => `${t.time}_${t.value}`),
      strength,
      type,
    };
  }

  /**
   * 提案の作成
   */
  private createProposal(
    level: PriceLevel,
    data: CandlestickData[],
    params: GeneratorParams
  ): ProposalData | null {
    // 信頼度計算
    const confidence = calculateSupportResistanceConfidence(
      level.price,
      level.touches,
      data
    );
    
    if (confidence < THRESHOLDS.MIN_CONFIDENCE) {
      return null;
    }
    
    const currentPrice = data[data.length - 1].close;
    const distance = Math.abs(currentPrice - level.price) / currentPrice;
    const isNearby = distance < 0.05; // 5%以内
    
    // 強度の文字列化
    let strengthText = '弱い';
    if (level.strength > 0.7) strengthText = '非常に強い';
    else if (level.strength > 0.5) strengthText = '強い';
    else if (level.strength > 0.3) strengthText = '中程度の';
    
    const proposal: ProposalData = {
      id: generateProposalId(`sr_${level.type}`),
      type: 'horizontal',
      title: MESSAGE_TEMPLATES.SUPPORT_RESISTANCE.TITLE(
        level.type === 'both' ? 'support/resistance' : level.type,
        level.price
      ),
      description: MESSAGE_TEMPLATES.SUPPORT_RESISTANCE.DESCRIPTION(
        level.touches.length,
        strengthText
      ),
      reason: this.generateReason(level, data, params),
      drawingData: validateDrawingData({
        type: 'horizontal',
        price: level.price,
        points: [{
          time: data[0].time,
          value: level.price,
        }],
        style: {
          color: this.getLineColor(level.type),
          lineWidth: Math.min(3, 1 + level.strength * 2),
          lineStyle: level.type === 'both' ? 'dashed' : 'solid',
        },
      }),
      confidence,
      priority: this.calculatePriority(confidence, level, isNearby),
      createdAt: Date.now(),
      symbol: params.symbol,
      interval: params.interval,
      metadata: {
        levelType: level.type,
        touches: level.touches.length,
        strength: level.strength,
        distanceFromPrice: distance,
        volumeAnalysis: this.analyzeVolumeAtLevel(level, data),
      },
    };
    
    return proposal;
  }

  /**
   * 理由文の生成
   */
  private generateReason(
    level: PriceLevel,
    data: CandlestickData[],
    params: GeneratorParams
  ): string {
    const currentPrice = data[data.length - 1].close;
    const position = currentPrice > level.price ? '下' : '上';
    const distance = Math.abs(currentPrice - level.price) / currentPrice * 100;
    
    let reason = `${level.price.toFixed(2)}のレベルは過去に${level.touches.length}回テストされています。`;
    
    if (level.type === 'support') {
      reason += `このレベルは強力なサポートとして機能しており、価格が下落した際の反発点となる可能性があります。`;
    } else if (level.type === 'resistance') {
      reason += `このレベルは強力なレジスタンスとして機能しており、価格が上昇した際の反落点となる可能性があります。`;
    } else {
      reason += `このレベルはサポートとレジスタンスの両方として機能しており、重要な価格帯です。`;
    }
    
    reason += `現在価格から${distance.toFixed(1)}%${position}に位置しています。`;
    
    // 最近のタッチ
    const recentTouches = level.touches.filter(t => {
      const index = data.findIndex(d => d.time === t.time);
      return data.length - index <= TIME_CONSTANTS.RECENT_CANDLES;
    });
    
    if (recentTouches.length > 0) {
      reason += `最近もこのレベルでの反応が確認されています。`;
    }
    
    return reason;
  }

  /**
   * 線の色を取得
   */
  private getLineColor(type: 'support' | 'resistance' | 'both'): string {
    switch (type) {
      case 'support':
        return COLOR_PALETTE.SUPPORT_RESISTANCE.SUPPORT;
      case 'resistance':
        return COLOR_PALETTE.SUPPORT_RESISTANCE.RESISTANCE;
      case 'both':
        return COLOR_PALETTE.SUPPORT_RESISTANCE.ZONE;
    }
  }

  /**
   * 優先度の計算
   */
  private calculatePriority(
    confidence: number,
    level: PriceLevel,
    isNearby: boolean
  ): 'high' | 'medium' | 'low' {
    if (
      confidence >= THRESHOLDS.HIGH_CONFIDENCE &&
      level.touches.length >= 5 &&
      isNearby
    ) {
      return 'high';
    }
    
    if (
      confidence >= THRESHOLDS.MIN_CONFIDENCE &&
      level.touches.length >= 3
    ) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * レベルでのボリューム分析
   */
  private analyzeVolumeAtLevel(
    level: PriceLevel,
    data: CandlestickData[]
  ): {
    averageVolume: number;
    volumeRatio: number;
    highVolumeCount: number;
  } {
    const touchVolumes = level.touches.map(t => t.volume);
    const avgTouchVolume = touchVolumes.reduce((sum, v) => sum + v, 0) / touchVolumes.length;
    const overallAvgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    const highVolumeCount = touchVolumes.filter(v => v > overallAvgVolume * 1.5).length;
    
    return {
      averageVolume: avgTouchVolume,
      volumeRatio: avgTouchVolume / overallAvgVolume,
      highVolumeCount,
    };
  }
}