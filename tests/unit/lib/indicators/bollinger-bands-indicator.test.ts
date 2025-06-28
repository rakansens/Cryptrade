import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BollingerBandsIndicator, getBollingerBandsConfig } from '@/lib/indicators/bollinger-bands-indicator';
import type { PriceDataLightweight } from '@/lib/indicators/types';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('BollingerBandsIndicator', () => {
  let indicator: BollingerBandsIndicator;
  
  const mockData: PriceDataLightweight[] = Array.from({ length: 30 }, (_, i) => ({
    time: 1638360000 + i * 3600,
    close: 100 + Math.sin(i * 0.2) * 10 // Sinusoidal pattern
  }));

  const flatData: PriceDataLightweight[] = Array.from({ length: 30 }, (_, i) => ({
    time: 1638360000 + i * 3600,
    close: 100 // Constant price
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create BollingerBandsIndicator instance successfully', () => {
      expect(() => {
        new BollingerBandsIndicator(20, 2);
      }).not.toThrow();
    });

    it('should accept period and stdDev parameters', () => {
      const indicator = new BollingerBandsIndicator(20, 2);
      expect(indicator).toBeDefined();
      expect(indicator.getIndicatorName()).toBe('BollingerBands');
      expect(indicator.getPeriod()).toBe(20);
      expect(indicator.getStdDev()).toBe(2);
    });

    it('should use default values when not specified', () => {
      const indicator = new BollingerBandsIndicator();
      expect(indicator.getPeriod()).toBe(20);
      expect(indicator.getStdDev()).toBe(2);
    });

    it('should throw error for invalid period', () => {
      expect(() => {
        new BollingerBandsIndicator(0, 2);
      }).toThrow('Period must be positive');
      
      expect(() => {
        new BollingerBandsIndicator(-5, 2);
      }).toThrow('Period must be positive');
    });

    it('should throw error for invalid stdDev', () => {
      expect(() => {
        new BollingerBandsIndicator(20, 0);
      }).toThrow('Standard deviation multiplier must be positive');
      
      expect(() => {
        new BollingerBandsIndicator(20, -2);
      }).toThrow('Standard deviation multiplier must be positive');
    });

    it('should set appropriate validation options', () => {
      const indicator = new BollingerBandsIndicator(20, 2);
      const validationOptions = (indicator as any).defaultOptions;
      expect(validationOptions.minLength).toBe(20);
      expect(validationOptions.checkMonotonic).toBe(true);
      expect(validationOptions.allowNaN).toBe(false);
      expect(validationOptions.allowInfinity).toBe(false);
    });
  });

  describe('calculate method', () => {
    beforeEach(() => {
      indicator = new BollingerBandsIndicator(20, 2);
    });

    it('should calculate Bollinger Bands correctly', () => {
      const result = indicator.calculate(mockData);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(11); // 30 - 20 + 1
      
      // Verify structure
      const firstResult = result[0];
      expect(firstResult).toHaveProperty('time');
      expect(firstResult).toHaveProperty('upper');
      expect(firstResult).toHaveProperty('middle');
      expect(firstResult).toHaveProperty('lower');
      
      // Verify bands relationship
      result.forEach(band => {
        expect(band.upper).toBeGreaterThanOrEqual(band.middle);
        expect(band.middle).toBeGreaterThanOrEqual(band.lower);
      });
    });

    it('should return empty array for insufficient data', () => {
      const insufficientData = mockData.slice(0, 10); // Less than period
      const result = indicator.calculate(insufficientData);
      
      expect(result).toEqual([]);
    });

    it('should handle flat price data', () => {
      const result = indicator.calculate(flatData);
      
      expect(result.length).toBe(11);
      
      // For constant price, all bands should be equal
      result.forEach(band => {
        expect(band.upper).toBe(100);
        expect(band.middle).toBe(100);
        expect(band.lower).toBe(100);
      });
    });

    it('should match calculateBollingerBands function output', async () => {
      // Import the legacy function
      const { calculateBollingerBands } = await import('@/lib/indicators/bollinger-bands');
      
      const legacyResult = calculateBollingerBands(mockData, 20, 2);
      const indicatorResult = indicator.calculate(mockData);
      
      expect(indicatorResult.length).toBe(legacyResult.length);
      
      // Compare values (allowing small floating point differences)
      indicatorResult.forEach((result, index) => {
        expect(result.upper).toBeCloseTo(legacyResult[index].upper, 10);
        expect(result.middle).toBeCloseTo(legacyResult[index].middle, 10);
        expect(result.lower).toBeCloseTo(legacyResult[index].lower, 10);
      });
    });

    it('should handle custom parameters', () => {
      const customIndicator = new BollingerBandsIndicator(10, 3);
      const result = customIndicator.calculate(mockData);
      
      expect(result.length).toBe(21); // 30 - 10 + 1
      
      // With larger stdDev, bands should be wider
      result.forEach(band => {
        const width = band.upper - band.lower;
        expect(width).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle small stdDev multiplier', () => {
      const narrowIndicator = new BollingerBandsIndicator(20, 0.5);
      const result = narrowIndicator.calculate(mockData);
      
      expect(result.length).toBe(11);
      
      // Bands should still maintain proper relationship
      result.forEach(band => {
        expect(band.upper).toBeGreaterThanOrEqual(band.middle);
        expect(band.middle).toBeGreaterThanOrEqual(band.lower);
      });
    });
  });

  describe('output validation', () => {
    it('should validate band relationships', () => {
      const indicator = new BollingerBandsIndicator();
      const result = indicator.calculate(mockData);
      
      // The custom validation ensures upper >= middle >= lower
      result.forEach(band => {
        expect(band.upper).toBeGreaterThanOrEqual(band.middle);
        expect(band.middle).toBeGreaterThanOrEqual(band.lower);
      });
    });
  });

  describe('getBollingerBandsConfig', () => {
    it('should return default configuration', () => {
      const config = getBollingerBandsConfig();
      expect(config).toEqual({
        period: 20,
        stdDev: 2
      });
    });

    it('should return custom configuration', () => {
      const config = getBollingerBandsConfig(10, 3);
      expect(config).toEqual({
        period: 10,
        stdDev: 3
      });
    });

    it('should handle partial parameters', () => {
      const config1 = getBollingerBandsConfig(15);
      expect(config1).toEqual({
        period: 15,
        stdDev: 2
      });

      const config2 = getBollingerBandsConfig(undefined, 2.5);
      expect(config2).toEqual({
        period: 20,
        stdDev: 2.5
      });
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      const indicator = new BollingerBandsIndicator();
      const invalidData = null as any;
      
      const result = indicator.calculate(invalidData);
      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const indicator = new BollingerBandsIndicator();
      const result = indicator.calculate([]);
      
      expect(result).toEqual([]);
    });

    it('should handle negative variance edge case', () => {
      // Create data that might cause numerical issues
      const edgeCaseData: PriceDataLightweight[] = Array.from({ length: 30 }, (_, i) => ({
        time: 1638360000 + i * 3600,
        close: i < 15 ? 1e-10 : 1e10 // Extreme values
      }));

      const indicator = new BollingerBandsIndicator();
      const result = indicator.calculate(edgeCaseData);
      
      // Should not throw and bands should maintain relationship
      result.forEach(band => {
        expect(Number.isFinite(band.upper)).toBe(true);
        expect(Number.isFinite(band.middle)).toBe(true);
        expect(Number.isFinite(band.lower)).toBe(true);
        expect(band.upper).toBeGreaterThanOrEqual(band.middle);
        expect(band.middle).toBeGreaterThanOrEqual(band.lower);
      });
    });
  });
});