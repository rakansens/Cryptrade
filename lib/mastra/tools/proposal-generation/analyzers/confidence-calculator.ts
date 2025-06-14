/**
 * Confidence Calculator
 * 
 * 提案の信頼度を計算する専用モジュール
 * 複数の要因を考慮して総合的な信頼度を算出
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { ConfidenceFactors } from '../types';
import { SCORING_WEIGHTS, THRESHOLDS } from '../utils/constants';

/**
 * 拡張信頼度計算
 * 複数の要因を重み付けして総合的な信頼度を計算
 */
export function calculateEnhancedConfidence(factors: ConfidenceFactors): number {
  const weights = SCORING_WEIGHTS.CONFIDENCE;
  
  // 各要因を0-1に正規化
  const normalizedFactors = {
    base: factors.baseConfidence,
    touches: Math.min(factors.touchPoints / 10, 1), // 10タッチで最大
    volume: Math.min(factors.volumeStrength, 1),
    timespan: Math.min(factors.timeSpan / 100, 1), // 100本で最大
    rSquared: factors.rSquared ?? 0,
    pattern: factors.patternAlignment ? 1 : 0,
    mtf: factors.multiTimeframeConfirmation ? 1 : 0,
    recent: factors.recentActivity ? 1 : 0,
  };
  
  // 重み付け合計
  const weightedSum = 
    normalizedFactors.base * weights.BASE +
    normalizedFactors.touches * weights.TOUCHES +
    normalizedFactors.volume * weights.VOLUME +
    normalizedFactors.timespan * weights.TIMESPAN +
    normalizedFactors.rSquared * weights.R_SQUARED +
    normalizedFactors.pattern * weights.PATTERN +
    normalizedFactors.mtf * weights.MTF_ALIGNMENT +
    normalizedFactors.recent * weights.RECENT_ACTIVITY;
  
  // アウトライアによるペナルティ
  const outlierPenalty = factors.outliers 
    ? Math.max(0, 1 - (factors.outliers / 10) * 0.3) // 10個のアウトライアで30%減
    : 1;
  
  const finalConfidence = Math.min(Math.max(weightedSum * outlierPenalty, 0), 1);
  
  logger.debug('[ConfidenceCalculator] Enhanced confidence calculated', {
    factors: normalizedFactors,
    weightedSum,
    outlierPenalty,
    finalConfidence,
  });
  
  return finalConfidence;
}

/**
 * トレンドラインの信頼度計算
 */
export function calculateTrendlineConfidence(
  data: CandlestickData[],
  trendlinePoints: Array<{ index: number; time: number; value: number }>,
  regression: { slope: number; intercept: number; r2: number }
): {
  confidence: number;
  touches: number;
  volumeAnalysis: VolumeAnalysis;
  patterns: string[];
} {
  const touches = countTrendlineTouches(data, trendlinePoints, regression);
  const volumeAnalysis = analyzeTrendlineVolume(data, trendlinePoints);
  const patterns = detectNearbyPatterns(data, trendlinePoints);
  
  // 基本信頼度
  let confidence = 0.3;
  
  // タッチポイントによる加算
  if (touches >= 3) confidence += 0.1;
  if (touches >= 5) confidence += 0.1;
  if (touches >= 7) confidence += 0.1;
  
  // R二乗値による加算
  if (regression.r2 >= THRESHOLDS.ACCEPTABLE_FIT_R_SQUARED) confidence += 0.1;
  if (regression.r2 >= THRESHOLDS.GOOD_FIT_R_SQUARED) confidence += 0.1;
  
  // ボリューム分析による加算
  if (volumeAnalysis.volumeRatio > THRESHOLDS.HIGH_VOLUME_RATIO) confidence += 0.1;
  if (volumeAnalysis.volumeTrend === 'increasing') confidence += 0.05;
  
  // パターンによる加算
  if (patterns.length > 0) confidence += 0.05 * Math.min(patterns.length, 2);
  
  return {
    confidence: Math.min(confidence, 1),
    touches,
    volumeAnalysis,
    patterns,
  };
}

/**
 * サポート/レジスタンスの信頼度計算
 */
export function calculateSupportResistanceConfidence(
  level: number,
  touches: Array<{ time: number; value: number; volume: number }>,
  data: CandlestickData[]
): number {
  // 基本信頼度
  let confidence = 0.4;
  
  // タッチ回数
  const touchCount = touches.length;
  if (touchCount >= 3) confidence += 0.15;
  if (touchCount >= 5) confidence += 0.1;
  if (touchCount >= 7) confidence += 0.05;
  
  // ボリューム分析
  const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
  const touchVolumes = touches.map(t => t.volume);
  const avgTouchVolume = touchVolumes.reduce((sum, v) => sum + v, 0) / touchVolumes.length;
  const volumeRatio = avgTouchVolume / avgVolume;
  
  if (volumeRatio > THRESHOLDS.HIGH_VOLUME_RATIO) confidence += 0.1;
  
  // 最近のタッチ
  const recentTouches = touches.filter(t => {
    const index = data.findIndex(d => d.time === t.time);
    return data.length - index <= 20;
  });
  
  if (recentTouches.length > 0) confidence += 0.1;
  
  // レベルの強度（どれだけ正確にバウンスしているか）
  const bounceAccuracy = calculateBounceAccuracy(level, touches);
  if (bounceAccuracy > 0.95) confidence += 0.1;
  
  return Math.min(confidence, 1);
}

