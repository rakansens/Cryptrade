/**
 * RSI (Relative Strength Index) Calculator - Optimized O(N) version
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 * Uses Wilder's smoothing method for efficient calculation
 */

import type { RSIData } from '@/types/market';

export function calculateRSI(
  data: { time: number; close: number }[],
  period: number = 14
): RSIData[] {
  if (data.length < period + 1) {
    return [];
  }

  const gains: number[] = [];
  const losses: number[] = [];
  const rsiData: RSIData[] = [];

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  // Calculate first RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = 100 - (100 / (1 + firstRS));
  
  rsiData.push({
    time: data[period].time,
    rsi: firstRSI
  });

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    // Wilder's smoothing
    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    rsiData.push({
      time: data[i].time,
      rsi: rsi
    });
  }

  return rsiData;
}

export function getRSIColor(rsi: number): string {
  if (rsi >= 70) return '#ff4d4d'; // Overbought - Red
  if (rsi <= 30) return '#0ddfba'; // Oversold - Teal
  return '#7b61ff'; // Normal - Purple
}

export function getRSISignal(rsi: number): 'overbought' | 'oversold' | 'neutral' {
  if (rsi >= 70) return 'overbought';
  if (rsi <= 30) return 'oversold';
  return 'neutral';
}