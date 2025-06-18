import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  computeRSI,
  computeATR,
  computeSupportResistance,
  computeMACD,
  computeTrendStrength,
  computeSupportResistanceDetailed,
  calculateMACD,
  calculateRSI,
  calculateBollingerBands,
  calculateSMA
} from '@/lib/utils/indicators';
import type { ProcessedKline } from '@/types/market';

// Mock dependencies
jest.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test'
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn()
  }
}));

// Mock the new indicator modules
jest.mock('@/lib/indicators/macd', () => ({
  calculateMACD: jest.fn().mockImplementation((data) => {
    return data.map((item: any, index: number) => ({
      time: item.time,
      macd: index * 0.1,
      signal: index * 0.05,
      histogram: index * 0.05
    }));
  })
}));

jest.mock('@/lib/indicators/rsi', () => ({
  calculateRSI: jest.fn().mockImplementation((data, period) => {
    return data.map((item: any, index: number) => ({
      time: item.time,
      value: 50 + index
    }));
  })
}));

jest.mock('@/lib/indicators/bollinger-bands', () => ({
  calculateBollingerBands: jest.fn().mockImplementation((data, period, stdDev) => {
    return data.map((item: any) => ({
      time: item.time,
      upper: item.close * 1.02,
      middle: item.close,
      lower: item.close * 0.98
    }));
  })
}));

jest.mock('@/lib/indicators/moving-average', () => ({
  calculateSMA: jest.fn().mockImplementation((data, period) => {
    return data.map((item: any, index: number) => ({
      time: item.time,
      value: item.close
    }));
  })
}));

