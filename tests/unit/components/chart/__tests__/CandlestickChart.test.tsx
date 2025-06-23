/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import CandlestickChart, { type CandlestickChartRef } from '@/components/chart/core/CandlestickChart'
import type { PatternRenderer } from '@/components/chart/patterns/PatternRenderer'

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

// Move mock definition before jest.mock
const mockUseCandlestickData = jest.fn()

jest.mock('@/hooks/market/use-candlestick-data', () => ({
  useCandlestickData: (...args: any[]) => mockUseCandlestickData(...args)
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
// Import statement removed - using mockUseCandlestickData directly
const { useChartInstance } = require('@/components/chart/hooks/useChartInstance')
const { useChartData } = require('@/components/chart/hooks/useChartData')
const { useAgentEventHandlers } = require('@/components/chart/hooks/useAgentEventHandlers')
const { usePatternRestore } = require('@/components/chart/hooks/usePatternRestore')
const { usePatternDebug } = require('@/components/chart/hooks/usePatternDebug')
const { useDrawingRestore } = require('@/components/chart/hooks/useDrawingRestore')

describe('CandlestickChart', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset to default mock values
    mockUseCandlestickData.mockImplementation(() => ({
      priceData: [
        { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
        { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 }
      ],
      isLoading: false
    }))
    
    // Reset all mock functions
    mockChartInstance.initializeChart.mockClear()
    mockChartInstance.addIndicatorSeries.mockClear()
    mockChartInstance.getSeries.mockClear()
    mockChartInstance.fitContent.mockClear()
    
    // Reset useChart to default state
    useChart.mockReturnValue({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: { ma: true, rsi: false, macd: false, boll: false },
      settings: { boll: {} },
      setChartReady: jest.fn()
    })
  })

  describe('Basic Rendering', () => {
    it('renders chart container when data is loaded', () => {
      render(<CandlestickChart />)
      
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })

    it('renders loading state when loading data', () => {
      mockUseCandlestickData.mockImplementation(() => ({
        priceData: [],
        isLoading: true
      }))
      
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
      
      // Clear the mock to verify it's not called again
      mockChartInstance.initializeChart.mockClear()
      
      // Also reset the updateIndicatorData mock that might be used
      const updateIndicatorData = jest.fn()
      useChartData.mockReturnValue({ updateIndicatorData })
      
      // Change timeframe only
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '4h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      // Should not be called again when only timeframe changes
      expect(mockChartInstance.initializeChart).not.toHaveBeenCalled()
    })
  })

  describe('Indicator Management', () => {
    it('adds MA indicator when enabled', () => {
      // Start with no indicators
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      const { rerender } = render(<CandlestickChart />)
      
      // Clear the mock to check for new calls
      mockChartInstance.addIndicatorSeries.mockClear()
      
      // Enable MA indicator
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', true)
    })

    it('removes MA indicator when disabled', () => {
      // Start with MA enabled
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      const { rerender } = render(<CandlestickChart />)
      
      // Clear the mock
      mockChartInstance.addIndicatorSeries.mockClear()
      
      // Disable MA indicator
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      // Should call addIndicatorSeries with false to remove it
      expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', false)
    })

    it('adds Bollinger Bands when enabled', () => {
      // Start with Bollinger Bands disabled
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: { period: 20, stdDev: 2 } },
        setChartReady: jest.fn()
      })
      
      const { rerender } = render(<CandlestickChart />)
      
      // Clear the mock
      mockChartInstance.addIndicatorSeries.mockClear()
      
      // Enable Bollinger Bands
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: true },
        settings: { boll: { period: 20, stdDev: 2 } },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('boll', true)
    })

    it('updates indicator data after adding', () => {
      const updateIndicatorData = jest.fn()
      useChartData.mockReturnValue({ updateIndicatorData })
      
      // Start with no indicators
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      const { rerender } = render(<CandlestickChart />)
      
      jest.useFakeTimers()
      
      // Enable MA indicator
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      rerender(<CandlestickChart />)
      
      // Wait for the setTimeout in the component
      jest.advanceTimersByTime(50)
      
      expect(updateIndicatorData).toHaveBeenCalledWith('ma')
      
      jest.useRealTimers()
    })
  })

  describe('Pattern Renderer', () => {
    it('sets chart ready when pattern renderer is available', async () => {
      const setChartReady = jest.fn()
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady
      })
      
      // Start without pattern renderer
      mockChartInstance.patternRenderer = null as any
      
      const { rerender } = render(<CandlestickChart />)
      
      // Add pattern renderer after initialization
      await act(async () => {
        mockChartInstance.patternRenderer = {} as PatternRenderer
        rerender(<CandlestickChart />)
      })
      
      // Wait for useEffect to run
      await waitFor(() => {
        expect(setChartReady).toHaveBeenCalledWith(true)
      })
    })

    it('sets chart not ready when component unmounts', async () => {
      const setChartReady = jest.fn()
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: false, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady
      })
      
      // Start without pattern renderer
      mockChartInstance.patternRenderer = null as any
      
      const { unmount, rerender } = render(<CandlestickChart />)
      
      // After initial render, set pattern renderer to trigger the effect
      await act(async () => {
        mockChartInstance.patternRenderer = {} as PatternRenderer
        rerender(<CandlestickChart />)
      })
      
      // Wait for setChartReady(true) to be called
      await waitFor(() => {
        expect(setChartReady).toHaveBeenCalledWith(true)
      })
      
      // Clear the mock
      setChartReady.mockClear()
      
      // Set pattern renderer to null and rerender to trigger effect with null value
      await act(async () => {
        mockChartInstance.patternRenderer = null as any
        rerender(<CandlestickChart />)
      })
      
      // Now unmount - the cleanup function from the last effect run (with null patternRenderer) should call setChartReady(false)
      unmount()
      
      // The cleanup function will call setChartReady(false) because patternRenderer is null
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
        fitContent: mockChartInstance.fitContent,
        zoomIn: expect.any(Function),
        zoomOut: expect.any(Function),
        resetView: expect.any(Function),
        drawingManager: mockChartInstance.drawingManager,
        chartData: expect.any(Array),
        patternRenderer: mockChartInstance.patternRenderer,
        getPatternRenderer: expect.any(Function)
      })
    })
  })

  describe('Restoration Hooks', () => {
    it('calls pattern restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(usePatternRestore).toHaveBeenCalledWith({
        patternRenderer: mockChartInstance.patternRenderer,
        isChartReady: expect.any(Boolean), // Can be false initially
        timeframe: '1h'
      })
    })

    it('calls drawing restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(useDrawingRestore).toHaveBeenCalledWith({
        drawingManager: mockChartInstance.drawingManager,
        isChartReady: expect.any(Boolean), // Can be false initially
        timeframe: '1h'
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
      
      expect(mockUseCandlestickData).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 1000
      })
    })

    it('tracks initial data load state', async () => {
      const updateIndicatorData = jest.fn()
      useChartData.mockReturnValue({ updateIndicatorData })
      
      // Start with no data
      mockUseCandlestickData.mockImplementation(() => ({
        priceData: [],
        isLoading: true
      }))
      
      const { rerender } = render(<CandlestickChart />)
      
      // Change to loaded data
      mockUseCandlestickData.mockImplementation(() => ({
        priceData: [
          { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
          { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 },
          { time: 1704074400, open: 45500, high: 46000, low: 45400, close: 45800, volume: 130 }
        ],
        isLoading: false
      }))
      
      rerender(<CandlestickChart />)
      
      // Verify that price data was passed to useChartData
      expect(useChartData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          priceData: expect.arrayContaining([
            expect.objectContaining({ time: 1704067200 })
          ])
        })
      )
    })
  })

  describe('Chart Data Updates', () => {
    it('passes correct props to useChartData', () => {
      // Set up the indicators state
      useChart.mockReturnValue({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        settings: { boll: {} },
        setChartReady: jest.fn()
      })
      
      render(<CandlestickChart />)
      
      expect(useChartData).toHaveBeenCalledWith({
        priceData: expect.any(Array),
        indicators: { ma: true, rsi: false, macd: false, boll: false },
        bollingerSettings: {},
        getSeries: mockChartInstance.getSeries,
        fitContent: mockChartInstance.fitContent,
        autoFit: false
      })
    })
  })

  describe('Zoom Handlers', () => {
    it('provides zoom in handler', () => {
      let zoomInHandler: (() => void) | undefined
      
      useAgentEventHandlers.mockImplementation((handlers) => {
        zoomInHandler = handlers.zoomIn
      })
      
      render(<CandlestickChart />)
      
      // Verify zoom in handler is provided
      expect(zoomInHandler).toBeDefined()
      expect(typeof zoomInHandler).toBe('function')
      
      // Test that zoom in handler can be called without error
      expect(() => zoomInHandler?.()).not.toThrow()
    })

    it('provides zoom out handler', () => {
      let zoomOutHandler: (() => void) | undefined
      
      useAgentEventHandlers.mockImplementation((handlers) => {
        zoomOutHandler = handlers.zoomOut
      })
      
      render(<CandlestickChart />)
      
      // Verify zoom out handler is provided
      expect(zoomOutHandler).toBeDefined()
      expect(typeof zoomOutHandler).toBe('function')
      
      // Test that zoom out handler can be called without error
      expect(() => zoomOutHandler?.()).not.toThrow()
    })

    it('provides reset view handler', () => {
      let resetViewHandler: (() => void) | undefined
      
      useAgentEventHandlers.mockImplementation((handlers) => {
        resetViewHandler = handlers.resetView
      })
      
      render(<CandlestickChart />)
      
      // Verify reset view handler is provided
      expect(resetViewHandler).toBeDefined()
      expect(typeof resetViewHandler).toBe('function')
      
      // Test that reset view handler can be called without error
      expect(() => resetViewHandler?.()).not.toThrow()
    })
  })
})