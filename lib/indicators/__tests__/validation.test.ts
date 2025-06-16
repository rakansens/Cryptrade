// Mock logger before imports
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validatePriceData,
  validateNumericArray,
  validateIndicatorInput,
  sanitizeData,
  type DataValidationOptions,
} from '../validation';

describe('Indicator Validation', () => {
  const mockPriceData = [
    { time: 1000, close: 100 },
    { time: 2000, close: 105 },
    { time: 3000, close: 110 },
    { time: 4000, close: 108 },
    { time: 5000, close: 112 },
  ];

  const defaultOptions: DataValidationOptions = {
    minLength: 2,
    allowNaN: false,
    allowInfinity: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePriceData', () => {
    it('should validate valid price data', () => {
      const result = validatePriceData(mockPriceData, defaultOptions);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty data', () => {
      const result = validatePriceData([], defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Data array is empty');
    });

    it('should reject null data', () => {
      const result = validatePriceData(null as any, defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Data array is empty');
    });

    it('should reject insufficient data', () => {
      const result = validatePriceData(
        [mockPriceData[0]], 
        { minLength: 5 }
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient data: 1 points provided, need at least 5');
    });

    it('should enforce maximum length', () => {
      const result = validatePriceData(
        mockPriceData,
        { minLength: 2, maxLength: 3 }
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too much data: 5 points provided, maximum is 3');
    });

    it('should detect NaN values', () => {
      const dataWithNaN = [
        ...mockPriceData.slice(0, 2),
        { time: 3000, close: NaN },
      ];
      
      const result = validatePriceData(dataWithNaN, defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Data contains NaN values at indices: 2');
    });

    it('should allow NaN when specified', () => {
      const dataWithNaN = [
        ...mockPriceData.slice(0, 2),
        { time: 3000, close: NaN },
      ];
      
      const result = validatePriceData(dataWithNaN, {
        ...defaultOptions,
        allowNaN: true,
      });
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Data contains 1 NaN values');
    });

    it('should detect Infinity values', () => {
      const dataWithInfinity = [
        ...mockPriceData.slice(0, 2),
        { time: 3000, close: Infinity },
      ];
      
      const result = validatePriceData(dataWithInfinity, defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Data contains Infinity values at indices: 2');
    });

    it('should detect negative prices', () => {
      const dataWithNegative = [
        ...mockPriceData.slice(0, 2),
        { time: 3000, close: -10 },
      ];
      
      const result = validatePriceData(dataWithNegative, defaultOptions);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Data contains negative values at indices: 2');
    });

    it('should check time monotonicity', () => {
      const nonMonotonicData = [
        { time: 1000, close: 100 },
        { time: 3000, close: 105 },
        { time: 2000, close: 110 }, // Out of order
      ];
      
      const result = validatePriceData(nonMonotonicData, {
        ...defaultOptions,
        checkMonotonic: true,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Time values are not monotonically increasing');
    });

    it('should detect duplicate timestamps', () => {
      const duplicateData = [
        { time: 1000, close: 100 },
        { time: 2000, close: 105 },
        { time: 2000, close: 110 }, // Duplicate
      ];
      
      const result = validatePriceData(duplicateData, defaultOptions);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Found 1 duplicate timestamps');
    });

    it('should use custom validator', () => {
      const customValidator = jest.fn().mockReturnValue({
        valid: false,
        error: 'Custom validation failed',
      });
      
      const result = validatePriceData(mockPriceData, {
        ...defaultOptions,
        customValidator: customValidator as any,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Custom validation failed');
      expect(customValidator).toHaveBeenCalledWith(mockPriceData);
    });

    it('should detect outliers', () => {
      const dataWithOutlier = [
        { time: 1000, close: 100 },
        { time: 2000, close: 105 },
        { time: 3000, close: 1000 }, // Outlier
        { time: 4000, close: 108 },
      ];
      
      const result = validatePriceData(dataWithOutlier, defaultOptions);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Potential outlier detected')
      );
    });
  });

  describe('validateNumericArray', () => {
    it('should validate valid numeric array', () => {
      const result = validateNumericArray([1, 2, 3, 4, 5], defaultOptions);
      
      expect(result.valid).toBe(true);
    });

    it('should reject non-numeric values', () => {
      const result = validateNumericArray([1, 2, 'three', 4] as any, defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Array contains non-numeric values at indices: 2');
    });

    it('should handle mixed types', () => {
      const result = validateNumericArray([1, 2, null, undefined, 5] as any, defaultOptions);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-numeric values');
    });

    it('should validate range constraints', () => {
      const result = validateNumericArray([1, 2, 3], {
        minLength: 2,
        minValue: 0,
        maxValue: 2,
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Values out of range [0, 2] at indices: 2');
    });

    it('should check for constant values', () => {
      const result = validateNumericArray([5, 5, 5, 5], defaultOptions);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('All values are constant (5)');
    });
  });

  describe('validateIndicatorInput', () => {
    it('should validate RSI input', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 14 },
        'RSI',
        defaultOptions
      );
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid RSI period', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 0 },
        'RSI',
        defaultOptions
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RSI period must be positive');
    });

    it('should validate MACD input', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        'MACD',
        defaultOptions
      );
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid MACD periods', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, fastPeriod: 26, slowPeriod: 12, signalPeriod: 9 },
        'MACD',
        defaultOptions
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MACD fast period must be less than slow period');
    });

    it('should validate Bollinger Bands input', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 20, stdDev: 2 },
        'BollingerBands',
        defaultOptions
      );
      
      expect(result.valid).toBe(true);
    });

    it('should reject negative standard deviation', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 20, stdDev: -2 },
        'BollingerBands',
        defaultOptions
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Standard deviation must be positive');
    });

    it('should validate SMA input', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 10 },
        'SMA',
        defaultOptions
      );
      
      expect(result.valid).toBe(true);
    });

    it('should validate EMA input', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData, period: 10 },
        'EMA',
        defaultOptions
      );
      
      expect(result.valid).toBe(true);
    });

    it('should handle unknown indicator', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData },
        'UnknownIndicator',
        defaultOptions
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown indicator: UnknownIndicator');
    });

    it('should ensure sufficient data for indicator', () => {
      const result = validateIndicatorInput(
        { data: mockPriceData.slice(0, 2), fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        'MACD',
        defaultOptions
      );
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient data for MACD');
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize price data', () => {
      const dirtyData = [
        { time: 1000, close: 100 },
        { time: 2000, close: NaN },
        { time: 3000, close: Infinity },
        { time: 4000, close: -Infinity },
        { time: 5000, close: 110 },
      ];
      
      const sanitized = sanitizeData(dirtyData);
      
      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].close).toBe(100);
      expect(sanitized[1].close).toBe(110);
    });

    it('should handle interpolation option', () => {
      const dataWithGaps = [
        { time: 1000, close: 100 },
        { time: 2000, close: NaN },
        { time: 3000, close: 110 },
      ];
      
      const sanitized = sanitizeData(dataWithGaps, {
        interpolate: true,
      });
      
      expect(sanitized).toHaveLength(3);
      expect(sanitized[1].close).toBe(105); // Interpolated
    });

    it('should handle fillForward option', () => {
      const dataWithGaps = [
        { time: 1000, close: 100 },
        { time: 2000, close: NaN },
        { time: 3000, close: NaN },
        { time: 4000, close: 110 },
      ];
      
      const sanitized = sanitizeData(dataWithGaps, {
        fillForward: true,
      });
      
      expect(sanitized).toHaveLength(4);
      expect(sanitized[1].close).toBe(100); // Filled forward
      expect(sanitized[2].close).toBe(100); // Filled forward
    });

    it('should remove outliers', () => {
      const dataWithOutliers = [
        { time: 1000, close: 100 },
        { time: 2000, close: 105 },
        { time: 3000, close: 1000 }, // Outlier
        { time: 4000, close: 108 },
        { time: 5000, close: 5 },    // Outlier
        { time: 6000, close: 110 },
      ];
      
      const sanitized = sanitizeData(dataWithOutliers, {
        removeOutliers: true,
        outlierStdDev: 2,
      });
      
      expect(sanitized.length).toBeLessThan(dataWithOutliers.length);
      expect(sanitized.every(d => d.close > 50 && d.close < 200)).toBe(true);
    });

    it('should handle empty array', () => {
      const sanitized = sanitizeData([]);
      expect(sanitized).toEqual([]);
    });

    it('should handle all invalid data', () => {
      const allInvalid = [
        { time: 1000, close: NaN },
        { time: 2000, close: Infinity },
        { time: 3000, close: -Infinity },
      ];
      
      const sanitized = sanitizeData(allInvalid);
      expect(sanitized).toEqual([]);
    });

    it('should preserve original data when no issues', () => {
      const sanitized = sanitizeData(mockPriceData);
      expect(sanitized).toEqual(mockPriceData);
    });

    it('should sort by time if needed', () => {
      const unsortedData = [
        { time: 3000, close: 110 },
        { time: 1000, close: 100 },
        { time: 2000, close: 105 },
      ];
      
      const sanitized = sanitizeData(unsortedData, {
        sortByTime: true,
      });
      
      expect(sanitized[0].time).toBe(1000);
      expect(sanitized[1].time).toBe(2000);
      expect(sanitized[2].time).toBe(3000);
    });
  });

  describe('edge cases', () => {
    it('should handle very large datasets', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        time: i * 1000,
        close: 100 + Math.random() * 10,
      }));
      
      const result = validatePriceData(largeData, {
        minLength: 100,
        maxLength: 15000,
      });
      
      expect(result.valid).toBe(true);
    });

    it('should handle extreme values', () => {
      const extremeData = [
        { time: 1000, close: Number.MIN_VALUE },
        { time: 2000, close: Number.MAX_VALUE },
        { time: 3000, close: Number.EPSILON },
      ];
      
      const result = validatePriceData(extremeData, defaultOptions);
      expect(result.valid).toBe(true);
    });

    it('should handle precision issues', () => {
      const precisionData = [
        { time: 1000, close: 0.1 + 0.2 }, // 0.30000000000000004
        { time: 2000, close: 0.3 },
      ];
      
      const result = validatePriceData(precisionData, defaultOptions);
      expect(result.valid).toBe(true);
    });
  });
});