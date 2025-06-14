/**
 * MACD (Moving Average Convergence Divergence) Calculator - Optimized O(N) version
 * MACD Line = EMA(12) - EMA(26)
 * Signal Line = EMA(9) of MACD Line
 * Histogram = MACD Line - Signal Line
 * Uses efficient EMA calculation with single pass
 */

import type { MACDData } from '@/types/market';

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA value is SMA
  const sma = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  ema.push(sma);

  // Calculate subsequent EMA values
  for (let i = period; i < data.length; i++) {
    const emaValue = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(emaValue);
  }

  return ema;
}

export function calculateMACD(
  data: { time: number; close: number }[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  if (data.length < slowPeriod + signalPeriod) {
    return [];
  }

  const closePrices = data.map(d => d.close);
  
  // Calculate EMAs
  const ema12 = calculateEMA(closePrices, fastPeriod);
  const ema26 = calculateEMA(closePrices, slowPeriod);
  
  // Calculate MACD line (EMA12 - EMA26)
  const macdLine: number[] = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < ema26.length; i++) {
    const ema12Value = ema12[i + startIndex];
    const ema26Value = ema26[i];
    macdLine.push(ema12Value - ema26Value);
  }
  
  // Calculate Signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate Histogram (MACD - Signal)
  const result: MACDData[] = [];
  const resultStartIndex = slowPeriod + signalPeriod - 1;
  
  for (let i = 0; i < signalLine.length; i++) {
    const macdValue = macdLine[i + signalPeriod - 1];
    const signalValue = signalLine[i];
    const histogram = macdValue - signalValue;
    
    const dataIndex = resultStartIndex + i;
    if (dataIndex < data.length) {
      result.push({
        time: data[dataIndex].time,
        macd: macdValue,
        signal: signalValue,
        histogram: histogram
      });
    }
  }

  return result;
}

export function getMACDColor(histogram: number): string {
  return histogram >= 0 ? '#0ddfba' : '#ff4d4d';
}

export function getMACDSignal(macd: number, signal: number, prevMacd: number, prevSignal: number): 'bullish' | 'bearish' | 'neutral' {
  // Bullish crossover: MACD crosses above Signal
  if (macd > signal && prevMacd <= prevSignal) return 'bullish';
  
  // Bearish crossover: MACD crosses below Signal
  if (macd < signal && prevMacd >= prevSignal) return 'bearish';
  
  return 'neutral';
}