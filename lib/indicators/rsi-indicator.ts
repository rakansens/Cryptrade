import { BaseIndicator } from './base-indicator';
import type { PriceDataLightweight, ValidationOptions } from './types';
import type { RSIData } from '@/types/market';

/**
 * Relative Strength Index (RSI) Indicator
 * 
 * Calculates the RSI using Wilder's smoothing method.
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 * 
 * Created: 2025-06-28 - Refactored from calculateRSI function
 */
export class RSIIndicator extends BaseIndicator<RSIData> {
  private readonly period: number;

  constructor(period: number = 14, options?: Partial<ValidationOptions>) {
    if (period <= 0) {
      throw new Error('Period must be positive');
    }

    // Set appropriate default validation options for RSI
    const defaultOptions: ValidationOptions = {
      minLength: period + 1,
      checkMonotonic: true,
      allowNaN: false,
      allowInfinity: false,
      ...options
    };

    super('RSI', defaultOptions);
    this.period = period;
  }

  /**
   * Get the period value for this RSI indicator
   */
  public getPeriod(): number {
    return this.period;
  }

  /**
   * Core RSI calculation using Wilder's smoothing method
   * Time complexity: O(N) where N is the data length
   */
  protected calculateCore(data: PriceDataLightweight[]): RSIData[] {
    const rsiData: RSIData[] = [];
    
    if (data.length < this.period + 1) {
      return rsiData;
    }

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, this.period).reduce((sum, gain) => sum + gain, 0) / this.period;
    let avgLoss = losses.slice(0, this.period).reduce((sum, loss) => sum + loss, 0) / this.period;

    // Calculate first RSI value
    let firstRSI: number;
    if (avgLoss === 0) {
      // No losses means RS approaches infinity, RSI = 100
      firstRSI = 100;
    } else if (avgGain === 0) {
      // No gains means RS = 0, RSI = 0
      firstRSI = 0;
    } else {
      const firstRS = avgGain / avgLoss;
      firstRSI = 100 - (100 / (1 + firstRS));
    }
    
    rsiData.push({
      time: data[this.period].time,
      rsi: firstRSI
    });

    // Calculate subsequent RSI values using Wilder's smoothing
    for (let i = this.period + 1; i < data.length; i++) {
      const currentGain = gains[i - 1];
      const currentLoss = losses[i - 1];

      // Wilder's smoothing
      avgGain = ((avgGain * (this.period - 1)) + currentGain) / this.period;
      avgLoss = ((avgLoss * (this.period - 1)) + currentLoss) / this.period;

      // Calculate RSI
      let rsi: number;
      if (avgLoss === 0) {
        rsi = 100;
      } else if (avgGain === 0) {
        rsi = 0;
      } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }

      rsiData.push({
        time: data[i].time,
        rsi: rsi
      });
    }

    return rsiData;
  }
}