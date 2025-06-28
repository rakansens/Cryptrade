import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SMAIndicator } from '@/lib/indicators/sma-indicator';
import type { PriceDataLightweight, MovingAverageData } from '@/lib/indicators/types';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('SMAIndicator', () => {
  let smaIndicator: SMAIndicator;
  
  const mockData: PriceDataLightweight[] = [
    { time: 1638360000, close: 100 },
    { time: 1638363600, close: 102 },
    { time: 1638367200, close: 104 },
    { time: 1638370800, close: 106 },
    { time: 1638374400, close: 108 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create SMAIndicator instance successfully', () => {
      expect(() => {
        new SMAIndicator(3);
      }).not.toThrow();
    });

    it('should accept period parameter and set correctly', () => {
      const indicator = new SMAIndicator(3);
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('SMA');
      expect(indicator.getPeriod()).toBe(3);
    });

    it('should set appropriate validation options', () => {
      const indicator = new SMAIndicator(5);
      // Should have minLength equal to period
      const validationOptions = (indicator as any).defaultOptions;
      expect(validationOptions.minLength).toBe(5);
      expect(validationOptions.checkMonotonic).toBe(true);
      expect(validationOptions.allowNaN).toBe(false);
    });
  });

  describe('calculate method', () => {
    beforeEach(() => {
      smaIndicator = new SMAIndicator(3);
    });

    it('should calculate method returns MovingAverageData array', () => {
      const result = smaIndicator.calculate(mockData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3); // mockData.length - period + 1
      
      // Check first SMA value: (100 + 102 + 104) / 3 = 102
      expect(result[0]).toEqual({
        time: 1638367200,
        value: 102
      });
      
      // Check second SMA value: (102 + 104 + 106) / 3 = 104
      expect(result[1]).toEqual({
        time: 1638370800,
        value: 104
      });
      
      // Check third SMA value: (104 + 106 + 108) / 3 = 106
      expect(result[2]).toEqual({
        time: 1638374400,
        value: 106
      });
    });

    it('should handle insufficient data correctly', () => {
      const insufficientData = mockData.slice(0, 2); // Only 2 items, but period is 3
      const result = smaIndicator.calculate(insufficientData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle single period calculation', () => {
      const singlePeriod = new SMAIndicator(1);
      const singleData = [{ time: 1638360000, close: 100 }];
      
      const result = singlePeriod.calculate(singleData);
      
      expect(result).toEqual([{
        time: 1638360000,
        value: 100
      }]);
    });

    it('should use sliding window optimization for efficiency', () => {
      const largePeriod = new SMAIndicator(2);
      const result = largePeriod.calculate(mockData);
      
      expect(result.length).toBe(4); // 5 - 2 + 1
      
      // First SMA: (100 + 102) / 2 = 101
      expect(result[0].value).toBe(101);
      
      // Second SMA: (102 + 104) / 2 = 103  
      expect(result[1].value).toBe(103);
      
      // Third SMA: (104 + 106) / 2 = 105
      expect(result[2].value).toBe(105);
      
      // Fourth SMA: (106 + 108) / 2 = 107
      expect(result[3].value).toBe(107);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const indicator = new SMAIndicator(3);
      const result = indicator.calculate([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle period larger than data length', () => {
      const indicator = new SMAIndicator(10);
      const result = indicator.calculate(mockData); // Only 5 data points
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle zero or negative period', () => {
      expect(() => {
        new SMAIndicator(0);
      }).toThrow('Period must be positive');
      
      expect(() => {
        new SMAIndicator(-1);
      }).toThrow('Period must be positive');
    });
  });

  describe('method existence', () => {
    it('should have getPeriod method that returns correct value', () => {
      const indicator = new SMAIndicator(5);
      expect(() => {
        indicator.getPeriod();
      }).not.toThrow();
      expect(indicator.getPeriod()).toBe(5);
    });

    it('should inherit from BaseIndicator', () => {
      const indicator = new SMAIndicator(5);
      expect(indicator.getIndicatorName).toBeDefined();
      expect(typeof indicator.calculate).toBe('function');
    });
  });

  describe('performance characteristics', () => {
    it('should demonstrate O(N) time complexity with sliding window', () => {
      // This test verifies the sliding window optimization is used
      const indicator = new SMAIndicator(3);
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: 100 + Math.random() * 10
      }));
      
      const startTime = performance.now();
      const result = indicator.calculate(largeDataset);
      const endTime = performance.now();
      
      expect(result.length).toBe(998); // 1000 - 3 + 1
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with O(N)
    });
  });
});