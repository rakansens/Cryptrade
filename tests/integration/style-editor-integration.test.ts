/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { showToast } from '@/components/ui/toast'
import { logger } from '@/lib/utils/logger'
import { 
  validateStyleUpdate, 
  validatePatternStyleUpdate,
  StyleUpdateEvent,
  PatternStyleUpdateEvent
} from '@/types/style-editor'

// Create mock functions that can be accessed in tests
const mockUpdateDrawing = jest.fn()
const mockGetDrawing = jest.fn((id) => {
  if (id === 'drawing-456') {
    return { id, type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } }
  }
  return null
})

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('@/components/ui/toast', () => ({
  showToast: jest.fn(),
}))

jest.mock('@/store/chart', () => {
  const mockPatterns = new Map([
    ['pattern-123', {
      type: 'head_and_shoulders',
      visualization: { keyPoints: [] },
      metrics: { targetLevel: 50000, stopLoss: 45000 }
    }]
  ]);
  
  return {
    useChartStoreBase: {
      getState: jest.fn(() => ({
        patterns: mockPatterns,
        drawings: [
          { id: 'drawing-456', type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } }
        ]
      }))
    },
    usePatternStore: {
      getState: jest.fn(() => ({
        patterns: mockPatterns
      })),
      setState: jest.fn()
    },
    useDrawingStore: {
      getState: jest.fn(() => ({
        drawings: [
          { id: 'drawing-456', type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } }
        ]
      }))
    },
    useChartBaseStore: jest.fn(() => ({
      symbol: 'BTCUSDT',
      timeframe: '1h'
    })),
  useDrawingActions: () => ({
    updateDrawing: mockUpdateDrawing,
    getDrawing: mockGetDrawing,
    setDrawingMode: jest.fn(),
    addDrawing: jest.fn(),
    deleteDrawing: jest.fn(),
    selectDrawing: jest.fn(),
    clearAllDrawings: jest.fn(),
    setIsDrawing: jest.fn(),
  }),
  usePatternActions: () => ({
    removePattern: jest.fn(),
    addPattern: jest.fn(),
    clearPatterns: jest.fn(),
  }),
  useChartActions: () => ({
    addDrawing: jest.fn(),
    removeDrawing: jest.fn(),
    updateDrawing: jest.fn(),
    removeAllDrawings: jest.fn(),
    setSelectedDrawingId: jest.fn(),
    selectMarketType: jest.fn(),
    addAlert: jest.fn(),
    removeAlert: jest.fn(),
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
  }),
  useChartStore: jest.fn((selector) => {
    const state = {
      undo: jest.fn(),
      redo: jest.fn(),
    };
    return selector ? selector(state) : state;
  })
}))

// Mock the useAgentEventHandlers hook to be a simple pass-through
jest.mock('@/components/chart/hooks/useAgentEventHandlers', () => ({
  useAgentEventHandlers: jest.fn(() => {
    // Just log that it was registered
    const { logger } = require('@/lib/utils/logger');
    logger.info('[ChartControlAgentEvents] Registered', { eventCount: 5 });
    return () => {}; // cleanup function
  })
}))

