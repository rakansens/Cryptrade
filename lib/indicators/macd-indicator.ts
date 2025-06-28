import { BaseIndicator } from './base-indicator';
import { EMAIndicator } from './ema-indicator';
import type { PriceDataLightweight, ValidationOptions } from './types';
import type { MACDData } from '@/types/market';
import type { UTCTimestamp } from 'lightweight-charts';

/**
 * MACD (Moving Average Convergence Divergence) Indicator
 * 
 * Calculates the MACD line, signal line, and histogram.
 * - MACD Line = EMA(12) - EMA(26)
 * - Signal Line = EMA(9) of MACD Line
 * - Histogram = MACD Line - Signal Line
 * 
 * Created: 2025-06-28 - Refactored from calculateMACD function
 */
export class MACDIndicator extends BaseIndicator<MACDData> {
  private readonly fastPeriod: number;
  private readonly slowPeriod: number;
  private readonly signalPeriod: number;
  private readonly fastEMA: EMAIndicator;
  private readonly slowEMA: EMAIndicator;
  private readonly signalEMA: EMAIndicator;

  constructor(
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
    options?: Partial<ValidationOptions>
  ) {
    if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
      throw new Error('All periods must be positive');
    }
    
    if (fastPeriod >= slowPeriod) {
      throw new Error('Fast period must be less than slow period');
    }

    // Set appropriate default validation options for MACD
    const defaultOptions: ValidationOptions = {
      minLength: slowPeriod + signalPeriod,
      checkMonotonic: true,
      allowNaN: false,
      allowInfinity: false,
      ...options
    };

    super('MACD', defaultOptions);
    
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
    
    // Create EMA indicators for calculations
    this.fastEMA = new EMAIndicator(fastPeriod);
    this.slowEMA = new EMAIndicator(slowPeriod);
    this.signalEMA = new EMAIndicator(signalPeriod);
  }

  /**
   * Get the fast period value
   */
  public getFastPeriod(): number {
    return this.fastPeriod;
  }

  /**
   * Get the slow period value
   */
  public getSlowPeriod(): number {
    return this.slowPeriod;
  }

  /**
   * Get the signal period value
   */
  public getSignalPeriod(): number {
    return this.signalPeriod;
  }

  /**
   * Core MACD calculation
   * Time complexity: O(N) where N is the data length
   */
  protected calculateCore(data: PriceDataLightweight[]): MACDData[] {
    const result: MACDData[] = [];
    
    if (data.length < this.slowPeriod + this.signalPeriod) {
      return result;
    }

    // Calculate fast and slow EMAs
    const fastEMAData = this.fastEMA.calculate(data);
    const slowEMAData = this.slowEMA.calculate(data);
    
    // Calculate MACD line (fast EMA - slow EMA)
    const macdLineData: { time: UTCTimestamp; value: number }[] = [];
    
    // Align the EMAs - slow EMA starts later than fast EMA
    const startIndex = this.slowPeriod - this.fastPeriod;
    
    for (let i = 0; i < slowEMAData.length; i++) {
      const fastIndex = i + startIndex;
      if (fastIndex < fastEMAData.length) {
        const macdValue = fastEMAData[fastIndex].value - slowEMAData[i].value;
        macdLineData.push({
          time: slowEMAData[i].time,
          value: macdValue
        });
      }
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalLineData = this.signalEMA.calculate(
      macdLineData.map(d => ({
        time: d.time,
        close: d.value
      }))
    );
    
    // Build final result with MACD, signal, and histogram
    // Start from the last signal value to match original implementation
    for (let i = 0; i < signalLineData.length; i++) {
      const macdIndex = i + this.signalPeriod - 1;
      if (macdIndex < macdLineData.length) {
        const macdValue = macdLineData[macdIndex].value;
        const signalValue = signalLineData[i].value;
        const histogram = macdValue - signalValue;
        
        // Map time back to original data
        const originalDataIndex = this.slowPeriod + this.signalPeriod - 1 + i;
        if (originalDataIndex < data.length) {
          result.push({
            time: data[originalDataIndex].time,
            macd: macdValue,
            signal: signalValue,
            histogram: histogram
          });
        }
      }
    }
    
    return result;
  }
}

/**
 * Get the color for MACD histogram
 */
export function getMACDColor(histogram: number): string {
  return histogram >= 0 ? '#0ddfba' : '#ff4d4d';
}

/**
 * Determine MACD signal (bullish/bearish crossover)
 */
export function getMACDSignal(
  macd: number, 
  signal: number, 
  prevMacd: number, 
  prevSignal: number
): 'bullish' | 'bearish' | 'neutral' {
  // Bullish crossover: MACD crosses above Signal
  if (macd > signal && prevMacd <= prevSignal) return 'bullish';
  
  // Bearish crossover: MACD crosses below Signal
  if (macd < signal && prevMacd >= prevSignal) return 'bearish';
  
  return 'neutral';
}