import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useDrawingActions, useDrawingStore, useChartStore } from '@/store/chart';
import { useCursor } from '@/hooks/chart/useCursor';
import { logger } from '@/lib/utils/logger';
import type { ChartEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers';
import { 
  handleAgentError, 
  showAgentSuccess, 
  handleValidationError,
  executeDrawingOperation,
  prepareDrawingData 
} from '@/lib/chart/agent-utils';

// Unmock the hook to use actual implementation
jest.unmock('@/hooks/chart/useDrawingEventHandlers');

// Import after unmocking
import { useDrawingEventHandlers } from '@/hooks/chart/useDrawingEventHandlers';

// Mock dependencies
jest.mock('@/store/chart');
jest.mock('@/hooks/chart/useCursor');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('@/lib/chart/agent-utils', () => ({
  handleAgentError: jest.fn(),
  showAgentSuccess: jest.fn(),
  handleValidationError: jest.fn(),
  executeDrawingOperation: jest.fn(async (fn) => await fn()),
  prepareDrawingData: jest.fn((data) => ({
    ...data,
    id: data.id || 'generated-id',
    visible: data.visible !== undefined ? data.visible : true,
    interactive: data.interactive !== undefined ? data.interactive : true,
    timestamp: data.timestamp || Date.now()
  }))
}));
jest.mock('@/types/events/drawing-events', () => ({
  validateDrawingEvent: jest.fn((eventType, payload) => {
    // Return a proper validation result structure
    return {
      success: true,
      data: {
        eventType,
        data: payload
      }
    };
  })
}));
jest.mock('@/types/drawing', () => ({
  validateChartDrawing: jest.fn((drawing) => drawing),
  DrawingStyleSchema: {},
  DrawingPointSchema: {}
}));

describe('useDrawingEventHandlers', () => {
  const mockHandlers: ChartEventHandlers = {
    drawingManager: {
      addDrawing: jest.fn(),
      removeDrawing: jest.fn(),
      updateDrawing: jest.fn(),
      clearAll: jest.fn(),
    },
  } as any;

  const mockDrawingActions = {
    setDrawingMode: jest.fn(),
    addDrawing: jest.fn(),
    updateDrawing: jest.fn(),
    deleteDrawing: jest.fn(),
    selectDrawing: jest.fn(),
    clearAllDrawings: jest.fn(),
    setIsDrawing: jest.fn(),
  };

  const mockCursor = {
    setDrawingCursor: jest.fn(),
    resetCursor: jest.fn(),
  };

  const mockUndo = jest.fn();
  const mockRedo = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useDrawingActions).mockReturnValue(mockDrawingActions);
    jest.mocked(useCursor).mockReturnValue(mockCursor);
    jest.mocked(useChartStore).mockImplementation((selector) => {
      if (!selector) return mockUndo;
      const selectorStr = selector.toString();
      if (selectorStr.includes('undo')) return mockUndo;
      if (selectorStr.includes('redo')) return mockRedo;
      return mockUndo;
    });
    // Mock useDrawingStore.getState as a static method
    (useDrawingStore as any).getState = jest.fn().mockReturnValue({
      drawings: [
        { id: 'drawing1', type: 'line', style: { color: '#ff0000', lineWidth: 2, lineStyle: 'solid' } },
      ],
    });
    
    // Make sure window.addEventListener is available
    if (!window.addEventListener) {
      Object.defineProperty(window, 'addEventListener', {
        value: jest.fn(),
        writable: true
      });
    }
  });

  afterEach(() => {
    // Clean up event listeners
    const eventTypes = [
      'chart:startDrawing',
      'chart:addDrawing',
      'chart:deleteDrawing',
      'chart:clearAllDrawings',
      'chart:undo',
      'chart:redo',
      'chart:updateDrawingStyle',
      'chart:updateDrawingColor',
      'chart:updateDrawingLineWidth',
    ];
    eventTypes.forEach(type => {
      window.removeEventListener(type, () => {});
    });
  });

  describe('Initial state and mounting', () => {
    it('should register event listeners on mount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      expect(addEventListenerSpy).toHaveBeenCalledTimes(13);
      expect(logger.info).toHaveBeenCalledWith(
        '[Drawing Event Handlers] Registered drawing event listeners',
        expect.objectContaining({ eventCount: 13 })
      );
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useDrawingEventHandlers(mockHandlers));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(13);
      expect(logger.info).toHaveBeenCalledWith('[Drawing Event Handlers] Cleaned up drawing event listeners');
    });
  });

  describe('Start Drawing Event', () => {
    it('should handle valid start drawing event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:startDrawing', {
        detail: {
          type: 'line',
          style: { color: '#3498db', lineWidth: 2 },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('line');
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(true);
      expect(mockCursor.setDrawingCursor).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle validation error for invalid event', () => {
      // Mock validation failure for this test
      const { validateDrawingEvent } = require('@/types/events/drawing-events');
      validateDrawingEvent.mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: 'Invalid data' }] }
      });

      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:startDrawing', {
        detail: { invalid: 'data' },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(handleValidationError).toHaveBeenCalled();
      expect(mockDrawingActions.setDrawingMode).not.toHaveBeenCalled();
    });
  });

  describe('Add Drawing Event', () => {
    it('should handle valid add drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'drawing123',
          type: 'trendline',
          points: [
            { time: 1000, value: 100 },
            { time: 2000, value: 200 },
          ],
          style: { color: '#ff0000', lineWidth: 3, lineStyle: 'solid' },
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      expect(prepareDrawingData).toHaveBeenCalled();
      // validateChartDrawing is called internally by the hook
      expect(mockDrawingActions.addDrawing).toHaveBeenCalled();
      expect(mockHandlers.drawingManager?.addDrawing).toHaveBeenCalled();
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(false);
      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('none');
      expect(mockCursor.resetCursor).toHaveBeenCalled();
    });

    it('should handle add drawing with metadata', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addDrawingWithMetadata', {
        detail: {
          id: 'proposal123',
          type: 'trendline',
          points: [
            { time: 1000, value: 100 },
            { time: 2000, value: 200 },
          ],
          style: { color: '#00ff00', lineWidth: 2 },
          metadata: { source: 'ai-proposal' },
          visible: true,
          interactive: true,
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.addDrawing).toHaveBeenCalled();
      expect(mockHandlers.drawingManager?.addDrawing).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'chart:addDrawingWithMetadata' }),
        expect.stringContaining('Proposal drawing')
      );
    });
  });

  describe('Delete Drawing Event', () => {
    it('should handle valid delete drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:deleteDrawing', {
        detail: { id: 'drawing123' },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.deleteDrawing).toHaveBeenCalledWith('drawing123');
      expect(mockHandlers.drawingManager?.removeDrawing).toHaveBeenCalledWith('drawing123');
      expect(showAgentSuccess).toHaveBeenCalled();
    });
  });

  describe('Clear All Drawings Event', () => {
    it('should handle clear all drawings event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:clearAllDrawings');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.clearAllDrawings).toHaveBeenCalled();
      expect(mockHandlers.drawingManager?.clearAll).toHaveBeenCalled();
      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('none');
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(false);
      expect(mockCursor.resetCursor).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo Events', () => {
    it('should handle undo event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:undo', {
        detail: { steps: 2 },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockUndo).toHaveBeenCalledTimes(2);
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle redo event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:redo', {
        detail: { steps: 1 },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle undo last drawing event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:undoLastDrawing');

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
      expect(showAgentSuccess).toHaveBeenCalled();
    });
  });

  describe('Update Drawing Style Events', () => {
    it('should handle update drawing style event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updateDrawingStyle', {
        detail: {
          drawingId: 'drawing1',
          style: { color: '#0000ff', lineWidth: 4 },
          immediate: true,
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ color: '#0000ff', lineWidth: 4 }),
      });
      expect(mockHandlers.drawingManager?.updateDrawing).toHaveBeenCalled();
    });

    it('should handle update drawing color event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updateDrawingColor', {
        detail: { id: 'drawing1', color: '#00ff00' },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ color: '#00ff00' }),
      });
    });

    it('should handle update drawing line width event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updateDrawingLineWidth', {
        detail: { id: 'drawing1', lineWidth: 5 },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ lineWidth: 5 }),
      });
    });

    it('should handle update all styles event', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:updateAllStyles', {
        detail: {
          type: 'line',
          style: { color: '#ff00ff', lineWidth: 3 },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors during drawing operations', async () => {
      mockDrawingActions.addDrawing.mockImplementationOnce(() => {
        throw new Error('Failed to add drawing');
      });
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      const event = new CustomEvent('chart:addDrawing', {
        detail: {
          id: 'drawing123',
          type: 'line',
          points: [],
        },
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      expect(handleAgentError).toHaveBeenCalled();
    });

    it('should handle missing drawing manager gracefully', () => {
      const handlersWithoutManager = { ...mockHandlers, drawingManager: null };
      renderHook(() => useDrawingEventHandlers(handlersWithoutManager));

      const event = new CustomEvent('chart:addDrawingWithMetadata', {
        detail: {
          id: 'drawing123',
          type: 'line',
          points: [],
          style: { color: '#ff0000', lineWidth: 2 },
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(logger.warn).toHaveBeenCalledWith('[Drawing Event] No drawing manager available');
    });
  });
});