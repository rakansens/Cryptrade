import { act, renderHook } from '@testing-library/react';
import { useChartRangeStore, useChartRangeActions, useChartRange } from '@/store/chart-range.store';

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('Store: useChartRangeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllStores();
  });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useChartRange());
    
    expect(result.current.visibleLogicalRange).toBeNull();
    expect(result.current.registeredChartsCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
  });

  it('should update visible range correctly', () => {
    const { result } = renderHook(() => useChartRange());
    
    const testRange = { from: 0, to: 100 };
    
    act(() => {
      result.current.setVisibleLogicalRange(testRange);
    });
    
    expect(result.current.visibleLogicalRange).toEqual(testRange);
  });

  it('should register and unregister charts', () => {
    const { result } = renderHook(() => useChartRange());
    
    act(() => {
      result.current.registerChart('chart1');
      result.current.registerChart('chart2');
    });
    
    expect(result.current.registeredChartsCount).toBe(2);
    
    act(() => {
      result.current.unregisterChart('chart1');
    });
    
    expect(result.current.registeredChartsCount).toBe(1);
  });

  it('should handle syncing state', () => {
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

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useChartRange());
    
    // Set some state
    act(() => {
      result.current.setVisibleLogicalRange({ from: 0, to: 100 });
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
