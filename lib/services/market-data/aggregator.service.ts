// TDD Green Phase: AggregatorService - テスト通過を目的とした最小実装
// Created: 2025-06-27 - Multi-timeframe data aggregation and analysis

import { BaseService } from '@/lib/api/base-service';
import type { 
  KlineData,
  MultiTimeframeData,
  TimeframeData,
  GroupingResult,
  SimilarityMatcher,
  CrossTimeframeValidation
} from './types';

export interface AggregatorConfig {
  timeframes: string[];
  volumeWeights: Record<string, number>;
  priceTolerancePercent: number;
  volatilityPeriod: number;
}

export interface VolatilityMetrics {
  standardDeviation: number;
  averageRange: number;
  coefficientOfVariation: number;
  priceRangePercent: number;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
  totalVolume: number;
}

export class AggregatorService extends BaseService {
  private config: AggregatorConfig;

  constructor(config?: Partial<AggregatorConfig>) {
    super('/api/aggregation');
    this.config = {
      timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
      volumeWeights: { '1m': 0.1, '5m': 0.2, '15m': 0.3, '1h': 0.5, '4h': 0.8, '1d': 1.0 },
      priceTolerancePercent: 0.5,
      volatilityPeriod: 20,
      ...config
    };
  }

  /**
   * TDD Green Phase: マルチタイムフレームデータマージ - O(n log n)目標
   */
  async mergeMultiTimeframeData(
    symbol: string,
    multiData: Record<string, TimeframeData>,
    signal?: AbortSignal
  ): Promise<{
    mergedData: KlineData[];
    deduplicationStats: {
      originalCount: number;
      deduplicatedCount: number;
      duplicatesRemoved: number;
    };
    processingTimeMs: number;
    sortingComplexity: string;
  }> {
    const startTime = Date.now();

    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // バリデーション: multiDataが空または未定義の場合
    if (!multiData || Object.keys(multiData).length === 0) {
      throw new Error('No timeframe data provided');
    }

    // Green Phase: 簡単なマージとソート実装
    const allData: KlineData[] = [];
    let originalCount = 0;

    Object.values(multiData).forEach(timeframeData => {
      if (timeframeData && timeframeData.data && Array.isArray(timeframeData.data)) {
        originalCount += timeframeData.data.length;
        allData.push(...timeframeData.data);
      }
    });

    // O(n log n) ソート (時間順)
    const sortedData = allData.sort((a, b) => a.time - b.time);

    // 重複除去 (同じ時間のデータ)
    const deduplicatedData: KlineData[] = [];
    const seen = new Set<number>();

    sortedData.forEach(kline => {
      if (!seen.has(kline.time)) {
        seen.add(kline.time);
        deduplicatedData.push(kline);
      }
    });

    return {
      mergedData: deduplicatedData,
      deduplicationStats: {
        originalCount,
        deduplicatedCount: deduplicatedData.length,
        duplicatesRemoved: originalCount - deduplicatedData.length
      },
      processingTimeMs: Date.now() - startTime,
      sortingComplexity: 'O(n log n)'
    };
  }

