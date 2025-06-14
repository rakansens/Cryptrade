import { renderHook, act } from '@testing-library/react-hooks';
import { useChartStoreBase } from '@/store/chart.store';
import { ChartPersistenceManager } from '@/lib/storage/chart-persistence';
import type { ChartDrawing } from '@/lib/validation/chart-drawing.schema';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Timeframe Switching with Drawing Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useChartStoreBase.setState({
      drawings: [],
      patterns: new Map(),
      timeframe: '1h',
      symbol: 'BTCUSDT'
    });
  });

  const mockDrawing: ChartDrawing = {
    id: 'test-line-1',
    type: 'trendline',
    points: [
      { time: 1700000000, value: 45000 },
      { time: 1700001000, value: 46000 }
    ],
    style: {
      color: '#2962ff',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true
    },
    visible: true,
    interactive: true
  };

  const mockPattern = {
    type: 'triangle',
    visualization: {
      lines: [{
        start: { time: 1700000000, value: 45000 },
        end: { time: 1700002000, value: 46000 }
      }]
    },
    metrics: { height: 1000, duration: 2000 },
    confidence: 0.85
  };

  it('should preserve drawings when switching timeframes', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add a drawing
    act(() => {
      result.current.addDrawing(mockDrawing);
    });

    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.drawings[0].id).toBe('test-line-1');

    // Switch timeframe
    act(() => {
      result.current.setTimeframe('4h');
    });

    // Drawing should still be there
    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.drawings[0].id).toBe('test-line-1');
    expect(result.current.timeframe).toBe('4h');
  });

  it('should preserve patterns when switching timeframes', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add a pattern
    act(() => {
      result.current.addPattern('pattern-1', mockPattern);
    });

    expect(result.current.patterns.size).toBe(1);
    expect(result.current.patterns.get('pattern-1')).toEqual(mockPattern);

    // Switch timeframe
    act(() => {
      result.current.setTimeframe('15m');
    });

    // Pattern should still be there
    expect(result.current.patterns.size).toBe(1);
    expect(result.current.patterns.get('pattern-1')).toEqual(mockPattern);
    expect(result.current.timeframe).toBe('15m');
  });

  it('should save to localStorage when adding drawings', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add a drawing
    act(() => {
      result.current.addDrawing(mockDrawing);
    });

    // Check localStorage
    const saved = localStorage.getItem('cryptrade_chart_drawings');
    expect(saved).toBeTruthy();
    
    const parsed = JSON.parse(saved!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('test-line-1');
  });

  it('should validate drawings before adding', () => {
    const { result } = renderHook(() => useChartStoreBase());

    const invalidDrawing = {
      id: 'invalid',
      type: 'invalid-type' as any,
      points: [],
      style: { color: 'not-a-hex-color' } as any,
      visible: true,
      interactive: true
    };

    // Try to add invalid drawing
    act(() => {
      result.current.addDrawing(invalidDrawing);
    });

    // Should not be added
    expect(result.current.drawings).toHaveLength(0);
  });

  it('should handle multiple timeframe switches', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add multiple drawings
    const drawing1 = { ...mockDrawing, id: 'line-1' };
    const drawing2 = { ...mockDrawing, id: 'line-2', type: 'horizontal' as const };

    act(() => {
      result.current.addDrawing(drawing1);
      result.current.addDrawing(drawing2);
      result.current.addPattern('pattern-1', mockPattern);
    });

    expect(result.current.drawings).toHaveLength(2);
    expect(result.current.patterns.size).toBe(1);

    // Switch timeframes multiple times
    const timeframes = ['5m', '15m', '30m', '1h', '4h', '1d'];
    
    timeframes.forEach(tf => {
      act(() => {
        result.current.setTimeframe(tf as any);
      });
      
      // All data should persist
      expect(result.current.drawings).toHaveLength(2);
      expect(result.current.patterns.size).toBe(1);
      expect(result.current.timeframe).toBe(tf);
    });
  });

  it('should persist undo/redo stacks correctly', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add drawings
    act(() => {
      result.current.addDrawing(mockDrawing);
    });

    const drawing2 = { ...mockDrawing, id: 'line-2' };
    act(() => {
      result.current.addDrawing(drawing2);
    });

    expect(result.current.drawings).toHaveLength(2);
    expect(result.current.undoStack).toHaveLength(2);

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.redoStack).toHaveLength(1);

    // Switch timeframe
    act(() => {
      result.current.setTimeframe('4h');
    });

    // Undo/redo state should be preserved
    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.redoStack).toHaveLength(1);

    // Redo should still work
    act(() => {
      result.current.redo();
    });

    expect(result.current.drawings).toHaveLength(2);
  });

  it('should clear all data when requested', () => {
    const { result } = renderHook(() => useChartStoreBase());

    // Add data
    act(() => {
      result.current.addDrawing(mockDrawing);
      result.current.addPattern('pattern-1', mockPattern);
    });

    expect(result.current.drawings).toHaveLength(1);
    expect(result.current.patterns.size).toBe(1);

    // Clear all drawings
    act(() => {
      result.current.clearAllDrawings();
    });

    expect(result.current.drawings).toHaveLength(0);
    expect(localStorage.getItem('cryptrade_chart_drawings')).toBe('[]');

    // Clear all patterns
    act(() => {
      result.current.clearPatterns();
    });

    expect(result.current.patterns.size).toBe(0);
    expect(localStorage.getItem('cryptrade_chart_patterns')).toBe('[]');
  });
});