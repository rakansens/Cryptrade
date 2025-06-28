import { renderHook, act } from '@testing-library/react';
import { useChartDataBase } from '@/hooks/shared/useChartDataBase';
import type { ProcessedKline } from '@/types/market';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('useChartDataBase', () => {
  const mockData: ProcessedKline[] = [
    { time: 1735830000, open: 100000, high: 101000, low: 99000, close: 100500, volume: 1000 },
    { time: 1735833600, open: 100500, high: 102000, low: 100000, close: 101500, volume: 1200 },
    { time: 1735837200, open: 101500, high: 103000, low: 101000, close: 102500, volume: 1500 },
  ];

  const defaultConfig = {
    hookName: 'useChartDataBase-test',
    enableAutoCleanup: true,
    logLevel: 'info' as const
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      expect(result.current.hasAutoProcessed()).toBe(false);
      expect(result.current.getDataCount()).toBe(0);
    });

    it('should handle custom configuration', () => {
      const customConfig = {
        hookName: 'custom-chart-data',
        enableAutoCleanup: false,
        logLevel: 'debug' as const
      };
      
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(customConfig));
      
      expect(result.current.isMounted()).toBe(true);
    });
  });

  describe('data management', () => {
    it('should format chart data correctly', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const formattedData = result.current.formatChartData(mockData);
      
      expect(formattedData).toHaveLength(3);
      expect(formattedData[0]).toEqual({
        time: 1735830000,
        open: 100000,
        high: 101000,
        low: 99000,
        close: 100500
      });
    });

    it('should detect data changes correctly', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      // First call should detect change
      const hasChanged1 = result.current.detectDataChange(mockData, (data) => data.length);
      expect(hasChanged1).toBe(true);
      
      // Second call with same data should not detect change
      const hasChanged2 = result.current.detectDataChange(mockData, (data) => data.length);
      expect(hasChanged2).toBe(false);
      
      // Different data should detect change
      const newData = [...mockData, { time: 1735840800, open: 102500, high: 103500, low: 102000, close: 103000, volume: 1800 }];
      const hasChanged3 = result.current.detectDataChange(newData, (data) => data.length);
      expect(hasChanged3).toBe(true);
    });

    it('should track data count', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      expect(result.current.getDataCount()).toBe(0);
      
      result.current.detectDataChange(mockData, (data) => data.length);
      expect(result.current.getDataCount()).toBe(3);
      
      const newData = [...mockData, { time: 1735840800, open: 102500, high: 103500, low: 102000, close: 103000, volume: 1800 }];
      result.current.detectDataChange(newData, (data) => data.length);
      expect(result.current.getDataCount()).toBe(4);
    });
  });

  describe('auto processing', () => {
    it('should handle auto processed flag', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      expect(result.current.hasAutoProcessed()).toBe(false);
      
      act(() => {
        result.current.setAutoProcessed();
      });
      
      expect(result.current.hasAutoProcessed()).toBe(true);
    });

    it('should reset auto processed flag', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      act(() => {
        result.current.setAutoProcessed();
      });
      expect(result.current.hasAutoProcessed()).toBe(true);
      
      act(() => {
        result.current.resetAutoProcessed();
      });
      expect(result.current.hasAutoProcessed()).toBe(false);
    });
  });

  describe('safe execution', () => {
    it('should execute safely when mounted', async () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation);
      });
      
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should not execute when unmounted', async () => {
      const { result, unmount } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      unmount();
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation);
      });
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should handle errors in safe execution', async () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      const { logger } = require('@/lib/utils/logger');
      
      await act(async () => {
        await result.current.executeSafely('test operation', mockOperation, {
          data: { test: 'context' }
        });
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[useChartDataBase-test] test operation failed',
        expect.objectContaining({
          error: 'Test error',
          data: { test: 'context' }
        })
      );
    });
  });

  describe('logging', () => {
    it('should log info messages when log level allows', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.safeLog('info', 'Test info message', { test: 'data' });
      
      expect(logger.info).toHaveBeenCalledWith('[useChartDataBase-test] Test info message', { test: 'data' });
    });

    it('should not log debug messages when log level is info', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.safeLog('debug', 'Test debug message');
      
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should always log error messages', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      const { logger } = require('@/lib/utils/logger');
      
      result.current.safeLog('error', 'Test error message', { error: 'test error' });
      
      expect(logger.error).toHaveBeenCalledWith('[useChartDataBase-test] Test error message', { error: 'test error' });
    });
  });

  describe('cleanup', () => {
    it('should mark as unmounted when component unmounts', () => {
      const { result, unmount } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      expect(result.current.isMounted()).toBe(true);
      
      unmount();
      
      expect(result.current.isMounted()).toBe(false);
    });

    it('should reset state on unmount when auto cleanup is enabled', () => {
      const { result, unmount } = renderHook(() => useChartDataBase<ProcessedKline[]>({
        ...defaultConfig,
        enableAutoCleanup: true
      }));
      
      // Set some state
      act(() => {
        result.current.setAutoProcessed();
      });
      result.current.detectDataChange(mockData, (data) => data.length);
      
      expect(result.current.hasAutoProcessed()).toBe(true);
      expect(result.current.getDataCount()).toBe(3);
      
      unmount();
      
      // State should be reset after unmount
      expect(result.current.hasAutoProcessed()).toBe(false);
      expect(result.current.getDataCount()).toBe(0);
    });

    it('should not reset state on unmount when auto cleanup is disabled', () => {
      const { result, unmount } = renderHook(() => useChartDataBase<ProcessedKline[]>({
        ...defaultConfig,
        enableAutoCleanup: false
      }));
      
      // Set some state
      act(() => {
        result.current.setAutoProcessed();
      });
      result.current.detectDataChange(mockData, (data) => data.length);
      
      expect(result.current.hasAutoProcessed()).toBe(true);
      expect(result.current.getDataCount()).toBe(3);
      
      unmount();
      
      // State should persist after unmount
      expect(result.current.hasAutoProcessed()).toBe(true);
      expect(result.current.getDataCount()).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data arrays', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const formattedData = result.current.formatChartData([]);
      expect(formattedData).toEqual([]);
      
      const hasChanged = result.current.detectDataChange([], (data) => data.length);
      expect(hasChanged).toBe(true);
      expect(result.current.getDataCount()).toBe(0);
    });

    it('should handle null/undefined data', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      const formattedData = result.current.formatChartData(null as any);
      expect(formattedData).toEqual([]);
    });

    it('should handle invalid extraction functions', () => {
      const { result } = renderHook(() => useChartDataBase<ProcessedKline[]>(defaultConfig));
      
      // Should not throw error with invalid extraction function
      expect(() => {
        result.current.detectDataChange(mockData, null as any);
      }).not.toThrow();
    });
  });
});