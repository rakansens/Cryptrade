import { describe, it, expect, jest } from '@jest/globals';
import {
  TimeConverter,
  OHLCVConverter,
  ChartDataPreparation,
  MarketDataConverter,
  safeConvert,
  batchConvert,
  ConversionError
} from '@/lib/chart/data-converters';
import type { BinanceKlineMessage, ProcessedKline } from '@/types/market';

// Mock console.error for testing error handling
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('TimeConverter', () => {
  describe('toChartTime', () => {
    it('should convert milliseconds to seconds', () => {
      const msTimestamp = 1638360000000; // milliseconds
      const result = TimeConverter.toChartTime(msTimestamp);
      expect(result).toBe(1638360000); // seconds
    });

    it('should handle seconds timestamps', () => {
      const secTimestamp = 1638360000; // seconds
      const result = TimeConverter.toChartTime(secTimestamp);
      expect(result).toBe(1638360); // still divides by 1000
    });

    it('should handle string timestamps', () => {
      const stringTimestamp = '1638360000000';
      const result = TimeConverter.toChartTime(stringTimestamp);
      expect(result).toBe(1638360000);
    });

    it('should handle negative timestamps', () => {
      const negativeTimestamp = -1638360000000;
      const result = TimeConverter.toChartTime(negativeTimestamp);
      expect(result).toBe(-1638360000);
    });
  });

  describe('fromChartTime', () => {
    it('should convert seconds back to milliseconds', () => {
      const seconds = 1638360000;
      const result = TimeConverter.fromChartTime(seconds);
      expect(result).toBe(1638360000000);
    });
  });

  describe('now', () => {
    it('should return current timestamp in chart format', () => {
      const before = Math.floor(Date.now() / 1000);
      const result = TimeConverter.now();
      const after = Math.floor(Date.now() / 1000);
      
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('normalize', () => {
    it('should keep reasonable seconds timestamps as-is', () => {
      const reasonableSeconds = 1638360000; // 2021
      const result = TimeConverter.normalize(reasonableSeconds);
      expect(result).toBe(1638360000);
    });

    it('should convert milliseconds to seconds', () => {
      const milliseconds = 1638360000000;
      const result = TimeConverter.normalize(milliseconds);
      expect(result).toBe(1638360000);
    });

    it('should handle string timestamps', () => {
      const stringTimestamp = '1638360000000';
      const result = TimeConverter.normalize(stringTimestamp);
      expect(result).toBe(1638360000);
    });

    it('should throw error for invalid timestamps', () => {
      expect(() => TimeConverter.normalize(null)).toThrow('Invalid timestamp');
      expect(() => TimeConverter.normalize(undefined)).toThrow('Invalid timestamp');
      expect(() => TimeConverter.normalize({})).toThrow('Invalid timestamp');
    });
  });
});

describe('OHLCVConverter', () => {
  const mockBinanceMessage: BinanceKlineMessage = {
    e: 'kline',
    E: 1638360000000,
    s: 'BTCUSDT',
    k: {
      t: 1638360000000, // start time
      T: 1638360059999, // close time
      s: 'BTCUSDT',
      i: '1m',
      f: 100,
      L: 200,
      o: '50000.00',
      c: '50100.00',
      h: '50200.00',
      l: '49900.00',
      v: '10.5',
      n: 100,
      x: true,
      q: '525525.00',
      V: '5.25',
      Q: '262762.50',
      B: '0'
    }
  };

  describe('toNumber', () => {
    it('should convert string numbers to numbers', () => {
      expect(OHLCVConverter.toNumber('50000.123')).toBe(50000.123);
      expect(OHLCVConverter.toNumber('0')).toBe(0);
      expect(OHLCVConverter.toNumber('-100.5')).toBe(-100.5);
    });

    it('should keep numbers as-is', () => {
      expect(OHLCVConverter.toNumber(50000.123)).toBe(50000.123);
    });

    it('should throw error for invalid values', () => {
      expect(() => OHLCVConverter.toNumber('invalid')).toThrow('Invalid value: invalid');
      expect(() => OHLCVConverter.toNumber('abc', 'price')).toThrow('Invalid price: abc');
    });
  });

  describe('fromBinanceWebSocket', () => {
    it('should convert Binance WebSocket message to ProcessedKline', () => {
      const result = OHLCVConverter.fromBinanceWebSocket(mockBinanceMessage);
      
      const expected: ProcessedKline = {
        time: 1638360000, // converted to seconds
        open: 50000.00,
        high: 50200.00,
        low: 49900.00,
        close: 50100.00,
        volume: 10.5
      };

      expect(result).toEqual(expected);
    });

    it('should handle string numeric values correctly', () => {
      const messageWithStrings = {
        ...mockBinanceMessage,
        k: {
          ...mockBinanceMessage.k,
          o: '50000.123',
          c: '50100.456',
          h: '50200.789',
          l: '49900.012',
          v: '10.555'
        }
      };

      const result = OHLCVConverter.fromBinanceWebSocket(messageWithStrings);

      expect(result.open).toBe(50000.123);
      expect(result.close).toBe(50100.456);
      expect(result.high).toBe(50200.789);
      expect(result.low).toBe(49900.012);
      expect(result.volume).toBe(10.555);
    });

    it('should throw error for invalid numeric values', () => {
      const invalidMessage = {
        ...mockBinanceMessage,
        k: {
          ...mockBinanceMessage.k,
          o: 'invalid'
        }
      };

      expect(() => OHLCVConverter.fromBinanceWebSocket(invalidMessage))
        .toThrow('Invalid open: invalid');
    });
  });

  describe('fromBinanceTuple', () => {
    it('should convert Binance tuple to ProcessedKline', () => {
      const tuple = [
        1638360000000, // timestamp
        '50000.00',    // open
        '50200.00',    // high
        '49900.00',    // low
        '50100.00',    // close
        '10.5',        // volume
        1638360059999, // close time
        '525525.00',   // quote volume
        100,           // count
        '5.25',        // taker buy volume
        '262762.50',   // taker buy quote volume
        '0'            // ignore
      ];

      const result = OHLCVConverter.fromBinanceTuple(tuple);
      
      expect(result).toEqual({
        time: 1638360000,
        open: 50000.00,
        high: 50200.00,
        low: 49900.00,
        close: 50100.00,
        volume: 10.5
      });
    });

    it('should throw error for invalid tuple', () => {
      expect(() => OHLCVConverter.fromBinanceTuple([])).toThrow('Invalid Binance kline data');
      expect(() => OHLCVConverter.fromBinanceTuple([1, 2, 3])).toThrow('Invalid Binance kline data');
    });
  });

  describe('fromBinanceTuples', () => {
    it('should convert array of tuples', () => {
      const tuples = [
        [1638360000000, '50000', '50200', '49900', '50100', '10.5', 1638360059999, '525525', 100, '5.25', '262762.50', '0'],
        [1638360060000, '50100', '50300', '50000', '50200', '12.3', 1638360119999, '620000', 120, '6.0', '300000', '0']
      ];

      const result = OHLCVConverter.fromBinanceTuples(tuples);
      
      expect(result.length).toBe(2);
      expect(result[0].time).toBe(1638360000);
      expect(result[1].time).toBe(1638360060);
    });
  });

  describe('validate', () => {
    it('should validate correct OHLCV data', () => {
      const validKline: ProcessedKline = {
        time: 1638360000,
        open: 50000,
        high: 50200,
        low: 49900,
        close: 50100,
        volume: 10.5
      };

      expect(OHLCVConverter.validate(validKline)).toBe(true);
    });

    it('should reject invalid OHLC relationships', () => {
      const invalidKline: ProcessedKline = {
        time: 1638360000,
        open: 50000,
        high: 49000, // high < open (invalid)
        low: 49900,
        close: 50100,
        volume: 10.5
      };

      expect(OHLCVConverter.validate(invalidKline)).toBe(false);
    });

    it('should reject negative prices', () => {
      const invalidKline: ProcessedKline = {
        time: 1638360000,
        open: -50000, // negative price
        high: 50200,
        low: 49900,
        close: 50100,
        volume: 10.5
      };

      expect(OHLCVConverter.validate(invalidKline)).toBe(false);
    });
  });
});

describe('ChartDataPreparation', () => {
  const sampleKlines: ProcessedKline[] = [
    { time: 1638360000, open: 50000, high: 50200, low: 49900, close: 50100, volume: 10.5 },
    { time: 1638360060, open: 50100, high: 50300, low: 50000, close: 50200, volume: 12.3 },
    { time: 1638360120, open: 50200, high: 50400, low: 50100, close: 50300, volume: 8.7 }
  ];

  describe('forLightweightCharts', () => {
    it('should prepare data for lightweight charts', () => {
      const result = ChartDataPreparation.forLightweightCharts(sampleKlines);
      
      expect(result.length).toBe(3);
      expect(result[0].time).toBe(1638360000);
      expect(result[0].open).toBe(50000);
      
      // Should maintain order
      expect(result[0].time).toBeLessThan(result[1].time);
      expect(result[1].time).toBeLessThan(result[2].time);
    });

    it('should filter out invalid data', () => {
      const mixedData = [
        ...sampleKlines,
        { time: 1638360180, open: -1, high: 50500, low: 50200, close: 50400, volume: 5.0 } // invalid (negative open)
      ];

      const result = ChartDataPreparation.forLightweightCharts(mixedData);
      
      expect(result.length).toBe(3); // invalid data filtered out
    });

    it('should handle empty data', () => {
      const result = ChartDataPreparation.forLightweightCharts([]);
      expect(result).toEqual([]);
    });
  });

  describe('mergeKlineData', () => {
    it('should merge new data with existing data', () => {
      const existing = sampleKlines.slice(0, 2);
      const newData = [sampleKlines[2]];
      
      const result = ChartDataPreparation.mergeKlineData(existing, newData);
      
      expect(result.length).toBe(3);
      expect(result[2].time).toBe(1638360120);
    });

    it('should update existing timestamps with new data', () => {
      const existing = sampleKlines.slice(0, 2);
      const updatedData = [{
        time: 1638360060,
        open: 50100,
        high: 50350, // updated
        low: 50000,
        close: 50250, // updated
        volume: 15.0   // updated
      }];
      
      const result = ChartDataPreparation.mergeKlineData(existing, updatedData);
      
      expect(result.length).toBe(2);
      const updated = result.find(k => k.time === 1638360060);
      expect(updated?.high).toBe(50350);
      expect(updated?.close).toBe(50250);
      expect(updated?.volume).toBe(15.0);
    });

    it('should maintain chronological order', () => {
      const existing = [sampleKlines[0], sampleKlines[2]];
      const newData = [sampleKlines[1]]; // insert in middle
      
      const result = ChartDataPreparation.mergeKlineData(existing, newData);
      
      expect(result.length).toBe(3);
      expect(result[0].time).toBe(1638360000);
      expect(result[1].time).toBe(1638360060);
      expect(result[2].time).toBe(1638360120);
    });
  });

  describe('calculateStats', () => {
    it('should calculate basic statistics', () => {
      const stats = ChartDataPreparation.calculateStats(sampleKlines);
      
      expect(stats.count).toBe(3);
      expect(stats.minPrice).toBe(49900);
      expect(stats.maxPrice).toBe(50400);
      expect(stats.totalVolume).toBeCloseTo(31.5);
      expect(stats.avgPrice).toBeCloseTo(50150); // avg of all (open+close)/2
    });

    it('should handle single data point', () => {
      const singleKline = [sampleKlines[0]];
      const stats = ChartDataPreparation.calculateStats(singleKline);
      
      expect(stats.count).toBe(1);
      expect(stats.minPrice).toBe(49900);
      expect(stats.maxPrice).toBe(50200);
      expect(stats.avgPrice).toBe(50050); // (50000 + 50100) / 2
    });

    it('should handle empty data', () => {
      const stats = ChartDataPreparation.calculateStats([]);
      
      expect(stats.count).toBe(0);
      expect(stats.minPrice).toBe(0);
      expect(stats.maxPrice).toBe(0);
      expect(stats.avgPrice).toBe(0);
      expect(stats.totalVolume).toBe(0);
    });
  });

  describe('getLastN', () => {
    it('should return last N data points', () => {
      const result = ChartDataPreparation.getLastN(sampleKlines, 2);
      expect(result.length).toBe(2);
      expect(result[0].time).toBe(1638360060);
      expect(result[1].time).toBe(1638360120);
    });

    it('should return all data if N > length', () => {
      const result = ChartDataPreparation.getLastN(sampleKlines, 10);
      expect(result.length).toBe(3);
    });
  });

  describe('filterByTimeRange', () => {
    it('should filter data by time range', () => {
      const result = ChartDataPreparation.filterByTimeRange(
        sampleKlines, 
        1638360000, 
        1638360060
      );
      
      expect(result.length).toBe(2);
      expect(result[0].time).toBe(1638360000);
      expect(result[1].time).toBe(1638360060);
    });
  });
});

describe('MarketDataConverter', () => {
  const sampleKline: ProcessedKline = {
    time: 1638360000,
    open: 50000,
    high: 50200,
    low: 49900,
    close: 50100,
    volume: 10.5
  };

  describe('toMarketData', () => {
    it('should convert ProcessedKline to MarketData', () => {
      const result = MarketDataConverter.toMarketData(sampleKline, 'BTCUSDT');
      
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.price).toBe(50100);
      expect(result.timestamp).toBe(1638360000000); // converted back to ms
      expect(result.volume).toBe(10.5);
      expect(result.change).toBe(0);
      expect(result.changePercent).toBe(0);
    });
  });

  describe('toMarketDataWithChanges', () => {
    it('should convert klines to market data with price changes', () => {
      const klines = [
        { time: 1638360000, open: 50000, high: 50200, low: 49900, close: 50100, volume: 10.5 },
        { time: 1638360060, open: 50100, high: 50300, low: 50000, close: 50200, volume: 12.3 }
      ];
      
      const result = MarketDataConverter.toMarketDataWithChanges(klines, 'BTCUSDT');
      
      expect(result.length).toBe(2);
      
      // First item should have no change
      expect(result[0].change).toBe(0);
      expect(result[0].changePercent).toBe(0);
      
      // Second item should have change
      expect(result[1].change).toBe(100); // 50200 - 50100
      expect(result[1].changePercent).toBeCloseTo(0.1996, 4); // (100/50100) * 100
    });
  });
});

describe('safeConvert', () => {
  it('should return result for successful conversion', () => {
    const converter = (x: number) => x * 2;
    const result = safeConvert(5, converter, 'test');
    expect(result).toBe(10);
  });

  it('should return null for failed conversion', () => {
    const converter = () => { throw new Error('Test error'); };
    const result = safeConvert(5, converter, 'test');
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('batchConvert', () => {
  it('should convert all valid items', () => {
    const data = [1, 2, 3, 4];
    const converter = (x: number) => x * 2;
    
    const result = batchConvert(data, converter);
    expect(result).toEqual([2, 4, 6, 8]);
  });

  it('should skip errors by default', () => {
    const data = [1, 2, 3, 4];
    const converter = (x: number) => {
      if (x === 3) throw new Error('Test error');
      return x * 2;
    };
    
    const result = batchConvert(data, converter);
    expect(result).toEqual([2, 4, 8]); // item 3 skipped
    expect(console.error).toHaveBeenCalled();
  });

  it('should throw error when skipErrors is false', () => {
    const data = [1, 2, 3, 4];
    const converter = (x: number) => {
      if (x === 3) throw new Error('Test error');
      return x * 2;
    };
    
    expect(() => batchConvert(data, converter, { skipErrors: false }))
      .toThrow(ConversionError);
  });

  it('should handle empty array', () => {
    const result = batchConvert([], (x: number) => x * 2);
    expect(result).toEqual([]);
  });
});