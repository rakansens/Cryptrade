// 新規ファイル: lib/utils/indicators.ts
// テクニカル指標を簡易計算するユーティリティ関数群
// - RSI (14)
// - ATR (14)
// 今後追加実装を容易にするため、シンプルな実装に留める
import { env } from '@/config/env'
import { logger } from '@/lib/utils/logger'
import type { ProcessedKline } from '@/types/market'

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const emaArr: number[] = []
  values.forEach((v, i) => {
    if (i === 0) {
      emaArr.push(v)
    } else {
      const prevEma = emaArr[i - 1]
      if (prevEma !== undefined) {
        emaArr.push(v * k + prevEma * (1 - k))
      }
    }
  })
  return emaArr
}

export function computeRSI(klines: ProcessedKline[], period: number = 14): number {
  if (klines.length < period + 1) return 0
  const closes = klines.map(k => k.close)
  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const current = closes[i]
    const previous = closes[i - 1]
    if (current !== undefined && previous !== undefined) {
      const diff = current - previous
      if (diff >= 0) gains += diff
      else losses -= diff
    }
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function computeATR(klines: ProcessedKline[], period: number = 14): number {
  if (klines.length < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < klines.length; i++) {
    const prevKline = klines[i - 1]
    const currentKline = klines[i]
    if (prevKline && currentKline) {
      const prevClose = prevKline.close
      const { high, low } = currentKline
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
      trs.push(tr)
    }
  }
  // 初期 SMA
  const initial = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const rest = ema(trs.slice(period), period)
  const last = rest.length > 0 ? rest[rest.length - 1] ?? initial : initial
  return last
}

export function computeSupportResistance(
  klines: ProcessedKline[],
  count: number = 3
): { support: number[]; resistance: number[] } {
  const highs = klines.map(k => k.high)
  const lows = klines.map(k => k.low)
  const sortedHighs = [...highs].sort((a, b) => b - a)
  const sortedLows = [...lows].sort((a, b) => a - b)
  return {
    resistance: sortedHighs.slice(0, count),
    support: sortedLows.slice(0, count)
  }
}

// -----------------------------------------------------------------------------
// MACD
// -----------------------------------------------------------------------------

export function computeMACD(
  klines: ProcessedKline[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
) {
  if (klines.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' as const }
  }

  const closes = klines.map(k => k.close)
  const emaFast = ema(closes, fastPeriod)
  const emaSlow = ema(closes, slowPeriod)
  const macdLine: number[] = emaFast.map((v, i) => {
    const slowValue = emaSlow[i]
    return slowValue !== undefined ? v - slowValue : 0
  })
  const signalLine = ema(macdLine.slice(-slowPeriod), signalPeriod)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]
  
  if (lastMacd === undefined || lastSignal === undefined) {
    return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' }
  }
  
  const histogram = lastMacd - lastSignal
  const trend: 'bullish' | 'bearish' | 'neutral' = histogram > 0 ? 'bullish' : histogram < 0 ? 'bearish' : 'neutral'

  return { macd: lastMacd, signal: lastSignal, histogram, trend }
}

// -----------------------------------------------------------------------------
// Trend direction & strength (単純な終値変化率)
// -----------------------------------------------------------------------------

export function computeTrendStrength(
  klines: ProcessedKline[],
  lookback: number = 20
): { direction: 'up' | 'down' | 'neutral'; strength: number } {
  if (klines.length < lookback + 1) return { direction: 'neutral', strength: 0 }
  const firstKline = klines[klines.length - lookback - 1]
  const lastKline = klines[klines.length - 1]
  if (!firstKline || !lastKline) return { direction: 'neutral', strength: 0 }
  const first = firstKline.close
  const last = lastKline.close
  if (first === 0) return { direction: 'neutral', strength: 0 }
  const changePct = (last - first) / first
  const direction = changePct > 0.005 ? 'up' : changePct < -0.005 ? 'down' : 'neutral'
  const strength = Math.min(Math.abs(changePct) * 1000, 100) // scale up to percentage-like
  return { direction, strength }
}

// -----------------------------------------------------------------------------
// Support / Resistance 詳細版（ざっくり版）
// -----------------------------------------------------------------------------

export interface LevelDetail {
  price: number
  strength: number // 1-100 評価
  touches: number
}

export function computeSupportResistanceDetailed(
  klines: ProcessedKline[],
  count: number = 3,
  tolerance: number = 0.001 // 0.1% within level counts as touch
): { support: LevelDetail[]; resistance: LevelDetail[] } {
  if (klines.length === 0) return { support: [], resistance: [] }

  const highs = klines.map(k => k.high)
  const lows = klines.map(k => k.low)

  // Pick potential levels
  const sortedHighs = [...highs].sort((a, b) => b - a)
  const sortedLows = [...lows].sort((a, b) => a - b)

  const resistances = sortedHighs.slice(0, count)
  const supports = sortedLows.slice(0, count)

  function detail(levelPrice: number, arr: number[]): LevelDetail {
    const tol = levelPrice * tolerance
    const touches = arr.filter(v => Math.abs(v - levelPrice) <= tol).length
    const strength = Math.min(touches * 20, 100) // simple linear mapping
    return { price: levelPrice, strength, touches }
  }

  const resDetail = resistances.map(p => detail(p, highs))
  const supDetail = supports.map(p => detail(p, lows))

  return { resistance: resDetail, support: supDetail }
}

/**
 * Calculate MACD indicator
 * @deprecated Use lib/indicators/macd.ts instead
 * This function now delegates to the proper implementation
 */
export function calculateMACD(data: number[]) {
  console.warn('[Deprecated] calculateMACD in utils/indicators.ts is deprecated. Use lib/indicators/macd.ts instead');
  
  try {
    // Import the proper implementation
    const { calculateMACD: properCalculateMACD } = require('../indicators/macd');
    
    // Convert simple array to required format
    const formattedData = data.map((close, index) => ({
      time: Date.now() - (data.length - index) * 60000, // Assume 1 minute intervals
      close
    }));
    
    const result = properCalculateMACD(formattedData);
    
    // Return only the values for backward compatibility
    return result.map((item: any) => ({
      macd: item.macd,
      signal: item.signal,
      histogram: item.histogram
    }));
  } catch (error) {
    logger.error('[Indicators] Failed to calculate MACD', { error });
    
    // Fallback for development and test
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      return data.slice(26 + 9 - 1).map(() => ({
        macd: 0,
        signal: 0,
        histogram: 0
      }));
    }
    
    throw new Error(`Failed to calculate MACD: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate RSI indicator
 * @deprecated Use lib/indicators/rsi.ts instead
 * This function now delegates to the proper implementation
 */
export function calculateRSI(data: number[], period: number = 14) {
  console.warn('[Deprecated] calculateRSI in utils/indicators.ts is deprecated. Use lib/indicators/rsi.ts instead');
  
  try {
    // Import the proper implementation
    const { calculateRSI: properCalculateRSI } = require('../indicators/rsi');
    
    // Convert simple array to required format
    const formattedData = data.map((close, index) => ({
      time: Date.now() - (data.length - index) * 60000, // Assume 1 minute intervals
      close
    }));
    
    const result = properCalculateRSI(formattedData, period);
    
    // Return only the RSI values for backward compatibility
    return result.map((item: any) => item.value);
  } catch (error) {
    logger.error('[Indicators] Failed to calculate RSI', { error });
    
    // Fallback for development and test
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      return data.slice(period).map(() => 50);
    }
    
    throw new Error(`Failed to calculate RSI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate Bollinger Bands
 * @deprecated Use lib/indicators/bollinger-bands.ts instead
 * This function now delegates to the proper implementation
 */
export function calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2) {
  console.warn('[Deprecated] calculateBollingerBands in utils/indicators.ts is deprecated. Use lib/indicators/bollinger-bands.ts instead');
  
  try {
    // Import the proper implementation
    const { calculateBollingerBands: properCalculateBB } = require('../indicators/bollinger-bands');
    
    // Convert simple array to required format
    const formattedData = data.map((close, index) => ({
      time: Date.now() - (data.length - index) * 60000, // Assume 1 minute intervals
      close
    }));
    
    const result = properCalculateBB(formattedData, period, stdDev);
    
    // Return in backward compatible format
    return result.map((item: any) => ({
      upper: item.upper,
      middle: item.middle,
      lower: item.lower
    }));
  } catch (error) {
    logger.error('[Indicators] Failed to calculate Bollinger Bands', { error });
    
    // Fallback for development and test
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      return data.slice(period - 1).map((value) => ({
        upper: value * 1.02,
        middle: value,
        lower: value * 0.98
      }));
    }
    
    throw new Error(`Failed to calculate Bollinger Bands: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate Simple Moving Average
 * @deprecated Use lib/indicators/moving-average.ts instead
 * This function now delegates to the proper implementation
 */
export function calculateSMA(data: number[], period: number = 20) {
  console.warn('[Deprecated] calculateSMA in utils/indicators.ts is deprecated. Use lib/indicators/moving-average.ts instead');
  
  try {
    // Import the proper implementation
    const { calculateSMA: properCalculateSMA } = require('../indicators/moving-average');
    
    // Convert simple array to required format
    const formattedData = data.map((close, index) => ({
      time: Date.now() - (data.length - index) * 60000, // Assume 1 minute intervals
      close
    }));
    
    const result = properCalculateSMA(formattedData, period);
    
    // Return only the SMA values for backward compatibility
    return result.map((item: any) => item.value);
  } catch (error) {
    logger.error('[Indicators] Failed to calculate SMA', { error });
    
    // Fallback for development and test
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      return data.slice(period - 1).map((_, index) => {
        const start = index;
        const end = index + period;
        const slice = data.slice(start, end);
        return slice.reduce((sum, val) => sum + val, 0) / slice.length;
      });
    }
    
    throw new Error(`Failed to calculate SMA: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 