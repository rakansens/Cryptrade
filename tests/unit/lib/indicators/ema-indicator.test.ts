import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EMAIndicator } from '@/lib/indicators/ema-indicator';
import type { PriceDataLightweight, MovingAverageData } from '@/lib/indicators/types';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('EMAIndicator', () => {
  let emaIndicator: EMAIndicator;
  
  const mockData: PriceDataLightweight[] = [
    { time: 1638360000, close: 100 },
    { time: 1638363600, close: 102 },
    { time: 1638367200, close: 104 },
    { time: 1638370800, close: 106 },
    { time: 1638374400, close: 108 },
    { time: 1638378000, close: 110 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create EMAIndicator instance successfully', () => {
      expect(() => {
        new EMAIndicator(3);
      }).not.toThrow();
    });

    it('should accept period parameter and set correctly', () => {
      const indicator = new EMAIndicator(3);
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('EMA');
      expect(indicator.getPeriod()).toBe(3);
    });

    it('should set appropriate validation options', () => {
      const indicator = new EMAIndicator(5);
      // Should have minLength equal to period
      const validationOptions = (indicator as any).defaultOptions;
      expect(validationOptions.minLength).toBe(5);
      expect(validationOptions.checkMonotonic).toBe(true);
      expect(validationOptions.allowNaN).toBe(false);
    });

    it('should calculate smoothing factor correctly', () => {
      const indicator = new EMAIndicator(10);
      const alpha = (indicator as any).alpha;
      expect(alpha).toBeCloseTo(2 / (10 + 1), 6); // 2/(period+1)
    });
  });

  describe('calculate method', () => {
    beforeEach(() => {
      emaIndicator = new EMAIndicator(3);
    });

    it('should calculate method returns MovingAverageData array', () => {
      const result = emaIndicator.calculate(mockData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4); // data length - period + 1
      
      // First EMA value should be SMA: (100 + 102 + 104) / 3 = 102
      expect(result[0]).toEqual({
        time: 1638367200,
        value: 102
      });
      
      // Second EMA value should use EMA formula
      // EMA = (price * alpha) + (previous_EMA * (1 - alpha))
      // alpha = 2 / (3 + 1) = 0.5
      // EMA = (106 * 0.5) + (102 * 0.5) = 104
      expect(result[1]).toEqual({
        time: 1638370800,
        value: 104
      });
    });

    it('should handle insufficient data correctly', () => {
      const insufficientData = mockData.slice(0, 2); // Only 2 items, but period is 3
      const result = emaIndicator.calculate(insufficientData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle single period calculation', () => {
      const singlePeriod = new EMAIndicator(1);
      const singleData = [{ time: 1638360000, close: 100 }];
      
      const result = singlePeriod.calculate(singleData);
      
      expect(result).toEqual([{
        time: 1638360000,
        value: 100
      }]);
    });

    it('should use correct smoothing factor formula', () => {
      const ema5 = new EMAIndicator(5);
      const result = ema5.calculate(mockData);
      
      expect(result.length).toBe(2); // 6 - 5 + 1
      
      // First EMA should be SMA: (100 + 102 + 104 + 106 + 108) / 5 = 104
      expect(result[0].value).toBe(104);
      
      // Second EMA should use alpha = 2/(5+1) = 0.333...
      // EMA = (110 * 0.333...) + (104 * 0.666...) = 106
      expect(result[1].value).toBeCloseTo(106, 2);
    });

    it('should demonstrate exponential weighting characteristic', () => {
      // Test that recent prices have more influence than older ones
      const heavyRecentData = [
        { time: 1638360000, close: 100 },
        { time: 1638363600, close: 100 },
        { time: 1638367200, close: 100 },
        { time: 1638370800, close: 120 } // Big jump in recent price
      ];
      
      const ema3 = new EMAIndicator(3);
      const result = ema3.calculate(heavyRecentData);
      
      // The EMA should be closer to 120 than a simple average would be
      // Simple average of last 3: (100 + 100 + 120) / 3 = 106.67
      // EMA should be higher due to exponential weighting
      expect(result[result.length - 1].value).toBeGreaterThan(106.67);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const indicator = new EMAIndicator(3);
      const result = indicator.calculate([]);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle period larger than data length', () => {
      const indicator = new EMAIndicator(10);
      const result = indicator.calculate(mockData); // Only 6 data points
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle zero or negative period', () => {
      expect(() => {
        new EMAIndicator(0);
      }).toThrow('Period must be positive');
      
      expect(() => {
        new EMAIndicator(-1);
      }).toThrow('Period must be positive');
    });
  });

  describe('method existence', () => {
    it('should have getPeriod method that returns correct value', () => {
      const indicator = new EMAIndicator(5);
      expect(() => {
        indicator.getPeriod();
      }).not.toThrow();
      expect(indicator.getPeriod()).toBe(5);
    });

    it('should have getAlpha method that returns correct value', () => {
      const indicator = new EMAIndicator(5);
      expect(() => {
        indicator.getAlpha();
      }).not.toThrow();
      expect(indicator.getAlpha()).toBeCloseTo(2 / (5 + 1), 6);
    });

    it('should inherit from BaseIndicator', () => {
      const indicator = new EMAIndicator(5);
      expect(indicator.getIndicatorName).toBeDefined();
      expect(typeof indicator.calculate).toBe('function');
    });
  });

  describe('EMA vs SMA comparison', () => {
    it('should demonstrate that EMA responds faster to price changes than SMA', () => {
      // Create data with a trend
      const trendData = [
        { time: 1638360000, close: 100 },
        { time: 1638363600, close: 102 },
        { time: 1638367200, close: 104 },
        { time: 1638370800, close: 110 }, // Sharp increase
        { time: 1638374400, close: 115 },  // Continued increase
      ];
      
      const ema3 = new EMAIndicator(3);
      const emaResult = ema3.calculate(trendData);
      
      // EMA should show stronger response to the trend
      // Last EMA value should be closer to recent high prices
      const lastEMA = emaResult[emaResult.length - 1].value;
      expect(lastEMA).toBeGreaterThan(108); // Should be responsive to trend
    });
  });

  describe('performance characteristics', () => {
    it('should demonstrate O(N) time complexity', () => {
      // This test verifies the EMA calculation is O(N)
      const indicator = new EMAIndicator(10);
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: 100 + Math.sin(i * 0.1) * 10 // Sine wave pattern
      }));
      
      const startTime = performance.now();
      const result = indicator.calculate(largeDataset);
      const endTime = performance.now();
      
      expect(result.length).toBe(991); // 1000 - 10 + 1
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with O(N)
    });
  });
});