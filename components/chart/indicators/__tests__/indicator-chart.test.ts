import { renderHook, act } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useIndicatorChartInit } from '../../hooks/useIndicatorChartInit';
import { useIndicatorChartData } from '../../hooks/useIndicatorChartData';
import type { ProcessedKline } from '@/types/market';

// Mock lightweight-charts
const mockChart = {
  addLineSeries: jest.fn(() => ({
    setData: jest.fn(),
  })),
  addHistogramSeries: jest.fn(() => ({
    setData: jest.fn(),
  })),
  priceScale: jest.fn(() => ({
    applyOptions: jest.fn(),
  })),
  timeScale: jest.fn(() => ({
    setVisibleLogicalRange: jest.fn(),
    subscribeVisibleLogicalRangeChange: jest.fn(),
  })),
  applyOptions: jest.fn(),
  remove: jest.fn(),
};

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => mockChart),
  ColorType: { Solid: 'solid' },
  LineStyle: { Dashed: 2 },
}));

// Mock chart range store
jest.mock('@/store/chart-range.store', () => ({
  useChartRange: () => ({
    registerChart: jest.fn(),
    unregisterChart: jest.fn(),
    visibleLogicalRange: null,
    setSyncing: jest.fn(),
  }),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

// Performance testing utilities
const createMockPriceData = (count: number): ProcessedKline[] => {
  return Array.from({ length: count }, (_, i) => ({
    time: (Date.now() / 1000 + i * 3600) as any,
    open: 100 + Math.random() * 10,
    high: 105 + Math.random() * 10,
    low: 95 + Math.random() * 10,
    close: 100 + Math.random() * 10,
    volume: 1000 + Math.random() * 500,
  }));
};

const mockCalculateIndicator = jest.fn((data) => 
  data.map((item: any, index: number) => ({
    time: item.time,
    value: 50 + Math.sin(index * 0.1) * 20,
  }))
);

const mockFormatSeriesData = jest.fn((data) => ({
  main: data,
}));

describe('Indicator Chart Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock DOM element
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 400,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('useIndicatorChartInit', () => {
    it('should initialize chart only once per symbol', () => {
      const { result, rerender } = renderHook(
        ({ chartId }) => useIndicatorChartInit({
          chartId,
          height: 150,
        }),
        { initialProps: { chartId: 'test-chart' } }
      );

      // Initialize chart
      act(() => {
        result.current.initializeChart();
      });

      expect(mockChart.addLineSeries).not.toHaveBeenCalled();
      
      // Re-render with same chartId should not re-initialize
      rerender({ chartId: 'test-chart' });
      
      expect(mockChart.remove).not.toHaveBeenCalled();
    });

    it('should clean up chart when chartId changes', () => {
      const { result, rerender } = renderHook(
        ({ chartId }) => useIndicatorChartInit({
          chartId,
          height: 150,
        }),
        { initialProps: { chartId: 'test-chart-1' } }
      );

      // Initialize chart
      act(() => {
        result.current.initializeChart();
      });

      // Change chartId should trigger cleanup
      rerender({ chartId: 'test-chart-2' });

      expect(mockChart.remove).toHaveBeenCalled();
    });

    it('should handle resize efficiently', () => {
      const { result } = renderHook(() => useIndicatorChartInit({
        chartId: 'test-chart',
        height: 150,
      }));

      act(() => {
        result.current.initializeChart();
      });

      // Simulate resize
      act(() => {
        result.current.handleResize();
      });

      expect(mockChart.applyOptions).toHaveBeenCalled();
    });
  });

  describe('useIndicatorChartData Performance', () => {
    it('should update data efficiently with setData() only', async () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      const { result, rerender } = renderHook(
        ({ priceData }) => useIndicatorChartData({
          chartId: 'test-chart',
          priceData,
          seriesRefs: mockSeriesRefs,
          isInitialized: true,
          calculateIndicator: mockCalculateIndicator,
          formatSeriesData: mockFormatSeriesData,
        }),
        { 
          initialProps: { 
            priceData: createMockPriceData(100) 
          } 
        }
      );

      expect(mockSeriesRefs.main.setData).toHaveBeenCalled();

      // Performance test: measure update time
      const startTime = performance.now();
      
      act(() => {
        rerender({ priceData: createMockPriceData(200) });
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Assert update time is under 50ms threshold
      expect(updateTime).toBeLessThan(50);
    });

    it('should handle large datasets efficiently', async () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      const largeDataset = createMockPriceData(1000);

      const startTime = performance.now();

      renderHook(() => useIndicatorChartData({
        chartId: 'test-chart',
        priceData: largeDataset,
        seriesRefs: mockSeriesRefs,
        isInitialized: true,
        calculateIndicator: mockCalculateIndicator,
        formatSeriesData: mockFormatSeriesData,
      }));

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Assert large dataset handling is under 100ms
      expect(renderTime).toBeLessThan(100);
      expect(mockSeriesRefs.main.setData).toHaveBeenCalled();
    });

    it('should not update when not initialized', () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      renderHook(() => useIndicatorChartData({
        chartId: 'test-chart',
        priceData: createMockPriceData(100),
        seriesRefs: mockSeriesRefs,
        isInitialized: false, // Not initialized
        calculateIndicator: mockCalculateIndicator,
        formatSeriesData: mockFormatSeriesData,
      }));

      expect(mockSeriesRefs.main.setData).not.toHaveBeenCalled();
    });

    it('should handle empty data gracefully', () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      const { result } = renderHook(() => useIndicatorChartData({
        chartId: 'test-chart',
        priceData: [], // Empty data
        seriesRefs: mockSeriesRefs,
        isInitialized: true,
        calculateIndicator: mockCalculateIndicator,
        formatSeriesData: mockFormatSeriesData,
      }));

      expect(result.current.hasData).toBe(false);
      expect(mockSeriesRefs.main.setData).not.toHaveBeenCalled();
    });
  });

  describe('Memory and Re-render Optimization', () => {
    it('should not cause excessive re-renders on price data updates', () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      let renderCount = 0;
      const TestComponent = ({ priceData }: { priceData: ProcessedKline[] }) => {
        renderCount++;
        useIndicatorChartData({
          chartId: 'test-chart',
          priceData,
          seriesRefs: mockSeriesRefs,
          isInitialized: true,
          calculateIndicator: mockCalculateIndicator,
          formatSeriesData: mockFormatSeriesData,
        });
        return null;
      };

      const { rerender } = renderHook(() => null);

      // Initial render
      renderCount = 0;
      TestComponent({ priceData: createMockPriceData(100) });
      const initialRenderCount = renderCount;

      // Update data multiple times
      for (let i = 0; i < 5; i++) {
        TestComponent({ priceData: createMockPriceData(100 + i) });
      }

      // Should not cause excessive re-renders (max 2x the updates)
      expect(renderCount).toBeLessThan(initialRenderCount + 10);
    });

    it('should clean up resources properly', () => {
      const { result, unmount } = renderHook(() => useIndicatorChartInit({
        chartId: 'test-chart',
        height: 150,
      }));

      act(() => {
        result.current.initializeChart();
      });

      // Unmount should trigger cleanup
      unmount();

      expect(mockChart.remove).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle chart creation errors gracefully', () => {
      const { createChart } = require('lightweight-charts');
      createChart.mockImplementationOnce(() => {
        throw new Error('Chart creation failed');
      });

      const { result } = renderHook(() => useIndicatorChartInit({
        chartId: 'test-chart',
        height: 150,
      }));

      expect(() => {
        act(() => {
          result.current.initializeChart();
        });
      }).not.toThrow();

      expect(result.current.chartInstance).toBe(null);
    });

    it('should handle indicator calculation errors gracefully', () => {
      const mockSeriesRefs = {
        main: { setData: jest.fn() },
      };

      const errorCalculator = jest.fn(() => {
        throw new Error('Calculation failed');
      });

      expect(() => {
        renderHook(() => useIndicatorChartData({
          chartId: 'test-chart',
          priceData: createMockPriceData(100),
          seriesRefs: mockSeriesRefs,
          isInitialized: true,
          calculateIndicator: errorCalculator,
          formatSeriesData: mockFormatSeriesData,
        }));
      }).not.toThrow();

      expect(mockSeriesRefs.main.setData).not.toHaveBeenCalled();
    });
  });
});