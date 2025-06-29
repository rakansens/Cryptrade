/**
 * Unified Chart Data Converters
 * 
 * Consolidates chart data transformation patterns found across the codebase.
 * Eliminates duplication in time conversion, OHLCV formatting, and data structure mapping.
 */

import type { 
  ProcessedKline, 
  BinanceKlineMessage, 
  BinanceKlineData,
  MarketData 
} from '@/types/market';

/**
 * Time conversion utilities
 */
export class TimeConverter {
  /**
   * Convert milliseconds to seconds (for LightweightCharts)
   * Handles both number and string timestamps
   */
  static toChartTime(timestamp: number | string): number {
    const ms = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    return Math.floor(ms / 1000);
  }

  /**
   * Convert seconds back to milliseconds
   */
  static fromChartTime(seconds: number): number {
    return seconds * 1000;
  }

  /**
   * Get current chart time
   */
  static now(): number {
    return this.toChartTime(Date.now());
  }

  /**
   * Validate and normalize timestamp
   */
  static normalize(timestamp: unknown): number {
    if (typeof timestamp === 'number') {
      // If already in seconds (reasonable chart timestamp)
      if (timestamp > 1000000000 && timestamp < 2000000000) {
        return timestamp;
      }
      // If in milliseconds
      return this.toChartTime(timestamp);
    }
    
    if (typeof timestamp === 'string') {
      return this.toChartTime(Number(timestamp));
    }
    
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
}

/**
 * OHLCV data conversion utilities
 */
export class OHLCVConverter {
  /**
   * Convert string values to numbers with validation
   */
  static toNumber(value: string | number, name: string = 'value'): number {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) {
      throw new Error(`Invalid ${name}: ${value}`);
    }
    
    return num;
  }

  /**
   * Convert Binance Kline tuple to ProcessedKline
   */
  static fromBinanceTuple(kline: (string | number)[]): ProcessedKline {
    if (!Array.isArray(kline) || kline.length < 11) {
      throw new Error('Invalid Binance kline data');
    }

    return {
      time: TimeConverter.toChartTime(kline[0]),
      open: this.toNumber(kline[1], 'open'),
      high: this.toNumber(kline[2], 'high'),
      low: this.toNumber(kline[3], 'low'),
      close: this.toNumber(kline[4], 'close'),
      volume: this.toNumber(kline[5], 'volume'),
    };
  }

  /**
   * Convert Binance WebSocket message to ProcessedKline
   */
  static fromBinanceWebSocket(data: BinanceKlineMessage): ProcessedKline {
    const k = data.k;
    
    return {
      time: TimeConverter.toChartTime(k.t),
      open: this.toNumber(k.o, 'open'),
      high: this.toNumber(k.h, 'high'),
      low: this.toNumber(k.l, 'low'),
      close: this.toNumber(k.c, 'close'),
      volume: this.toNumber(k.v, 'volume'),
    };
  }

  /**
   * Convert any Binance kline data to ProcessedKline
   */
  static fromBinanceKlineData(data: BinanceKlineData): ProcessedKline {
    return {
      time: TimeConverter.toChartTime(data.openTime),
      open: this.toNumber(data.open, 'open'),
      high: this.toNumber(data.high, 'high'),
      low: this.toNumber(data.low, 'low'),
      close: this.toNumber(data.close, 'close'),
      volume: this.toNumber(data.volume, 'volume'),
    };
  }

  /**
   * Convert array of Binance tuples to ProcessedKline array
   */
  static fromBinanceTuples(klines: (string | number)[][]): ProcessedKline[] {
    return klines.map(kline => this.fromBinanceTuple(kline));
  }

  /**
   * Validate OHLCV data integrity
   */
  static validate(data: ProcessedKline): boolean {
    const { open, high, low, close } = data;
    
    // Basic price validation
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      return false;
    }
    
    // All values should be positive
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      return false;
    }
    
    return true;
  }
}

/**
 * Chart data preparation utilities
 */
export class ChartDataPreparation {
  /**
   * Prepare data for LightweightCharts with proper formatting
   */
  static forLightweightCharts(data: ProcessedKline[]): ProcessedKline[] {
    return data
      .filter(OHLCVConverter.validate)
      .sort((a, b) => a.time - b.time)
      .map(item => ({
        ...item,
        time: TimeConverter.normalize(item.time),
      }));
  }

