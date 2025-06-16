import type { UTCTimestamp } from 'lightweight-charts';
import { validatePriceData, handleIndicatorError } from './validation';
import { logger } from '@/lib/utils/logger';

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
  // 入力データの検証
  const validation = validatePriceData(data as any, {
    minLength: period,
    checkMonotonic: true,
    allowNaN: false,
    allowInfinity: false
  });

  if (!validation.valid) {
    return handleIndicatorError('SMA', new Error(validation.error!), []);
  }

  if (validation.warnings) {
    validation.warnings.forEach(warning => {
      logger.warn(`[SMA] ${warning}`);
    });
  }

  try {
    const result: MovingAverageDataLightweight[] = [];
    
    // Calculate initial sum for first window
    let sum = 0;
    for (let i = 0; i < period; i++) {
      const candle = data[i];
      if (candle) {
        sum += candle.close;
      }
    }
    
    // Add first SMA value
    const firstCandle = data[period - 1];
    if (firstCandle) {
      result.push({
        time: firstCandle.time,
        value: sum / period
      });
    }
    
    // Use sliding window for remaining values (O(N) complexity)
    for (let i = period; i < data.length; i++) {
      const oldCandle = data[i - period];
      const newCandle = data[i];
      if (oldCandle && newCandle) {
        // Remove oldest value and add newest value
        sum = sum - oldCandle.close + newCandle.close;
        result.push({
          time: newCandle.time,
          value: sum / period
        });
      }
    }
    
    return result;
  } catch (error) {
    return handleIndicatorError('SMA', error, []);
  }
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
  // 入力データの検証
  const validation = validatePriceData(data as any, {
    minLength: period,
    checkMonotonic: true,
    allowNaN: false,
    allowInfinity: false
  });

  if (!validation.valid) {
    return handleIndicatorError('EMA', new Error(validation.error!), []);
  }

  if (validation.warnings) {
    validation.warnings.forEach(warning => {
      logger.warn(`[EMA] ${warning}`);
    });
  }

  try {
    const result: MovingAverageDataLightweight[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      const candle = data[i];
      if (candle) {
        sum += candle.close;
      }
    }
    const firstEMA = sum / period;
    const firstCandle = data[period - 1];
    if (firstCandle) {
      result.push({
        time: firstCandle.time,
        value: firstEMA
      });
    }

    // Calculate subsequent EMA values
    for (let i = period; i < data.length; i++) {
      const candle = data[i];
      const lastResult = result[result.length - 1];
      if (candle && lastResult) {
        const emaValue = (candle.close - lastResult.value) * multiplier + lastResult.value;
        result.push({
          time: candle.time,
          value: emaValue
        });
      }
    }

    return result;
  } catch (error) {
    return handleIndicatorError('EMA', error, []);
  }
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