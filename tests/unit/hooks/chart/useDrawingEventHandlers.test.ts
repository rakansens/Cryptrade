import { renderHook, act } from '@testing-library/react';
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
import { validateDrawingEvent } from '@/types/events/drawing-events';

// Unmock the hook to use actual implementation
jest.unmock('@/hooks/chart/useDrawingEventHandlers');

// Import after unmocking
import { useDrawingEventHandlers } from '@/hooks/chart/useDrawingEventHandlers';

// Mock Mastra agent utils to prevent import conflicts
jest.mock('@/lib/mastra/agents/utils/agent-utils', () => ({
  handleAgentError: jest.fn(),
}));

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
  executeDrawingOperation: jest.fn(async (fn) => {
    // Simulate async execution
    return await Promise.resolve(fn());
  }),
  prepareDrawingData: jest.fn((data) => ({
    ...data,
    id: data.id || 'generated-id',
    visible: data.visible !== undefined ? data.visible : true,
    interactive: data.interactive !== undefined ? data.interactive : true,
    timestamp: data.timestamp || Date.now(),
    style: {
      color: data.style?.color || '#3498db',
      lineWidth: data.style?.lineWidth || 2,
      lineStyle: data.style?.lineStyle || 'solid',
      showLabels: data.style?.showLabels || false,
      ...data.style
    }
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

// Mock drawing queue
jest.mock('@/lib/utils/drawing-queue', () => ({
  drawingQueue: {
    enqueue: jest.fn(async (operation) => await operation())
  }
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

  // Store original event listeners
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  let eventHandlerMap: Map<string, (event: CustomEvent) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset event handler map
    eventHandlerMap = new Map();
    
    // Create spies for event listeners
    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((eventType: string, handler: any) => {
      eventHandlerMap.set(eventType, handler);
    });
    
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation((eventType: string, handler: any) => {
      eventHandlerMap.delete(eventType);
    });
    
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
  });

  afterEach(() => {
    // Restore original event listener functions
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    eventHandlerMap.clear();
  });

  // Helper function to dispatch events through registered handlers
  const dispatchEventThroughHandler = async (eventType: string, detail: any) => {
    const handler = eventHandlerMap.get(eventType);
    if (handler) {
      const event = new CustomEvent(eventType, { detail });
      await handler(event);
    }
  };

  describe('Initial state and mounting', () => {
    it('should register event listeners on mount', () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      // The hook registers 13 drawing event types
      const expectedEventCount = 13;
      expect(addEventListenerSpy).toHaveBeenCalledTimes(expectedEventCount);
      expect(logger.info).toHaveBeenCalledWith(
        '[Drawing Event Handlers] Registered drawing event listeners',
        expect.objectContaining({
          eventCount: expectedEventCount,
          events: expect.arrayContaining([
            'chart:startDrawing',
            'chart:addDrawing',
            'chart:addDrawingWithMetadata',
            'chart:deleteDrawing',
            'chart:clearAllDrawings',
            'chart:undo',
            'chart:redo',
            'chart:undoLastDrawing',
            'chart:redoLastDrawing',
            'chart:updateDrawingStyle',
            'chart:updateAllStyles',
            'chart:updateDrawingColor',
            'chart:updateDrawingLineWidth'
          ])
        })
      );
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useDrawingEventHandlers(mockHandlers));

      unmount();

      // Should remove the same number of listeners that were added
      const expectedEventCount = 13;
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(expectedEventCount);
      expect(logger.info).toHaveBeenCalledWith('[Drawing Event Handlers] Cleaned up drawing event listeners');
    });
  });

  describe('Start Drawing Event', () => {
    it('should handle valid start drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:startDrawing', {
          type: 'line',
          style: { color: '#3498db', lineWidth: 2 },
        });
      });

      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('line');
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(true);
      expect(mockCursor.setDrawingCursor).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle validation error for invalid event', async () => {
      // Mock validation failure for this test
      const validateDrawingEventMock = jest.mocked(validateDrawingEvent);
      validateDrawingEventMock.mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: 'Invalid data' }] }
      });

      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:startDrawing', { invalid: 'data' });
      });

      expect(handleValidationError).toHaveBeenCalled();
      expect(mockDrawingActions.setDrawingMode).not.toHaveBeenCalled();
    });
  });

  describe('Add Drawing Event', () => {
    it('should handle valid add drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:addDrawing', {
          id: 'drawing123',
          type: 'trendline',
          points: [
            { time: 1000, value: 100 },
            { time: 2000, value: 200 },
          ],
          style: { color: '#ff0000', lineWidth: 3, lineStyle: 'solid' },
        });
      });

      expect(prepareDrawingData).toHaveBeenCalledTimes(1);
      expect(mockDrawingActions.addDrawing).toHaveBeenCalledTimes(1);
      expect(mockHandlers.drawingManager?.addDrawing).toHaveBeenCalledTimes(1);
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(false);
      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('none');
      expect(mockCursor.resetCursor).toHaveBeenCalledTimes(1);
    });

    it('should handle add drawing with metadata', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:addDrawingWithMetadata', {
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
        });
      });

      expect(mockDrawingActions.addDrawing).toHaveBeenCalledTimes(1);
      expect(mockHandlers.drawingManager?.addDrawing).toHaveBeenCalledTimes(1);
      expect(showAgentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'chart:addDrawingWithMetadata' }),
        expect.stringContaining('Proposal drawing')
      );
    });
  });

  describe('Delete Drawing Event', () => {
    it('should handle valid delete drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:deleteDrawing', { id: 'drawing123' });
      });

      expect(mockDrawingActions.deleteDrawing).toHaveBeenCalledWith('drawing123');
      expect(mockHandlers.drawingManager?.removeDrawing).toHaveBeenCalledWith('drawing123');
      expect(showAgentSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear All Drawings Event', () => {
    it('should handle clear all drawings event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:clearAllDrawings', {});
      });

      expect(mockDrawingActions.clearAllDrawings).toHaveBeenCalled();
      expect(mockHandlers.drawingManager?.clearAll).toHaveBeenCalled();
      expect(mockDrawingActions.setDrawingMode).toHaveBeenCalledWith('none');
      expect(mockDrawingActions.setIsDrawing).toHaveBeenCalledWith(false);
      expect(mockCursor.resetCursor).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo Events', () => {
    it('should handle undo event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:undo', { steps: 2 });
      });

      expect(mockUndo).toHaveBeenCalledTimes(2);
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle redo event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:redo', { steps: 1 });
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
      expect(showAgentSuccess).toHaveBeenCalled();
    });

    it('should handle undo last drawing event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:undoLastDrawing', {});
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
      expect(showAgentSuccess).toHaveBeenCalled();
    });
  });

  describe('Update Drawing Style Events', () => {
    it('should handle update drawing style event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:updateDrawingStyle', {
          drawingId: 'drawing1',
          style: { color: '#0000ff', lineWidth: 4 },
          immediate: true,
        });
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ color: '#0000ff', lineWidth: 4 }),
      });
      expect(mockHandlers.drawingManager?.updateDrawing).toHaveBeenCalled();
    });

    it('should handle update drawing color event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:updateDrawingColor', {
          id: 'drawing1',
          color: '#00ff00'
        });
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ color: '#00ff00' }),
      });
    });

    it('should handle update drawing line width event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:updateDrawingLineWidth', {
          id: 'drawing1',
          lineWidth: 5
        });
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalledWith('drawing1', {
        style: expect.objectContaining({ lineWidth: 5 }),
      });
    });

    it('should handle update all styles event', async () => {
      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:updateAllStyles', {
          type: 'line',
          style: { color: '#ff00ff', lineWidth: 3 },
        });
      });

      expect(mockDrawingActions.updateDrawing).toHaveBeenCalled();
      expect(showAgentSuccess).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors during drawing operations', async () => {
      // Mock validation to fail - this will trigger handleValidationError
      const validateDrawingEventMock = jest.mocked(validateDrawingEvent);
      validateDrawingEventMock.mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: 'Simulated validation error' }] }
      });

      renderHook(() => useDrawingEventHandlers(mockHandlers));

      await act(async () => {
        await dispatchEventThroughHandler('chart:addDrawing', {
          id: 'drawing123',
          type: 'line',
          points: [],
        });
      });

      // Validation error should be handled
      expect(handleValidationError).toHaveBeenCalledTimes(1);
      expect(handleValidationError).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        expect.objectContaining({
          eventType: 'chart:addDrawing',
          operation: expect.any(String),
          payload: expect.any(Object)
        })
      );
    });

    it('should handle missing drawing manager gracefully', async () => {
      const handlersWithoutManager = { ...mockHandlers, drawingManager: null };
      renderHook(() => useDrawingEventHandlers(handlersWithoutManager));

      await act(async () => {
        await dispatchEventThroughHandler('chart:addDrawingWithMetadata', {
          id: 'drawing123',
          type: 'line',
          points: [],
          style: { color: '#ff0000', lineWidth: 2 },
        });
      });

      expect(logger.warn).toHaveBeenCalledWith('[Drawing Event] No drawing manager available');
    });
  });
});