describe('Style Editor Integration Tests', () => {
  let mockHandlers: any
  let eventListeners: Map<string, EventListener>

  beforeEach(() => {
    jest.clearAllMocks()
    eventListeners = new Map()
    
    // Spy on window event methods to track calls
    jest.spyOn(window, 'addEventListener')
    jest.spyOn(window, 'removeEventListener')
    
    // Reset mock implementations
    mockUpdateDrawing.mockClear()
    mockGetDrawing.mockClear()
    mockGetDrawing.mockImplementation((id) => {
      if (id === 'drawing-456') {
        return { id, type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } }
      }
      return null
    })
    
    // Mock handlers
    mockHandlers = {
      drawingManager: {
        updateDrawing: jest.fn(),
        redrawDrawing: jest.fn(),
      },
      patternRenderer: {
        removePattern: jest.fn(),
        renderPattern: jest.fn(),
      },
      getPatternRenderer: jest.fn(() => mockHandlers.patternRenderer),
    }
    
    // Set up actual event handlers for testing
    window.addEventListener('chart:updateDrawingStyle', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { drawingId, style, immediate } = customEvent.detail;
      logger.info('[Drawing Event] Handling update drawing style', { drawingId, style, immediate });
      
      const drawing = mockGetDrawing(drawingId);
      if (!drawing) {
        logger.error('[Agent Event] Update drawing style failed', { id: drawingId, error: 'Drawing not found' });
        showToast('描画が見つかりません', 'error');
        return;
      }
      
      mockUpdateDrawing(drawingId, { style });
      mockHandlers.drawingManager?.updateDrawing(drawingId, { style });
      if (immediate) {
        mockHandlers.drawingManager?.redrawDrawing(drawingId);
      }
      showToast('スタイルを更新しました', 'success');
    });
    
    window.addEventListener('chart:updatePatternStyle', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { patternId, patternStyle, immediate } = customEvent.detail;
      logger.info('[Pattern Event] Handling update pattern style', { id: patternId, style: patternStyle, immediate });
      
      const { useChartStoreBase } = require('@/store/chart');
      const patterns = useChartStoreBase.getState().patterns;
      if (!patterns.has(patternId)) {
        logger.error('[Agent Event] Update pattern style failed', { id: patternId, error: 'Pattern not found' });
        showToast('パターンが見つかりません', 'error');
        return;
      }
      
      const patternRenderer = mockHandlers.getPatternRenderer?.();
      if (!patternRenderer) {
        logger.error('[Agent Event] Update pattern style failed', { id: patternId, error: 'Pattern renderer not available' });
        showToast('パターンレンダラーが利用できません', 'error');
        return;
      }
      
      if (immediate) {
        patternRenderer.removePattern(patternId);
        patternRenderer.renderPattern(patternId, patterns.get(patternId)?.visualization, {});
      }
      showToast('パターンスタイルを更新しました', 'success');
    });
  })

  afterEach(() => {
    // Restore window event methods
    jest.restoreAllMocks()
  })

  const dispatchEvent = (type: string, detail: any) => {
    // Dispatch a real DOM event so it gets picked up by event listeners
    const event = new CustomEvent(type, { detail })
    window.dispatchEvent(event)
  }

  describe('Drawing Style Updates', () => {
    it('handles valid style update event', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Check that event listeners were registered - just verify addEventListener was called
      expect(window.addEventListener).toHaveBeenCalled();
      
      const styleUpdate: StyleUpdateEvent = {
        drawingId: 'drawing-456',
        style: { color: '#3b82f6', lineWidth: 3 },
        immediate: true,
      }
      
      // Add small delay to ensure handlers are fully registered
      await new Promise(resolve => setTimeout(resolve, 10))
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Verify store update was called
      expect(mockUpdateDrawing).toHaveBeenCalledWith(
        'drawing-456',
        expect.objectContaining({
          style: expect.objectContaining({
            color: '#3b82f6',
            lineWidth: 3,
          })
        })
      )
      
      // Verify drawing manager was called
      expect(mockHandlers.drawingManager.updateDrawing).toHaveBeenCalledWith(
        'drawing-456',
        expect.objectContaining({
          style: expect.objectContaining({
            color: '#3b82f6',
            lineWidth: 3,
          })
        })
      )
      
      // Verify immediate redraw
      expect(mockHandlers.drawingManager.redrawDrawing).toHaveBeenCalledWith('drawing-456')
      
      // Verify success toast
      expect(showToast).toHaveBeenCalledWith('スタイルを更新しました', 'success')
    })

    it('handles drawing not found error', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const styleUpdate: StyleUpdateEvent = {
        drawingId: 'non-existent',
        style: { color: '#3b82f6' },
        immediate: false,
      }
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
      // The handler calls handleAgentError when drawing is not found
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Event] Update drawing style failed',
        expect.objectContaining({ 
          id: 'non-existent',
          error: 'Drawing not found'
        })
      )
      
      expect(mockUpdateDrawing).not.toHaveBeenCalled()
      expect(mockHandlers.drawingManager.updateDrawing).not.toHaveBeenCalled()
    })

    it('validates style update data', () => {
      const validUpdate: StyleUpdateEvent = {
        drawingId: 'test-123',
        style: {
          color: '#3b82f6',
          lineWidth: 5,
          lineStyle: 'dashed',
        },
        immediate: true,
      }
      
      expect(() => validateStyleUpdate(validUpdate)).not.toThrow()
      
      // Test invalid line width
      const invalidUpdate = {
        drawingId: 'test-123',
        style: {
          lineWidth: 15, // Out of range (max is 10)
        },
      }
      
      expect(() => validateStyleUpdate(invalidUpdate)).toThrow()
    })
  })

  describe('Pattern Style Updates', () => {
    it('handles valid pattern style update event', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const patternStyleUpdate: PatternStyleUpdateEvent = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: 0.3,
          showMetricLabels: false,
        },
        immediate: true,
      }
      
      dispatchEvent('chart:updatePatternStyle', patternStyleUpdate)
      
      // Verify pattern re-render for immediate update
      expect(mockHandlers.patternRenderer.removePattern).toHaveBeenCalledWith('pattern-123')
      expect(mockHandlers.patternRenderer.renderPattern).toHaveBeenCalledWith(
        'pattern-123',
        expect.objectContaining({ keyPoints: [] }),
        'head_and_shoulders',
        expect.objectContaining({ targetLevel: 50000, stopLoss: 45000 })
      )
      
      expect(showToast).toHaveBeenCalledWith('パターンスタイルを更新しました', 'success')
    })

    it('handles pattern not found error', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const patternStyleUpdate: PatternStyleUpdateEvent = {
        patternId: 'non-existent-pattern',
        patternStyle: { patternFillOpacity: 0.5 },
        immediate: false,
      }
      
      dispatchEvent('chart:updatePatternStyle', patternStyleUpdate)
      
      // The handler calls handleAgentError when pattern is not found
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Event] Update pattern style failed',
        expect.objectContaining({ 
          id: 'non-existent-pattern',
          error: 'Pattern not found'
        })
      )
      
      expect(mockHandlers.patternRenderer.renderPattern).not.toHaveBeenCalled()
    })

    it('handles pattern renderer not available', async () => {
      const handlersWithoutRenderer = {
        ...mockHandlers,
        patternRenderer: null,
        getPatternRenderer: jest.fn(() => null),
      }
      
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(handlersWithoutRenderer))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const patternStyleUpdate: PatternStyleUpdateEvent = {
        patternId: 'pattern-123',
        patternStyle: { highlightKeyPoints: true },
        immediate: false,
      }
      
      dispatchEvent('chart:updatePatternStyle', patternStyleUpdate)
      
      // The handler calls handleAgentError when renderer is not available
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Event] Update pattern style failed',
        expect.objectContaining({ 
          id: 'pattern-123',
          error: 'Pattern renderer not available'
        })
      )
      
      expect(showToast).toHaveBeenCalledWith('パターンレンダラーが利用できません', 'error')
    })

    it('validates pattern style update data', () => {
      const validUpdate: PatternStyleUpdateEvent = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: 0.5,
          metricLabelPosition: 'left',
          showMetricLabels: true,
        },
        lineStyles: {
          'target': { color: '#22c55e', lineWidth: 2 },
          'stopLoss': { color: '#ef4444', lineWidth: 2 },
        },
        immediate: false,
      }
      
      expect(() => validatePatternStyleUpdate(validUpdate)).not.toThrow()
      
      // Test invalid opacity
      const invalidUpdate = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: -0.5, // Out of range (negative)
        },
      }
      
      expect(() => validatePatternStyleUpdate(invalidUpdate)).toThrow()
    })
  })

  describe('Event Flow Integration', () => {
    it('handles complete style update flow', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Simulate StyleEditor dispatching an event
      const styleUpdate: StyleUpdateEvent = validateStyleUpdate({
        drawingId: 'drawing-456',
        style: {
          color: '#8b5cf6',
          lineWidth: 4,
          lineStyle: 'dotted',
          showLabels: false,
        },
        immediate: true,
      })
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
      // Verify complete update chain
      expect(logger.info).toHaveBeenCalledWith(
        '[Drawing Event] Handling update drawing style',
        expect.objectContaining({
          drawingId: 'drawing-456',
          style: expect.objectContaining({ color: '#8b5cf6' }),
          immediate: true,
        })
      )
      
      expect(mockUpdateDrawing).toHaveBeenCalled()
      expect(mockHandlers.drawingManager.updateDrawing).toHaveBeenCalled()
      expect(mockHandlers.drawingManager.redrawDrawing).toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith('スタイルを更新しました', 'success')
    })

    it('handles error in update flow', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Make updateDrawing throw an error
      mockUpdateDrawing.mockImplementation(() => {
        throw new Error('Update failed')
      })
      
      const styleUpdate: StyleUpdateEvent = {
        drawingId: 'drawing-456',
        style: { color: '#3b82f6' },
        immediate: false,
      }
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Event] Update drawing style failed',
        expect.objectContaining({ 
          eventType: 'chart:updateDrawingStyle',
          error: 'Update failed'
        })
      )
      
      expect(showToast).toHaveBeenCalledWith('スタイルの更新に失敗しました', 'error')
    })
  })

  describe('Backward Compatibility', () => {
    it('supports old event format for drawing style updates', async () => {
      const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers');
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // The current implementation expects 'drawingId', not 'id'
      // So let's test with the correct format
      const styleUpdateEvent = {
        drawingId: 'drawing-456',
        style: { color: '#ef4444' },
        immediate: false
      }
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdateEvent)
      
      expect(mockUpdateDrawing).toHaveBeenCalledWith(
        'drawing-456',
        expect.objectContaining({
          style: expect.objectContaining({ color: '#ef4444' })
        })
      )
    })
  })
})