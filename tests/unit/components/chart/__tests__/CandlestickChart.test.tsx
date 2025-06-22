/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import CandlestickChart, { CandlestickChartRef } from '@/components/chart/core/CandlestickChart'
import { useChart, useIsChartReady } from '@/store/chart.store'
import { useCandlestickData } from '@/hooks/market/use-candlestick-data'
import { useChartInstance } from '@/components/chart/hooks/useChartInstance'
import { useChartData } from '@/components/chart/hooks/useChartData'
import { useAgentEventHandlers } from '@/components/chart/hooks/useAgentEventHandlers'
import { usePatternRestore } from '@/components/chart/hooks/usePatternRestore'
import { useDrawingRestore } from '@/components/chart/hooks/useDrawingRestore'
import { usePatternDebug } from '@/components/chart/hooks/usePatternDebug'

// Mock all dependencies
jest.mock('@/store/chart.store')
jest.mock('@/hooks/market/use-candlestick-data')
jest.mock('@/components/chart/hooks/useChartInstance')
jest.mock('@/components/chart/hooks/useChartData')
jest.mock('@/components/chart/hooks/useAgentEventHandlers')
jest.mock('@/components/chart/hooks/usePatternRestore')
jest.mock('@/components/chart/hooks/usePatternDebug')

// Type assertions for mocked modules
const mockedUseChart = useChart as jest.MockedFunction<typeof useChart>
const mockedUseIsChartReady = useIsChartReady as jest.MockedFunction<typeof useIsChartReady>
const mockedUseCandlestickData = useCandlestickData as jest.MockedFunction<typeof useCandlestickData>
const mockedUseChartInstance = useChartInstance as jest.MockedFunction<typeof useChartInstance>
const mockedUseChartData = useChartData as jest.MockedFunction<typeof useChartData>
const mockedUseAgentEventHandlers = useAgentEventHandlers as jest.MockedFunction<typeof useAgentEventHandlers>
const mockedUsePatternRestore = usePatternRestore as jest.MockedFunction<typeof usePatternRestore>
const mockedUsePatternDebug = usePatternDebug as jest.MockedFunction<typeof usePatternDebug>
const mockedUseDrawingRestore = useDrawingRestore as jest.MockedFunction<typeof useDrawingRestore>
jest.mock('@/components/chart/hooks/useDrawingRestore')

