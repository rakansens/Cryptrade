import { BaseIndicator } from './base-indicator';
import type { PriceDataLightweight, MovingAverageData, ValidationOptions } from './types';

/**
 * Simple Moving Average (SMA) Indicator
 * 
 * Calculates the simple moving average over a specified period using a sliding window
 * approach for O(N) time complexity performance.
 */
export class SMAIndicator extends BaseIndicator<MovingAverageData> {
  private readonly period: number;

  constructor(period: number, options?: Partial<ValidationOptions>) {
    if (period <= 0) {
      throw new Error('Period must be positive');
    }

    // Set appropriate default validation options for SMA
    const defaultOptions: ValidationOptions = {
      minLength: period,
      checkMonotonic: true,
      allowNaN: false,
      allowInfinity: false,
      ...options
    };

    super('SMA', defaultOptions);
    this.period = period;
  }

  /**
   * Get the period value for this SMA indicator
   */
  public getPeriod(): number {
    return this.period;
  }

  /**
   * Core SMA calculation using sliding window optimization
   * Time complexity: O(N) where N is the data length
   */
  protected calculateCore(data: PriceDataLightweight[]): MovingAverageData[] {
    const result: MovingAverageData[] = [];
    
    if (data.length < this.period) {
      return result;
    }

    // Calculate initial sum for first window
    let sum = 0;
    for (let i = 0; i < this.period; i++) {
      sum += data[i].close;
    }

    // First SMA value
    result.push({
      time: data[this.period - 1].time,
      value: sum / this.period
    });

    // Sliding window: remove first element, add next element
    for (let i = this.period; i < data.length; i++) {
      sum = sum - data[i - this.period].close + data[i].close;
      result.push({
        time: data[i].time,
        value: sum / this.period
      });
    }

    return result;
  }
}