  /**
   * TDD Green Phase: ボリューム統計計算
   */
  async calculateVolumeStatistics(
    data: KlineData[],
    signal?: AbortSignal
  ): Promise<StatisticalSummary> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // バリデーション: dataが配列かチェック
    if (!Array.isArray(data) || data.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        count: 0,
        totalVolume: 0
      };
    }

    const volumes = data.map(k => k.volume);
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
    const mean = totalVolume / volumes.length;
    
    // 中央値計算
    const sortedVolumes = [...volumes].sort((a, b) => a - b);
    const median = sortedVolumes.length % 2 === 0
      ? ((sortedVolumes[sortedVolumes.length / 2 - 1] || 0) + (sortedVolumes[sortedVolumes.length / 2] || 0)) / 2
      : (sortedVolumes[Math.floor(sortedVolumes.length / 2)] || 0);

    // 標準偏差
    const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean,
      median,
      standardDeviation,
      min: Math.min(...volumes),
      max: Math.max(...volumes),
      count: volumes.length,
      totalVolume
    };
  }

  /**
   * TDD Green Phase: 価格レンジ統計
   */
  async calculatePriceRangeStatistics(
    data: KlineData[],
    signal?: AbortSignal
  ): Promise<StatisticalSummary> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // バリデーション: dataが配列かチェック
    if (!Array.isArray(data) || data.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        count: 0,
        totalVolume: 0
      };
    }

    const ranges = data.map(k => k.high - k.low);
    const mean = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
    
    const sortedRanges = [...ranges].sort((a, b) => a - b);
    const median = sortedRanges.length % 2 === 0
      ? ((sortedRanges[sortedRanges.length / 2 - 1] || 0) + (sortedRanges[sortedRanges.length / 2] || 0)) / 2
      : (sortedRanges[Math.floor(sortedRanges.length / 2)] || 0);

    const variance = ranges.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ranges.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean,
      median,
      standardDeviation,
      min: Math.min(...ranges),
      max: Math.max(...ranges),
      count: ranges.length,
      totalVolume: 0 // N/A for price ranges
    };
  }

  /**
   * TDD Green Phase: ボラティリティメトリクス計算
   */
  async calculateVolatilityMetrics(
    data: KlineData[],
    signal?: AbortSignal
  ): Promise<VolatilityMetrics> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // バリデーション: dataが配列かチェック
    if (!Array.isArray(data) || data.length === 0) {
      return {
        standardDeviation: 0,
        averageRange: 0,
        coefficientOfVariation: 0,
        priceRangePercent: 0
      };
    }

    const prices = data.map(k => k.close);
    const ranges = data.map(k => k.high - k.low);

    // 価格の標準偏差
    const priceMean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceVariance = prices.reduce((sum, p) => sum + Math.pow(p - priceMean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(priceVariance);

    // 平均レンジ
    const averageRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;

    // 変動係数
    const coefficientOfVariation = priceMean > 0 ? standardDeviation / priceMean : 0;

    // 価格レンジ（パーセント）
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRangePercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

    return {
      standardDeviation,
      averageRange,
      coefficientOfVariation,
      priceRangePercent
    };
  }

  /**
   * TDD Green Phase: クロスタイムフレーム検証
   */
  async validateCrossTimeframes(
    multiData: Record<string, TimeframeData>,
    priceLevel: number,
    signal?: AbortSignal
  ): Promise<CrossTimeframeValidation> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const tolerance = priceLevel * (this.config.priceTolerancePercent / 100);
    const supportingTimeframes: string[] = [];
    const touchCounts: Record<string, number> = {};
    let totalStrength = 0;

    Object.entries(multiData).forEach(([timeframe, data]) => {
      let touchCount = 0;
      
      // 価格レベル近くのタッチ数をカウント
      data.data.forEach(kline => {
        if (Math.abs(kline.high - priceLevel) <= tolerance ||
            Math.abs(kline.low - priceLevel) <= tolerance ||
            Math.abs(kline.close - priceLevel) <= tolerance) {
          touchCount++;
        }
      });

      if (touchCount > 0) {
        supportingTimeframes.push(timeframe);
        touchCounts[timeframe] = touchCount;
        totalStrength += touchCount * (this.config.volumeWeights[timeframe] || 1);
      }
    });

    const avgStrength = supportingTimeframes.length > 0 
      ? totalStrength / supportingTimeframes.length 
      : 0;

    const validationScore = Math.min(avgStrength / 10, 1.0); // 0-1スケール

    return {
      validationScore,
      supportingTimeframes,
      touchCounts,
      avgStrength,
      metadata: {
        calculatedAt: Date.now(),
        tolerancePercent: this.config.priceTolerancePercent
      }
    };
  }

  /**
   * TDD Green Phase: 類似データグルーピング
   */
  async groupSimilarData<T>(
    data: T[],
    matcher: SimilarityMatcher<T>,
    signal?: AbortSignal
  ): Promise<GroupingResult<T>> {
    const startTime = Date.now();

    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const groups: T[][] = [];
    const processed = new Set<number>();

    data.forEach((item, index) => {
      if (processed.has(index)) return;

      const group: T[] = [item];
      processed.add(index);

      // 他のアイテムとの類似度チェック
      data.forEach((otherItem, otherIndex) => {
        if (processed.has(otherIndex)) return;

        const similarity = matcher.calculate(item, otherItem);
        if (similarity >= matcher.threshold) {
          group.push(otherItem);
          processed.add(otherIndex);
        }
      });

      groups.push(group);
    });

    return {
      groups,
      metadata: {
        totalItems: data.length,
        groupCount: groups.length,
        avgGroupSize: data.length / groups.length,
        processingTimeMs: Date.now() - startTime
      }
    };
  }

  /**
   * TDD Green Phase: 設定更新
   */
  updateConfig(newConfig: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * TDD Green Phase: 設定取得
   */
  getConfig(): AggregatorConfig {
    return { ...this.config };
  }
}

export default AggregatorService;