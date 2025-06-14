/**
 * Helper Utilities
 * 
 * 提案生成ツール用のユーティリティ関数集
 */

import { logger } from '@/lib/utils/logger';

/**
 * 提案IDの生成
 */
export function generateProposalId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 標準偏差の計算
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * 移動平均の計算
 */
export function calculateMovingAverage(values: number[], period: number): number[] {
  if (values.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
}

/**
 * パーセンタイルの計算
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * 線形補間
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 角度の計算（ラジアンから度へ）
 */
export function calculateAngleDegrees(slope: number): number {
  return Math.atan(slope) * (180 / Math.PI);
}

/**
 * 価格変化率の計算
 */
export function calculatePriceChangePercent(
  startPrice: number,
  endPrice: number
): number {
  if (startPrice === 0) return 0;
  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * 時間フォーマット
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * 時間差の計算（時間単位）
 */
export function calculateHoursDifference(
  startTime: number,
  endTime: number
): number {
  return Math.abs(endTime - startTime) / 3600;
}

/**
 * 配列のチャンク分割
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}

/**
 * 配列の重複除去
 */
export function unique<T>(array: T[], keyFn?: (item: T) => string): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }
  
  const seen = new Set<string>();
  const result: T[] = [];
  
  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * 安全な除算
 */
export function safeDivide(numerator: number, denominator: number, defaultValue = 0): number {
  if (denominator === 0) return defaultValue;
  return numerator / denominator;
}

/**
 * 値のクランプ
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 加重平均の計算
 */
export function calculateWeightedAverage(
  values: number[],
  weights: number[]
): number {
  if (values.length !== weights.length || values.length === 0) {
    logger.warn('[Helpers] Invalid input for weighted average', {
      valuesLength: values.length,
      weightsLength: weights.length,
    });
    return 0;
  }
  
  const weightedSum = values.reduce((sum, val, i) => sum + val * weights[i], 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  return safeDivide(weightedSum, totalWeight);
}

/**
 * 外れ値の検出（IQR法）
 */
export function detectOutliers(values: number[]): {
  outliers: number[];
  inliers: number[];
  bounds: { lower: number; upper: number };
} {
  if (values.length < 4) {
    return {
      outliers: [],
      inliers: values,
      bounds: { lower: -Infinity, upper: Infinity },
    };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = calculatePercentile(sorted, 25);
  const q3 = calculatePercentile(sorted, 75);
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers: number[] = [];
  const inliers: number[] = [];
  
  for (const value of values) {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value);
    } else {
      inliers.push(value);
    }
  }
  
  return {
    outliers,
    inliers,
    bounds: { lower: lowerBound, upper: upperBound },
  };
}

/**
 * 配列の最頻値
 */
export function mode<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  
  const counts = new Map<T, number>();
  
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  
  let maxCount = 0;
  let modeValue: T | undefined;
  
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      modeValue = value;
    }
  }
  
  return modeValue;
}

/**
 * 深いオブジェクトのマージ
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(
          result[key] || {},
          source[key] as Record<string, unknown>
        );
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}