import { BaseIndicator } from './base-indicator';
import type { PriceDataLightweight, MovingAverageData, ValidationOptions } from './types';

/**
 * Exponential Moving Average (EMA) Indicator
 * 
 * Calculates the exponential moving average which gives more weight to recent prices.
 * Uses the smoothing factor alpha = 2 / (period + 1) for the calculation.
 * The first EMA value is calculated as a Simple Moving Average (SMA).
 */
export class EMAIndicator extends BaseIndicator<MovingAverageData> {
  private readonly period: number;
  private readonly alpha: number; // Smoothing factor

  constructor(period: number, options?: Partial<ValidationOptions>) {
    if (period <= 0) {
      throw new Error('Period must be positive');
    }

    // Set appropriate default validation options for EMA
    const defaultOptions: ValidationOptions = {
      minLength: period,
      checkMonotonic: true,
      allowNaN: false,
      allowInfinity: false,
      ...options
    };

    super('EMA', defaultOptions);
    this.period = period;
    this.alpha = 2 / (period + 1); // Standard EMA smoothing factor
  }

  /**
   * Get the period value for this EMA indicator
   */
  public getPeriod(): number {
    return this.period;
  }

  /**
   * Get the alpha (smoothing factor) value for this EMA indicator
   */
  public getAlpha(): number {
    return this.alpha;
  }

  /**
   * Core EMA calculation using exponential smoothing
   * Time complexity: O(N) where N is the data length
   */
  protected calculateCore(data: PriceDataLightweight[]): MovingAverageData[] {
    const result: MovingAverageData[] = [];
    
    if (data.length < this.period) {
      return result;
    }

    // Calculate the first EMA value as SMA (Simple Moving Average)
    let sum = 0;
    for (let i = 0; i < this.period; i++) {
      sum += data[i].close;
    }
    
    let previousEMA = sum / this.period;
    result.push({
      time: data[this.period - 1].time,
      value: previousEMA
    });

    // Calculate subsequent EMA values using the exponential smoothing formula
    // EMA = (price * alpha) + (previous_EMA * (1 - alpha))
    for (let i = this.period; i < data.length; i++) {
      const currentPrice = data[i].close;
      const currentEMA = (currentPrice * this.alpha) + (previousEMA * (1 - this.alpha));
      
      result.push({
        time: data[i].time,
        value: currentEMA
      });
      
      previousEMA = currentEMA;
    }

    return result;
  }
}