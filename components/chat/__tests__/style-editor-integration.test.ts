import { renderHook } from '@testing-library/react'
import { useAgentEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers'
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

jest.mock('@/store/chart.store', () => ({
  useChartStoreBase: {
    getState: jest.fn(() => ({
      patterns: new Map([
        ['pattern-123', {
          type: 'head_and_shoulders',
          visualization: { keyPoints: [] },
          metrics: { target_level: 50000, stop_loss: 45000 }
        }]
      ]),
      drawings: [
        { id: 'drawing-456', type: 'trendline', style: { color: '#22c55e', lineWidth: 2 } }
      ]
    }))
  },
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

describe('Style Editor Integration Tests', () => {
  let mockHandlers: any
  let eventListeners: Map<string, EventListener>

  beforeEach(() => {
    jest.clearAllMocks()
    eventListeners = new Map()
    
    // Mock window.addEventListener to capture event listeners
    window.addEventListener = jest.fn((type: string, listener: EventListener) => {
      eventListeners.set(type, listener)
    })
    
    window.removeEventListener = jest.fn((type: string) => {
      eventListeners.delete(type)
    })
    
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
  })

  const dispatchEvent = (type: string, detail: any) => {
    const listener = eventListeners.get(type)
    if (listener) {
      listener(new CustomEvent(type, { detail }))
    }
  }

  describe('Drawing Style Updates', () => {
    it('handles valid style update event', async () => {
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Wait for the useEffect to run
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Check that event listeners were registered
      expect(window.addEventListener).toHaveBeenCalledWith('chart:updateDrawingStyle', expect.any(Function))
      
      const styleUpdate: StyleUpdateEvent = {
        drawingId: 'drawing-456',
        style: { color: '#3b82f6', lineWidth: 3 },
        immediate: true,
      }
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
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

    it('handles drawing not found error', () => {
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      const styleUpdate: StyleUpdateEvent = {
        drawingId: 'non-existent',
        style: { color: '#3b82f6' },
        immediate: false,
      }
      
      dispatchEvent('chart:updateDrawingStyle', styleUpdate)
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Agent Event] Drawing not found for style update',
        { drawingId: 'non-existent' }
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
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
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
        expect.objectContaining({ target_level: 50000, stop_loss: 45000 })
      )
      
      expect(showToast).toHaveBeenCalledWith('パターンスタイルを更新しました', 'success')
    })

    it('handles pattern not found error', () => {
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      const patternStyleUpdate: PatternStyleUpdateEvent = {
        patternId: 'non-existent-pattern',
        patternStyle: { patternFillOpacity: 0.5 },
        immediate: false,
      }
      
      dispatchEvent('chart:updatePatternStyle', patternStyleUpdate)
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Agent Event] Pattern not found for style update',
        { patternId: 'non-existent-pattern' }
      )
      
      expect(mockHandlers.patternRenderer.renderPattern).not.toHaveBeenCalled()
    })

    it('handles pattern renderer not available', () => {
      const handlersWithoutRenderer = {
        ...mockHandlers,
        patternRenderer: null,
        getPatternRenderer: jest.fn(() => null),
      }
      
      renderHook(() => useAgentEventHandlers(handlersWithoutRenderer))
      
      const patternStyleUpdate: PatternStyleUpdateEvent = {
        patternId: 'pattern-123',
        patternStyle: { highlightKeyPoints: true },
        immediate: false,
      }
      
      dispatchEvent('chart:updatePatternStyle', patternStyleUpdate)
      
      expect(logger.error).toHaveBeenCalledWith(
        '[Agent Event] Pattern renderer not available for style update'
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
        '[Agent Event] Handling chart:updateDrawingStyle',
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

    it('handles error in update flow', () => {
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
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
        '[Agent Event] Failed to update drawing style',
        expect.objectContaining({ error: expect.any(Error) })
      )
      
      expect(showToast).toHaveBeenCalledWith('スタイルの更新に失敗しました', 'error')
    })
  })

  describe('Backward Compatibility', () => {
    it('supports old event format for drawing style updates', () => {
      renderHook(() => useAgentEventHandlers(mockHandlers))
      
      // Old format with 'id' instead of 'drawingId'
      const oldFormatEvent = {
        id: 'drawing-456',
        style: { color: '#ef4444' },
      }
      
      dispatchEvent('chart:updateDrawingStyle', oldFormatEvent)
      
      expect(mockUpdateDrawing).toHaveBeenCalledWith(
        'drawing-456',
        expect.objectContaining({
          style: expect.objectContaining({ color: '#ef4444' })
        })
      )
    })
  })
})