/**
 * Trendline Generator
 * 
 * トレンドライン提案を生成する専用モジュール
 * ピーク/トラフ検出、統計分析、信頼度計算を含む
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { ProposalData, ConfidenceResult, TrendlineCandidate } from '@/types/proposal-generator.types';
import type { 
  IProposalGenerator, 
  GeneratorParams,
  PeakTroughPoint,
  TrendlineCandidate,
  ProposalGroup,
  ConfidenceFactors
} from '../types';
import { 
  ANALYSIS_PARAMS, 
  SCORING_WEIGHTS,
  COLOR_PALETTE,
  MESSAGE_TEMPLATES,
  THRESHOLDS,
  TIME_CONSTANTS
} from '../utils/constants';
import { 
  calculateEnhancedConfidence,
  calculateTrendlineConfidence
} from '../analyzers/confidence-calculator';
import { validateDrawingData } from '../validators/drawing-validator';
import { generateProposalId, calculateStandardDeviation } from '../utils/helpers';

export class TrendlineGenerator implements IProposalGenerator {
  readonly name = 'TrendlineGenerator';
  readonly analysisType = 'trendline' as const;

  async generate(
    data: CandlestickData[],
    params: GeneratorParams
  ): Promise<ProposalGroup['proposals']> {
    logger.info('[TrendlineGenerator] Starting trendline generation', {
      dataLength: data.length,
      symbol: params.symbol,
      interval: params.interval,
    });

    try {
      const proposals: ProposalData[] = [];
      
      // 動的な許容誤差の計算
      const priceRange = Math.max(...data.map(d => d.high)) - Math.min(...data.map(d => d.low));
      const dynamicTolerance = priceRange * 0.0015;

    // ピーク/トラフの検出
    const peaks = this.findVolumeWeightedPeaks(data, 'high');
    const troughs = this.findVolumeWeightedPeaks(data, 'low');
    
    logger.info('[TrendlineGenerator] Peak/Trough detection results', {
      peaksCount: peaks.length,
      troughsCount: troughs.length,
      dataLength: data.length,
      firstPeak: peaks[0],
      firstTrough: troughs[0],
    });

    // 上昇トレンドライン生成
    const uptrendProposals = this.generateUptrendLines(
      data, 
      troughs, 
      dynamicTolerance, 
      params
    );
    proposals.push(...uptrendProposals);

    // 下降トレンドライン生成
    const downtrendProposals = this.generateDowntrendLines(
      data, 
      peaks, 
      dynamicTolerance, 
      params
    );
    proposals.push(...downtrendProposals);

    // maxProposalsに合わせて調整
    const sortedProposals = proposals
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, params.maxProposals);

    logger.info('[TrendlineGenerator] Trendline generation completed', {
      totalProposals: sortedProposals.length,
      uptrendCount: uptrendProposals.length,
      downtrendCount: downtrendProposals.length,
    });

    return sortedProposals;
    } catch (error) {
      logger.error('[TrendlineGenerator] Generation failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        dataLength: data?.length,
        params,
      });
      throw error;
    }
  }

  /**
   * ボリューム加重ピーク検出
   */
  private findVolumeWeightedPeaks(
    data: CandlestickData[],
    type: 'high' | 'low'
  ): PeakTroughPoint[] {
    const peaks: PeakTroughPoint[] = [];
    const window = ANALYSIS_PARAMS.PEAK_WINDOW_SIZE;
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    logger.debug('[TrendlineGenerator] findVolumeWeightedPeaks', {
      type,
      dataLength: data.length,
      windowSize: window,
      avgVolume,
    });

    for (let i = window; i < data.length - window; i++) {
      const currentValue = data[i][type];
      let isPeak = true;

      // ウィンドウ内で最高/最低値かチェック
      for (let j = i - window; j <= i + window; j++) {
        if (j !== i) {
          if (type === 'high' && data[j].high >= currentValue) isPeak = false;
          if (type === 'low' && data[j].low <= currentValue) isPeak = false;
        }
      }

      if (isPeak) {
        // ボリューム加重計算
        const volumeWeight = Math.min(data[i].volume / avgVolume, 3);
        
        peaks.push({
          index: i,
          time: data[i].time,
          value: currentValue,
          volumeWeight,
          type: type === 'high' ? 'peak' : 'trough',
        });
      }
    }

    return peaks;
  }

  /**
   * 上昇トレンドライン生成
   */
  private generateUptrendLines(
    data: CandlestickData[],
    troughs: PeakTroughPoint[],
    dynamicTolerance: number,
    params: GeneratorParams
  ): ProposalData[] {
    const proposals: ProposalData[] = [];

    if (troughs.length < ANALYSIS_PARAMS.TRENDLINE_MIN_POINTS) {
      logger.warn('[TrendlineGenerator] Not enough troughs for uptrend lines', {
        troughsCount: troughs.length,
        minRequired: ANALYSIS_PARAMS.TRENDLINE_MIN_POINTS,
      });
      return proposals;
    }

    // トレンドライン候補の評価
    const candidates = this.evaluateTrendlineCandidates(
      data,
      troughs,
      'uptrend'
    );

    // 上位候補から提案を生成
    for (const candidate of candidates) {
      const startPoint = data[candidate.start.index];
      const endPoint = data[candidate.end.index];

      // 線形回帰分析
      const regression = this.performLinearRegression(
        data,
        candidate.start.index,
        candidate.end.index,
        'low',
        dynamicTolerance
      );

      // 信頼度計算
      const confidenceResult = calculateTrendlineConfidence(
        data,
        [candidate.start, candidate.end],
        regression
      );

      // 拡張信頼度計算
      const factors: ConfidenceFactors = {
        baseConfidence: confidenceResult.confidence,
        touchPoints: confidenceResult.touches,
        volumeStrength: confidenceResult.volumeAnalysis.volumeRatio,
        timeSpan: candidate.end.index - candidate.start.index,
        recentActivity: (data.length - candidate.end.index) <= TIME_CONSTANTS.RECENT_CANDLES,
        patternAlignment: confidenceResult.patterns.length > 0,
        multiTimeframeConfirmation: params.multiTimeframeAnalysis?.alignment ?? false,
        rSquared: regression.r2,
        angle: Math.abs(regression.slope * 100),
      };

      const enhancedConfidence = calculateEnhancedConfidence(factors);

      // 提案作成
      const proposal: ProposalData = {
        id: generateProposalId('tl_up'),
        type: 'trendline',
        title: MESSAGE_TEMPLATES.TRENDLINE.TITLE('uptrend'),
        description: MESSAGE_TEMPLATES.TRENDLINE.DESCRIPTION(
          confidenceResult.touches,
          enhancedConfidence
        ),
        reason: this.generateReason(
          candidate,
          regression,
          confidenceResult,
          factors
        ),
        drawingData: validateDrawingData({
          type: 'trendline',
          points: [
            { time: startPoint.time, value: startPoint.low },
            { time: endPoint.time, value: endPoint.low },
          ],
          style: {
            color: COLOR_PALETTE.TRENDLINE.UPTREND,
            lineWidth: 2,
            lineStyle: 'solid',
          },
        }),
        confidence: enhancedConfidence,
        priority: this.calculatePriority(enhancedConfidence, factors),
        createdAt: Date.now(),
        symbol: params.symbol,
        interval: params.interval,
        touches: confidenceResult.touches,
        volumeAnalysis: confidenceResult.volumeAnalysis,
        patterns: confidenceResult.patterns,
        statistics: {
          points: candidate.end.index - candidate.start.index + 1,
          touches: confidenceResult.touches,
          outliers: 0,
          r_squared: regression.r2,
          angle: Math.abs(regression.slope * 100),
          duration_hours: this.calculateDurationHours(
            startPoint.time,
            endPoint.time,
            params.interval
          ),
          price_change_percent: ((endPoint.low - startPoint.low) / startPoint.low) * 100,
        },
      };

      proposals.push(proposal);
    }

    return proposals;
  }

  /**
   * 下降トレンドライン生成
   */
  private generateDowntrendLines(
    data: CandlestickData[],
    peaks: PeakTroughPoint[],
    dynamicTolerance: number,
    params: GeneratorParams
  ): ProposalData[] {
    const proposals: ProposalData[] = [];

    if (peaks.length < ANALYSIS_PARAMS.TRENDLINE_MIN_POINTS) {
      logger.warn('[TrendlineGenerator] Not enough peaks for downtrend lines', {
        peaksCount: peaks.length,
        minRequired: ANALYSIS_PARAMS.TRENDLINE_MIN_POINTS,
      });
      return proposals;
    }

    // トレンドライン候補の評価
    const candidates = this.evaluateTrendlineCandidates(
      data,
      peaks,
      'downtrend'
    );

    // 上位候補から提案を生成
    for (const candidate of candidates) {
      const startPoint = data[candidate.start.index];
      const endPoint = data[candidate.end.index];

      // 線形回帰分析
      const regression = this.performLinearRegression(
        data,
        candidate.start.index,
        candidate.end.index,
        'high',
        dynamicTolerance
      );

      // 信頼度計算
      const confidenceResult = calculateTrendlineConfidence(
        data,
        [candidate.start, candidate.end],
        regression
      );

      // 拡張信頼度計算
      const factors: ConfidenceFactors = {
        baseConfidence: confidenceResult.confidence,
        touchPoints: confidenceResult.touches,
        volumeStrength: confidenceResult.volumeAnalysis.volumeRatio,
        timeSpan: candidate.end.index - candidate.start.index,
        recentActivity: (data.length - candidate.end.index) <= TIME_CONSTANTS.RECENT_CANDLES,
        patternAlignment: confidenceResult.patterns.length > 0,
        multiTimeframeConfirmation: params.multiTimeframeAnalysis?.alignment ?? false,
        rSquared: regression.r2,
        angle: Math.abs(regression.slope * 100),
      };

      const enhancedConfidence = calculateEnhancedConfidence(factors);

      // 提案作成
      const proposal: ProposalData = {
        id: generateProposalId('tl_down'),
        type: 'trendline',
        title: MESSAGE_TEMPLATES.TRENDLINE.TITLE('downtrend'),
        description: MESSAGE_TEMPLATES.TRENDLINE.DESCRIPTION(
          confidenceResult.touches,
          enhancedConfidence
        ),
        reason: this.generateReason(
          candidate,
          regression,
          confidenceResult,
          factors
        ),
        drawingData: validateDrawingData({
          type: 'trendline',
          points: [
            { time: startPoint.time, value: startPoint.high },
            { time: endPoint.time, value: endPoint.high },
          ],
          style: {
            color: COLOR_PALETTE.TRENDLINE.DOWNTREND,
            lineWidth: 2,
            lineStyle: 'solid',
          },
        }),
        confidence: enhancedConfidence,
        priority: this.calculatePriority(enhancedConfidence, factors),
        createdAt: Date.now(),
        symbol: params.symbol,
        interval: params.interval,
        touches: confidenceResult.touches,
        volumeAnalysis: confidenceResult.volumeAnalysis,
        patterns: confidenceResult.patterns,
        statistics: {
          points: candidate.end.index - candidate.start.index + 1,
          touches: confidenceResult.touches,
          outliers: 0,
          r_squared: regression.r2,
          angle: Math.abs(regression.slope * 100),
          duration_hours: this.calculateDurationHours(
            startPoint.time,
            endPoint.time,
            params.interval
          ),
          price_change_percent: ((endPoint.high - startPoint.high) / startPoint.high) * 100,
        },
      };

      proposals.push(proposal);
    }

    return proposals;
  }

  /**
   * トレンドライン候補の評価
   */
  private evaluateTrendlineCandidates(
    data: CandlestickData[],
    points: PeakTroughPoint[],
    type: 'uptrend' | 'downtrend'
  ): TrendlineCandidate[] {
    const candidates: TrendlineCandidate[] = [];
    const weights = SCORING_WEIGHTS.TRENDLINE;

    // 全ての組み合わせを評価
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const start = points[i];
        const end = points[j];
        const timeSpan = end.index - start.index;

        // 最小時間スパンチェック
        if (timeSpan < ANALYSIS_PARAMS.TRENDLINE_MIN_TIMESPAN) {
          continue;
        }
        
        // 最大時間スパンはスコアに反映させるが、除外はしない
        // (元の実装では最大制限がなかった)

        // スコア計算
        const recencyBonus = (data.length - end.index) <= TIME_CONSTANTS.RECENT_CANDLES ? 1.2 : 1.0;
        const volumeScore = (start.volumeWeight + end.volumeWeight) / 2;
        const timeSpanScore = Math.min(timeSpan / 50, 2);
        
        const score = (
          timeSpanScore * weights.TIME_SPAN +
          volumeScore * weights.VOLUME +
          recencyBonus * weights.RECENCY
        );

        candidates.push({
          start,
          end,
          score,
          type,
        });
      }
    }

    // スコア順でソートし、上位を返す
    const sortedCandidates = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // 元の実装ではもっと多くの候補を評価していた
      
    logger.debug('[TrendlineGenerator] Evaluated candidates', {
      totalCandidates: candidates.length,
      topCandidates: sortedCandidates.length,
      type,
      topScores: sortedCandidates.map(c => c.score),
    });
    
    return sortedCandidates;
  }

  /**
   * 線形回帰分析
   */
  private performLinearRegression(
    data: CandlestickData[],
    startIdx: number,
    endIdx: number,
    priceType: 'high' | 'low',
    tolerance: number
  ): { slope: number; intercept: number; r2: number } {
    const points: Array<{ x: number; y: number }> = [];
    const startPrice = data[startIdx][priceType];
    const endPrice = data[endIdx][priceType];

    // トレンドライン近傍の点を収集
    for (let i = startIdx; i <= endIdx; i++) {
      const expectedPrice = startPrice + (endPrice - startPrice) * ((i - startIdx) / (endIdx - startIdx));
      const actualPrice = data[i][priceType];
      
      if (Math.abs(actualPrice - expectedPrice) <= tolerance) {
        points.push({ x: i, y: actualPrice });
      }
    }

    // 線形回帰計算
    const n = points.length;
    if (n < 2) {
      return { 
        slope: (endPrice - startPrice) / (endIdx - startIdx), 
        intercept: startPrice,
        r2: 0 
      };
    }

    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R二乗値計算
    const yMean = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const yPred = slope * p.x + intercept;
      return sum + Math.pow(p.y - yPred, 2);
    }, 0);

    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { slope, intercept, r2 };
  }

  /**
   * 理由文の生成
   */
  private generateReason(
    candidate: TrendlineCandidate,
    regression: { slope: number; intercept: number; r2: number },
    confidenceResult: ConfidenceResult,
    factors: ConfidenceFactors
  ): string {
    const trendType = candidate.type === 'uptrend' ? '上昇' : '下降';
    const timeSpan = candidate.end.index - candidate.start.index;
    const angle = Math.abs((regression?.slope ?? 0) * 100);
    const touches = confidenceResult?.touches ?? 0;
    const volumeScore = confidenceResult?.volumeAnalysis?.volumeWeightedScore ?? 0;
    const r2 = regression?.r2 ?? 0;

    let strength = '弱い';
    if (factors.baseConfidence > THRESHOLDS.HIGH_CONFIDENCE) strength = '強い';
    else if (factors.baseConfidence > THRESHOLDS.MIN_CONFIDENCE) strength = '中程度の';

    let reason = `過去${timeSpan}本のローソク足で${angle.toFixed(2)}%の${trendType}傾向を検出。`;
    reason += `${touches}回のタッチポイント（出来高加重スコア: ${volumeScore.toFixed(2)}）があり、`;
    reason += `${strength}${candidate.type === 'uptrend' ? 'サポート' : 'レジスタンス'}ラインとして機能する可能性があります。`;
    reason += `R²値: ${r2.toFixed(3)}`;

    if (factors.multiTimeframeConfirmation) {
      reason += ` 上位タイムフレームでも確認されています。`;
    }

    if (confidenceResult?.patterns?.length > 0) {
      reason += ` ${confidenceResult.patterns[0].type}パターンも検出されました。`;
    }

    return reason;
  }

  /**
   * 優先度計算
   */
  private calculatePriority(
    confidence: number,
    factors: ConfidenceFactors
  ): 'high' | 'medium' | 'low' {
    if (
      confidence >= THRESHOLDS.HIGH_CONFIDENCE &&
      factors.touchPoints >= 5 &&
      factors.recentActivity &&
      factors.multiTimeframeConfirmation
    ) {
      return 'high';
    }

    if (
      confidence >= THRESHOLDS.MIN_CONFIDENCE &&
      factors.touchPoints >= 3
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 時間計算
   */
  private calculateDurationHours(
    startTime: number,
    endTime: number,
    interval: string
  ): number {
    const minutes = TIME_CONSTANTS.INTERVAL_TO_MINUTES[interval as keyof typeof TIME_CONSTANTS.INTERVAL_TO_MINUTES] ?? 60;
    const bars = Math.abs(endTime - startTime) / (minutes * 60);
    return bars * (minutes / 60);
  }
}