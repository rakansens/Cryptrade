/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { 
  useChartRangeStore,
  useChartRange,
  useVisibleLogicalRange,
  useChartRangeSync,
  useRegisteredChartsCount,
  useChartRangeActions
} from '@/store/chart-range.store';
import type { LogicalRange } from 'lightweight-charts';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock zustand helpers
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: () => jest.fn()
}));

describe('Store: ChartRangeStore', () => {
  const mockRange: LogicalRange = { from: 0, to: 100 };
  
  beforeEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useChartRangeActions());
    act(() => {
      result.current.reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useChartRange());
      
      expect(result.current.visibleLogicalRange).toBeNull();
      expect(result.current.registeredChartsCount).toBe(0);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Range Management', () => {
    it('should set visible logical range', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.setVisibleLogicalRange(mockRange);
      });
      
      expect(result.current.visibleLogicalRange).toEqual(mockRange);
    });

    it('should prevent range update when syncing', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.setSyncing(true);
        result.current.setVisibleLogicalRange(mockRange);
      });
      
      expect(result.current.visibleLogicalRange).toBeNull();
    });

    it('should handle null range', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.setVisibleLogicalRange(mockRange);
        result.current.setVisibleLogicalRange(null);
      });
      
      expect(result.current.visibleLogicalRange).toBeNull();
    });
  });

  describe('Chart Registration', () => {
    it('should register charts', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.registerChart('chart1');
        result.current.registerChart('chart2');
      });
      
      expect(result.current.registeredChartsCount).toBe(2);
    });

    it('should not duplicate chart registrations', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.registerChart('chart1');
        result.current.registerChart('chart1'); // Duplicate
      });
      
      expect(result.current.registeredChartsCount).toBe(1);
    });

    it('should unregister charts', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.registerChart('chart1');
        result.current.registerChart('chart2');
        result.current.unregisterChart('chart1');
      });
      
      expect(result.current.registeredChartsCount).toBe(1);
    });

    it('should handle unregistering non-existent chart', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.registerChart('chart1');
        result.current.unregisterChart('chart2'); // Non-existent
      });
      
      expect(result.current.registeredChartsCount).toBe(1);
    });
  });

  describe('Sync Control', () => {
    it('should set syncing state', () => {
      const { result } = renderHook(() => useChartRange());
      
      act(() => {
        result.current.setSyncing(true);
      });
      
      expect(result.current.isSyncing).toBe(true);
      
      act(() => {
        result.current.setSyncing(false);
      });
      
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() => useChartRange());
      
      // Set up some state
      act(() => {
        result.current.setVisibleLogicalRange(mockRange);
        result.current.registerChart('chart1');
        result.current.setSyncing(true);
      });
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.visibleLogicalRange).toBeNull();
      expect(result.current.registeredChartsCount).toBe(0);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('Individual Hooks', () => {
    it('should work with useVisibleLogicalRange hook', () => {
      const { result: rangeResult } = renderHook(() => useVisibleLogicalRange());
      const { result: actionsResult } = renderHook(() => useChartRangeActions());
      
      expect(rangeResult.current).toBeNull();
      
      act(() => {
        actionsResult.current.setVisibleLogicalRange(mockRange);
      });
      
      expect(rangeResult.current).toEqual(mockRange);
    });

    it('should work with useChartRangeSync hook', () => {
      const { result: syncResult } = renderHook(() => useChartRangeSync());
      const { result: actionsResult } = renderHook(() => useChartRangeActions());
      
      expect(syncResult.current).toBe(false);
      
      act(() => {
        actionsResult.current.setSyncing(true);
      });
      
      expect(syncResult.current).toBe(true);
    });

    it('should work with useRegisteredChartsCount hook', () => {
      const { result: countResult } = renderHook(() => useRegisteredChartsCount());
      const { result: actionsResult } = renderHook(() => useChartRangeActions());
      
      expect(countResult.current).toBe(0);
      
      act(() => {
        actionsResult.current.registerChart('chart1');
        actionsResult.current.registerChart('chart2');
      });
      
      expect(countResult.current).toBe(2);
    });
  });

  describe('Selector Hook', () => {
    it('should work with custom selectors', () => {
      const { result } = renderHook(() => 
        useChartRangeStore(state => ({
          range: state.visibleLogicalRange,
          chartCount: state.registeredCharts.size
        }))
      );
      
      const { result: actionsResult } = renderHook(() => useChartRangeActions());
      
      act(() => {
        actionsResult.current.setVisibleLogicalRange(mockRange);
        actionsResult.current.registerChart('chart1');
      });
      
      expect(result.current.range).toEqual(mockRange);
      expect(result.current.chartCount).toBe(1);
    });
  });

  describe('State Persistence', () => {
    it('should persist state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useChartRange());
      
      act(() => {
        result1.current.setVisibleLogicalRange(mockRange);
        result1.current.registerChart('chart1');
      });
      
      const { result: result2 } = renderHook(() => useChartRange());
      
      expect(result2.current.visibleLogicalRange).toEqual(mockRange);
      expect(result2.current.registeredChartsCount).toBe(1);
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on state changes', () => {
      const subscriber = jest.fn();
      const { result } = renderHook(() => useChartRangeStore(subscriber));
      
      act(() => {
        const { result: actionsResult } = renderHook(() => useChartRangeActions());
        actionsResult.current.setVisibleLogicalRange(mockRange);
      });
      
      expect(subscriber).toHaveBeenCalled();
    });
  });
});
