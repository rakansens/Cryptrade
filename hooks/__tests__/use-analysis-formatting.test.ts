import { renderHook } from '@testing-library/react';
import { useAnalysisFormatting } from '../use-analysis-formatting';

describe('useAnalysisFormatting', () => {
  // Mock current time for consistent testing
  const mockDate = new Date('2024-01-15T12:00:00Z');
  const originalDate = Date;

  beforeEach(() => {
    // Mock Date constructor to return consistent time
    global.Date = jest.fn((...args) => {
      if (args.length === 0) {
        return mockDate;
      }
      return new originalDate(...args);
    }) as any;
    global.Date.now = originalDate.now;
    global.Date.parse = originalDate.parse;
    global.Date.UTC = originalDate.UTC;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('formatDate', () => {
    it('should format dates less than 1 hour ago in minutes', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      // 30 minutes ago
      const timestamp = mockDate.getTime() - (30 * 60 * 1000);
      expect(result.current.formatDate(timestamp)).toBe('30分前');
      
      // 45 minutes ago
      const timestamp2 = mockDate.getTime() - (45 * 60 * 1000);
      expect(result.current.formatDate(timestamp2)).toBe('45分前');
    });

    it('should format dates less than 24 hours ago in hours', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      // 2 hours ago
      const timestamp = mockDate.getTime() - (2 * 60 * 60 * 1000);
      expect(result.current.formatDate(timestamp)).toBe('2時間前');
      
      // 23 hours ago
      const timestamp2 = mockDate.getTime() - (23 * 60 * 60 * 1000);
      expect(result.current.formatDate(timestamp2)).toBe('23時間前');
    });

    it('should format dates between 24-48 hours ago as "昨日"', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      // 25 hours ago
      const timestamp = mockDate.getTime() - (25 * 60 * 60 * 1000);
      expect(result.current.formatDate(timestamp)).toBe('昨日');
      
      // 47 hours ago
      const timestamp2 = mockDate.getTime() - (47 * 60 * 60 * 1000);
      expect(result.current.formatDate(timestamp2)).toBe('昨日');
    });

    it('should format older dates with full date and time', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      // 3 days ago
      const timestamp = mockDate.getTime() - (72 * 60 * 60 * 1000);
      const formatted = result.current.formatDate(timestamp);
      
      // Should include month, day, hour, and minute
      expect(formatted).toMatch(/\d+月\d+日/);
      expect(formatted).toMatch(/\d+:\d+/);
    });

    it('should round minutes correctly', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      // 0.5 minutes ago (30 seconds)
      const timestamp = mockDate.getTime() - (0.5 * 60 * 1000);
      expect(result.current.formatDate(timestamp)).toBe('1分前');
      
      // 1.4 minutes ago
      const timestamp2 = mockDate.getTime() - (1.4 * 60 * 1000);
      expect(result.current.formatDate(timestamp2)).toBe('1分前');
      
      // 1.6 minutes ago
      const timestamp3 = mockDate.getTime() - (1.6 * 60 * 1000);
      expect(result.current.formatDate(timestamp3)).toBe('2分前');
    });
  });

  describe('formatDuration', () => {
    it('should format durations less than 1 minute', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatDuration(30000)).toBe('1分未満'); // 30 seconds
      expect(result.current.formatDuration(59999)).toBe('1分未満'); // 59.999 seconds
    });

    it('should format durations in minutes only', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatDuration(60000)).toBe('1分'); // 1 minute
      expect(result.current.formatDuration(150000)).toBe('2分'); // 2.5 minutes
      expect(result.current.formatDuration(3540000)).toBe('59分'); // 59 minutes
    });

    it('should format durations in hours and minutes', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatDuration(3600000)).toBe('1時間'); // 1 hour exactly
      expect(result.current.formatDuration(3900000)).toBe('1時間5分'); // 1 hour 5 minutes
      expect(result.current.formatDuration(7320000)).toBe('2時間2分'); // 2 hours 2 minutes
    });

    it('should handle edge cases', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatDuration(0)).toBe('1分未満');
      expect(result.current.formatDuration(-1000)).toBe('1分未満'); // Negative duration
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal values as percentages', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPercentage(0.5)).toBe('50%');
      expect(result.current.formatPercentage(0.75)).toBe('75%');
      expect(result.current.formatPercentage(1)).toBe('100%');
      expect(result.current.formatPercentage(0)).toBe('0%');
    });

    it('should round percentages correctly', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPercentage(0.754)).toBe('75%');
      expect(result.current.formatPercentage(0.755)).toBe('76%');
      expect(result.current.formatPercentage(0.999)).toBe('100%');
    });

    it('should handle values greater than 1', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPercentage(1.5)).toBe('150%');
      expect(result.current.formatPercentage(2)).toBe('200%');
    });

    it('should handle negative values', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPercentage(-0.25)).toBe('-25%');
      expect(result.current.formatPercentage(-1)).toBe('-100%');
    });
  });

  describe('formatPrice', () => {
    it('should format prices with dollar sign and thousand separators', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPrice(1000)).toBe('$1,000');
      expect(result.current.formatPrice(1000000)).toBe('$1,000,000');
      expect(result.current.formatPrice(50)).toBe('$50');
    });

    it('should handle decimal prices', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPrice(99.99)).toBe('$99.99');
      expect(result.current.formatPrice(1234.5)).toBe('$1,234.5');
      expect(result.current.formatPrice(0.5)).toBe('$0.5');
    });

    it('should limit decimal places to 2', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPrice(99.999)).toBe('$100');
      expect(result.current.formatPrice(123.456)).toBe('$123.46');
    });

    it('should handle edge cases', () => {
      const { result } = renderHook(() => useAnalysisFormatting());
      
      expect(result.current.formatPrice(0)).toBe('$0');
      expect(result.current.formatPrice(-100)).toBe('$-100');
    });
  });

  describe('memoization', () => {
    it('should return the same formatter functions on re-renders', () => {
      const { result, rerender } = renderHook(() => useAnalysisFormatting());
      
      const firstResult = result.current;
      rerender();
      const secondResult = result.current;
      
      expect(firstResult).toBe(secondResult);
      expect(firstResult.formatDate).toBe(secondResult.formatDate);
      expect(firstResult.formatDuration).toBe(secondResult.formatDuration);
      expect(firstResult.formatPercentage).toBe(secondResult.formatPercentage);
      expect(firstResult.formatPrice).toBe(secondResult.formatPrice);
    });
  });
});