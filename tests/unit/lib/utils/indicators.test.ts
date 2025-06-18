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
  calculateSMA,
  type LevelDetail,
} from '@/lib/utils/indicators';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProcessedKline } from '@/types/market';

// Mock dependencies
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('indicators utilities', () => {
  const createKline = (overrides: Partial<ProcessedKline>): ProcessedKline => ({
    time: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    ...overrides,
  });

  describe('computeRSI', () => {
    it('should return 0 for insufficient data', () => {
      const klines = Array.from({ length: 10 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i })
      );
      
      expect(computeRSI(klines, 14)).toBe(0);
    });

    it('should calculate RSI correctly', () => {
      // Create data with upward trend
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i * 2 })
      );
      
      const rsi = computeRSI(klines, 14);
      expect(rsi).toBeGreaterThan(70); // Strong uptrend should have high RSI
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle all gains (RSI = 100)', () => {
      const klines = Array.from({ length: 15 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i * 10 })
      );
      
      expect(computeRSI(klines, 14)).toBe(100);
    });

    it('should handle all losses (RSI = 0)', () => {
      const klines = Array.from({ length: 15 }, (_, i) => 
        createKline({ time: i * 1000, close: 1000 - i * 10 })
      );
      
      const rsi = computeRSI(klines, 14);
      expect(rsi).toBeLessThan(30); // Strong downtrend
    });

    it('should handle flat market (RSI ≈ 50)', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + (i % 2) })
      );
      
      const rsi = computeRSI(klines, 14);
      expect(rsi).toBeGreaterThan(40);
      expect(rsi).toBeLessThan(60);
    });
  });

  describe('computeATR', () => {
    it('should return 0 for insufficient data', () => {
      const klines = Array.from({ length: 10 }, (_, i) => 
        createKline({ time: i * 1000 })
      );
      
      expect(computeATR(klines, 14)).toBe(0);
    });

    it('should calculate ATR correctly', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({
          time: i * 1000,
          high: 110 + i,
          low: 90 - i,
          close: 100,
        })
      );
      
      const atr = computeATR(klines, 14);
      expect(atr).toBeGreaterThan(0);
    });

    it('should handle high volatility', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({
          time: i * 1000,
          high: 100 + (i % 2) * 50,
          low: 100 - (i % 2) * 50,
          close: 100,
        })
      );
      
      const atr = computeATR(klines, 14);
      expect(atr).toBeGreaterThan(30); // High volatility
    });

    it('should handle low volatility', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({
          time: i * 1000,
          high: 101,
          low: 99,
          close: 100,
        })
      );
      
      const atr = computeATR(klines, 14);
      expect(atr).toBeLessThan(5); // Low volatility
    });
  });

  describe('computeSupportResistance', () => {
    it('should find support and resistance levels', () => {
      const klines = [
        createKline({ high: 120, low: 80 }),
        createKline({ high: 115, low: 85 }),
        createKline({ high: 125, low: 75 }),
        createKline({ high: 110, low: 90 }),
        createKline({ high: 130, low: 70 }),
      ];
      
      const { support, resistance } = computeSupportResistance(klines, 3);
      
      expect(resistance).toHaveLength(3);
      expect(resistance[0]).toBe(130); // Highest
      expect(resistance[1]).toBe(125);
      expect(resistance[2]).toBe(120);
      
      expect(support).toHaveLength(3);
      expect(support[0]).toBe(70); // Lowest
      expect(support[1]).toBe(75);
      expect(support[2]).toBe(80);
    });

    it('should handle empty data', () => {
      const { support, resistance } = computeSupportResistance([], 3);
      expect(support).toEqual([]);
      expect(resistance).toEqual([]);
    });

    it('should handle count larger than data', () => {
      const klines = [
        createKline({ high: 110, low: 90 }),
        createKline({ high: 120, low: 80 }),
      ];
      
      const { support, resistance } = computeSupportResistance(klines, 5);
      
      expect(resistance).toHaveLength(2);
      expect(support).toHaveLength(2);
    });
  });

  describe('computeMACD', () => {
    it('should return neutral for insufficient data', () => {
      const klines = Array.from({ length: 20 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 })
      );
      
      const result = computeMACD(klines);
      expect(result).toEqual({
        macd: 0,
        signal: 0,
        histogram: 0,
        trend: 'neutral',
      });
    });

    it('should detect bullish trend', () => {
      const klines = Array.from({ length: 50 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i })
      );
      
      const result = computeMACD(klines);
      expect(result.trend).toBe('bullish');
      expect(result.histogram).toBeGreaterThan(0);
    });

    it('should detect bearish trend', () => {
      const klines = Array.from({ length: 50 }, (_, i) => 
        createKline({ time: i * 1000, close: 200 - i })
      );
      
      const result = computeMACD(klines);
      expect(result.trend).toBe('bearish');
      expect(result.histogram).toBeLessThan(0);
    });

    it('should handle custom periods', () => {
      const klines = Array.from({ length: 50 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + Math.sin(i / 5) * 10 })
      );
      
      const result = computeMACD(klines, 10, 20, 5);
      expect(result.macd).toBeDefined();
      expect(result.signal).toBeDefined();
    });
  });

  describe('computeTrendStrength', () => {
    it('should return neutral for insufficient data', () => {
      const klines = Array.from({ length: 10 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result).toEqual({ direction: 'neutral', strength: 0 });
    });

    it('should detect upward trend', () => {
      const klines = Array.from({ length: 30 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i * 0.5 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('up');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should detect downward trend', () => {
      const klines = Array.from({ length: 30 }, (_, i) => 
        createKline({ time: i * 1000, close: 150 - i * 0.5 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('down');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should detect neutral trend', () => {
      const klines = Array.from({ length: 30 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + (i % 2) * 0.1 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.direction).toBe('neutral');
      expect(result.strength).toBeLessThan(10);
    });

    it('should cap strength at 100', () => {
      const klines = Array.from({ length: 30 }, (_, i) => 
        createKline({ time: i * 1000, close: 100 + i * 10 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result.strength).toBe(100);
    });

    it('should handle zero first close', () => {
      const klines = Array.from({ length: 30 }, (_, i) => 
        createKline({ time: i * 1000, close: i === 9 ? 0 : 100 })
      );
      
      const result = computeTrendStrength(klines, 20);
      expect(result).toEqual({ direction: 'neutral', strength: 0 });
    });
  });

  describe('computeSupportResistanceDetailed', () => {
    it('should return empty arrays for empty data', () => {
      const result = computeSupportResistanceDetailed([], 3);
      expect(result.support).toEqual([]);
      expect(result.resistance).toEqual([]);
    });

    it('should calculate detailed levels with touches', () => {
      const klines = [
        createKline({ high: 110, low: 90 }),
        createKline({ high: 111, low: 89 }),
        createKline({ high: 109, low: 91 }),
        createKline({ high: 110.5, low: 90.5 }),
        createKline({ high: 120, low: 80 }),
      ];
      
      const result = computeSupportResistanceDetailed(klines, 3);
      
      expect(result.resistance).toHaveLength(3);
      expect(result.resistance[0].price).toBe(120);
      expect(result.resistance[1].price).toBe(111);
      expect(result.resistance[1].touches).toBeGreaterThan(1); // Multiple touches around 110
      
      expect(result.support).toHaveLength(3);
      expect(result.support[0].price).toBe(80);
      expect(result.support[1].price).toBe(89);
      expect(result.support[1].touches).toBeGreaterThan(1); // Multiple touches around 90
    });

    it('should calculate strength based on touches', () => {
      const klines = Array.from({ length: 10 }, () => 
        createKline({ high: 110, low: 90 }) // All same
      );
      
      const result = computeSupportResistanceDetailed(klines, 1);
      
      expect(result.resistance[0].strength).toBe(100); // Max strength
      expect(result.support[0].strength).toBe(100); // Max strength
    });

    it('should handle custom tolerance', () => {
      const klines = [
        createKline({ high: 100, low: 80 }),
        createKline({ high: 101, low: 81 }),
        createKline({ high: 99, low: 79 }),
      ];
      
      const result = computeSupportResistanceDetailed(klines, 1, 0.02); // 2% tolerance
      
      expect(result.resistance[0].touches).toBe(3); // All within 2% of 101
      expect(result.support[0].touches).toBe(3); // All within 2% of 79
    });
  });

  describe('deprecated functions', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    describe('calculateMACD', () => {
      it('should warn about deprecation', () => {
        const data = [100, 101, 102, 103, 104];
        
        try {
          calculateMACD(data);
        } catch (e) {
          // May throw if proper implementation not found
        }
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
      });

      it('should handle fallback in development', () => {
        vi.doMock('@/config/env', () => ({
          env: { NODE_ENV: 'development' },
        }));
        
        vi.doMock('../indicators/macd', () => {
          throw new Error('Module not found');
        });
        
        const data = Array.from({ length: 50 }, (_, i) => 100 + i);
        const result = calculateMACD(data);
        
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('macd');
        expect(result[0]).toHaveProperty('signal');
        expect(result[0]).toHaveProperty('histogram');
      });
    });

    describe('calculateRSI', () => {
      it('should warn about deprecation', () => {
        const data = Array.from({ length: 20 }, (_, i) => 100 + i);
        
        try {
          calculateRSI(data);
        } catch (e) {
          // May throw if proper implementation not found
        }
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
      });
    });

    describe('calculateBollingerBands', () => {
      it('should warn about deprecation', () => {
        const data = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 10);
        
        try {
          calculateBollingerBands(data);
        } catch (e) {
          // May throw if proper implementation not found
        }
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
      });

      it('should provide development fallback', () => {
        vi.doMock('@/config/env', () => ({
          env: { NODE_ENV: 'development' },
        }));
        
        vi.doMock('../indicators/bollinger-bands', () => {
          throw new Error('Module not found');
        });
        
        const data = Array.from({ length: 30 }, (_, i) => 100);
        const result = calculateBollingerBands(data, 20, 2);
        
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('upper');
        expect(result[0]).toHaveProperty('middle');
        expect(result[0]).toHaveProperty('lower');
      });
    });

    describe('calculateSMA', () => {
      it('should warn about deprecation', () => {
        const data = Array.from({ length: 30 }, (_, i) => 100 + i);
        
        try {
          calculateSMA(data);
        } catch (e) {
          // May throw if proper implementation not found
        }
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );
      });

      it('should provide development fallback', () => {
        vi.doMock('@/config/env', () => ({
          env: { NODE_ENV: 'development' },
        }));
        
        vi.doMock('../indicators/moving-average', () => {
          throw new Error('Module not found');
        });
        
        const data = [10, 20, 30, 40, 50];
        const result = calculateSMA(data, 3);
        
        expect(result).toHaveLength(3);
        expect(result[0]).toBeCloseTo(20); // (10+20+30)/3
        expect(result[1]).toBeCloseTo(30); // (20+30+40)/3
        expect(result[2]).toBeCloseTo(40); // (30+40+50)/3
      });
    });
  });

  describe('edge cases', () => {
    it('should handle klines with undefined values', () => {
      const klines = [
        createKline({ close: 100 }),
        createKline({ close: undefined as any }),
        createKline({ close: 110 }),
      ];
      
      const rsi = computeRSI(klines, 2);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle negative prices', () => {
      const klines = Array.from({ length: 15 }, (_, i) => 
        createKline({ time: i * 1000, close: -100 + i })
      );
      
      const rsi = computeRSI(klines, 14);
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle very large numbers', () => {
      const klines = Array.from({ length: 15 }, (_, i) => 
        createKline({ 
          time: i * 1000, 
          close: 1e10 + i * 1e8,
          high: 1e10 + i * 1e8 + 1e7,
          low: 1e10 + i * 1e8 - 1e7,
        })
      );
      
      const atr = computeATR(klines, 14);
      expect(atr).toBeFinite();
      expect(atr).toBeGreaterThan(0);
    });
  });
});

export {};