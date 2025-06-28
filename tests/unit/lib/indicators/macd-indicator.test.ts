import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MACDIndicator, getMACDColor, getMACDSignal } from '@/lib/indicators/macd-indicator';
import type { PriceDataLightweight } from '@/lib/indicators/types';
import type { MACDData } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MACDIndicator', () => {
  let macdIndicator: MACDIndicator;
  
  const mockData: PriceDataLightweight[] = [
    { time: 1638360000, close: 44.00 },
    { time: 1638363600, close: 44.34 },
    { time: 1638367200, close: 44.09 },
    { time: 1638370800, close: 43.61 },
    { time: 1638374400, close: 44.33 },
    { time: 1638378000, close: 44.83 },
    { time: 1638381600, close: 45.10 },
    { time: 1638385200, close: 45.42 },
    { time: 1638388800, close: 45.84 },
    { time: 1638392400, close: 46.08 },
    { time: 1638396000, close: 45.89 },
    { time: 1638399600, close: 46.03 },
    { time: 1638403200, close: 45.61 },
    { time: 1638406800, close: 46.28 },
    { time: 1638410400, close: 46.28 },
    { time: 1638414000, close: 46.00 },
    { time: 1638417600, close: 46.03 },
    { time: 1638421200, close: 46.41 },
    { time: 1638424800, close: 46.22 },
    { time: 1638428400, close: 45.64 },
    { time: 1638432000, close: 46.21 },
    { time: 1638435600, close: 46.25 },
    { time: 1638439200, close: 45.71 },
    { time: 1638442800, close: 46.45 },
    { time: 1638446400, close: 45.78 },
    { time: 1638450000, close: 45.35 },
    { time: 1638453600, close: 44.03 },
    { time: 1638457200, close: 44.18 },
    { time: 1638460800, close: 44.22 },
    { time: 1638464400, close: 44.57 },
    { time: 1638468000, close: 43.42 },
    { time: 1638471600, close: 42.98 },
    { time: 1638475200, close: 43.41 },
    { time: 1638478800, close: 43.75 },
    { time: 1638482400, close: 44.07 },
    { time: 1638486000, close: 44.38 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create MACDIndicator instance successfully', () => {
      expect(() => {
        new MACDIndicator(12, 26, 9);
      }).not.toThrow();
    });

    it('should accept period parameters and set correctly', () => {
      const indicator = new MACDIndicator(12, 26, 9);
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('MACD');
      expect(indicator.getFastPeriod()).toBe(12);
      expect(indicator.getSlowPeriod()).toBe(26);
      expect(indicator.getSignalPeriod()).toBe(9);
    });

    it('should use default periods when not specified', () => {
      const indicator = new MACDIndicator();
      expect(indicator.getFastPeriod()).toBe(12);
      expect(indicator.getSlowPeriod()).toBe(26);
      expect(indicator.getSignalPeriod()).toBe(9);
    });

    it('should throw error for invalid periods', () => {
      expect(() => {
        new MACDIndicator(0, 26, 9);
      }).toThrow('All periods must be positive');
      
      expect(() => {
        new MACDIndicator(12, -5, 9);
      }).toThrow('All periods must be positive');
      
      expect(() => {
        new MACDIndicator(12, 26, 0);
      }).toThrow('All periods must be positive');
    });

    it('should throw error if fast period >= slow period', () => {
      expect(() => {
        new MACDIndicator(26, 26, 9);
      }).toThrow('Fast period must be less than slow period');
      
      expect(() => {
        new MACDIndicator(30, 26, 9);
      }).toThrow('Fast period must be less than slow period');
    });

    it('should set appropriate validation options', () => {
      const indicator = new MACDIndicator(12, 26, 9);
      const validationOptions = (indicator as any).defaultOptions;
      expect(validationOptions.minLength).toBe(35); // 26 + 9
      expect(validationOptions.checkMonotonic).toBe(true);
      expect(validationOptions.allowNaN).toBe(false);
      expect(validationOptions.allowInfinity).toBe(false);
    });
  });

  describe('calculate method', () => {
    beforeEach(() => {
      macdIndicator = new MACDIndicator(12, 26, 9);
    });

    it('should calculate MACD values correctly', () => {
      const result = macdIndicator.calculate(mockData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify structure
      const firstResult = result[0];
      expect(firstResult).toHaveProperty('time');
      expect(firstResult).toHaveProperty('macd');
      expect(firstResult).toHaveProperty('signal');
      expect(firstResult).toHaveProperty('histogram');
      
      // Verify histogram calculation
      result.forEach(item => {
        expect(item.histogram).toBeCloseTo(item.macd - item.signal, 10);
      });
    });

    it('should return empty array for insufficient data', () => {
      const insufficientData = mockData.slice(0, 30); // Less than 26 + 9
      const result = macdIndicator.calculate(insufficientData);
      
      expect(result).toEqual([]);
    });

    it('should match calculateMACD function output', async () => {
      // Import the legacy function
      const { calculateMACD } = await import('@/lib/indicators/macd');
      
      // Convert data for legacy function
      const legacyData = mockData.map(d => ({
        time: Number(d.time),
        close: d.close
      }));
      
      const legacyResult = calculateMACD(legacyData, 12, 26, 9);
      const indicatorResult = macdIndicator.calculate(mockData);
      
      expect(indicatorResult.length).toBe(legacyResult.length);
      
      // Compare values (allowing small floating point differences)
      indicatorResult.forEach((result, index) => {
        expect(result.macd).toBeCloseTo(legacyResult[index].macd, 5);
        expect(result.signal).toBeCloseTo(legacyResult[index].signal, 5);
        expect(result.histogram).toBeCloseTo(legacyResult[index].histogram, 5);
      });
    });

    it('should handle custom periods', () => {
      const customIndicator = new MACDIndicator(5, 20, 5);
      const result = customIndicator.calculate(mockData);
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(item => {
        expect(item.histogram).toBeCloseTo(item.macd - item.signal, 10);
      });
    });
  });

  describe('getMACDColor', () => {
    it('should return green color for positive histogram', () => {
      expect(getMACDColor(1)).toBe('#0ddfba');
      expect(getMACDColor(0)).toBe('#0ddfba');
      expect(getMACDColor(100)).toBe('#0ddfba');
    });

    it('should return red color for negative histogram', () => {
      expect(getMACDColor(-1)).toBe('#ff4d4d');
      expect(getMACDColor(-100)).toBe('#ff4d4d');
    });
  });

  describe('getMACDSignal', () => {
    it('should detect bullish crossover', () => {
      // MACD crosses above signal
      expect(getMACDSignal(1, 0, -1, 0)).toBe('bullish');
      expect(getMACDSignal(5, 3, 2, 4)).toBe('bullish');
    });

    it('should detect bearish crossover', () => {
      // MACD crosses below signal
      expect(getMACDSignal(0, 1, 0, -1)).toBe('bearish');
      expect(getMACDSignal(3, 5, 4, 2)).toBe('bearish');
    });

    it('should return neutral when no crossover', () => {
      // MACD stays above signal
      expect(getMACDSignal(5, 3, 4, 2)).toBe('neutral');
      // MACD stays below signal
      expect(getMACDSignal(3, 5, 2, 4)).toBe('neutral');
      // MACD and signal equal
      expect(getMACDSignal(5, 5, 5, 5)).toBe('neutral');
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      const indicator = new MACDIndicator();
      const invalidData = null as any;
      
      const result = indicator.calculate(invalidData);
      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const indicator = new MACDIndicator();
      const result = indicator.calculate([]);
      
      expect(result).toEqual([]);
    });
  });
});