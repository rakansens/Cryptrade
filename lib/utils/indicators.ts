// 新規ファイル: lib/utils/indicators.ts
// テクニカル指標を簡易計算するユーティリティ関数群
// - RSI (14)
// - ATR (14)
// 今後追加実装を容易にするため、シンプルな実装に留める
import type { ProcessedKline } from '@/types/market'

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const emaArr: number[] = []
  values.forEach((v, i) => {
    if (i === 0) {
      emaArr.push(v)
    } else {
      emaArr.push(v * k + emaArr[i - 1] * (1 - k))
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
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
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
    const prevClose = klines[i - 1].close
    const { high, low } = klines[i]
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trs.push(tr)
  }
  // 初期 SMA
  const initial = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const rest = ema(trs.slice(period), period)
  const last = rest.length > 0 ? rest[rest.length - 1] : initial
  return last
}

export function computeSupportResistance(
  klines: ProcessedKline[],
  count: number = 3
): { support: number[]; resistance: number[] } {
  const closes = klines.map(k => k.close)
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
  const macdLine: number[] = emaFast.map((v, i) => v - emaSlow[i])
  const signalLine = ema(macdLine.slice(-slowPeriod), signalPeriod)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1]
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
  const first = klines[klines.length - lookback - 1].close
  const last = klines[klines.length - 1].close
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