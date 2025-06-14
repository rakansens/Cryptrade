import { PatternRenderer } from '../pattern-renderer'
import { logger } from '@/lib/utils/logger'
import type { IChartApi, ISeriesApi, SeriesMarker, Time, SeriesType } from 'lightweight-charts'
import type { PatternVisualization } from '@/types/pattern'

// Mock dependencies
jest.mock('@/lib/utils/logger')
jest.mock('@/lib/chart/renderers/keyPointMarkerRenderer')
jest.mock('@/lib/chart/renderers/patternLineRenderer')
jest.mock('@/lib/chart/renderers/patternAreaRenderer')
jest.mock('@/lib/chart/renderers/patternMetricRenderer')

describe('PatternRenderer', () => {
  let mockChart: jest.Mocked<IChartApi>
  let mockMainSeries: jest.Mocked<ISeriesApi<SeriesType>>
  let mockPatternSeries: jest.Mocked<ISeriesApi<SeriesType>>
  let renderer: PatternRenderer

  const mockVisualization: PatternVisualization = {
    keyPoints: [
      { time: 1704067200, value: 45000, type: 'peak', label: 'Peak 1' },
      { time: 1704153600, value: 43000, type: 'trough', label: 'Trough 1' },
      { time: 1704240000, value: 46000, type: 'peak', label: 'Peak 2' }
    ],
    lines: [
      { from: 0, to: 2, type: 'resistance', style: { color: '#ef4444', lineWidth: 2 } },
      { from: 1, to: 2, type: 'support', style: { color: '#22c55e', lineWidth: 2 } }
    ],
    areas: [
      {
        points: [
          { x: 1704067200, y: 45000 },
          { x: 1704240000, y: 46000 },
          { x: 1704240000, y: 43000 },
          { x: 1704067200, y: 43000 }
        ],
        fillColor: 'rgba(59, 130, 246, 0.1)',
        strokeColor: '#3b82f6'
      }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock pattern series
    mockPatternSeries = {
      setData: jest.fn(),
      applyOptions: jest.fn(),
      setMarkers: jest.fn(),
      update: jest.fn()
    } as unknown as jest.Mocked<ISeriesApi<SeriesType>>

    // Mock main series
    mockMainSeries = {
      setMarkers: jest.fn(),
      markers: jest.fn().mockReturnValue([])
    } as unknown as jest.Mocked<ISeriesApi<SeriesType>>

    // Mock chart
    mockChart = {
      addLineSeries: jest.fn().mockReturnValue(mockPatternSeries),
      addAreaSeries: jest.fn().mockReturnValue(mockPatternSeries),
      removeSeries: jest.fn()
    } as unknown as jest.Mocked<IChartApi>

    // Mock logger
    ;(logger.info as jest.Mock).mockImplementation(() => {})
    ;(logger.error as jest.Mock).mockImplementation(() => {})
    ;(logger.warn as jest.Mock).mockImplementation(() => {})
  })

  describe('Initialization', () => {
    it('creates renderer instance with unique ID', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Creating new instance',
        expect.objectContaining({
          instanceId: expect.any(Number),
          totalInstances: expect.any(Number)
        })
      )
    })

    it('exposes instance for debugging in browser environment', () => {
      const originalWindow = global.window
      global.window = { } as unknown as Window & typeof globalThis
      
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      expect((window as unknown as { __debugPatternRenderer: PatternRenderer }).__debugPatternRenderer).toBe(renderer)
      expect((window as unknown as { __debugPatternRenderers: unknown }).__debugPatternRenderers).toBeDefined()
      
      global.window = originalWindow
    })
  })

  describe('Pattern Rendering', () => {
    it('validates visualization object', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Null visualization
      renderer.renderPattern('pattern-1', null as unknown as PatternVisualization, 'test')
      expect(logger.error).toHaveBeenCalledWith(
        '[PatternRenderer] Failed to render pattern',
        expect.objectContaining({
          error: 'Visualization object is null or undefined'
        })
      )
      
      // Missing keyPoints
      renderer.renderPattern('pattern-2', { } as unknown as PatternVisualization, 'test')
      expect(logger.error).toHaveBeenCalledWith(
        '[PatternRenderer] Failed to render pattern',
        expect.objectContaining({
          error: 'Visualization keyPoints is missing or not an array'
        })
      )
    })

    it('renders pattern with all components', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      renderer.renderPattern('pattern-1', mockVisualization, 'head-and-shoulders', {
        target_level: 48000,
        stop_loss: 42000,
        breakout_level: 46500
      })
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Starting pattern render',
        expect.objectContaining({
          id: 'pattern-1',
          patternType: 'head-and-shoulders',
          keyPointsCount: 3
        })
      )
      
      // Should create series for lines
      expect(mockChart.addLineSeries).toHaveBeenCalled()
      
      // Should create series for areas
      expect(mockChart.addAreaSeries).toHaveBeenCalled()
    })

    it('cleans up existing pattern before rendering new one', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Render first pattern
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Render same pattern again
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Should clean up previous series
      expect(mockChart.removeSeries).toHaveBeenCalled()
    })

    it('handles empty visualization components gracefully', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      const emptyVisualization: PatternVisualization = {
        keyPoints: [],
        lines: undefined,
        areas: undefined
      }
      
      renderer.renderPattern('pattern-1', emptyVisualization, 'test')
      
      // Should not throw
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('Pattern Removal', () => {
    it('removes pattern and cleans up series', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Render pattern
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Remove pattern
      renderer.removePattern('pattern-1')
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Removing pattern',
        expect.objectContaining({ id: 'pattern-1' })
      )
      
      expect(mockChart.removeSeries).toHaveBeenCalled()
    })

    it('handles removal of non-existent pattern', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      renderer.removePattern('non-existent')
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[PatternRenderer] Pattern not found for removal',
        expect.objectContaining({ id: 'non-existent' })
      )
    })

    it('removes all patterns', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Render multiple patterns
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      renderer.renderPattern('pattern-2', mockVisualization, 'test')
      
      // Remove all
      renderer.removeAllPatterns()
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Removing all patterns',
        expect.objectContaining({ count: 2 })
      )
      
      expect(mockChart.removeSeries).toHaveBeenCalledTimes(4) // 2 patterns * 2 series each (simplified)
    })
  })

  describe('Metric Lines', () => {
    it('renders metric lines when provided', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      const metrics = {
        target_level: 48000,
        stop_loss: 42000,
        breakout_level: 46500
      }
      
      renderer.renderPattern('pattern-1', mockVisualization, 'test', metrics)
      
      // Should create series for metric lines
      expect(mockChart.addLineSeries).toHaveBeenCalledTimes(5) // 2 pattern lines + 3 metric lines
    })

    it('removes metric lines when pattern is removed', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Render with metrics
      renderer.renderPattern('pattern-1', mockVisualization, 'test', {
        target_level: 48000
      })
      
      // Remove pattern
      renderer.removePattern('pattern-1')
      
      // Should remove metric series
      expect(mockChart.removeSeries).toHaveBeenCalled()
    })
  })

  describe('Global Tracking', () => {
    it('tracks patterns globally for cleanup', () => {
      const originalWindow = global.window
      global.window = { } as unknown as Window & typeof globalThis
      
      // Create multiple renderer instances
      const renderer1 = new PatternRenderer(mockChart, mockMainSeries)
      const renderer2 = new PatternRenderer(mockChart, mockMainSeries)
      
      renderer1.renderPattern('pattern-1', mockVisualization, 'test')
      renderer2.renderPattern('pattern-2', mockVisualization, 'test')
      
      // Both patterns should be tracked
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Starting pattern render',
        expect.objectContaining({ id: 'pattern-1' })
      )
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Starting pattern render',
        expect.objectContaining({ id: 'pattern-2' })
      )
      
      global.window = originalWindow
    })
  })

  describe('Error Handling', () => {
    it('handles rendering errors gracefully', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Mock error in addLineSeries
      mockChart.addLineSeries.mockImplementation(() => {
        throw new Error('Chart error')
      })
      
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      expect(logger.error).toHaveBeenCalledWith(
        '[PatternRenderer] Failed to render pattern',
        expect.objectContaining({
          error: 'Chart error'
        })
      )
    })

    it('continues rendering after component failure', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      // Mock error only for first series
      let callCount = 0
      mockChart.addLineSeries.mockImplementation(() => {
        if (callCount++ === 0) {
          throw new Error('First series error')
        }
        return mockPatternSeries
      })
      
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Should still try to render other components
      expect(mockChart.addLineSeries).toHaveBeenCalledTimes(2)
    })
  })

  describe('Cleanup', () => {
    it('cleans up global tracking on destroy', () => {
      const originalWindow = global.window
      global.window = { } as unknown as Window & typeof globalThis
      
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Destroy should clean up
      renderer.destroy()
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PatternRenderer] Destroying instance',
        expect.any(Object)
      )
      
      global.window = originalWindow
    })
  })

  describe('Pattern Types', () => {
    it('handles different pattern types correctly', () => {
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      
      const patternTypes = [
        'head-and-shoulders',
        'double-top',
        'double-bottom',
        'triangle',
        'wedge',
        'flag'
      ]
      
      patternTypes.forEach(type => {
        renderer.renderPattern(`pattern-${type}`, mockVisualization, type)
        
        expect(logger.info).toHaveBeenCalledWith(
          '[PatternRenderer] Starting pattern render',
          expect.objectContaining({
            patternType: type
          })
        )
      })
    })
  })

  describe('Marker Management', () => {
    it('merges markers with existing series markers', () => {
      const existingMarkers = [
        { time: 1704000000 as Time, position: 'belowBar' as const, color: '#000', text: 'Existing' }
      ]
      
      mockMainSeries.markers.mockReturnValue(existingMarkers)
      
      renderer = new PatternRenderer(mockChart, mockMainSeries)
      renderer.renderPattern('pattern-1', mockVisualization, 'test')
      
      // Should preserve existing markers
      expect(mockMainSeries.setMarkers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Existing' })
        ])
      )
    })
  })
})