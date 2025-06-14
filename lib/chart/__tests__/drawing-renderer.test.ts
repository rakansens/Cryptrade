import { DrawingRenderer } from '../drawing-renderer'
import { useDrawingStore as useChartStoreBase } from '@/store/chart'
import type { ChartDrawing } from '@/store/chart'
import type { IChartApi, ISeriesApi, IPriceLine, SeriesType } from 'lightweight-charts'

// Mock the store
jest.mock('@/store/chart', () => ({
  useDrawingStore: {
    getState: jest.fn(),
    subscribe: jest.fn()
  }
}))

describe('DrawingRenderer', () => {
  let mockChart: jest.Mocked<IChartApi>
  let mockMainSeries: jest.Mocked<ISeriesApi<SeriesType>>
  let mockPriceLine: jest.Mocked<IPriceLine>
  let mockLineSeries: jest.Mocked<ISeriesApi<SeriesType>>
  let renderer: DrawingRenderer

  const mockDrawings: ChartDrawing[] = [
    {
      id: 'horizontal-1',
      type: 'horizontal',
      points: [{ time: 1704067200, value: 45000 }],
      style: {
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      },
      visible: true,
      interactive: true
    },
    {
      id: 'trendline-1',
      type: 'trendline',
      points: [
        { time: 1704067200, value: 45000 },
        { time: 1704153600, value: 47000 }
      ],
      style: {
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 'dashed',
        showLabels: false
      },
      visible: true,
      interactive: true
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock price line
    mockPriceLine = {
      applyOptions: jest.fn(),
      options: jest.fn()
    } as unknown as jest.Mocked<IPriceLine>

    // Mock line series
    mockLineSeries = {
      setData: jest.fn(),
      applyOptions: jest.fn(),
      priceScale: jest.fn().mockReturnValue({ options: jest.fn() }),
      options: jest.fn()
    } as unknown as jest.Mocked<ISeriesApi<SeriesType>>

    // Mock main series
    mockMainSeries = {
      createPriceLine: jest.fn().mockReturnValue(mockPriceLine),
      removePriceLine: jest.fn()
    } as unknown as jest.Mocked<ISeriesApi<SeriesType>>

    // Mock chart
    mockChart = {
      addLineSeries: jest.fn().mockReturnValue(mockLineSeries),
      removeSeries: jest.fn()
    } as unknown as jest.Mocked<IChartApi>

    // Mock store state
    ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
      drawings: mockDrawings
    })

    // Mock store subscription
    ;(useChartStoreBase.subscribe as jest.Mock).mockImplementation((selector, callback) => {
      // Simulate immediate callback
      callback(mockDrawings)
      return jest.fn() // unsubscribe function
    })
  })

  describe('Initialization', () => {
    it('subscribes to drawing store on creation', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      expect(useChartStoreBase.subscribe).toHaveBeenCalled()
    })

    it('renders initial drawings', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Should create horizontal line
      expect(mockMainSeries.createPriceLine).toHaveBeenCalled()
      
      // Should create trend line series
      expect(mockChart.addLineSeries).toHaveBeenCalled()
    })

    it('throttles drawing updates', async () => {
      const mockCallback = jest.fn()
      ;(useChartStoreBase.subscribe as jest.Mock).mockImplementation((selector, callback) => {
        mockCallback.mockImplementation(callback)
        return jest.fn()
      })

      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Trigger multiple updates rapidly
      mockCallback(mockDrawings)
      mockCallback(mockDrawings)
      mockCallback(mockDrawings)
      
      // Should only process once due to throttling
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(mockMainSeries.createPriceLine).toHaveBeenCalledTimes(1)
    })
  })

  describe('Horizontal Line Rendering', () => {
    it('creates horizontal price line with correct options', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      expect(mockMainSeries.createPriceLine).toHaveBeenCalledWith({
        price: 45000,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 2, // solid
        title: '45000.00',
        axisLabelVisible: true,
        lineVisible: true
      })
    })

    it('updates existing horizontal line', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Update drawing
      const updatedDrawing = {
        ...mockDrawings[0],
        points: [{ time: 1704067200, value: 46000 }],
        style: { ...mockDrawings[0].style, color: '#22c55e' }
      }
      
      // Trigger update
      const callback = (useChartStoreBase.subscribe as jest.Mock).mock.calls[0][1]
      callback([updatedDrawing, mockDrawings[1]])
      
      // Wait for throttle
      jest.advanceTimersByTime(100)
      
      expect(mockPriceLine.applyOptions).toHaveBeenCalledWith({
        price: 46000,
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 2,
        title: '46000.00'
      })
    })

    it('removes deleted horizontal lines', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Remove horizontal line
      const callback = (useChartStoreBase.subscribe as jest.Mock).mock.calls[0][1]
      callback([mockDrawings[1]]) // Only trendline remains
      
      expect(mockMainSeries.removePriceLine).toHaveBeenCalledWith(mockPriceLine)
    })

    it('hides title when showLabels is false', () => {
      const drawingWithoutLabels = {
        ...mockDrawings[0],
        style: { ...mockDrawings[0].style, showLabels: false }
      }
      
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: [drawingWithoutLabels]
      })
      
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      expect(mockMainSeries.createPriceLine).toHaveBeenCalledWith(
        expect.objectContaining({
          title: ''
        })
      )
    })
  })

  describe('Trend Line Rendering', () => {
    it('creates trend line series with correct data', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      expect(mockChart.addLineSeries).toHaveBeenCalledWith({
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 1, // dashed
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        autoscaleInfoProvider: expect.any(Function)
      })
      
      expect(mockLineSeries.setData).toHaveBeenCalledWith([
        { time: 1704067200, value: 45000 },
        { time: 1704153600, value: 47000 }
      ])
    })

    it('extends trend line correctly', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Check extended data points
      const setDataCall = mockLineSeries.setData.mock.calls[0][0]
      expect(setDataCall.length).toBeGreaterThan(2) // Should have extended points
    })

    it('updates existing trend line', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Update trend line
      const updatedDrawing = {
        ...mockDrawings[1],
        style: { ...mockDrawings[1].style, color: '#3b82f6', lineWidth: 3 }
      }
      
      const callback = (useChartStoreBase.subscribe as jest.Mock).mock.calls[0][1]
      callback([mockDrawings[0], updatedDrawing])
      
      expect(mockLineSeries.applyOptions).toHaveBeenCalledWith({
        color: '#3b82f6',
        lineWidth: 3
      })
    })

    it('removes deleted trend lines', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Remove trend line
      const callback = (useChartStoreBase.subscribe as jest.Mock).mock.calls[0][1]
      callback([mockDrawings[0]]) // Only horizontal remains
      
      expect(mockChart.removeSeries).toHaveBeenCalledWith(mockLineSeries)
    })
  })

  describe('Fibonacci Rendering', () => {
    it('creates fibonacci retracement levels', () => {
      const fibDrawing: ChartDrawing = {
        id: 'fib-1',
        type: 'fibonacci',
        points: [
          { time: 1704067200, value: 44000 },
          { time: 1704153600, value: 48000 }
        ],
        style: {
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 'dotted',
          showLabels: true
        },
        visible: true,
        interactive: true
      }
      
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: [fibDrawing]
      })
      
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Should create multiple price lines for each fibonacci level
      const expectedLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
      expect(mockMainSeries.createPriceLine).toHaveBeenCalledTimes(expectedLevels.length)
    })

    it('calculates fibonacci levels correctly', () => {
      const fibDrawing: ChartDrawing = {
        id: 'fib-1',
        type: 'fibonacci',
        points: [
          { time: 1704067200, value: 44000 },
          { time: 1704153600, value: 48000 }
        ],
        style: {
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      }
      
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: [fibDrawing]
      })
      
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      // Check 50% level calculation
      expect(mockMainSeries.createPriceLine).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 46000, // (44000 + 48000) / 2
          title: expect.stringContaining('50.0%')
        })
      )
    })
  })

  describe('Line Style Conversion', () => {
    it('converts line styles correctly', () => {
      const drawings: ChartDrawing[] = [
        { ...mockDrawings[0], style: { ...mockDrawings[0].style, lineStyle: 'solid' } },
        { ...mockDrawings[0], id: 'h2', style: { ...mockDrawings[0].style, lineStyle: 'dashed' } },
        { ...mockDrawings[0], id: 'h3', style: { ...mockDrawings[0].style, lineStyle: 'dotted' } }
      ]
      
      drawings.forEach((drawing, index) => {
        ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({ drawings: [drawing] })
        renderer = new DrawingRenderer(mockChart, mockMainSeries)
        
        const expectedStyle = index === 0 ? 2 : index === 1 ? 1 : 0
        expect(mockMainSeries.createPriceLine).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lineStyle: expectedStyle
          })
        )
      })
    })
  })

  describe('Cleanup', () => {
    it('cleans up all drawings on destroy', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      renderer.destroy()
      
      // Should remove all price lines
      expect(mockMainSeries.removePriceLine).toHaveBeenCalled()
      
      // Should remove all series
      expect(mockChart.removeSeries).toHaveBeenCalled()
      
      // Should unsubscribe from store
      const unsubscribe = (useChartStoreBase.subscribe as jest.Mock).mock.results[0].value
      expect(unsubscribe).toHaveBeenCalled()
    })

    it('handles multiple destroy calls safely', () => {
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      renderer.destroy()
      renderer.destroy()
      
      // Should not throw errors
      expect(mockMainSeries.removePriceLine).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty drawings array', () => {
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: []
      })
      
      renderer = new DrawingRenderer(mockChart, mockMainSeries)
      
      expect(mockMainSeries.createPriceLine).not.toHaveBeenCalled()
      expect(mockChart.addLineSeries).not.toHaveBeenCalled()
    })

    it('handles invalid drawing types', () => {
      const invalidDrawing = {
        ...mockDrawings[0],
        type: 'invalid' as unknown as ChartDrawing['type']
      }
      
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: [invalidDrawing]
      })
      
      // Should not throw
      expect(() => {
        renderer = new DrawingRenderer(mockChart, mockMainSeries)
      }).not.toThrow()
    })

    it('handles missing points data', () => {
      const invalidDrawing = {
        ...mockDrawings[0],
        points: []
      }
      
      ;(useChartStoreBase.getState as jest.Mock).mockReturnValue({
        drawings: [invalidDrawing]
      })
      
      // Should not throw
      expect(() => {
        renderer = new DrawingRenderer(mockChart, mockMainSeries)
      }).not.toThrow()
    })
  })
})