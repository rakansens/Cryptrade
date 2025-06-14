import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ChartToolbar from '../toolbar/ChartToolbar'
import { useChart } from '@/store/chart.store'
import { useIndicatorValues } from '@/hooks/market/use-indicator-values'

// Mock dependencies
jest.mock('@/store/chart.store')
jest.mock('@/hooks/market/use-indicator-values')
jest.mock('../toolbar/DrawingManager', () => ({
  __esModule: true,
  default: () => <div data-testid="drawing-manager">Drawing Manager</div>
}))
jest.mock('../indicators/IndicatorSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="indicator-settings">Indicator Settings</div>
}))
jest.mock('../toolbar/PriceDisplay', () => ({
  __esModule: true,
  default: ({ symbol, symbolName }: any) => (
    <div data-testid="price-display">
      Price Display - {symbol} - {symbolName}
    </div>
  )
}))

// Mock UI components
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button onClick={() => onValueChange('ETHUSDT')}>Change Symbol</button>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid={`select-item-${value}`}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, disabled, variant, size, title }: any) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      title={title}
    >
      {children}
    </button>
  )
}))

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  )
}))

describe('ChartToolbar', () => {
  const mockChartStore = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    setSymbol: jest.fn(),
    setTimeframe: jest.fn(),
    indicators: {
      ma: true,
      rsi: true,
      macd: true,
      boll: false
    }
  }

  const mockIndicatorValues = {
    ma7: 45123.45,
    ma25: 44980.12,
    ma99: 44500.00,
    rsi: 65.5,
    macd: 123.45,
    macdSignal: 100.00,
    macdHistogram: 23.45
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useChart as jest.Mock).mockReturnValue(mockChartStore)
    ;(useIndicatorValues as jest.Mock).mockReturnValue(mockIndicatorValues)
  })

  describe('Basic Rendering', () => {
    it('renders all main sections', () => {
      render(<ChartToolbar />)
      
      // Symbol selector
      expect(screen.getByTestId('select')).toBeInTheDocument()
      
      // Price display
      expect(screen.getByTestId('price-display')).toBeInTheDocument()
      expect(screen.getByText('Price Display - BTCUSDT - BTC/USDT')).toBeInTheDocument()
      
      // Drawing manager
      expect(screen.getByTestId('drawing-manager')).toBeInTheDocument()
      
      // Settings button
      expect(screen.getByTitle('Fit chart to data')).toBeInTheDocument()
    })

    it('displays timeframe buttons', () => {
      render(<ChartToolbar />)
      
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']
      timeframes.forEach(tf => {
        expect(screen.getByText(tf)).toBeInTheDocument()
      })
    })

    it('highlights active timeframe', () => {
      render(<ChartToolbar />)
      
      const activeButton = screen.getByText('1h')
      expect(activeButton).toHaveClass('bg-gradient-to-r', 'from-green-500', 'to-emerald-500')
    })
  })

  describe('Symbol Selection', () => {
    it('displays current symbol', () => {
      render(<ChartToolbar />)
      
      expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'BTCUSDT')
    })

    it('calls setSymbol when symbol is changed', () => {
      render(<ChartToolbar />)
      
      const changeButton = screen.getByText('Change Symbol')
      fireEvent.click(changeButton)
      
      expect(mockChartStore.setSymbol).toHaveBeenCalledWith('ETHUSDT')
    })
  })

  describe('Timeframe Selection', () => {
    it('calls setTimeframe when timeframe button is clicked', () => {
      render(<ChartToolbar />)
      
      const button4h = screen.getByText('4h')
      fireEvent.click(button4h)
      
      expect(mockChartStore.setTimeframe).toHaveBeenCalledWith('4h')
    })

    it('shows correct styling for inactive timeframes', () => {
      render(<ChartToolbar />)
      
      const inactiveButton = screen.getByText('4h')
      expect(inactiveButton).toHaveClass('text-gray-400', 'hover:bg-gray-700/60')
    })
  })

  describe('Indicator Display', () => {
    it('shows MA indicators when enabled', () => {
      render(<ChartToolbar />)
      
      expect(screen.getByText('MA(7):')).toBeInTheDocument()
      expect(screen.getByText('45123.45')).toBeInTheDocument()
      expect(screen.getByText('MA(25):')).toBeInTheDocument()
      expect(screen.getByText('44980.12')).toBeInTheDocument()
      expect(screen.getByText('MA(99):')).toBeInTheDocument()
      expect(screen.getByText('44500.00')).toBeInTheDocument()
    })

    it('hides MA indicators when disabled', () => {
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartStore,
        indicators: { ...mockChartStore.indicators, ma: false }
      })
      
      render(<ChartToolbar />)
      
      expect(screen.queryByText('MA(7):')).not.toBeInTheDocument()
    })

    it('shows RSI when enabled', () => {
      render(<ChartToolbar />)
      
      expect(screen.getByText('RSI(14):')).toBeInTheDocument()
      expect(screen.getByText('65.50')).toBeInTheDocument()
    })

    it('shows MACD when enabled', () => {
      render(<ChartToolbar />)
      
      expect(screen.getByText('MACD:')).toBeInTheDocument()
      expect(screen.getByText('123.45')).toBeInTheDocument()
    })

    it('shows separator between indicator groups', () => {
      render(<ChartToolbar />)
      
      const separator = screen.getByRole('generic', { hidden: true })
      expect(separator).toHaveClass('h-3', 'w-px', 'bg-gray-700')
    })

    it('shows --- when indicator value is null', () => {
      ;(useIndicatorValues as jest.Mock).mockReturnValue({
        ...mockIndicatorValues,
        ma7: null
      })
      
      render(<ChartToolbar />)
      
      expect(screen.getByText('---')).toBeInTheDocument()
    })
  })

  describe('Toolbar Actions', () => {
    it('calls onFitContent when fit button is clicked', () => {
      const onFitContent = jest.fn()
      render(<ChartToolbar onFitContent={onFitContent} />)
      
      const fitButton = screen.getByTitle('Fit chart to data')
      fireEvent.click(fitButton)
      
      expect(onFitContent).toHaveBeenCalled()
    })

    it('renders settings popover', () => {
      render(<ChartToolbar />)
      
      expect(screen.getByTestId('popover')).toBeInTheDocument()
      expect(screen.getByTestId('indicator-settings')).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('applies correct gradient background', () => {
      const { container } = render(<ChartToolbar />)
      
      const toolbar = container.firstChild
      expect(toolbar).toHaveClass('bg-gradient-to-b', 'from-gray-900/80', 'to-gray-950/80')
    })

    it('applies correct MACD color based on histogram value', () => {
      render(<ChartToolbar />)
      
      // Positive histogram
      let macdValue = screen.getByText('123.45')
      expect(macdValue.parentElement).toHaveStyle({
        color: expect.stringContaining('macdHistogramBull')
      })
      
      // Negative histogram
      ;(useIndicatorValues as jest.Mock).mockReturnValue({
        ...mockIndicatorValues,
        macdHistogram: -23.45
      })
      
      const { rerender } = render(<ChartToolbar />)
      rerender(<ChartToolbar />)
      
      macdValue = screen.getByText('123.45')
      expect(macdValue.parentElement).toHaveStyle({
        color: expect.stringContaining('macdHistogramBear')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles missing symbol info gracefully', () => {
      ;(useChart as jest.Mock).mockReturnValue({
        ...mockChartStore,
        symbol: 'UNKNOWN'
      })
      
      render(<ChartToolbar />)
      
      expect(screen.getByText('Price Display - UNKNOWN - UNKNOWN')).toBeInTheDocument()
    })

    it('renders extra menu button', () => {
      render(<ChartToolbar />)
      
      const extraButton = screen.getByText('•••')
      expect(extraButton).toBeInTheDocument()
      expect(extraButton).toHaveClass('text-gray-500', 'hover:text-gray-300')
    })
  })

  describe('Memoization', () => {
    it('memoizes symbol info calculation', () => {
      const { rerender } = render(<ChartToolbar />)
      
      // Initial render
      expect(screen.getByText('Price Display - BTCUSDT - BTC/USDT')).toBeInTheDocument()
      
      // Re-render with same props
      rerender(<ChartToolbar />)
      
      // Should not recalculate
      expect(screen.getByText('Price Display - BTCUSDT - BTC/USDT')).toBeInTheDocument()
    })
  })
})