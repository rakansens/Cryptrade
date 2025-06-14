/**
 * Market Analyzer
 * 
 * 市場状態を分析する専用モジュール
 * トレンド、レンジ、ボラティリティなどを判定
 */

import { logger } from '@/lib/utils/logger';
import type { PriceData as CandlestickData } from '@/types/market';
import type { MarketCondition, MultiTimeframeAnalysis } from '../types';
import { THRESHOLDS, TIME_CONSTANTS } from '../utils/constants';
import { calculateMovingAverage, calculateStandardDeviation } from '../utils/helpers';

/**
 * 市場状態の分析
 */
export function analyzeMarketCondition(data: CandlestickData[]): MarketCondition {
  if (data.length < 50) {
    return { type: 'ranging', strength: 0.5 };
  }

  // 価格データの抽出
  const closes = data.map(d => d.close);
  
  // トレンド分析
  const trendAnalysis = analyzeTrend(closes);
  
  // ボラティリティ分析
  const volatilityAnalysis = analyzeVolatility(data);
  
  // レンジ分析
  const rangeAnalysis = analyzeRange(data);

  // 総合判定
  let condition: MarketCondition;
  
  if (trendAnalysis.strength > 0.7) {
    condition = {
      type: 'trending',
      strength: trendAnalysis.strength,
      direction: trendAnalysis.direction,
    };
  } else if (volatilityAnalysis.normalized > 0.03) {
    condition = {
      type: 'volatile',
      strength: volatilityAnalysis.normalized,
    };
  } else {
    condition = {
      type: 'ranging',
      strength: rangeAnalysis.strength,
    };
  }

  logger.debug('[MarketAnalyzer] Market condition analyzed', {
    condition,
    trendAnalysis,
    volatilityAnalysis,
    rangeAnalysis,
  });

  return condition;
}

/**
 * トレンド分析
 */
function analyzeTrend(closes: number[]): {
  direction: 'bullish' | 'bearish';
  strength: number;
} {
  // 移動平均を使用したトレンド判定
  const ma20 = calculateMovingAverage(closes, 20);
  const ma50 = calculateMovingAverage(closes, 50);
  
  if (ma20.length === 0 || ma50.length === 0) {
    return { direction: 'bullish', strength: 0 };
  }

  // 最新の移動平均値
  const currentMa20 = ma20[ma20.length - 1];
  const currentMa50 = ma50[ma50.length - 1];
  const currentPrice = closes[closes.length - 1];

  // トレンドの方向
  const direction = currentMa20 > currentMa50 ? 'bullish' : 'bearish';

  // トレンドの強さ（価格と移動平均の乖離率）
  const priceAboveMa20 = (currentPrice - currentMa20) / currentMa20;
  const ma20AboveMa50 = (currentMa20 - currentMa50) / currentMa50;
  
  // 線形回帰による傾き
  const slope = calculateTrendSlope(closes.slice(-50));
  const normalizedSlope = Math.abs(slope) / (closes[closes.length - 1] / 100);

  // 強さの総合評価
  const strength = Math.min(1, (
    Math.abs(priceAboveMa20) * 0.3 +
    Math.abs(ma20AboveMa50) * 0.3 +
    normalizedSlope * 0.4
  ));

  return { direction, strength };
}

/**
 * ボラティリティ分析
 */
function analyzeVolatility(data: CandlestickData[]): {
  absolute: number;
  normalized: number;
  trend: 'increasing' | 'decreasing' | 'stable';
} {
  // ATR（Average True Range）の計算
  const atr = calculateATR(data, 14);
  if (atr.length === 0) {
    return { absolute: 0, normalized: 0, trend: 'stable' };
  }

  const currentATR = atr[atr.length - 1];
  const avgPrice = data[data.length - 1].close;
  const normalizedATR = currentATR / avgPrice;

  // ボラティリティのトレンド
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (atr.length >= 10) {
    const recentATR = atr.slice(-10);
    const firstHalf = recentATR.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = recentATR.slice(5).reduce((a, b) => a + b, 0) / 5;
    
    if (secondHalf > firstHalf * 1.2) trend = 'increasing';
    else if (secondHalf < firstHalf * 0.8) trend = 'decreasing';
  }

  return {
    absolute: currentATR,
    normalized: normalizedATR,
    trend,
  };
}

/**
 * レンジ分析
 */
function analyzeRange(data: CandlestickData[]): {
  strength: number;
  upperBound: number;
  lowerBound: number;
} {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  // 最近50本のデータでレンジを判定
  const recentData = data.slice(-50);
  const recentHighs = recentData.map(d => d.high);
  const recentLows = recentData.map(d => d.low);

  const maxHigh = Math.max(...recentHighs);
  const minLow = Math.min(...recentLows);
  const range = maxHigh - minLow;
  const avgPrice = (maxHigh + minLow) / 2;

  // レンジの強さ（価格がどれだけレンジ内に収まっているか）
  let bounces = 0;
  const tolerance = range * 0.1;

  for (const candle of recentData) {
    if (Math.abs(candle.high - maxHigh) < tolerance ||
        Math.abs(candle.low - minLow) < tolerance) {
      bounces++;
    }
  }

  const strength = Math.min(1, bounces / 10);

  return {
    strength,
    upperBound: maxHigh,
    lowerBound: minLow,
  };
}

