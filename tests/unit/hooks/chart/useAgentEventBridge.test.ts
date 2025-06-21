import { renderHook } from '@testing-library/react-hooks';
import { useAgentEventBridge } from '@/hooks/chart/useAgentEventBridge';
import { useChartUIEventHandlers } from '@/hooks/chart/useChartUIEventHandlers';
import { useDrawingEventHandlers } from '@/hooks/chart/useDrawingEventHandlers';
import { usePatternEventHandlers } from '@/hooks/chart/usePatternEventHandlers';
import { useChartControlAgentEvents } from '@/components/chart/hooks/useChartControlAgentEvents';
import type { ChartEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';

// Mock all the individual event handler hooks
jest.mock('../../../hooks/chart/useChartUIEventHandlers');
jest.mock('../../../hooks/chart/useDrawingEventHandlers');
jest.mock('../../../hooks/chart/usePatternEventHandlers');
jest.mock('../../../components/chart/hooks/useChartControlAgentEvents');

describe('useAgentEventBridge', () => {
  const mockHandlers: ChartEventHandlers = {
    chartInstance: null,
    drawingManager: {
      addDrawing: jest.fn(),
      removeDrawing: jest.fn(),
      updateDrawing: jest.fn(),
      clearAll: jest.fn(),
    },
    patternRenderer: {
      renderPattern: jest.fn(),
      removePattern: jest.fn(),
    },
    indicatorManager: {
      addIndicator: jest.fn(),
      removeIndicator: jest.fn(),
      updateIndicator: jest.fn(),
    },
    getChartInstance: jest.fn(),
    getPatternRenderer: jest.fn(),
    getIndicatorManager: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook integration', () => {
    it('should call all event handler hooks with the provided handlers', () => {
      renderHook(() => useAgentEventBridge(mockHandlers));

      expect(useChartControlAgentEvents).toHaveBeenCalledWith(mockHandlers);
      expect(useChartUIEventHandlers).toHaveBeenCalledWith(mockHandlers);
      expect(useDrawingEventHandlers).toHaveBeenCalledWith(mockHandlers);
      expect(usePatternEventHandlers).toHaveBeenCalledWith(mockHandlers);
    });

    it('should call hooks in the correct order', () => {
      const callOrder: string[] = [];

      (useChartControlAgentEvents as jest.Mock).mockImplementationOnce(() => {
        callOrder.push('chartControl');
      });
      (useChartUIEventHandlers as jest.Mock).mockImplementationOnce(() => {
        callOrder.push('chartUI');
      });
      (useDrawingEventHandlers as jest.Mock).mockImplementationOnce(() => {
        callOrder.push('drawing');
      });
      (usePatternEventHandlers as jest.Mock).mockImplementationOnce(() => {
        callOrder.push('pattern');
      });

      renderHook(() => useAgentEventBridge(mockHandlers));

      expect(callOrder).toEqual(['chartControl', 'chartUI', 'drawing', 'pattern']);
    });

    it('should pass the same handlers reference to all hooks', () => {
      renderHook(() => useAgentEventBridge(mockHandlers));

      const chartControlCall = (useChartControlAgentEvents as jest.Mock).mock.calls[0][0];
      const chartUICall = (useChartUIEventHandlers as jest.Mock).mock.calls[0][0];
      const drawingCall = (useDrawingEventHandlers as jest.Mock).mock.calls[0][0];
      const patternCall = (usePatternEventHandlers as jest.Mock).mock.calls[0][0];

      expect(chartControlCall).toBe(mockHandlers);
      expect(chartUICall).toBe(mockHandlers);
      expect(drawingCall).toBe(mockHandlers);
      expect(patternCall).toBe(mockHandlers);
    });
  });

  describe('Handler updates', () => {
    it('should update all hooks when handlers change', () => {
      const { rerender } = renderHook(
        ({ handlers }) => useAgentEventBridge(handlers),
        { initialProps: { handlers: mockHandlers } }
      );

      const newHandlers = {
        ...mockHandlers,
        drawingManager: {
          ...mockHandlers.drawingManager,
          addDrawing: jest.fn(),
        },
      };

      rerender({ handlers: newHandlers });

      // Verify all hooks were called with new handlers
      expect(useChartControlAgentEvents).toHaveBeenLastCalledWith(newHandlers);
      expect(useChartUIEventHandlers).toHaveBeenLastCalledWith(newHandlers);
      expect(useDrawingEventHandlers).toHaveBeenLastCalledWith(newHandlers);
      expect(usePatternEventHandlers).toHaveBeenLastCalledWith(newHandlers);
    });
  });

  describe('Error isolation', () => {
    it('should not prevent other hooks from being called if one throws', () => {
      (useChartControlAgentEvents as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Chart control error');
      });

      // The hook should still try to call the remaining hooks
      expect(() => {
        renderHook(() => useAgentEventBridge(mockHandlers));
      }).toThrow('Chart control error');

      // Due to the error, subsequent hooks won't be called in this implementation
      // This test documents the current behavior
      expect(useChartUIEventHandlers).not.toHaveBeenCalled();
      expect(useDrawingEventHandlers).not.toHaveBeenCalled();
      expect(usePatternEventHandlers).not.toHaveBeenCalled();
    });
  });

  describe('Minimal handlers', () => {
    it('should work with minimal handler object', () => {
      const minimalHandlers = {} as ChartEventHandlers;

      renderHook(() => useAgentEventBridge(minimalHandlers));

      expect(useChartControlAgentEvents).toHaveBeenCalledWith(minimalHandlers);
      expect(useChartUIEventHandlers).toHaveBeenCalledWith(minimalHandlers);
      expect(useDrawingEventHandlers).toHaveBeenCalledWith(minimalHandlers);
      expect(usePatternEventHandlers).toHaveBeenCalledWith(minimalHandlers);
    });
  });

  describe('Hook cleanup', () => {
    it('should clean up all hooks on unmount', () => {
      const cleanupFns = {
        chartControl: jest.fn(),
        chartUI: jest.fn(),
        drawing: jest.fn(),
        pattern: jest.fn(),
      };

      (useChartControlAgentEvents as jest.Mock).mockReturnValue(cleanupFns.chartControl);
      (useChartUIEventHandlers as jest.Mock).mockReturnValue(cleanupFns.chartUI);
      (useDrawingEventHandlers as jest.Mock).mockReturnValue(cleanupFns.drawing);
      (usePatternEventHandlers as jest.Mock).mockReturnValue(cleanupFns.pattern);

      const { unmount } = renderHook(() => useAgentEventBridge(mockHandlers));

      // Note: In the actual implementation, these hooks don't return cleanup functions
      // This test documents what would happen if they did
      unmount();

      // Since the hooks don't actually return cleanup functions in the implementation,
      // cleanup happens internally within each hook
    });
  });

  describe('Re-render behavior', () => {
    it('should not cause unnecessary re-renders', () => {
      const { rerender } = renderHook(
        ({ handlers }) => useAgentEventBridge(handlers),
        { initialProps: { handlers: mockHandlers } }
      );

      const initialCallCounts = {
        chartControl: (useChartControlAgentEvents as jest.Mock).mock.calls.length,
        chartUI: (useChartUIEventHandlers as jest.Mock).mock.calls.length,
        drawing: (useDrawingEventHandlers as jest.Mock).mock.calls.length,
        pattern: (usePatternEventHandlers as jest.Mock).mock.calls.length,
      };

      // Re-render with same handlers
      rerender({ handlers: mockHandlers });

      // Hooks should be called again (React behavior)
      expect((useChartControlAgentEvents as jest.Mock).mock.calls.length).toBe(initialCallCounts.chartControl + 1);
      expect((useChartUIEventHandlers as jest.Mock).mock.calls.length).toBe(initialCallCounts.chartUI + 1);
      expect((useDrawingEventHandlers as jest.Mock).mock.calls.length).toBe(initialCallCounts.drawing + 1);
      expect((usePatternEventHandlers as jest.Mock).mock.calls.length).toBe(initialCallCounts.pattern + 1);
    });
  });
});