  /**
   * Merge new data with existing data, handling duplicates
   */
  static mergeKlineData(
    existing: ProcessedKline[], 
    newData: ProcessedKline[]
  ): ProcessedKline[] {
    const timeMap = new Map<number, ProcessedKline>();
    
    // Add existing data
    existing.forEach(item => {
      timeMap.set(item.time, item);
    });
    
    // Add/update with new data
    newData.forEach(item => {
      timeMap.set(item.time, item);
    });
    
    // Convert back to array and sort
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Get last N data points
   */
  static getLastN(data: ProcessedKline[], n: number): ProcessedKline[] {
    return data.slice(-n);
  }

  /**
   * Filter data by time range
   */
  static filterByTimeRange(
    data: ProcessedKline[], 
    startTime: number, 
    endTime: number
  ): ProcessedKline[] {
    return data.filter(item => 
      item.time >= startTime && item.time <= endTime
    );
  }

  /**
   * Calculate price statistics
   */
  static calculateStats(data: ProcessedKline[]): {
    count: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    totalVolume: number;
  } {
    if (data.length === 0) {
      return {
        count: 0,
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
        totalVolume: 0,
      };
    }

    let minPrice = data[0].low;
    let maxPrice = data[0].high;
    let totalPrice = 0;
    let totalVolume = 0;

    data.forEach(item => {
      minPrice = Math.min(minPrice, item.low);
      maxPrice = Math.max(maxPrice, item.high);
      totalPrice += (item.open + item.close) / 2; // Average of open and close
      totalVolume += item.volume;
    });

    return {
      count: data.length,
      minPrice,
      maxPrice,
      avgPrice: totalPrice / data.length,
      totalVolume,
    };
  }
}

/**
 * Market data converters for various data sources
 */
export class MarketDataConverter {
  /**
   * Convert ProcessedKline to MarketData format
   */
  static toMarketData(kline: ProcessedKline, symbol: string): MarketData {
    return {
      symbol,
      price: kline.close,
      timestamp: TimeConverter.fromChartTime(kline.time),
      volume: kline.volume,
      change: 0, // Would need previous data to calculate
      changePercent: 0, // Would need previous data to calculate
    };
  }

  /**
   * Convert multiple klines to market data with price changes
   */
  static toMarketDataWithChanges(
    klines: ProcessedKline[], 
    symbol: string
  ): MarketData[] {
    return klines.map((kline, index) => {
      const prevKline = index > 0 ? klines[index - 1] : null;
      const change = prevKline ? kline.close - prevKline.close : 0;
      const changePercent = prevKline ? (change / prevKline.close) * 100 : 0;

      return {
        symbol,
        price: kline.close,
        timestamp: TimeConverter.fromChartTime(kline.time),
        volume: kline.volume,
        change,
        changePercent,
      };
    });
  }
}

/**
 * Error handling for data conversion
 */
export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly data?: any,
    public readonly context?: string
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

/**
 * Safe conversion wrapper with error handling
 */
export function safeConvert<T, R>(
  data: T,
  converter: (data: T) => R,
  context?: string
): R | null {
  try {
    return converter(data);
  } catch (error) {
    console.error(`Conversion failed in ${context}:`, error, data);
    return null;
  }
}

/**
 * Batch conversion with error resilience
 */
export function batchConvert<T, R>(
  data: T[],
  converter: (item: T) => R,
  options?: {
    skipErrors?: boolean;
    logErrors?: boolean;
    context?: string;
  }
): R[] {
  const { skipErrors = true, logErrors = true, context = 'batch conversion' } = options || {};
  const results: R[] = [];

  data.forEach((item, index) => {
    try {
      const result = converter(item);
      results.push(result);
    } catch (error) {
      if (logErrors) {
        console.error(`${context} failed at index ${index}:`, error, item);
      }
      
      if (!skipErrors) {
        throw new ConversionError(
          `Batch conversion failed at index ${index}`,
          item,
          context
        );
      }
    }
  });

  return results;
}