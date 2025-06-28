/**
 * MACD (Moving Average Convergence Divergence) Calculator - Optimized O(N) version
 * MACD Line = EMA(12) - EMA(26)
 * Signal Line = EMA(9) of MACD Line
 * Histogram = MACD Line - Signal Line
 * Uses efficient EMA calculation with single pass
 */

import type { MACDData } from '@/types/market';
import { MACDIndicator, getMACDColor as _getMACDColor, getMACDSignal as _getMACDSignal } from './macd-indicator';

/**
 * @deprecated Use MACDIndicator class instead for better performance and consistency
 */
export function calculateMACD(
  data: { time: number; close: number }[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  // Convert data to PriceDataLightweight format
  const convertedData = data.map(d => ({
    time: d.time as any, // Type assertion for compatibility
    close: d.close
  }));
  
  // Use the new MACDIndicator class
  const macdIndicator = new MACDIndicator(fastPeriod, slowPeriod, signalPeriod);
  return macdIndicator.calculate(convertedData);
}

// Re-export utility functions from macd-indicator.ts
export const getMACDColor = _getMACDColor;
export const getMACDSignal = _getMACDSignal;