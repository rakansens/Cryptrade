/**
 * Pattern Generator
 * 
 * チャートパターン提案を生成する専用モジュール
 * ヘッドアンドショルダー、ダブルトップ/ボトム、トライアングルなどを検出
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { ProposalData } from '@/types/proposal-generator.types';
// DrawingProposal type is not used directly due to mismatch
import type { 
  IProposalGenerator, 
  GeneratorParams,
  ProposalGroup,
  DetectedPattern
} from '../types';
import { 
  ANALYSIS_PARAMS, 
  COLOR_PALETTE,
  THRESHOLDS
} from '../utils/constants';
import { validateDrawingData } from '../validators/drawing-validator';
import { generateProposalId, calculateStandardDeviation } from '../utils/helpers';
import { detectCandlePatterns } from '../analyzers/market-analyzer';

export class PatternGenerator implements IProposalGenerator {
  readonly name = 'PatternGenerator';
  readonly analysisType = 'pattern' as const;

  async generate(
    data: CandlestickData[],
    params: GeneratorParams
  ): Promise<ProposalGroup['proposals']> {
    logger.info('[PatternGenerator] Starting pattern generation', {
      dataLength: data.length,
      symbol: params.symbol,
      interval: params.interval,
    });

    const proposals: ProposalData[] = [];
    
    // 各種パターンの検出
    const patterns: DetectedPattern[] = [
      ...this.detectDoubleTopBottom(data),
      ...this.detectHeadAndShoulders(data),
      ...this.detectTriangles(data),
      ...this.detectChannels(data),
    ];

    // 信頼度でフィルタリング
    const validPatterns = patterns.filter(
      p => p.confidence >= ANALYSIS_PARAMS.PATTERN_MIN_CONFIDENCE
    );

    // 各パターンから提案を生成
    for (const pattern of validPatterns) {
      const proposal = this.createProposal(pattern, data, params);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    // 最終的な選択
    const finalProposals = proposals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, params.maxProposals);

    logger.info('[PatternGenerator] Pattern generation completed', {
      detectedPatterns: patterns.length,
      validPatterns: validPatterns.length,
      finalProposals: finalProposals.length,
    });

    return finalProposals;
  }

  /**
   * ダブルトップ/ボトムの検出
   */
  private detectDoubleTopBottom(data: CandlestickData[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const window = 20;
    const tolerance = 0.02; // 2%

    for (let i = window * 2; i < data.length - window; i++) {
      // ダブルトップの検出
      const topPattern = this.checkDoubleTop(data, i, window, tolerance);
      if (topPattern) patterns.push(topPattern);

      // ダブルボトムの検出
      const bottomPattern = this.checkDoubleBottom(data, i, window, tolerance);
      if (bottomPattern) patterns.push(bottomPattern);
    }

    return patterns;
  }

  /**
   * ダブルトップのチェック
   */
  private checkDoubleTop(
    data: CandlestickData[],
    centerIndex: number,
    window: number,
    tolerance: number
  ): DetectedPattern | null {
    // 最初のピークを探す
    const firstPeakIndex = this.findLocalPeak(
      data,
      centerIndex - window,
      centerIndex,
      'high'
    );
    if (!firstPeakIndex) return null;

    // 2番目のピークを探す
    const secondPeakIndex = this.findLocalPeak(
      data,
      centerIndex,
      centerIndex + window,
      'high'
    );
    if (!secondPeakIndex) return null;

    const firstPeak = data[firstPeakIndex].high;
    const secondPeak = data[secondPeakIndex].high;

    // ピークの高さが近似しているかチェック
    if (Math.abs(firstPeak - secondPeak) / firstPeak > tolerance) return null;

    // ネックラインを見つける
    const necklineIndex = this.findLocalPeak(
      data,
      firstPeakIndex,
      secondPeakIndex,
      'low'
    );
    if (!necklineIndex) return null;

    const neckline = data[necklineIndex].low;
    const avgPeak = (firstPeak + secondPeak) / 2;
    const patternHeight = avgPeak - neckline;

    // パターンの妥当性チェック
    if (patternHeight / avgPeak < 0.03) return null; // 最小3%の高さ

    const confidence = this.calculatePatternConfidence(
      data,
      [firstPeakIndex, necklineIndex, secondPeakIndex],
      'double_top'
    );

    return {
      type: 'double_top',
      confidence,
      startIndex: firstPeakIndex,
      endIndex: secondPeakIndex,
      keyPoints: [
        { time: data[firstPeakIndex].time, value: firstPeak },
        { time: data[necklineIndex].time, value: neckline },
        { time: data[secondPeakIndex].time, value: secondPeak },
      ],
      implication: 'bearish',
    };
  }

  /**
   * ダブルボトムのチェック
   */
  private checkDoubleBottom(
    data: CandlestickData[],
    centerIndex: number,
    window: number,
    tolerance: number
  ): DetectedPattern | null {
    // 最初の谷を探す
    const firstTroughIndex = this.findLocalPeak(
      data,
      centerIndex - window,
      centerIndex,
      'low'
    );
    if (!firstTroughIndex) return null;

    // 2番目の谷を探す
    const secondTroughIndex = this.findLocalPeak(
      data,
      centerIndex,
      centerIndex + window,
      'low'
    );
    if (!secondTroughIndex) return null;

    const firstTrough = data[firstTroughIndex].low;
    const secondTrough = data[secondTroughIndex].low;

    // 谷の深さが近似しているかチェック
    if (Math.abs(firstTrough - secondTrough) / firstTrough > tolerance) return null;

    // ネックラインを見つける
    const necklineIndex = this.findLocalPeak(
      data,
      firstTroughIndex,
      secondTroughIndex,
      'high'
    );
    if (!necklineIndex) return null;

    const neckline = data[necklineIndex].high;
    const avgTrough = (firstTrough + secondTrough) / 2;
    const patternHeight = neckline - avgTrough;

    // パターンの妥当性チェック
    if (patternHeight / avgTrough < 0.03) return null; // 最小3%の高さ

    const confidence = this.calculatePatternConfidence(
      data,
      [firstTroughIndex, necklineIndex, secondTroughIndex],
      'double_bottom'
    );

    return {
      type: 'double_bottom',
      confidence,
      startIndex: firstTroughIndex,
      endIndex: secondTroughIndex,
      keyPoints: [
        { time: data[firstTroughIndex].time, value: firstTrough },
        { time: data[necklineIndex].time, value: neckline },
        { time: data[secondTroughIndex].time, value: secondTrough },
      ],
      implication: 'bullish',
    };
  }

  /**
   * ヘッドアンドショルダーの検出
   */
  private detectHeadAndShoulders(data: CandlestickData[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const window = 15;

    for (let i = window * 3; i < data.length - window; i++) {
      // 通常のヘッドアンドショルダー
      const hsPattern = this.checkHeadAndShoulders(data, i, window, false);
      if (hsPattern) patterns.push(hsPattern);

      // 逆ヘッドアンドショルダー
      const ihsPattern = this.checkHeadAndShoulders(data, i, window, true);
      if (ihsPattern) patterns.push(ihsPattern);
    }

    return patterns;
  }

  /**
   * ヘッドアンドショルダーのチェック
   */
  private checkHeadAndShoulders(
    data: CandlestickData[],
    centerIndex: number,
    window: number,
    inverse: boolean
  ): DetectedPattern | null {
    const priceType = inverse ? 'low' : 'high';
    const oppositeType = inverse ? 'high' : 'low';

    // 左肩を探す
    const leftShoulderIndex = this.findLocalPeak(
      data,
      centerIndex - window * 2,
      centerIndex - window,
      priceType
    );
    if (!leftShoulderIndex) return null;

    // 頭を探す
    const headIndex = this.findLocalPeak(
      data,
      centerIndex - window / 2,
      centerIndex + window / 2,
      priceType
    );
    if (!headIndex) return null;

    // 右肩を探す
    const rightShoulderIndex = this.findLocalPeak(
      data,
      centerIndex + window,
      centerIndex + window * 2,
      priceType
    );
    if (!rightShoulderIndex) return null;

    const leftShoulder = data[leftShoulderIndex][priceType];
    const head = data[headIndex][priceType];
    const rightShoulder = data[rightShoulderIndex][priceType];

    // パターンの妥当性チェック
    if (inverse) {
      if (head >= leftShoulder || head >= rightShoulder) return null;
      if (Math.abs(leftShoulder - rightShoulder) / leftShoulder > 0.02) return null;
    } else {
      if (head <= leftShoulder || head <= rightShoulder) return null;
      if (Math.abs(leftShoulder - rightShoulder) / leftShoulder > 0.02) return null;
    }

    const confidence = this.calculatePatternConfidence(
      data,
      [leftShoulderIndex, headIndex, rightShoulderIndex],
      inverse ? 'inverse_head_shoulders' : 'head_shoulders'
    );

    return {
      type: inverse ? 'inverse_head_shoulders' : 'head_shoulders',
      confidence,
      startIndex: leftShoulderIndex,
      endIndex: rightShoulderIndex,
      keyPoints: [
        { time: data[leftShoulderIndex].time, value: leftShoulder },
        { time: data[headIndex].time, value: head },
        { time: data[rightShoulderIndex].time, value: rightShoulder },
      ],
      implication: inverse ? 'bullish' : 'bearish',
    };
  }

  /**
   * トライアングルパターンの検出
   */
  private detectTriangles(data: CandlestickData[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const minLength = 20;
    const maxLength = 60;

    for (let length = minLength; length <= maxLength; length += 10) {
      for (let i = length; i < data.length; i++) {
        const segment = data.slice(i - length, i);
        
        // 対称トライアングル
        const symmetricTriangle = this.checkSymmetricTriangle(segment, i - length);
        if (symmetricTriangle) patterns.push(symmetricTriangle);

        // 上昇トライアングル
        const ascendingTriangle = this.checkAscendingTriangle(segment, i - length);
        if (ascendingTriangle) patterns.push(ascendingTriangle);

        // 下降トライアングル
        const descendingTriangle = this.checkDescendingTriangle(segment, i - length);
        if (descendingTriangle) patterns.push(descendingTriangle);
      }
    }

    return patterns;
  }

  /**
   * 対称トライアングルのチェック
   */
  private checkSymmetricTriangle(
    segment: CandlestickData[],
    startIndex: number
  ): DetectedPattern | null {
    const highs = segment.map(d => d.high);
    const lows = segment.map(d => d.low);

    // 高値と安値のトレンドラインを計算
    const highTrend = this.calculateTrendline(highs);
    const lowTrend = this.calculateTrendline(lows);

    // 収束しているかチェック
    if (highTrend.slope >= 0 || lowTrend.slope <= 0) return null;
    if (Math.abs(highTrend.slope) < 0.001 || Math.abs(lowTrend.slope) < 0.001) return null;

    // 収束点を計算
    const convergencePoint = this.calculateConvergencePoint(
      highTrend,
      lowTrend,
      segment.length
    );

    if (!convergencePoint || convergencePoint < segment.length * 0.8) return null;

    const confidence = 0.7; // 簡略化

    return {
      type: 'symmetric_triangle',
      confidence,
      startIndex,
      endIndex: startIndex + segment.length - 1,
      keyPoints: [
        { time: segment[0].time, value: segment[0].high },
        { time: segment[segment.length - 1].time, value: segment[segment.length - 1].low },
      ],
      implication: 'neutral',
    };
  }

  /**
   * 上昇トライアングルのチェック
   */
  private checkAscendingTriangle(
    segment: CandlestickData[],
    startIndex: number
  ): DetectedPattern | null {
    const highs = segment.map(d => d.high);
    const lows = segment.map(d => d.low);

    // 高値が水平かチェック
    const highStd = calculateStandardDeviation(highs);
    const avgHigh = highs.reduce((a, b) => a + b, 0) / highs.length;
    
    if (highStd / avgHigh > 0.01) return null; // 1%以上の変動は水平でない

    // 安値が上昇トレンドかチェック
    const lowTrend = this.calculateTrendline(lows);
    if (lowTrend.slope <= 0 || lowTrend.r2 < 0.7) return null;

    const confidence = 0.75;

    return {
      type: 'ascending_triangle',
      confidence,
      startIndex,
      endIndex: startIndex + segment.length - 1,
      keyPoints: [
        { time: segment[0].time, value: avgHigh },
        { time: segment[0].time, value: segment[0].low },
        { time: segment[segment.length - 1].time, value: segment[segment.length - 1].low },
      ],
      implication: 'bullish',
    };
  }

  /**
   * 下降トライアングルのチェック
   */
  private checkDescendingTriangle(
    segment: CandlestickData[],
    startIndex: number
  ): DetectedPattern | null {
    const highs = segment.map(d => d.high);
    const lows = segment.map(d => d.low);

    // 安値が水平かチェック
    const lowStd = calculateStandardDeviation(lows);
    const avgLow = lows.reduce((a, b) => a + b, 0) / lows.length;
    
    if (lowStd / avgLow > 0.01) return null; // 1%以上の変動は水平でない

    // 高値が下降トレンドかチェック
    const highTrend = this.calculateTrendline(highs);
    if (highTrend.slope >= 0 || highTrend.r2 < 0.7) return null;

    const confidence = 0.75;

    return {
      type: 'descending_triangle',
      confidence,
      startIndex,
      endIndex: startIndex + segment.length - 1,
      keyPoints: [
        { time: segment[0].time, value: segment[0].high },
        { time: segment[segment.length - 1].time, value: segment[segment.length - 1].high },
        { time: segment[0].time, value: avgLow },
      ],
      implication: 'bearish',
    };
  }

  /**
   * チャネルパターンの検出
   */
  private detectChannels(data: CandlestickData[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const minLength = 30;

    for (let i = minLength; i < data.length; i++) {
      const segment = data.slice(i - minLength, i);
      
      // 上昇チャネル
      const upChannel = this.checkChannel(segment, i - minLength, 'up');
      if (upChannel) patterns.push(upChannel);

      // 下降チャネル
      const downChannel = this.checkChannel(segment, i - minLength, 'down');
      if (downChannel) patterns.push(downChannel);
    }

    return patterns;
  }

  /**
   * チャネルのチェック
   */
  private checkChannel(
    segment: CandlestickData[],
    startIndex: number,
    direction: 'up' | 'down'
  ): DetectedPattern | null {
    const highs = segment.map(d => d.high);
    const lows = segment.map(d => d.low);

    const highTrend = this.calculateTrendline(highs);
    const lowTrend = this.calculateTrendline(lows);

    // 平行性チェック
    const slopeDiff = Math.abs(highTrend.slope - lowTrend.slope);
    const avgSlope = Math.abs(highTrend.slope + lowTrend.slope) / 2;
    
    if (avgSlope === 0 || slopeDiff / avgSlope > 0.2) return null;

    // 方向性チェック
    if (direction === 'up' && highTrend.slope <= 0) return null;
    if (direction === 'down' && highTrend.slope >= 0) return null;

    // フィット度チェック
    if (highTrend.r2 < 0.8 || lowTrend.r2 < 0.8) return null;

    const confidence = (highTrend.r2 + lowTrend.r2) / 2;

    return {
      type: direction === 'up' ? 'ascending_channel' : 'descending_channel',
      confidence,
      startIndex,
      endIndex: startIndex + segment.length - 1,
      keyPoints: [
        { time: segment[0].time, value: segment[0].high },
        { time: segment[segment.length - 1].time, value: segment[segment.length - 1].high },
        { time: segment[0].time, value: segment[0].low },
        { time: segment[segment.length - 1].time, value: segment[segment.length - 1].low },
      ],
      implication: direction === 'up' ? 'bullish' : 'bearish',
    };
  }

  /**
   * ローカルピークの検索
   */
  private findLocalPeak(
    data: CandlestickData[],
    startIdx: number,
    endIdx: number,
    type: 'high' | 'low'
  ): number | null {
    let peakIndex = null;
    let peakValue = type === 'high' ? -Infinity : Infinity;

    for (let i = Math.max(0, startIdx); i <= Math.min(data.length - 1, endIdx); i++) {
      const value = data[i][type];
      if (type === 'high' && value > peakValue) {
        peakValue = value;
        peakIndex = i;
      } else if (type === 'low' && value < peakValue) {
        peakValue = value;
        peakIndex = i;
      }
    }

    return peakIndex;
  }

  /**
   * トレンドラインの計算
   */
  private calculateTrendline(values: number[]): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R二乗値
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => {
      const yPred = slope * i + intercept;
      return sum + Math.pow(y - yPred, 2);
    }, 0);

    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { slope, intercept, r2 };
  }

  /**
   * 収束点の計算
   */
  private calculateConvergencePoint(
    line1: { slope: number; intercept: number },
    line2: { slope: number; intercept: number },
    currentLength: number
  ): number | null {
    if (line1.slope === line2.slope) return null;

    const x = (line2.intercept - line1.intercept) / (line1.slope - line2.slope);
    return x;
  }

  /**
   * パターンの信頼度計算
   */
  private calculatePatternConfidence(
    data: CandlestickData[],
    keyIndices: number[],
    patternType: string
  ): number {
    let confidence = 0.6; // 基本信頼度

    // ボリューム確認
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    const keyVolumes = keyIndices.map(i => data[i].volume);
    const avgKeyVolume = keyVolumes.reduce((a, b) => a + b, 0) / keyVolumes.length;

    if (avgKeyVolume > avgVolume * 1.5) confidence += 0.1;

    // パターンの完全性
    const patternCompleteness = this.checkPatternCompleteness(
      data,
      keyIndices,
      patternType
    );
    confidence += patternCompleteness * 0.2;

    // キャンドルパターンの確認
    for (const idx of keyIndices) {
      const candlePatterns = detectCandlePatterns(data, idx);
      if (candlePatterns.length > 0) confidence += 0.05;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * パターンの完全性チェック
   */
  private checkPatternCompleteness(
    data: CandlestickData[],
    keyIndices: number[],
    patternType: string
  ): number {
    // 簡略化された実装
    return 0.8;
  }

  /**
   * 提案の作成
   */
  private createProposal(
    pattern: DetectedPattern,
    data: CandlestickData[],
    params: GeneratorParams
  ): ProposalData | null {
    const patternInfo = this.getPatternInfo(pattern.type);
    
    const proposal: ProposalData = {
      id: generateProposalId(`pattern_${pattern.type}`),
      type: 'pattern',
      title: patternInfo.title,
      description: patternInfo.description,
      reason: this.generateReason(pattern, data, params),
      drawingData: validateDrawingData({
        type: 'pattern',
        points: pattern.keyPoints,
        style: {
          color: COLOR_PALETTE.PATTERN[pattern.implication.toUpperCase() as keyof typeof COLOR_PALETTE.PATTERN],
          lineWidth: 2,
          lineStyle: 'solid',
        },
      }),
      confidence: pattern.confidence,
      priority: this.calculatePriority(pattern),
      createdAt: Date.now(),
      symbol: params.symbol,
      interval: params.interval,
      metadata: {
        patternType: pattern.type,
        implication: pattern.implication,
        keyPoints: pattern.keyPoints,
        duration: pattern.endIndex - pattern.startIndex,
      },
    };

    return proposal;
  }

  /**
   * パターン情報の取得
   */
  private getPatternInfo(type: string): {
    title: string;
    description: string;
  } {
    const patterns: Record<string, { title: string; description: string }> = {
      double_top: {
        title: 'ダブルトップ',
        description: '反転の可能性を示唆する弱気パターン',
      },
      double_bottom: {
        title: 'ダブルボトム',
        description: '反転の可能性を示唆する強気パターン',
      },
      head_shoulders: {
        title: 'ヘッドアンドショルダー',
        description: '強力な反転を示唆する弱気パターン',
      },
      inverse_head_shoulders: {
        title: '逆ヘッドアンドショルダー',
        description: '強力な反転を示唆する強気パターン',
      },
      symmetric_triangle: {
        title: '対称トライアングル',
        description: 'ブレイクアウトを待つ継続パターン',
      },
      ascending_triangle: {
        title: '上昇トライアングル',
        description: '上方ブレイクの可能性が高い強気パターン',
      },
      descending_triangle: {
        title: '下降トライアングル',
        description: '下方ブレイクの可能性が高い弱気パターン',
      },
      ascending_channel: {
        title: '上昇チャネル',
        description: '上昇トレンドの継続を示唆',
      },
      descending_channel: {
        title: '下降チャネル',
        description: '下降トレンドの継続を示唆',
      },
    };

    return patterns[type] || {
      title: type,
      description: 'チャートパターン',
    };
  }

  /**
   * 理由文の生成
   */
  private generateReason(
    pattern: DetectedPattern,
    data: CandlestickData[],
    params: GeneratorParams
  ): string {
    const duration = pattern.endIndex - pattern.startIndex;
    const patternInfo = this.getPatternInfo(pattern.type);
    
    let reason = `${duration}本のローソク足にわたって${patternInfo.title}パターンが形成されています。`;
    
    switch (pattern.implication) {
      case 'bullish':
        reason += '上昇の可能性を示唆しており、買いシグナルとなる可能性があります。';
        break;
      case 'bearish':
        reason += '下降の可能性を示唆しており、売りシグナルとなる可能性があります。';
        break;
      case 'neutral':
        reason += 'ブレイクアウトの方向を見極める必要があります。';
        break;
    }
    
    if (pattern.confidence > 0.8) {
      reason += '高い信頼度で検出されたパターンです。';
    }
    
    return reason;
  }

  /**
   * 優先度の計算
   */
  private calculatePriority(pattern: DetectedPattern): 'high' | 'medium' | 'low' {
    if (pattern.confidence >= 0.85) return 'high';
    if (pattern.confidence >= 0.75) return 'medium';
    return 'low';
  }
}