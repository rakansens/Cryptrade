import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RSIIndicator } from '@/lib/indicators/rsi-indicator';
import type { PriceDataLightweight } from '@/lib/indicators/types';
import type { RSIData } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('RSIIndicator', () => {
  let rsiIndicator: RSIIndicator;
  
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
    { time: 1638414000, close: 46.00 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RSIIndicator instance successfully', () => {
      expect(() => {
        new RSIIndicator(14);
      }).not.toThrow();
    });

    it('should accept period parameter and set correctly', () => {
      const indicator = new RSIIndicator(14);
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('RSI');
      expect(indicator.getPeriod()).toBe(14);
    });

    it('should use default period of 14 when not specified', () => {
      const indicator = new RSIIndicator();
      expect(indicator.getPeriod()).toBe(14);
    });

    it('should throw error for invalid period', () => {
      expect(() => {
        new RSIIndicator(0);
      }).toThrow('Period must be positive');
      
      expect(() => {
        new RSIIndicator(-5);
      }).toThrow('Period must be positive');
    });

    it('should set appropriate validation options', () => {
      const indicator = new RSIIndicator(14);
      const validationOptions = (indicator as any).defaultOptions;
      expect(validationOptions.minLength).toBe(15); // period + 1
      expect(validationOptions.checkMonotonic).toBe(true);
      expect(validationOptions.allowNaN).toBe(false);
      expect(validationOptions.allowInfinity).toBe(false);
    });
  });

  describe('calculate method', () => {
    beforeEach(() => {
      rsiIndicator = new RSIIndicator(14);
    });

    it('should calculate RSI values correctly', () => {
      const result = rsiIndicator.calculate(mockData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2); // 16 data points - 14 period = 2 RSI values
      
      // Verify structure
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('rsi');
      
      // RSI values should be between 0 and 100
      result.forEach(rsiData => {
        expect(rsiData.rsi).toBeGreaterThanOrEqual(0);
        expect(rsiData.rsi).toBeLessThanOrEqual(100);
      });
    });

    it('should return empty array for insufficient data', () => {
      const insufficientData = mockData.slice(0, 10); // Less than period + 1
      const result = rsiIndicator.calculate(insufficientData);
      
      expect(result).toEqual([]);
    });

    it('should handle all gains scenario (RSI = 100)', () => {
      // Create data where price always increases
      const allGainsData: PriceDataLightweight[] = Array.from({ length: 16 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: 100 + i * 2
      }));
      
      const result = rsiIndicator.calculate(allGainsData);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].rsi).toBe(100);
    });

    it('should handle all losses scenario (RSI = 0)', () => {
      // Create data where price always decreases
      const allLossesData: PriceDataLightweight[] = Array.from({ length: 16 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: 100 - i * 2
      }));
      
      const result = rsiIndicator.calculate(allLossesData);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].rsi).toBe(0);
    });

    it('should handle flat price scenario', () => {
      // Create data where price remains constant
      const flatData: PriceDataLightweight[] = Array.from({ length: 16 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: 100
      }));
      
      const result = rsiIndicator.calculate(flatData);
      
      expect(result.length).toBeGreaterThan(0);
      // When price is flat, gains and losses are both 0
      // In this implementation, when avgLoss = 0, RSI = 100
      expect(result[0].rsi).toBe(100);
    });

    it('should match calculateRSI function output', async () => {
      // Import the legacy function
      const { calculateRSI } = await import('@/lib/indicators/rsi');
      
      // Convert data for legacy function
      const legacyData = mockData.map(d => ({
        time: Number(d.time),
        close: d.close
      }));
      
      const legacyResult = calculateRSI(legacyData, 14);
      const indicatorResult = rsiIndicator.calculate(mockData);
      
      expect(indicatorResult.length).toBe(legacyResult.length);
      
      // Compare values (allowing small floating point differences)
      indicatorResult.forEach((result, index) => {
        expect(result.rsi).toBeCloseTo(legacyResult[index].rsi, 5);
      });
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      const indicator = new RSIIndicator(14);
      const invalidData = null as any;
      
      const result = indicator.calculate(invalidData);
      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const indicator = new RSIIndicator(14);
      const result = indicator.calculate([]);
      
      expect(result).toEqual([]);
    });
  });
});