describe('indicators utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createKline = (overrides: Partial<ProcessedKline> = {}): ProcessedKline => ({
    time: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    interval: '1h',
    symbol: 'BTCUSDT',
    ...overrides
  });

  describe('computeRSI', () => {
    it('should return 0 if not enough data', () => {
      const klines = Array.from({ length: 10 }, (_, i) => 
        createKline({ close: 100 + i })
      );
      
      const result = computeRSI(klines, 14);
      expect(result).toBe(0);
    });

    it('should calculate RSI correctly with upward trend', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ close: 100 + i * 2 })
      );
      
      const result = computeRSI(klines, 14);
      expect(result).toBeGreaterThan(70); // Strong upward trend
    });

    it('should calculate RSI correctly with downward trend', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ close: 200 - i * 2 })
      );
      
      const result = computeRSI(klines, 14);
      expect(result).toBeLessThan(30); // Strong downward trend
    });

    it('should return 100 when no losses', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ close: 100 + i * 0.1 }) // Small consistent gains
      );
      
      const result = computeRSI(klines, 14);
      expect(result).toBe(100);
    });

    it('should handle empty array', () => {
      const result = computeRSI([], 14);
      expect(result).toBe(0);
    });

    it('should handle undefined values in klines', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        i === 10 ? undefined : createKline({ close: 100 + i })
      ).filter(Boolean) as ProcessedKline[];
      
      const result = computeRSI(klines, 14);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('computeATR', () => {
    it('should return 0 if not enough data', () => {
      const klines = Array.from({ length: 10 }, () => createKline());
      const result = computeATR(klines, 14);
      expect(result).toBe(0);
    });

    it('should calculate ATR for volatile market', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({
          high: 100 + (i % 2 ? 20 : 0),
          low: 100 - (i % 2 ? 20 : 0),
          close: 100
        })
      );
      
      const result = computeATR(klines, 14);
      expect(result).toBeGreaterThan(10);
    });

    it('should calculate ATR for stable market', () => {
      const klines = Array.from({ length: 20 }, () => 
        createKline({
          high: 101,
          low: 99,
          close: 100
        })
      );
      
      const result = computeATR(klines, 14);
      expect(result).toBeLessThan(5);
    });

    it('should handle single kline', () => {
      const result = computeATR([createKline()], 14);
      expect(result).toBe(0);
    });

    it('should handle edge case with exact period length', () => {
      const klines = Array.from({ length: 15 }, () => createKline());
      const result = computeATR(klines, 14);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeSupportResistance', () => {
    it('should find support and resistance levels', () => {
      const klines = [
        createKline({ high: 120, low: 80 }),
        createKline({ high: 115, low: 85 }),
        createKline({ high: 110, low: 90 }),
        createKline({ high: 105, low: 95 }),
        createKline({ high: 100, low: 100 })
      ];
      
      const result = computeSupportResistance(klines, 3);
      
      expect(result.resistance).toHaveLength(3);
      expect(result.resistance[0]).toBe(120);
      expect(result.resistance[1]).toBe(115);
      expect(result.resistance[2]).toBe(110);
      
      expect(result.support).toHaveLength(3);
      expect(result.support[0]).toBe(80);
      expect(result.support[1]).toBe(85);
      expect(result.support[2]).toBe(90);
    });

    it('should handle empty klines', () => {
      const result = computeSupportResistance([], 3);
      expect(result.resistance).toEqual([]);
      expect(result.support).toEqual([]);
    });

    it('should handle count larger than data', () => {
      const klines = [createKline(), createKline()];
      const result = computeSupportResistance(klines, 5);
      
      expect(result.resistance.length).toBeLessThanOrEqual(2);
      expect(result.support.length).toBeLessThanOrEqual(2);
    });
  });

  describe('computeMACD', () => {
    it('should return neutral values if not enough data', () => {
      const klines = Array.from({ length: 10 }, () => createKline());
      const result = computeMACD(klines);
      
      expect(result).toEqual({
        macd: 0,
        signal: 0,
        histogram: 0,
        trend: 'neutral'
      });
    });

    it('should calculate MACD for uptrend', () => {
      const klines = Array.from({ length: 50 }, (_, i) => 
        createKline({ close: 100 + i * 0.5 })
      );
      
      const result = computeMACD(klines);
      expect(result.macd).toBeGreaterThan(0);
      expect(result.histogram).toBeGreaterThan(0);
      expect(result.trend).toBe('bullish');
    });

    it('should calculate MACD for downtrend', () => {
      const klines = Array.from({ length: 50 }, (_, i) => 
        createKline({ close: 200 - i * 0.5 })
      );
      
      const result = computeMACD(klines);
      expect(result.macd).toBeLessThan(0);
      expect(result.histogram).toBeLessThan(0);
      expect(result.trend).toBe('bearish');
    });

    it('should handle custom periods', () => {
      const klines = Array.from({ length: 100 }, (_, i) => 
        createKline({ close: 100 + Math.sin(i * 0.1) * 10 })
      );
      
      const result = computeMACD(klines, 10, 20, 5);
      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('histogram');
      expect(result).toHaveProperty('trend');
    });
  });

  describe('computeTrendStrength', () => {
    it('should detect upward trend', () => {
      const klines = Array.from({ length: 25 }, (_, i) => 
        createKline({ close: 100 + i * 2 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('up');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should detect downward trend', () => {
      const klines = Array.from({ length: 25 }, (_, i) => 
        createKline({ close: 200 - i * 2 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('down');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should detect neutral trend', () => {
      const klines = Array.from({ length: 25 }, () => 
        createKline({ close: 100 + Math.random() * 0.1 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('neutral');
    });

    it('should handle insufficient data', () => {
      const klines = Array.from({ length: 5 }, () => createKline());
      const result = computeTrendStrength(klines, 20);
      
      expect(result).toEqual({
        direction: 'neutral',
        strength: 0
      });
    });

    it('should handle zero price', () => {
      const klines = Array.from({ length: 25 }, (_, i) => 
        createKline({ close: i === 0 ? 0 : 100 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('neutral');
      expect(result.strength).toBe(0);
    });

    it('should cap strength at 100', () => {
      const klines = Array.from({ length: 25 }, (_, i) => 
        createKline({ close: 100 * Math.pow(2, i) }) // Exponential growth
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.strength).toBe(100);
    });
  });

  describe('computeSupportResistanceDetailed', () => {
    it('should compute detailed levels with touches', () => {
      const klines = [
        createKline({ high: 110, low: 90 }),
        createKline({ high: 110.05, low: 89.95 }), // Near previous
        createKline({ high: 105, low: 95 }),
        createKline({ high: 110.1, low: 90.1 }), // Another near touch
        createKline({ high: 100, low: 85 })
      ];
      
      const result = computeSupportResistanceDetailed(klines, 2, 0.001);
      
      expect(result.resistance).toHaveLength(2);
      expect(result.resistance[0].price).toBe(110.1);
      expect(result.resistance[0].touches).toBeGreaterThan(1);
      
      expect(result.support).toHaveLength(2);
      expect(result.support[0].price).toBe(85);
    });

    it('should calculate strength based on touches', () => {
      const price = 100;
      const klines = Array.from({ length: 10 }, () => 
        createKline({ high: price + Math.random() * 0.05, low: price })
      );
      
      const result = computeSupportResistanceDetailed(klines, 1, 0.001);
      
      expect(result.resistance[0].strength).toBe(100); // Max strength
      expect(result.support[0].strength).toBe(100);
    });

    it('should handle empty klines', () => {
      const result = computeSupportResistanceDetailed([], 3, 0.001);
      expect(result.resistance).toEqual([]);
      expect(result.support).toEqual([]);
    });

    it('should handle custom tolerance', () => {
      const klines = [
        createKline({ high: 100, low: 90 }),
        createKline({ high: 101, low: 91 }), // 1% difference
        createKline({ high: 99, low: 89 })
      ];
      
      const strictResult = computeSupportResistanceDetailed(klines, 3, 0.005);
      const looseResult = computeSupportResistanceDetailed(klines, 3, 0.02);
      
      // Loose tolerance should have more touches
      expect(looseResult.resistance[0].touches).toBeGreaterThanOrEqual(
        strictResult.resistance[0].touches
      );
    });
  });

  describe('deprecated functions with fallback', () => {
    describe('calculateMACD', () => {
      it('should warn about deprecation', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const data = [100, 101, 102, 103, 104];
        
        calculateMACD(data);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
        consoleSpy.mockRestore();
      });

      it('should delegate to new implementation', () => {
        const data = Array.from({ length: 50 }, (_, i) => 100 + i);
        const result = calculateMACD(data);
        
        expect(result).toHaveLength(data.length);
        expect(result[0]).toHaveProperty('macd');
        expect(result[0]).toHaveProperty('signal');
        expect(result[0]).toHaveProperty('histogram');
      });

      it('should handle errors with development fallback', () => {
        const { calculateMACD: mockCalculateMACD } = require('@/lib/indicators/macd');
        mockCalculateMACD.mockImplementationOnce(() => {
          throw new Error('Module error');
        });
        
        // Set NODE_ENV to development
        const envModule = require('@/config/env');
        envModule.env.NODE_ENV = 'development';
        
        const data = Array.from({ length: 50 }, (_, i) => 100 + i);
        const result = calculateMACD(data);
        
        expect(result).toHaveLength(data.length - 26 - 9 + 1);
        expect(result[0]).toEqual({
          macd: 0,
          signal: 0,
          histogram: 0
        });
      });
    });

    describe('calculateRSI', () => {
      it('should warn about deprecation', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const data = [100, 101, 102, 103, 104];
        
        calculateRSI(data);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
        consoleSpy.mockRestore();
      });

      it('should delegate to new implementation', () => {
        const data = Array.from({ length: 20 }, (_, i) => 100 + i);
        const result = calculateRSI(data, 14);
        
        expect(result).toHaveLength(data.length);
        expect(result[0]).toBeGreaterThanOrEqual(0);
        expect(result[0]).toBeLessThanOrEqual(100);
      });
    });

    describe('calculateBollingerBands', () => {
      it('should warn about deprecation', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const data = Array.from({ length: 20 }, () => 100);
        
        calculateBollingerBands(data);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
        consoleSpy.mockRestore();
      });

      it('should delegate to new implementation', () => {
        const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.1) * 10);
        const result = calculateBollingerBands(data, 20, 2);
        
        expect(result).toHaveLength(data.length);
        expect(result[0]).toHaveProperty('upper');
        expect(result[0]).toHaveProperty('middle');
        expect(result[0]).toHaveProperty('lower');
        expect(result[0].upper).toBeGreaterThan(result[0].middle);
        expect(result[0].middle).toBeGreaterThan(result[0].lower);
      });
    });

    describe('calculateSMA', () => {
      it('should warn about deprecation', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const data = Array.from({ length: 20 }, () => 100);
        
        calculateSMA(data);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
        consoleSpy.mockRestore();
      });

      it('should delegate to new implementation', () => {
        const data = Array.from({ length: 30 }, (_, i) => 100 + i);
        const result = calculateSMA(data, 10);
        
        expect(result).toHaveLength(data.length);
        expect(result[0]).toBeGreaterThan(0);
      });

      it('should handle errors with development fallback', () => {
        const { calculateSMA: mockCalculateSMA } = require('@/lib/indicators/moving-average');
        mockCalculateSMA.mockImplementationOnce(() => {
          throw new Error('Module error');
        });
        
        // Set NODE_ENV to development
        const envModule = require('@/config/env');
        envModule.env.NODE_ENV = 'development';
        
        const data = [1, 2, 3, 4, 5];
        const result = calculateSMA(data, 3);
        
        expect(result).toHaveLength(3);
        expect(result[0]).toBe(2); // Average of [1,2,3]
        expect(result[1]).toBe(3); // Average of [2,3,4]
        expect(result[2]).toBe(4); // Average of [3,4,5]
      });
    });
  });
});