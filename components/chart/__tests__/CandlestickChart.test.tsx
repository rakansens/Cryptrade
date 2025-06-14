import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { forwardRef } from 'react'
import CandlestickChart, { CandlestickChartRef } from '../core/CandlestickChart'
import { useChart, useIsChartReady } from '@/store/chart.store'
import { useCandlestickData } from '@/hooks/market/use-candlestick-data'
import { useChartInstance } from '../hooks/useChartInstance'
import { useChartData } from '../hooks/useChartData'
import { useAgentEventHandlers } from '../hooks/useAgentEventHandlers'
import { usePatternRestore } from '../hooks/usePatternRestore'
import { useDrawingRestore } from '../hooks/useDrawingRestore'
import { usePatternDebug } from '../hooks/usePatternDebug'

// Mock all dependencies
jest.mock('@/store/chart.store')
jest.mock('@/hooks/market/use-candlestick-data')
jest.mock('../hooks/useChartInstance')
jest.mock('../hooks/useChartData')
jest.mock('../hooks/useAgentEventHandlers')
jest.mock('../hooks/usePatternRestore')
jest.mock('../hooks/usePatternDebug')
jest.mock('../hooks/useDrawingRestore')

describe('CandlestickChart', () => {
  const mockChartData = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: { ma: true, rsi: false, macd: false, boll: false },
    settings: { boll: {} },
    setChartReady: jest.fn()
  }

  const mockPriceData = [
    { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
    { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 }
  ]

  const mockChartInstance = {
    chartContainerRef: { current: null },
    initializeChart: jest.fn(() => jest.fn()),
    addIndicatorSeries: jest.fn(),
    getSeries: jest.fn(),
    fitContent: jest.fn(),
    drawingManager: {},
    patternRenderer: {},
    getPatternRenderer: jest.fn()
  }

  const defaultMocks = {
    useChart: mockChartData,
    useIsChartReady: true,
    useCandlestickData: { priceData: mockPriceData, isLoading: false },
    useChartInstance: mockChartInstance,
    useChartData: { updateIndicatorData: jest.fn() },
    useAgentEventHandlers: undefined,
    usePatternRestore: undefined,
    usePatternDebug: undefined,
    useDrawingRestore: undefined
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useChart as jest.Mock).mockReturnValue(defaultMocks.useChart)
    ;(useIsChartReady as jest.Mock).mockReturnValue(defaultMocks.useIsChartReady)
    ;(useCandlestickData as jest.Mock).mockReturnValue(defaultMocks.useCandlestickData)
    ;(useChartInstance as jest.Mock).mockReturnValue(defaultMocks.useChartInstance)
    ;(useChartData as jest.Mock).mockReturnValue(defaultMocks.useChartData)
    ;(useAgentEventHandlers as jest.Mock).mockReturnValue(defaultMocks.useAgentEventHandlers)
    ;(usePatternRestore as jest.Mock).mockReturnValue(defaultMocks.usePatternRestore)
    ;(usePatternDebug as jest.Mock).mockReturnValue(defaultMocks.usePatternDebug)
    ;(useDrawingRestore as jest.Mock).mockReturnValue(defaultMocks.useDrawingRestore)
  })

  describe('Basic Rendering', () => {
    it('renders chart container when data is loaded', () => {
      render(<CandlestickChart />)
      
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })

    it('renders loading state when loading data', () => {
      ;(useCandlestickData as jest.Mock).mockReturnValue({
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
        height: 500,
        indicators: mockChartData.indicators
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
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartData,
        symbol: 'ETHUSDT'
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(2)
    })

    it('does not reinitialize chart when timeframe changes', () => {
      const { rerender } = render(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
      
      // Change timeframe
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartData,
        timeframe: '4h'
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
    })
  })

  describe('Indicator Management', () => {
    it('adds MA indicator when enabled', async () => {
      render(<CandlestickChart />)
      
      await waitFor(() => {
        expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', true)
      })
    })

    it('removes MA indicator when disabled', async () => {
      const { rerender } = render(<CandlestickChart />)
      
      // Disable MA
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartData,
        indicators: { ...mockChartData.indicators, ma: false }
      })
      
      rerender(<CandlestickChart />)
      
      await waitFor(() => {
        expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', false)
      })
    })

    it('adds Bollinger Bands when enabled', async () => {
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartData,
        indicators: { ...mockChartData.indicators, boll: true }
      })
      
      render(<CandlestickChart />)
      
      await waitFor(() => {
        expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('boll', true)
      })
    })

    it('updates indicator data after adding', async () => {
      const updateIndicatorData = jest.fn()
      ;(useChartData as jest.Mock).mockReturnValue({ updateIndicatorData })
      
      render(<CandlestickChart />)
      
      await waitFor(() => {
        expect(updateIndicatorData).toHaveBeenCalledWith('ma')
      }, { timeout: 100 })
    })
  })

  describe('Pattern Renderer', () => {
    it('sets chart ready when pattern renderer is available', () => {
      render(<CandlestickChart />)
      
      expect(mockChartData.setChartReady).toHaveBeenCalledWith(true)
    })

    it('sets chart not ready when pattern renderer is removed', () => {
      const { rerender } = render(<CandlestickChart />)
      
      // Remove pattern renderer
      ;(useChartInstance as jest.Mock).mockReturnValue({
        ...mockChartInstance,
        patternRenderer: null
      })
      
      rerender(<CandlestickChart />)
      
      expect(mockChartData.setChartReady).toHaveBeenCalledWith(false)
    })
  })

  describe('Ref Handling', () => {
    it('exposes fitContent through ref', () => {
      const ref = React.createRef<CandlestickChartRef>()
      render(<CandlestickChart ref={ref} />)
      
      expect(ref.current).toBeDefined()
      expect(ref.current?.fitContent).toBeDefined()
      
      ref.current?.fitContent()
      expect(mockChartInstance.fitContent).toHaveBeenCalled()
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
        chartData: mockPriceData,
        patternRenderer: mockChartInstance.patternRenderer,
        getPatternRenderer: mockChartInstance.getPatternRenderer
      })
    })
  })

  describe('Restoration Hooks', () => {
    it('calls pattern restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(usePatternRestore).toHaveBeenCalledWith({
        patternRenderer: mockChartInstance.patternRenderer,
        isChartReady: true,
        timeframe: '1h'
      })
    })

    it('calls drawing restore hook with correct params', () => {
      render(<CandlestickChart />)
      
      expect(useDrawingRestore).toHaveBeenCalledWith({
        drawingManager: mockChartInstance.drawingManager,
        isChartReady: true,
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
      
      expect(useCandlestickData).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 1000
      })
    })

    it('tracks initial data load state', () => {
      const { rerender } = render(<CandlestickChart />)
      
      // Initially no data
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
      
      // Data loads
      ;(useCandlestickData as jest.Mock).mockReturnValue({
        priceData: mockPriceData,
        isLoading: false
      })
      
      rerender(<CandlestickChart />)
      
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })
  })

  describe('Chart Data Updates', () => {
    it('passes correct props to useChartData', () => {
      render(<CandlestickChart />)
      
      expect(useChartData).toHaveBeenCalledWith({
        priceData: mockPriceData,
        indicators: mockChartData.indicators,
        bollingerSettings: mockChartData.settings.boll,
        getSeries: mockChartInstance.getSeries,
        fitContent: mockChartInstance.fitContent,
        autoFit: false
      })
    })
  })
})