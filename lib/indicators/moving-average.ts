import type { UTCTimestamp } from 'lightweight-charts';
import type { MovingAverageData, PriceData } from '@/types/market';

// Lightweight Charts compatibility types
interface PriceDataLightweight {
  time: UTCTimestamp;
  close: number;
}

interface MovingAverageDataLightweight {
  time: UTCTimestamp;
  value: number;
}

/**
 * Calculate Simple Moving Average (SMA) - Optimized O(N) version
 * @param data Array of price data with time and close values
 * @param period Moving average period
 * @returns Array of moving average data points
 */
export function calculateSMA(
  data: PriceDataLightweight[], 
  period: number
): MovingAverageDataLightweight[] {
  if (data.length < period) {
    return [];
  }

  const result: MovingAverageDataLightweight[] = [];
  
  // Calculate initial sum for first window
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  
  // Add first SMA value
  result.push({
    time: data[period - 1].time,
    value: sum / period
  });
  
  // Use sliding window for remaining values (O(N) complexity)
  for (let i = period; i < data.length; i++) {
    // Remove oldest value and add newest value
    sum = sum - data[i - period].close + data[i].close;
    result.push({
      time: data[i].time,
      value: sum / period
    });
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param data Array of price data with time and close values
 * @param period EMA period
 * @returns Array of EMA data points
 */
export function calculateEMA(
  data: PriceDataLightweight[], 
  period: number
): MovingAverageDataLightweight[] {
  if (data.length < period) {
    return [];
  }

  const result: MovingAverageDataLightweight[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA value is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  const firstEMA = sum / period;
  result.push({
    time: data[period - 1].time,
    value: firstEMA
  });

  // Calculate subsequent EMA values
  for (let i = period; i < data.length; i++) {
    const emaValue = (data[i].close - result[result.length - 1].value) * multiplier + result[result.length - 1].value;
    result.push({
      time: data[i].time,
      value: emaValue
    });
  }

  return result;
}

/**
 * Calculate multiple moving averages at once
 * @param data Array of price data
 * @param periods Array of periods to calculate
 * @param type Type of moving average ('SMA' | 'EMA')
 * @returns Object with period as key and MA data as value
 */
export function calculateMultipleMovingAverages(
  data: PriceDataLightweight[],
  periods: number[],
  type: 'SMA' | 'EMA' = 'SMA'
): Record<number, MovingAverageDataLightweight[]> {
  const result: Record<number, MovingAverageDataLightweight[]> = {};
  
  for (const period of periods) {
    result[period] = type === 'SMA' 
      ? calculateSMA(data, period)
      : calculateEMA(data, period);
  }
  
  return result;
}

/**
 * Get moving average configuration with colors
 * @param periods Array of periods
 * @returns Array of MA configurations with colors
 */
export function getMovingAverageConfigs(periods: number[]) {
  const colors = ['#ffcc33', '#ff4d8c', '#5db3ff', '#00e676', '#ff6d00'];
  
  return periods.map((period, index) => ({
    period,
    color: colors[index % colors.length],
    title: `MA(${period})`,
  }));
}