/**
 * フィボナッチの信頼度計算
 */
export function calculateFibonacciConfidence(
  swingPoints: { high: number; low: number },
  currentPrice: number,
  data: CandlestickData[]
): number {
  const range = swingPoints.high - swingPoints.low;
  const retracement = (swingPoints.high - currentPrice) / range;
  
  // 主要なフィボナッチレベルに近いほど高信頼度
  const majorLevels = [0.382, 0.5, 0.618];
  const proximity = Math.min(...majorLevels.map(level => Math.abs(retracement - level)));
  
  let confidence = 0.5;
  
  // 近接度による加算
  if (proximity < 0.02) confidence += 0.2; // 2%以内
  else if (proximity < 0.05) confidence += 0.1; // 5%以内
  
  // スイングの明確さ
  const swingClarity = calculateSwingClarity(swingPoints, data);
  confidence += swingClarity * 0.2;
  
  // ボリューム確認
  const volumeConfirmation = checkVolumeAtSwingPoints(swingPoints, data);
  if (volumeConfirmation) confidence += 0.1;
  
  return Math.min(confidence, 1);
}

// ========================================
// Helper Functions
// ========================================

/**
 * トレンドラインのタッチ回数をカウント
 */
function countTrendlineTouches(
  data: CandlestickData[],
  trendlinePoints: Array<{ index: number; time: number; value: number }>,
  regression: { slope: number; intercept: number }
): number {
  const tolerance = 0.002; // 0.2%の許容誤差
  let touches = 0;
  
  for (let i = 0; i < data.length; i++) {
    const expectedValue = regression.slope * i + regression.intercept;
    const actualHigh = data[i].high;
    const actualLow = data[i].low;
    
    const highDiff = Math.abs(actualHigh - expectedValue) / expectedValue;
    const lowDiff = Math.abs(actualLow - expectedValue) / expectedValue;
    
    if (highDiff <= tolerance || lowDiff <= tolerance) {
      touches++;
    }
  }
  
  return touches;
}

/**
 * トレンドライン上のボリューム分析
 */
interface VolumeAnalysis {
  averageVolume: number;
  volumeRatio: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  significantVolumeBars: number;
}

function analyzeTrendlineVolume(
  data: CandlestickData[],
  trendlinePoints: Array<{ index: number; time: number; value: number }>
): VolumeAnalysis {
  const volumes = trendlinePoints.map(p => data[p.index].volume);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const overallAvg = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
  
  // ボリュームトレンドの判定
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (volumes.length > 1) {
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.2) trend = 'increasing';
    else if (secondAvg < firstAvg * 0.8) trend = 'decreasing';
  }
  
  const significantBars = volumes.filter(v => v > overallAvg * 1.5).length;
  
  return {
    averageVolume: avgVolume,
    volumeRatio: avgVolume / overallAvg,
    volumeTrend: trend,
    significantVolumeBars: significantBars,
  };
}

/**
 * 近くのパターンを検出
 */
function detectNearbyPatterns(
  data: CandlestickData[],
  trendlinePoints: Array<{ index: number; time: number; value: number }>
): string[] {
  // 簡略化された実装
  const patterns: string[] = [];
  
  // トレンドラインの近くでダブルトップ/ボトムなどを検出
  // 実際の実装は複雑になるため、ここでは簡略化
  
  return patterns;
}

/**
 * バウンスの精度を計算
 */
function calculateBounceAccuracy(
  level: number,
  touches: Array<{ time: number; value: number; volume: number }>
): number {
  if (touches.length === 0) return 0;
  
  const deviations = touches.map(t => Math.abs(t.value - level) / level);
  const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
  
  return Math.max(0, 1 - avgDeviation * 10); // 10%の偏差で0
}

/**
 * スイングポイントの明確さを計算
 */
function calculateSwingClarity(
  swingPoints: { high: number; low: number },
  data: CandlestickData[]
): number {
  // スイングの前後でどれだけ明確な反転があるかを評価
  // 簡略化された実装
  return 0.7;
}

/**
 * スイングポイントでのボリューム確認
 */
function checkVolumeAtSwingPoints(
  swingPoints: { high: number; low: number },
  data: CandlestickData[]
): boolean {
  // スイングポイントで高ボリュームがあるかチェック
  // 簡略化された実装
  return true;
}