/**
 * マルチタイムフレーム分析
 */
export async function analyzeMultipleTimeframes(
  data: CandlestickData[],
  currentInterval: string,
  getHigherTimeframeData?: (interval: string) => Promise<CandlestickData[]>
): Promise<MultiTimeframeAnalysis> {
  const higherInterval = TIME_CONSTANTS.HIGHER_TIMEFRAMES[
    currentInterval as keyof typeof TIME_CONSTANTS.HIGHER_TIMEFRAMES
  ];

  if (!higherInterval || !getHigherTimeframeData) {
    return {
      higherTimeframe: {
        trend: 'neutral',
        support: [],
        resistance: [],
      },
      alignment: false,
      conflictingSignals: false,
    };
  }

  try {
    // 上位タイムフレームのデータ取得
    const higherData = await getHigherTimeframeData(higherInterval);
    
    // 上位タイムフレームの分析
    const higherCondition = analyzeMarketCondition(higherData);
    const currentCondition = analyzeMarketCondition(data);

    // サポート・レジスタンスレベルの検出
    const levels = detectKeyLevels(higherData);

    // アライメントの判定
    const alignment = 
      higherCondition.type === 'trending' &&
      currentCondition.type === 'trending' &&
      higherCondition.direction === currentCondition.direction;

    // 矛盾シグナルの検出
    const conflictingSignals = 
      higherCondition.type === 'trending' &&
      currentCondition.type === 'trending' &&
      higherCondition.direction !== currentCondition.direction;

    return {
      higherTimeframe: {
        trend: higherCondition.direction || 'neutral',
        support: levels.support,
        resistance: levels.resistance,
      },
      alignment,
      conflictingSignals,
    };
  } catch (error) {
    logger.error('[MarketAnalyzer] Multi-timeframe analysis failed', { error });
    return {
      higherTimeframe: {
        trend: 'neutral',
        support: [],
        resistance: [],
      },
      alignment: false,
      conflictingSignals: false,
    };
  }
}

/**
 * キーレベルの検出
 */
function detectKeyLevels(data: CandlestickData[]): {
  support: number[];
  resistance: number[];
} {
  const support: number[] = [];
  const resistance: number[] = [];
  
  // 簡略化された実装
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  
  // 最高値・最安値を基準に
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const range = maxHigh - minLow;
  
  // レベルを分割
  for (let i = 1; i < 4; i++) {
    const level = minLow + (range / 4) * i;
    if (i < 2) support.push(level);
    else resistance.push(level);
  }
  
  return { support, resistance };
}

/**
 * ATR（Average True Range）の計算
 */
function calculateATR(data: CandlestickData[], period: number): number[] {
  if (data.length < period + 1) return [];

  const trueRanges: number[] = [];
  
  // True Rangeの計算
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }

  // ATRの計算（移動平均）
  return calculateMovingAverage(trueRanges, period);
}

/**
 * トレンドの傾きを計算
 */
function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) return 0;

  // 線形回帰による傾き計算
  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return slope;
}

/**
 * パターン認識
 */
export function detectCandlePatterns(
  data: CandlestickData[],
  index: number
): string[] {
  const patterns: string[] = [];
  
  if (index < 2 || index >= data.length) return patterns;

  const current = data[index];
  const prev = data[index - 1];
  const prevPrev = data[index - 2];

  // ピンバー
  const bodySize = Math.abs(current.close - current.open);
  const upperWick = current.high - Math.max(current.close, current.open);
  const lowerWick = Math.min(current.close, current.open) - current.low;
  const totalRange = current.high - current.low;

  if (totalRange > 0) {
    if (upperWick / totalRange > 0.6 && bodySize / totalRange < 0.3) {
      patterns.push('bearish_pin_bar');
    }
    if (lowerWick / totalRange > 0.6 && bodySize / totalRange < 0.3) {
      patterns.push('bullish_pin_bar');
    }
  }

  // エングルフィング
  if (prev && current) {
    const prevBody = Math.abs(prev.close - prev.open);
    const currentBody = Math.abs(current.close - current.open);
    
    if (prev.close < prev.open && current.close > current.open &&
        current.open <= prev.close && current.close >= prev.open &&
        currentBody > prevBody) {
      patterns.push('bullish_engulfing');
    }
    
    if (prev.close > prev.open && current.close < current.open &&
        current.open >= prev.close && current.close <= prev.open &&
        currentBody > prevBody) {
      patterns.push('bearish_engulfing');
    }
  }

  return patterns;
}