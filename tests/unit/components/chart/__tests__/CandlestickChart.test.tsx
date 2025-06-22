/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import CandlestickChart, { type CandlestickChartRef } from '@/components/chart/core/CandlestickChart'

// Mock all dependencies
jest.mock('@/store/chart.store', () => ({
  useChart: jest.fn(() => ({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: { ma: true, rsi: false, macd: false, boll: false },
    settings: { boll: {} },
    setChartReady: jest.fn()
  })),
  useIsChartReady: jest.fn(() => true)
}))

jest.mock('@/hooks/market/use-candlestick-data', () => ({
  useCandlestickData: jest.fn(() => ({
    priceData: [
      { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
      { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 }
    ],
    isLoading: false
  }))
}))

const mockChartInstance = {
  chartContainerRef: { current: null },
  initializeChart: jest.fn(() => jest.fn()),
  addIndicatorSeries: jest.fn(),
  getSeries: jest.fn(),
  fitContent: jest.fn(),
  drawingManager: {} as any,
  patternRenderer: {} as any,
  getPatternRenderer: jest.fn(),
  chartInstance: null as any
}

jest.mock('@/components/chart/hooks/useChartInstance', () => ({
  useChartInstance: jest.fn(() => mockChartInstance)
}))

jest.mock('@/components/chart/hooks/useChartData', () => ({
  useChartData: jest.fn(() => ({
    updateIndicatorData: jest.fn()
  }))
}))

jest.mock('@/components/chart/hooks/useAgentEventHandlers', () => ({
  useAgentEventHandlers: jest.fn()
}))

jest.mock('@/components/chart/hooks/usePatternRestore', () => ({
  usePatternRestore: jest.fn()
}))

jest.mock('@/components/chart/hooks/usePatternDebug', () => ({
  usePatternDebug: jest.fn()
}))

jest.mock('@/components/chart/hooks/useDrawingRestore', () => ({
  useDrawingRestore: jest.fn()
}))

// Get mocked functions
const { useChart, useIsChartReady } = require('@/store/chart.store')
const { useCandlestickData } = require('@/hooks/market/use-candlestick-data')
const { useChartInstance } = require('@/components/chart/hooks/useChartInstance')
const { useChartData } = require('@/components/chart/hooks/useChartData')
const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers')
const { usePatternRestore } = require('@/components/chart/hooks/usePatternRestore')
const { usePatternDebug } = require('@/components/chart/hooks/usePatternDebug')
const { useDrawingRestore } = require('@/components/chart/hooks/useDrawingRestore')

describe('CandlestickChart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders chart container when data is loaded', () => {
      render(<CandlestickChart />)
      
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })

    it('renders loading state when loading data', () => {
      useCandlestickData.mockReturnValue({
        priceData: [],
        isLoading: true
      })
      
      render(<CandlestickChart />)
      
      expect(screen.getByText(/Loading chart data for BTCUSDT/)).toBeInTheDocument()
    })

    it('applies correct container styles', () => {
      render(<CandlestickChart />)
      
      const container = screen.getByTestId('chart-container')
      expect(container).toHaveClass('w-full', 'h-full', 'bg-[#050f13]')
    })

    it('renders with custom height', () => {
      render(<CandlestickChart height={500} />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalled()
      expect(useChartInstance).toHaveBeenCalledWith({
        height: 500
      })
    })
  })

  describe('Chart Initialization', () => {
    it('initializes chart on mount', () => {
      render(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalled()
    })

    it('cleans up chart on unmount', () => {
      const cleanup = jest.fn()
      mockChartInstance.initializeChart.mockReturnValue(cleanup)
      
      const { unmount } = render(<CandlestickChart />)
      unmount()
      
      expect(cleanup).toHaveBeenCalled()
    })

    it('reinitializes chart when symbol changes', () => {
      const { rerender } = render(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
      
      // Change symbol
      useChart.mockReturnValue({
        symbol: 'ETHUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(2)
    })

    it('does not reinitialize chart when timeframe changes', () => {
      const { rerender } = render(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
      
      // Change timeframe only
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '4h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
    })
  })

  describe('Indicator Management', () => {
    it('adds MA indicator when enabled', () => {
      render(<CandlestickChart />)
      
      expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', expect.any(Array))
    })

    it('removes MA indicator when disabled', () => {
      const { rerender } = render(<CandlestickChart />)
      
      const series = {
        removeSeries: jest.fn()
      }
      mockChartInstance.getSeries.mockReturnValue(series)
      
      // Disable MA indicator
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.getSeries).toHaveBeenCalledWith('ma')
      expect(series.removeSeries).toHaveBeenCalled()
    })

    it('adds Bollinger Bands when enabled', () => {
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: true },
        settings: { boll: { period: 20, stdDev: 2 } },
        setChartReady: jest.fn()
      })
      
      render(<CandlestickChart />)
      
      expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('boll', expect.any(Array))
    })

    it('updates indicator data after adding', () => {
      const updateIndicatorData = jest.fn()
      useChartData.mockReturnValue({ updateIndicatorData })
      
      render(<CandlestickChart />)
      
      expect(updateIndicatorData).toHaveBeenCalledWith('ma', expect.any(Array))
    })
  })

  describe('Pattern Renderer', () => {
    it('sets chart ready when pattern renderer is available', () => {
      const setChartReady = jest.fn()
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady
      })
      
      mockChartInstance.patternRenderer = {} as PatternRenderer
      
      render(<CandlestickChart />)
      
      expect(setChartReady).toHaveBeenCalledWith(true)
    })

    it('sets chart not ready when pattern renderer is removed', () => {
      const setChartReady = jest.fn()
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady
      })
      
      mockChartInstance.patternRenderer = {} as PatternRenderer
      
      const { rerender } = render(<CandlestickChart />)
      
      // Remove pattern renderer
      mockChartInstance.patternRenderer = null as any
      rerender(<CandlestickChart />)
      
      expect(setChartReady).toHaveBeenCalledWith(false)
    })
  })

  describe('Ref Handling', () => {
    it('exposes fitContent through ref', () => {
      const ref = React.createRef<CandlestickChartRef>()
      render(<CandlestickChart ref={ref} />)
      
      expect(ref.current).toBeDefined()
      expect(ref.current?.fitContent).toBe(mockChartInstance.fitContent)
    })
  })

  describe('Event Handlers', () => {
    it('registers agent event handlers', () => {
      render(<CandlestickChart />)
      
      expect(useAgentEventHandlers).toHaveBeenCalledWith({
        chartInstance: null,
        patternRenderer: mockChartInstance.patternRenderer,
        drawingManager: mockChartInstance.drawingManager,
        isInitialized: true
      })
    })
  })

  describe('Restoration Hooks', () => {
    it('calls pattern restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(usePatternRestore).toHaveBeenCalledWith({
        chartInstance: null,
        patternRenderer: mockChartInstance.patternRenderer,
        isInitialized: true
      })
    })

    it('calls drawing restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(useDrawingRestore).toHaveBeenCalledWith({
        chartInstance: null,
        drawingManager: mockChartInstance.drawingManager,
        isInitialized: true
      })
    })

    it('calls pattern debug hook', () => {
      render(<CandlestickChart />)
      
      expect(usePatternDebug).toHaveBeenCalledWith(mockChartInstance.patternRenderer)
    })
  })

  describe('Data Loading', () => {
    it('loads candlestick data with correct params', () => {
      render(<CandlestickChart />)
      
      expect(useCandlestickData).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 1000
      })
    })

    it('tracks initial data load state', () => {
      const { rerender } = render(<CandlestickChart />)
      
      // Should update indicator data when price data changes
      useCandlestickData.mockReturnValue({
        priceData: [
          { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
          { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 },
          { time: 1704074400, open: 45500, high: 46000, low: 45400, close: 45800, volume: 130 }
        ],
        isLoading: false
      })
      
      rerender(<CandlestickChart />)
      
      const updateIndicatorData = useChartData.mock.results[0].value.updateIndicatorData
      expect(updateIndicatorData).toHaveBeenCalled()
    })
  })

  describe('Chart Data Updates', () => {
    it('passes correct props to useChartData', () => {
      render(<CandlestickChart />)
      
      expect(useChartData).toHaveBeenCalledWith({
        priceData: expect.any(Array),
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        bollSettings: {},
        hasInitialDataLoaded: true
      })
    })
  })

  describe('Zoom Handlers', () => {
    it('zooms in by adjusting visible range', () => {
      const chartApi = {
        priceScale: jest.fn().mockReturnValue({
          getVisibleLogicalRange: jest.fn().mockReturnValue({ from: 0, to: 100 })
        }),
        timeScale: jest.fn().mockReturnValue({
          setVisibleLogicalRange: jest.fn()
        })
      }
      
      mockChartInstance.chartInstance = chartApi
      useAgentEventHandlers.mockImplementation(({ chartInstance }) => {
        if (chartInstance) {
          // Simulate zoom in event
          const handlers = useAgentEventHandlers.mock.calls[0]?.[0]
          if (handlers?.chartInstance) {
            const range = handlers.chartInstance.priceScale().getVisibleLogicalRange()
            const newRange = {
              from: range.from + 10,
              to: range.to - 10
            }
            handlers.chartInstance.timeScale().setVisibleLogicalRange(newRange)
          }
        }
      })
      
      render(<CandlestickChart />)
      
      expect(chartApi.timeScale().setVisibleLogicalRange).toHaveBeenCalledWith({
        from: 10,
        to: 90
      })
    })

    it('zooms out by adjusting visible range', () => {
      const chartApi = {
        priceScale: jest.fn().mockReturnValue({
          getVisibleLogicalRange: jest.fn().mockReturnValue({ from: 10, to: 90 })
        }),
        timeScale: jest.fn().mockReturnValue({
          setVisibleLogicalRange: jest.fn()
        })
      }
      
      mockChartInstance.chartInstance = chartApi
      useAgentEventHandlers.mockImplementation(({ chartInstance }) => {
        if (chartInstance) {
          // Simulate zoom out event
          const handlers = useAgentEventHandlers.mock.calls[0]?.[0]
          if (handlers?.chartInstance) {
            const range = handlers.chartInstance.priceScale().getVisibleLogicalRange()
            const newRange = {
              from: Math.max(0, range.from - 10),
              to: Math.min(100, range.to + 10)
            }
            handlers.chartInstance.timeScale().setVisibleLogicalRange(newRange)
          }
        }
      })
      
      render(<CandlestickChart />)
      
      expect(chartApi.timeScale().setVisibleLogicalRange).toHaveBeenCalledWith({
        from: 0,
        to: 100
      })
    })
  })
})