import React from 'react'
import { render, screen } from '@testing-library/react'
import { MainLayout } from '@/components/MainLayout'

// Mock dependencies
jest.mock('@/store/chart.store', () => ({
  useChart: jest.fn(() => ({
    indicators: {},
    symbol: 'BTCUSDT',
    interval: '1h',
    setSymbol: jest.fn(),
    setInterval: jest.fn(),
  })),
  useChartDrawings: jest.fn(() => ({
    drawings: [],
    addDrawing: jest.fn(),
    removeDrawing: jest.fn(),
    updateDrawing: jest.fn(),
  }))
}))

jest.mock('@/components/chart/core/CandlestickChart', () => ({
  __esModule: true,
  default: React.forwardRef(() => <div data-testid="candlestick-chart">Chart</div>)
}))

jest.mock('@/components/chart/toolbar/ChartToolbar', () => ({
  __esModule: true,
  default: () => <div data-testid="chart-toolbar">Chart Toolbar</div>
}))

jest.mock('@/components/chart/indicators/IndicatorPanel', () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid="indicator-panel" data-title={title}>
      {children}
    </div>
  )
}))

jest.mock('@/components/chart/indicators/RsiChart', () => ({
  __esModule: true,
  default: () => <div data-testid="rsi-chart">RSI Chart</div>
}))

jest.mock('@/components/chart/indicators/MacdChart', () => ({
  __esModule: true,
  default: () => <div data-testid="macd-chart">MACD Chart</div>
}))

jest.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children, direction, className }: any) => (
    <div data-testid="resizable-panel-group" data-direction={direction} className={className}>
      {children}
    </div>
  ),
  ResizablePanel: ({ children, defaultSize, minSize, maxSize, className }: any) => (
    <div 
      data-testid="resizable-panel" 
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
      className={className}
    >
      {children}
    </div>
  ),
  ResizableHandle: ({ className }: any) => (
    <div data-testid="resizable-handle" className={className} />
  ),
}))

describe('MainLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders main layout structure without children', () => {
    render(<MainLayout />)
    
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument()
    expect(screen.getByTestId('chart-toolbar')).toBeInTheDocument()
    // There are multiple resizable panel groups (horizontal and vertical)
    const panelGroups = screen.getAllByTestId('resizable-panel-group')
    expect(panelGroups.length).toBeGreaterThan(0)
  })

  it('renders main layout structure with children', () => {
    render(
      <MainLayout>
        <div data-testid="chat-content">Chat Content</div>
      </MainLayout>
    )
    
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument()
    expect(screen.getByTestId('chart-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-content')).toBeInTheDocument()
  })

  it('displays chart toolbar', () => {
    render(<MainLayout />)
    
    expect(screen.getByTestId('chart-toolbar')).toBeInTheDocument()
  })

  it('renders indicator panels when indicators are enabled', () => {
    const { useChart } = require('@/store/chart.store')
    useChart.mockReturnValue({
      indicators: {
        rsi: true,
        macd: true
      },
      symbol: 'BTCUSDT',
      interval: '1h'
    })
    
    render(<MainLayout />)
    
    // Check for indicator panels
    const panels = screen.getAllByTestId('indicator-panel')
    expect(panels).toHaveLength(2)
    
    // Check for RSI panel
    const rsiPanel = panels.find(p => p.getAttribute('data-title') === 'RSI (14)')
    expect(rsiPanel).toBeInTheDocument()
    expect(screen.getByTestId('rsi-chart')).toBeInTheDocument()
    
    // Check for MACD panel
    const macdPanel = panels.find(p => p.getAttribute('data-title') === 'MACD (12, 26, 9)')
    expect(macdPanel).toBeInTheDocument()
    expect(screen.getByTestId('macd-chart')).toBeInTheDocument()
  })

  it('does not render indicator panels when indicators are disabled', () => {
    const { useChart } = require('@/store/chart.store')
    useChart.mockReturnValue({
      indicators: {
        rsi: false,
        macd: false
      },
      symbol: 'BTCUSDT',
      interval: '1h'
    })
    
    render(<MainLayout />)
    
    expect(screen.queryByTestId('rsi-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('macd-chart')).not.toBeInTheDocument()
  })

  it('renders resizable panels', () => {
    render(<MainLayout />)
    
    const panels = screen.getAllByTestId('resizable-panel')
    expect(panels.length).toBeGreaterThan(0)
  })

  it('renders resizable handles when children are provided', () => {
    render(
      <MainLayout>
        <div>Chat</div>
      </MainLayout>
    )
    
    const handles = screen.getAllByTestId('resizable-handle')
    expect(handles.length).toBeGreaterThan(0)
  })

  it('adjusts panel sizes based on children presence', () => {
    const { rerender } = render(<MainLayout />)
    
    // Without children, chart panel should be 100%
    let chartPanel = screen.getAllByTestId('resizable-panel').find(
      panel => panel.getAttribute('data-default-size') === '100'
    )
    expect(chartPanel).toBeInTheDocument()
    
    // With children, panels should be split
    rerender(
      <MainLayout>
        <div>Chat</div>
      </MainLayout>
    )
    
    const panels = screen.getAllByTestId('resizable-panel')
    const chatPanel = panels.find(p => p.getAttribute('data-default-size') === '25')
    const chartPanelWithChat = panels.find(p => p.getAttribute('data-default-size') === '75')
    
    expect(chatPanel).toBeInTheDocument()
    expect(chartPanelWithChat).toBeInTheDocument()
  })
})