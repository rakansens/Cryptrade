import { BaseIndicator } from './base-indicator';
import type { PriceDataLightweight, MovingAverageData, ValidationOptions } from './types';

/**
 * Simple Moving Average (SMA) Indicator
 * 
 * Calculates the arithmetic mean of prices over a specified period.
 * Uses a sliding window approach for O(N) time complexity.
 * 
 * Created: 2025-06-28 - Refactored from calculateSMA function
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
   * Core SMA calculation using sliding window technique
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
    
    // Add first SMA value
    result.push({
      time: data[this.period - 1].time,
      value: sum / this.period
    });
    
    // Use sliding window for remaining values (O(N) complexity)
    for (let i = this.period; i < data.length; i++) {
      // Remove oldest value and add newest value
      sum = sum - data[i - this.period].close + data[i].close;
      
      result.push({
        time: data[i].time,
        value: sum / this.period
      });
    }
    
    return result;
  }
}