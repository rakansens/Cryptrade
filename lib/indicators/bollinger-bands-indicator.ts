import { BaseIndicator } from './base-indicator';
import type { PriceDataLightweight, ValidationOptions } from './types';
import type { UTCTimestamp } from 'lightweight-charts';

export interface BollingerBandsData {
  time: UTCTimestamp | number;
  upper: number;
  middle: number;  // SMA
  lower: number;
}

/**
 * Bollinger Bands Indicator
 * 
 * Calculates the upper, middle (SMA), and lower bands.
 * - Middle Band = SMA(period)
 * - Upper Band = Middle Band + (Standard Deviation × Multiplier)
 * - Lower Band = Middle Band - (Standard Deviation × Multiplier)
 * 
 * Created: 2025-06-28 - Refactored from calculateBollingerBands function
 */
export class BollingerBandsIndicator extends BaseIndicator<BollingerBandsData> {
  private readonly period: number;
  private readonly stdDev: number;

  constructor(
    period: number = 20,
    stdDev: number = 2,
    options?: Partial<ValidationOptions>
  ) {
    if (period <= 0) {
      throw new Error('Period must be positive');
    }
    
    if (stdDev <= 0) {
      throw new Error('Standard deviation multiplier must be positive');
    }

    // Set appropriate default validation options for Bollinger Bands
    const defaultOptions: ValidationOptions = {
      minLength: period,
      checkMonotonic: true,
      allowNaN: false,
      allowInfinity: false,
      ...options
    };

    super('BollingerBands', defaultOptions);
    
    this.period = period;
    this.stdDev = stdDev;
  }

  /**
   * Get the period value
   */
  public getPeriod(): number {
    return this.period;
  }

  /**
   * Get the standard deviation multiplier
   */
  public getStdDev(): number {
    return this.stdDev;
  }

  /**
   * Core Bollinger Bands calculation using sliding window technique
   * Time complexity: O(N) where N is the data length
   */
  protected calculateCore(data: PriceDataLightweight[]): BollingerBandsData[] {
    const result: BollingerBandsData[] = [];
    
    if (data.length < this.period) {
      return result;
    }

    // Initialize first window sums
    let sum = 0;
    let sumSquares = 0;
    
    for (let i = 0; i < this.period; i++) {
      sum += data[i].close;
      sumSquares += data[i].close * data[i].close;
    }

    // Calculate first point
    const firstSma = sum / this.period;
    const firstVariance = (sumSquares / this.period) - (firstSma * firstSma);
    const firstStdDev = Math.sqrt(Math.max(0, firstVariance)); // Ensure non-negative
    
    result.push({
      time: data[this.period - 1].time,
      upper: firstSma + (firstStdDev * this.stdDev),
      middle: firstSma,
      lower: firstSma - (firstStdDev * this.stdDev),
    });

    // Use sliding window for remaining values (O(N) complexity)
    for (let i = this.period; i < data.length; i++) {
      // Update sliding window sums
      const oldValue = data[i - this.period].close;
      const newValue = data[i].close;
      
      sum = sum - oldValue + newValue;
      sumSquares = sumSquares - (oldValue * oldValue) + (newValue * newValue);
      
      // Calculate SMA and standard deviation
      const sma = sum / this.period;
      const variance = (sumSquares / this.period) - (sma * sma);
      const standardDeviation = Math.sqrt(Math.max(0, variance)); // Ensure non-negative

      result.push({
        time: data[i].time,
        upper: sma + (standardDeviation * this.stdDev),
        middle: sma,
        lower: sma - (standardDeviation * this.stdDev),
      });
    }
    
    return result;
  }

  /**
   * Custom output validation to ensure upper > middle > lower
   */
  protected customValidateOutput(
    result: BollingerBandsData[]
  ): { valid: boolean; error?: string } {
    for (const band of result) {
      if (band.upper < band.middle || band.middle < band.lower) {
        return { 
          valid: false, 
          error: 'Invalid Bollinger Bands: upper must be >= middle >= lower' 
        };
      }
    }
    return { valid: true };
  }
}

/**
 * Get Bollinger Band configuration with defaults
 */
export function getBollingerBandsConfig(
  period?: number,
  stdDev?: number
): { period: number; stdDev: number } {
  return {
    period: period ?? 20,
    stdDev: stdDev ?? 2
  };
}