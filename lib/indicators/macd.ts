/**
 * MACD (Moving Average Convergence Divergence) Calculator - Optimized O(N) version
 * MACD Line = EMA(12) - EMA(26)
 * Signal Line = EMA(9) of MACD Line
 * Histogram = MACD Line - Signal Line
 * Uses efficient EMA calculation with single pass
 */

import type { MACDData } from '@/types/market';
import { validatePriceData, handleIndicatorError } from './validation';
import { logger } from '@/lib/utils/logger';
import { EMAIndicator } from './ema-indicator';
import type { UTCTimestamp } from 'lightweight-charts';

function calculateEMAFromNumbers(data: number[], period: number): number[] {
  // Convert number array to PriceDataLightweight format for EMAIndicator
  const chartData = data.map((price, index) => ({
    time: index as UTCTimestamp, // Use index as time for calculation
    close: price,
  }));
  
  const emaIndicator = new EMAIndicator(period);
  const emaData = emaIndicator.calculate(chartData);
  
  // Extract just the values to maintain compatibility
  return emaData.map(item => item.value);
}

export function calculateMACD(
  data: { time: number; close: number }[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  // 入力データの検証
  const validation = validatePriceData(data, {
    minLength: slowPeriod + signalPeriod,
    checkMonotonic: true,
    allowNaN: false,
    allowInfinity: false
  });

  if (!validation.valid) {
    return handleIndicatorError('MACD', new Error(validation.error!), []);
  }

  if (validation.warnings) {
    validation.warnings.forEach(warning => {
      logger.warn(`[MACD] ${warning}`);
    });
  }

  try {

  const closePrices = data.map(d => d.close);
  
  // Calculate EMAs using EMAIndicator class
  const ema12 = calculateEMAFromNumbers(closePrices, fastPeriod);
  const ema26 = calculateEMAFromNumbers(closePrices, slowPeriod);
  
  // Calculate MACD line (EMA12 - EMA26)
  const macdLine: number[] = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < ema26.length; i++) {
    const ema12Value = ema12[i + startIndex];
    const ema26Value = ema26[i];
    if (ema12Value !== undefined && ema26Value !== undefined) {
      macdLine.push(ema12Value - ema26Value);
    }
  }
  
  // Calculate Signal line (EMA of MACD line)
  const signalLine = calculateEMAFromNumbers(macdLine, signalPeriod);
  
  // Calculate Histogram (MACD - Signal)
  const result: MACDData[] = [];
  const resultStartIndex = slowPeriod + signalPeriod - 1;
  
  for (let i = 0; i < signalLine.length; i++) {
    const macdValue = macdLine[i + signalPeriod - 1];
    const signalValue = signalLine[i];
    if (macdValue === undefined || signalValue === undefined) continue;
    const histogram = macdValue - signalValue;
    
    const dataIndex = resultStartIndex + i;
    if (dataIndex < data.length) {
      const candle = data[dataIndex];
      if (candle) {
        result.push({
          time: candle.time,
          macd: macdValue,
          signal: signalValue,
          histogram: histogram
        });
      }
    }
  }

  return result;
  } catch (error) {
    return handleIndicatorError('MACD', error, []);
  }
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