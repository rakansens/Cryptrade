import { act, renderHook } from '@testing-library/react';
import { 
  useChartStore,
  useChartSymbol,
  useChartTimeframe,
  useChartIndicators,
  useChartSettings,
  useIsChartReady,
  useChartDrawings,
  useChartPatterns,
  useDrawingMode,
  useSelectedDrawing,
  useIsDrawing,
  useChartActions,
  useDrawingActions,
  usePatternActions,
  useChart,
  useChartBaseStore,
  useIndicatorStore,
  useDrawingStore,
  usePatternStore
} from '@/store/chart';
import type { ChartDrawing, DrawingMode } from '@/types/drawing';
import type { Pattern } from '@/types/pattern';
import type { PatternData } from '@/store/chart/types';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock zustand helpers
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

describe('Chart Store', () => {
  beforeEach(() => {
    // Reset stores before each test
    act(() => {
      // Reset all stores using their reset methods
      useChartBaseStore.getState().reset();
      useIndicatorStore.getState().reset();
      useDrawingStore.getState().reset();
      usePatternStore.getState().reset();
    });
  });

  describe('Legacy useChartStore', () => {
    it('should combine state from all sub-stores', () => {
      const { result } = renderHook(() => 
        useChartStore(state => ({
          symbol: state.symbol,
          timeframe: state.timeframe,
          indicators: state.indicators,
          drawingMode: state.drawingMode,
          patterns: state.patterns,
        }))
      );

      expect(result.current).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        drawingMode: null,
        patterns: new Map(),
      });
    });

    it('should support all legacy actions', () => {
      const { result } = renderHook(() => 
        useChartStore(state => ({
          setSymbol: state.setSymbol,
          setTimeframe: state.setTimeframe,
          setIndicatorEnabled: state.setIndicatorEnabled,
          setDrawingMode: state.setDrawingMode,
          addPattern: state.addPattern,
        }))
      );

      // Test symbol change
      act(() => {
        result.current.setSymbol('ETHUSDT');
      });

      const { result: symbolResult } = renderHook(() => useChartSymbol());
      expect(symbolResult.current).toBe('ETHUSDT');

      // Test timeframe change
      act(() => {
        result.current.setTimeframe('1h');
      });

      const { result: timeframeResult } = renderHook(() => useChartTimeframe());
      expect(timeframeResult.current).toBe('1h');

      // Test indicator toggle
      act(() => {
        result.current.setIndicatorEnabled('rsi', true);
      });

      const { result: indicatorResult } = renderHook(() => useChartIndicators());
      expect(indicatorResult.current.rsi).toBe(true);

      // Test drawing mode
      act(() => {
        result.current.setDrawingMode('trendline');
      });

      const { result: drawingModeResult } = renderHook(() => useDrawingMode());
      expect(drawingModeResult.current).toBe('trendline');

      // Test pattern
      const patternId = 'pattern-1';
      const patternData: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [],
          color: 'blue',
        },
        confidence: 0.85,
      };

      act(() => {
        result.current.addPattern(patternId, patternData);
      });

      const { result: patternResult } = renderHook(() => useChartPatterns());
      expect(patternResult.current.size).toBe(1);
      expect(patternResult.current.get(patternId)).toEqual(patternData);
    });
  });

  describe('Chart Base Store', () => {
    it('should manage symbol and timeframe', () => {
      const { result } = renderHook(() => useChartBaseStore());

      expect(result.current.symbol).toBe('BTCUSDT');
      expect(result.current.timeframe).toBe('1h');

      act(() => {
        result.current.setSymbol('ETHUSDT');
        result.current.setTimeframe('4h');
      });

      expect(result.current.symbol).toBe('ETHUSDT');
      expect(result.current.timeframe).toBe('4h');
    });

    it('should manage chart ready state', () => {
      const { result } = renderHook(() => useChartBaseStore());

      expect(result.current.isChartReady).toBe(false);

      act(() => {
        result.current.setChartReady(true);
      });

      expect(result.current.isChartReady).toBe(true);
    });

    it('should manage loading and error states', () => {
      const { result } = renderHook(() => useChartBaseStore());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setError('Test error');
        result.current.setLoading(false);
      });

      expect(result.current.error).toBe('Test error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should reset to initial state', () => {
      const { result } = renderHook(() => useChartBaseStore());

      act(() => {
        result.current.setSymbol('ETHUSDT');
        result.current.setTimeframe('1h');
        result.current.setChartReady(true);
        result.current.setError('Error');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.symbol).toBe('BTCUSDT');
      expect(result.current.timeframe).toBe('1h');
      expect(result.current.isChartReady).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Indicator Store', () => {
    it('should manage indicator states', () => {
      const { result } = renderHook(() => useIndicatorStore());

      expect(result.current.indicators).toEqual({
        ma: false,
        rsi: false,
        macd: false,
        boll: false,
      });

      act(() => {
        result.current.setIndicatorEnabled('rsi', true);
        result.current.setIndicatorEnabled('ma', false);
      });

      expect(result.current.indicators.rsi).toBe(true);
      expect(result.current.indicators.ma).toBe(false);
    });

    it('should update indicator settings', () => {
      const { result } = renderHook(() => useIndicatorStore());

      act(() => {
        result.current.setIndicatorSetting('ma', 'ma1', 20);
      });

      expect(result.current.settings.ma.ma1).toBe(20);
    });

    it('should bulk update indicators', () => {
      const { result } = renderHook(() => useIndicatorStore());

      act(() => {
        result.current.setIndicators({
          ma: false,
          rsi: true,
          macd: true,
          boll: false,
        });
      });

      expect(result.current.indicators).toEqual({
        ma: false,
        rsi: true,
        macd: true,
        boll: false,
      });
    });

    it('should reset to initial state', () => {
      const { result } = renderHook(() => useIndicatorStore());

      act(() => {
        result.current.setIndicatorEnabled('rsi', true);
        result.current.setIndicatorSetting('ma', 'ma1', 30);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.indicators.rsi).toBe(false);
      expect(result.current.settings.ma.ma1).toBe(7);
    });
  });

  describe('Drawing Store', () => {
    it('should manage drawing mode', () => {
      const { result } = renderHook(() => useDrawingStore());

      expect(result.current.drawingMode).toBeNull();

      act(() => {
        result.current.setDrawingMode('trendline');
      });

      expect(result.current.drawingMode).toBe('trendline');

      act(() => {
        result.current.setDrawingMode(null);
      });

      expect(result.current.drawingMode).toBeNull();
    });

    it('should add and manage drawings', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        result.current.addDrawing(drawing);
      });

      expect(result.current.drawings).toHaveLength(1);
      expect(result.current.drawings[0]).toMatchObject({
        ...drawing,
        id: expect.any(String), // ID will be generated
      });
    });

    it('should update existing drawings', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        result.current.addDrawing(drawing);
      });

      const drawingId = result.current.drawings[0].id;

      act(() => {
        result.current.updateDrawing(drawingId, { 
          style: { ...drawing.style, color: '#00ff00' } 
        });
      });

      expect(result.current.drawings[0].style.color).toBe('#00ff00');
    });

    it('should delete drawings', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        result.current.addDrawing(drawing);
      });

      const drawingId = result.current.drawings[0].id;

      act(() => {
        result.current.deleteDrawing(drawingId);
      });

      expect(result.current.drawings).toHaveLength(0);
    });

    it('should manage drawing selection', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        result.current.addDrawing(drawing);
      });

      const drawingId = result.current.drawings[0].id;

      act(() => {
        result.current.selectDrawing(drawingId);
      });

      expect(result.current.selectedDrawingId).toBe(drawingId);

      act(() => {
        result.current.selectDrawing(null);
      });

      expect(result.current.selectedDrawingId).toBeNull();
    });

    it('should support undo/redo operations', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing1: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      const drawing2: ChartDrawing = {
        id: 'test-drawing-2',
        type: 'horizontal',
        points: [{ time: 1500, value: 150 }],
        style: {
          color: '#00ff00',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      // Add first drawing
      act(() => {
        result.current.addDrawing(drawing1);
      });

      expect(result.current.drawings).toHaveLength(1);
      expect(result.current.undoStack).toHaveLength(1);

      // Add second drawing
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
      expect(result.current.undoStack).toHaveLength(1);
      expect(result.current.redoStack).toHaveLength(1);

      // Redo
      act(() => {
        result.current.redo();
      });

      expect(result.current.drawings).toHaveLength(2);
      expect(result.current.undoStack).toHaveLength(2);
      expect(result.current.redoStack).toHaveLength(0);
    });

    it('should clear all drawings', () => {
      const { result } = renderHook(() => useDrawingStore());

      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        result.current.addDrawing(drawing);
        result.current.addDrawing({ ...drawing, id: 'test-drawing-2' });
      });

      expect(result.current.drawings).toHaveLength(2);

      act(() => {
        result.current.clearAllDrawings();
      });

      expect(result.current.drawings).toHaveLength(0);
      expect(result.current.selectedDrawingId).toBeNull();
    });
  });

  describe('Pattern Store', () => {
    it('should add and manage patterns', () => {
      const { result } = renderHook(() => usePatternStore());

      const patternId = 'pattern-1';
      const patternData: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [],
          color: 'blue',
        },
        confidence: 0.85,
      };

      act(() => {
        result.current.addPattern(patternId, patternData);
      });

      expect(result.current.patterns.size).toBe(1);
      expect(result.current.patterns.get(patternId)).toEqual(patternData);
    });

    it('should remove patterns', () => {
      const { result } = renderHook(() => usePatternStore());

      const patternId = 'pattern-1';
      const patternData: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [],
          color: 'blue',
        },
        confidence: 0.85,
      };

      act(() => {
        result.current.addPattern(patternId, patternData);
      });

      act(() => {
        result.current.removePattern(patternId);
      });

      expect(result.current.patterns.size).toBe(0);
    });

    it('should get pattern by id', () => {
      const { result } = renderHook(() => usePatternStore());

      const patternId = 'pattern-1';
      const patternData: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [],
          color: 'blue',
        },
        confidence: 0.85,
      };

      act(() => {
        result.current.addPattern(patternId, patternData);
      });

      const retrievedPattern = result.current.getPattern(patternId);
      expect(retrievedPattern).toEqual(patternData);

      const nonExistentPattern = result.current.getPattern('non-existent');
      expect(nonExistentPattern).toBeUndefined();
    });

    it('should clear all patterns', () => {
      const { result } = renderHook(() => usePatternStore());

      const pattern1Data: PatternData = {
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [],
          color: 'blue',
        },
        confidence: 0.85,
      };

      const pattern2Data: PatternData = {
        type: 'channel',
        visualization: {
          type: 'channel',
          points: [],
          color: 'red',
        },
        confidence: 0.75,
      };

      act(() => {
        result.current.addPattern('pattern-1', pattern1Data);
        result.current.addPattern('pattern-2', pattern2Data);
      });

      expect(result.current.patterns.size).toBe(2);

      act(() => {
        result.current.clearPatterns();
      });

      expect(result.current.patterns.size).toBe(0);
    });
  });

  describe('Convenience Hooks', () => {
    it('should provide individual state hooks', () => {
      const { result: symbolResult } = renderHook(() => useChartSymbol());
      const { result: timeframeResult } = renderHook(() => useChartTimeframe());
      const { result: indicatorsResult } = renderHook(() => useChartIndicators());
      const { result: drawingsResult } = renderHook(() => useChartDrawings());
      const { result: patternsResult } = renderHook(() => useChartPatterns());

      expect(symbolResult.current).toBe('BTCUSDT');
      expect(timeframeResult.current).toBe('1h');
      expect(indicatorsResult.current).toEqual({
        ma: false,
        rsi: false,
        macd: false,
        boll: false,
      });
      expect(drawingsResult.current).toEqual([]);
      expect(patternsResult.current).toBeInstanceOf(Map);
      expect(patternsResult.current.size).toBe(0);
    });

    it('should provide action hooks', () => {
      const { result: chartActions } = renderHook(() => useChartActions());
      const { result: drawingActions } = renderHook(() => useDrawingActions());
      const { result: patternActions } = renderHook(() => usePatternActions());

      expect(chartActions.current).toHaveProperty('setSymbol');
      expect(chartActions.current).toHaveProperty('setTimeframe');
      expect(chartActions.current).toHaveProperty('setIndicators');

      expect(drawingActions.current).toHaveProperty('setDrawingMode');
      expect(drawingActions.current).toHaveProperty('addDrawing');
      expect(drawingActions.current).toHaveProperty('deleteDrawing');

      expect(patternActions.current).toHaveProperty('addPattern');
      expect(patternActions.current).toHaveProperty('removePattern');
      expect(patternActions.current).toHaveProperty('clearPatterns');
    });

    it('should provide combined useChart hook', () => {
      const { result } = renderHook(() => useChart());

      expect(result.current).toHaveProperty('symbol');
      expect(result.current).toHaveProperty('timeframe');
      expect(result.current).toHaveProperty('indicators');
      expect(result.current).toHaveProperty('settings');
      expect(result.current).toHaveProperty('isChartReady');
      expect(result.current).toHaveProperty('setSymbol');
      expect(result.current).toHaveProperty('setTimeframe');
      expect(result.current).toHaveProperty('setIndicators');
    });
  });

  describe('Store Integration', () => {
    it('should handle complex workflows', () => {
      const { result: chartStore } = renderHook(() => useChartStore(state => state));
      const { result: baseStore } = renderHook(() => useChartBaseStore());
      const { result: drawingStore } = renderHook(() => useDrawingStore());

      // Change symbol and timeframe
      act(() => {
        baseStore.current.setSymbol('ETHUSDT');
        baseStore.current.setTimeframe('4h');
      });

      // Add a drawing
      const drawing: ChartDrawing = {
        id: 'test-drawing-1',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }, { time: 2000, value: 200 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: false,
        },
        visible: true,
        interactive: true,
      };

      act(() => {
        drawingStore.current.addDrawing(drawing);
      });

      // Verify through legacy store
      expect(chartStore.current.symbol).toBe('ETHUSDT');
      expect(chartStore.current.timeframe).toBe('4h');
      expect(chartStore.current.drawings).toHaveLength(1);
    });

    it('should maintain state consistency across stores', () => {
      // Use different hooks to access the same state
      const { result: legacySymbol } = renderHook(() => 
        useChartStore(state => state.symbol)
      );
      const { result: directSymbol } = renderHook(() => useChartSymbol());
      const { result: combinedChart } = renderHook(() => useChart());

      expect(legacySymbol.current).toBe(directSymbol.current);
      expect(legacySymbol.current).toBe(combinedChart.current.symbol);

      // Change symbol through base store
      const { result: baseStore } = renderHook(() => useChartBaseStore());
      
      act(() => {
        baseStore.current.setSymbol('ADAUSDT');
      });

      // Verify all hooks reflect the change
      expect(legacySymbol.current).toBe('ADAUSDT');
      expect(directSymbol.current).toBe('ADAUSDT');
      expect(combinedChart.current.symbol).toBe('ADAUSDT');
    });
  });
});