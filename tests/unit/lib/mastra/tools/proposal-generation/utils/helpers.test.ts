import {
  generateProposalId,
  calculateStandardDeviation,
  calculateMovingAverage,
  calculatePercentile,
  lerp,
  calculateAngleDegrees,
  calculatePriceChangePercent,
  formatTimestamp,
  calculateHoursDifference,
  chunk,
  unique,
  safeDivide,
  clamp,
  calculateWeightedAverage,
  detectOutliers,
  mode,
  deepMerge,
} from '@/lib/mastra/tools/proposal-generation/utils/helpers';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('proposal generation helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateProposalId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateProposalId('TEST');
      const id2 = generateProposalId('TEST');

      expect(id1).toMatch(/^TEST_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^TEST_\d+_[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const id = generateProposalId('TIME');
      const after = Date.now();

      const match = id.match(/^TIME_(\d+)_/);
      expect(match).toBeTruthy();
      
      const timestamp = parseInt(match![1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('calculateStandardDeviation', () => {
    it('should calculate standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const result = calculateStandardDeviation(values);
      expect(result).toBeCloseTo(2, 1);
    });

    it('should return 0 for empty array', () => {
      expect(calculateStandardDeviation([])).toBe(0);
    });

    it('should return 0 for single value', () => {
      expect(calculateStandardDeviation([5])).toBe(0);
    });

    it('should handle identical values', () => {
      expect(calculateStandardDeviation([10, 10, 10, 10])).toBe(0);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate simple moving average', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = calculateMovingAverage(values, 3);
      
      expect(result).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should return empty array for insufficient data', () => {
      expect(calculateMovingAverage([1, 2], 3)).toEqual([]);
    });

    it('should handle period of 1', () => {
      const values = [1, 2, 3];
      expect(calculateMovingAverage(values, 1)).toEqual([1, 2, 3]);
    });

    it('should handle period equal to array length', () => {
      const values = [1, 2, 3, 4, 5];
      const result = calculateMovingAverage(values, 5);
      expect(result).toEqual([3]); // Average of all values
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      expect(calculatePercentile(values, 25)).toBe(3);
      expect(calculatePercentile(values, 50)).toBe(5);
      expect(calculatePercentile(values, 75)).toBe(8);
      expect(calculatePercentile(values, 100)).toBe(10);
    });

    it('should return 0 for empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should handle single value', () => {
      expect(calculatePercentile([42], 50)).toBe(42);
    });

    it('should handle edge percentiles', () => {
      const values = [1, 2, 3, 4, 5];
      expect(calculatePercentile(values, 0)).toBe(1);
      expect(calculatePercentile(values, 100)).toBe(5);
    });
  });

  describe('lerp', () => {
    it('should interpolate between values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-5, -10, 0.5)).toBe(-7.5);
    });

    it('should extrapolate beyond range', () => {
      expect(lerp(0, 10, 1.5)).toBe(15);
      expect(lerp(0, 10, -0.5)).toBe(-5);
    });
  });

  describe('calculateAngleDegrees', () => {
    it('should convert slope to degrees', () => {
      expect(calculateAngleDegrees(0)).toBe(0);
      expect(calculateAngleDegrees(1)).toBeCloseTo(45, 0);
      expect(calculateAngleDegrees(-1)).toBeCloseTo(-45, 0);
    });

    it('should handle steep slopes', () => {
      expect(calculateAngleDegrees(100)).toBeCloseTo(89.4, 0);
      expect(calculateAngleDegrees(-100)).toBeCloseTo(-89.4, 0);
    });
  });

  describe('calculatePriceChangePercent', () => {
    it('should calculate percentage change', () => {
      expect(calculatePriceChangePercent(100, 110)).toBe(10);
      expect(calculatePriceChangePercent(100, 90)).toBe(-10);
      expect(calculatePriceChangePercent(50, 100)).toBe(100);
    });

    it('should handle zero start price', () => {
      expect(calculatePriceChangePercent(0, 100)).toBe(0);
    });

    it('should handle no change', () => {
      expect(calculatePriceChangePercent(100, 100)).toBe(0);
    });
  });

  describe('formatTimestamp', () => {
    it('should format unix timestamp to ISO string', () => {
      const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
      expect(formatTimestamp(timestamp)).toBe('2021-01-01T00:00:00.000Z');
    });

    it('should handle zero timestamp', () => {
      expect(formatTimestamp(0)).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('calculateHoursDifference', () => {
    it('should calculate hours between timestamps', () => {
      const start = 1609459200; // 2021-01-01 00:00:00
      const end = 1609466400;   // 2021-01-01 02:00:00
      
      expect(calculateHoursDifference(start, end)).toBe(2);
    });

    it('should return absolute difference', () => {
      expect(calculateHoursDifference(100, 50)).toBe(calculateHoursDifference(50, 100));
    });

    it('should handle same timestamps', () => {
      expect(calculateHoursDifference(1000, 1000)).toBe(0);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = chunk(array, 3);
      
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
    });

    it('should handle non-divisible lengths', () => {
      const array = [1, 2, 3, 4, 5];
      const result = chunk(array, 2);
      
      expect(result).toEqual([
        [1, 2],
        [3, 4],
        [5],
      ]);
    });

    it('should handle empty array', () => {
      expect(chunk([], 5)).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    });
  });

  describe('unique', () => {
    it('should remove duplicates from primitive array', () => {
      const array = [1, 2, 2, 3, 3, 3, 4];
      expect(unique(array)).toEqual([1, 2, 3, 4]);
    });

    it('should remove duplicates using key function', () => {
      const array = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
        { id: 3, name: 'D' },
      ];
      
      const result = unique(array, item => item.id.toString());
      
      expect(result).toEqual([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'D' },
      ]);
    });

    it('should handle empty array', () => {
      expect(unique([])).toEqual([]);
    });

    it('should preserve order', () => {
      const array = [3, 1, 4, 1, 5, 9, 2, 6, 5];
      const result = unique(array);
      expect(result).toEqual([3, 1, 4, 5, 9, 2, 6]);
    });
  });

  describe('safeDivide', () => {
    it('should perform normal division', () => {
      expect(safeDivide(10, 2)).toBe(5);
      expect(safeDivide(7, 3)).toBeCloseTo(2.333, 3);
      expect(safeDivide(-10, 4)).toBe(-2.5);
    });

    it('should return default value for division by zero', () => {
      expect(safeDivide(10, 0)).toBe(0);
      expect(safeDivide(10, 0, 999)).toBe(999);
    });

    it('should handle zero numerator', () => {
      expect(safeDivide(0, 5)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge values', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should handle negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(0, -10, -1)).toBe(-1);
      expect(clamp(-15, -10, -1)).toBe(-10);
    });
  });

  describe('calculateWeightedAverage', () => {
    it('should calculate weighted average', () => {
      const values = [80, 90, 100];
      const weights = [1, 2, 3];
      
      // (80*1 + 90*2 + 100*3) / (1+2+3) = 93.33...
      expect(calculateWeightedAverage(values, weights)).toBeCloseTo(93.333, 3);
    });

    it('should handle equal weights', () => {
      const values = [10, 20, 30];
      const weights = [1, 1, 1];
      
      expect(calculateWeightedAverage(values, weights)).toBe(20);
    });

    it('should return 0 for mismatched lengths', () => {
      const { logger } = require('@/lib/utils/logger');
      const result = calculateWeightedAverage([1, 2, 3], [1, 2]);
      
      expect(result).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return 0 for empty arrays', () => {
      expect(calculateWeightedAverage([], [])).toBe(0);
    });

    it('should handle zero total weight', () => {
      expect(calculateWeightedAverage([1, 2, 3], [0, 0, 0])).toBe(0);
    });
  });

  describe('detectOutliers', () => {
    it('should detect outliers using IQR method', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is outlier
      const result = detectOutliers(values);
      
      expect(result.outliers).toContain(100);
      expect(result.inliers).not.toContain(100);
      expect(result.inliers).toHaveLength(9);
    });

    it('should return bounds', () => {
      const values = [1, 2, 3, 4, 5];
      const result = detectOutliers(values);
      
      expect(result.bounds.lower).toBeLessThan(1);
      expect(result.bounds.upper).toBeGreaterThan(5);
    });

    it('should handle arrays with less than 4 values', () => {
      const result = detectOutliers([1, 2, 3]);
      
      expect(result.outliers).toEqual([]);
      expect(result.inliers).toEqual([1, 2, 3]);
      expect(result.bounds.lower).toBe(-Infinity);
      expect(result.bounds.upper).toBe(Infinity);
    });

    it('should handle arrays with no outliers', () => {
      const values = [1, 2, 3, 4, 5];
      const result = detectOutliers(values);
      
      expect(result.outliers).toEqual([]);
      expect(result.inliers).toEqual(values);
    });
  });

  describe('mode', () => {
    it('should find most frequent value', () => {
      expect(mode([1, 2, 2, 3, 3, 3, 4])).toBe(3);
      expect(mode(['a', 'b', 'b', 'c'])).toBe('b');
    });

    it('should return first mode for ties', () => {
      const values = [1, 1, 2, 2, 3];
      expect(mode(values)).toBe(1); // First value with max count
    });

    it('should return undefined for empty array', () => {
      expect(mode([])).toBeUndefined();
    });

    it('should handle single value', () => {
      expect(mode([42])).toBe(42);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = {
        a: 1,
        b: { c: 2, d: 3 },
        e: [1, 2, 3],
      };
      
      const source = {
        a: 10,
        b: { c: 20, f: 4 },
        g: 5,
      };
      
      const result = deepMerge(target, source);
      
      expect(result).toEqual({
        a: 10,
        b: { c: 20, d: 3, f: 4 },
        e: [1, 2, 3],
        g: 5,
      });
    });

    it('should not mutate original objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { c: 3 } };
      
      const result = deepMerge(target, source);
      
      expect(target.b.c).toBe(2);
      expect(source.b.c).toBe(3);
      expect(result.b.c).toBe(3);
    });

    it('should overwrite arrays', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      
      const result = deepMerge(target, source);
      
      expect(result.arr).toEqual([4, 5]);
    });

    it('should skip undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: undefined, b: 3, c: undefined };
      
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 3 });
    });

    it('should handle null values', () => {
      const target = { a: { b: 1 } };
      const source = { a: null };
      
      const result = deepMerge(target, source);
      
      expect(result.a).toBeNull();
    });

    it('should handle nested empty objects', () => {
      const target = { a: 1 };
      const source = { b: { c: { d: 2 } } };
      
      const result = deepMerge(target, source);
      
      expect(result).toEqual({
        a: 1,
        b: { c: { d: 2 } },
      });
    });
  });
});

export {};