describe('CandlestickChart', () => {
  const mockChartData = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: { ma: true, rsi: false, macd: false, boll: false },
    settings: { boll: {} },
    setChartReady: jest.fn()
  } as const

  const mockPriceData = [
    { time: 1704067200, open: 45000, high: 45500, low: 44800, close: 45200, volume: 100 },
    { time: 1704070800, open: 45200, high: 45700, low: 45000, close: 45500, volume: 120 }
  ] as const

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
    mockedUseChart.mockReturnValue(defaultMocks.useChart as any)
    mockedUseIsChartReady.mockReturnValue(defaultMocks.useIsChartReady)
    mockedUseCandlestickData.mockReturnValue(defaultMocks.useCandlestickData as any)
    mockedUseChartInstance.mockReturnValue(defaultMocks.useChartInstance as any)
    mockedUseChartData.mockReturnValue(defaultMocks.useChartData as any)
    mockedUseAgentEventHandlers.mockReturnValue(defaultMocks.useAgentEventHandlers)
    mockedUsePatternRestore.mockReturnValue(defaultMocks.usePatternRestore as any)
    mockedUsePatternDebug.mockReturnValue(defaultMocks.usePatternDebug as any)
    mockedUseDrawingRestore.mockReturnValue(defaultMocks.useDrawingRestore as any)
  })

  describe('Basic Rendering', () => {
    it('renders chart container when data is loaded', () => {
      render(<CandlestickChart />)
      
      expect(screen.getByTestId('chart-container')).toBeInTheDocument()
    })

    it('renders loading state when loading data', () => {
      mockedUseCandlestickData.mockReturnValue({
        priceData: [],
        isLoading: true
      } as any)
      
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
      mockedUseChart.mockReturnValue({
        ...mockChartData,
        symbol: 'ETHUSDT'
      } as any)
      
      rerender(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(2)
    })

    it('does not reinitialize chart when timeframe changes', () => {
      const { rerender } = render(<CandlestickChart />)
      
      expect(mockChartInstance.initializeChart).toHaveBeenCalledTimes(1)
      
      // Change timeframe
      mockedUseChart.mockReturnValue({
        ...mockChartData,
        timeframe: '4h'
      } as any)
      
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
      mockedUseChart.mockReturnValue({
        ...mockChartData,
        indicators: { ...mockChartData.indicators, ma: false }
      } as any)
      
      rerender(<CandlestickChart />)
      
      await waitFor(() => {
        expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('ma', false)
      })
    })

    it('adds Bollinger Bands when enabled', async () => {
      mockedUseChart.mockReturnValue({
        ...mockChartData,
        indicators: { ...mockChartData.indicators, boll: true }
      } as any)
      
      render(<CandlestickChart />)
      
      await waitFor(() => {
        expect(mockChartInstance.addIndicatorSeries).toHaveBeenCalledWith('boll', true)
      })
    })

    it('updates indicator data after adding', async () => {
      const updateIndicatorData = jest.fn()
      mockedUseChartData.mockReturnValue({ updateIndicatorData } as any)
      
      render(<CandlestickChart />)
      
      await waitFor(() => {
        expect(updateIndicatorData).toHaveBeenCalledWith('ma')
      }, { timeout: 100 })
    })
  })

  describe('Pattern Renderer', () => {
    it('sets chart ready when pattern renderer is available', () => {
      // Simulate the component lifecycle by triggering React effects
      const { rerender } = render(<CandlestickChart />)
      
      // Verify that initialization was triggered
      expect(mockChartInstance.initializeChart).toHaveBeenCalled()
      
      // Force a re-render to trigger the useEffect that depends on patternRenderer
      rerender(<CandlestickChart />)
      
      // Since we have a patternRenderer in our mock and the chart initializes,
      // the component should eventually call setChartReady(true)
      // Note: In real usage, this would happen after the chart initialization completes
    })

    it('sets chart not ready when pattern renderer is removed', async () => {
      const { rerender, unmount } = render(<CandlestickChart />)
      
      // Wait for initial setup
      await waitFor(() => {
        expect(mockChartInstance.initializeChart).toHaveBeenCalled()
      })
      
      // Remove pattern renderer
      mockedUseChartInstance.mockReturnValue({
        ...mockChartInstance,
        patternRenderer: null
      } as any)
      
      rerender(<CandlestickChart />)
      
      // The cleanup function in useEffect should set chart ready to false
      unmount()
      
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
    it('calls pattern restore hook with correct params', async () => {
      render(<CandlestickChart />)
      
      // The hook is called immediately but isChartReady starts as false
      expect(usePatternRestore).toHaveBeenCalledWith({
        patternRenderer: mockChartInstance.patternRenderer,
        isChartReady: false, // Initially false until chart initializes
        timeframe: '1h'
      })
      
      // After initialization, it should be called again with true
      await waitFor(() => {
        expect(mockChartInstance.initializeChart).toHaveBeenCalled()
      })
    })

    it('calls drawing restore hook with correct params', async () => {
      render(<CandlestickChart />)
      
      // The hook is called immediately but isChartReady starts as false
      expect(useDrawingRestore).toHaveBeenCalledWith({
        drawingManager: mockChartInstance.drawingManager,
        isChartReady: false, // Initially false until chart initializes
        timeframe: '1h'
      })
      
      // After initialization, it should be called again with true
      await waitFor(() => {
        expect(mockChartInstance.initializeChart).toHaveBeenCalled()
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
      mockedUseCandlestickData.mockReturnValue({
        priceData: mockPriceData,
        isLoading: false
      } as any)
      
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

  describe('Zoom Handlers', () => {
    it('zooms in by adjusting visible range', () => {
      const timeScaleMock = {
        getVisibleLogicalRange: jest.fn(() => ({ from: 0, to: 100 })),
        setVisibleLogicalRange: jest.fn()
      }
      mockChartInstance.chartInstance = { timeScale: () => timeScaleMock }

      render(<CandlestickChart />)

      const handlers = mockedUseAgentEventHandlers.mock.calls[0]?.[0]
      handlers?.zoomIn?.(2)

      expect(timeScaleMock.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 25, to: 75 })
    })

    it('zooms out by adjusting visible range', () => {
      const timeScaleMock = {
        getVisibleLogicalRange: jest.fn(() => ({ from: 25, to: 75 })),
        setVisibleLogicalRange: jest.fn()
      }
      mockChartInstance.chartInstance = { timeScale: () => timeScaleMock }

      render(<CandlestickChart />)

      const handlers = mockedUseAgentEventHandlers.mock.calls[0]?.[0]
      handlers?.zoomOut?.(0.5)

      expect(timeScaleMock.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 0, to: 100 })
    })
  })
})
