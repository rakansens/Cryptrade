import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IndicatorPanel } from '@/components/chart/indicators/IndicatorPanel'
import { IndicatorType } from '@/types/indicator-types'

// Mock the child components
jest.mock('@/components/chart/indicators/RsiChart', () => ({
  RsiChart: ({ data, settings }: any) => (
    <div data-testid="rsi-chart">
      RSI Chart - Period: {settings.period}
    </div>
  )
}))

jest.mock('@/components/chart/indicators/MacdChart', () => ({
  MacdChart: ({ data, settings }: any) => (
    <div data-testid="macd-chart">
      MACD Chart - Fast: {settings.fastPeriod}, Slow: {settings.slowPeriod}
    </div>
  )
}))

jest.mock('@/components/chart/indicators/IndicatorSettings', () => ({
  IndicatorSettings: ({ indicator, settings, onSettingsChange, onClose }: any) => (
    <div data-testid="indicator-settings">
      <h3>Settings for {indicator}</h3>
      <button onClick={() => onSettingsChange({ ...settings, period: 20 })}>
        Update Settings
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

const mockCandleData = [
  { time: '2024-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
  { time: '2024-01-02', open: 105, high: 115, low: 100, close: 110, volume: 1200 },
  { time: '2024-01-03', open: 110, high: 120, low: 105, close: 115, volume: 1100 },
]

describe('IndicatorPanel', () => {
  const defaultProps = {
    indicators: ['RSI', 'MACD'] as IndicatorType[],
    data: mockCandleData,
    onRemoveIndicator: jest.fn(),
    height: 200,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all active indicators', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    expect(screen.getByTestId('rsi-chart')).toBeInTheDocument()
    expect(screen.getByTestId('macd-chart')).toBeInTheDocument()
  })

  it('renders empty state when no indicators', () => {
    render(<IndicatorPanel {...defaultProps} indicators={[]} />)
    
    expect(screen.queryByTestId('rsi-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('macd-chart')).not.toBeInTheDocument()
  })

  it('displays indicator labels', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    expect(screen.getByText('RSI')).toBeInTheDocument()
    expect(screen.getByText('MACD')).toBeInTheDocument()
  })

  it('shows settings button for each indicator', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    expect(settingsButtons).toHaveLength(2)
  })

  it('shows remove button for each indicator', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const removeButtons = screen.getAllByLabelText(/remove/i)
    expect(removeButtons).toHaveLength(2)
  })

  it('calls onRemoveIndicator when remove button clicked', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const removeButtons = screen.getAllByLabelText(/remove/i)
    await user.click(removeButtons[0])
    
    expect(defaultProps.onRemoveIndicator).toHaveBeenCalledWith('RSI')
  })

  it('opens settings dialog when settings button clicked', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    await user.click(settingsButtons[0])
    
    expect(screen.getByTestId('indicator-settings')).toBeInTheDocument()
    expect(screen.getByText('Settings for RSI')).toBeInTheDocument()
  })

  it('closes settings dialog when close button clicked', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    await user.click(settingsButtons[0])
    
    expect(screen.getByTestId('indicator-settings')).toBeInTheDocument()
    
    await user.click(screen.getByText('Close'))
    
    expect(screen.queryByTestId('indicator-settings')).not.toBeInTheDocument()
  })

  it('updates indicator settings', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    // Open settings for RSI
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    await user.click(settingsButtons[0])
    
    // Update settings
    await user.click(screen.getByText('Update Settings'))
    
    // Settings should close and RSI should show updated period
    expect(screen.queryByTestId('indicator-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('rsi-chart')).toHaveTextContent('Period: 20')
  })

  it('maintains separate settings for each indicator', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    // Check initial settings
    expect(screen.getByTestId('rsi-chart')).toHaveTextContent('Period: 14')
    expect(screen.getByTestId('macd-chart')).toHaveTextContent('Fast: 12, Slow: 26')
    
    // Open and modify RSI settings
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    await user.click(settingsButtons[0])
    await user.click(screen.getByText('Update Settings'))
    
    // RSI should be updated, MACD should remain the same
    expect(screen.getByTestId('rsi-chart')).toHaveTextContent('Period: 20')
    expect(screen.getByTestId('macd-chart')).toHaveTextContent('Fast: 12, Slow: 26')
  })

  it('renders indicators with correct height', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const indicatorContainers = screen.getAllByTestId(/chart$/)
    indicatorContainers.forEach(container => {
      expect(container.closest('.indicator-container')).toHaveStyle({ height: '200px' })
    })
  })

  it('handles empty data gracefully', () => {
    render(<IndicatorPanel {...defaultProps} data={[]} />)
    
    expect(screen.getByTestId('rsi-chart')).toBeInTheDocument()
    expect(screen.getByTestId('macd-chart')).toBeInTheDocument()
  })

  it('applies hover effects on indicator containers', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const indicatorContainers = screen.getAllByRole('region')
    
    await user.hover(indicatorContainers[0])
    expect(indicatorContainers[0]).toHaveClass('hover:shadow-lg')
  })

  it('displays indicator type badges', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const badges = screen.getAllByRole('status')
    expect(badges[0]).toHaveTextContent('RSI')
    expect(badges[1]).toHaveTextContent('MACD')
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const settingsButtons = screen.getAllByLabelText(/settings/i)
    const removeButtons = screen.getAllByLabelText(/remove/i)
    
    settingsButtons[0].focus()
    expect(settingsButtons[0]).toHaveFocus()
    
    await user.tab()
    expect(removeButtons[0]).toHaveFocus()
    
    await user.tab()
    expect(settingsButtons[1]).toHaveFocus()
  })

  it('preserves settings when indicators are reordered', () => {
    const { rerender } = render(<IndicatorPanel {...defaultProps} />)
    
    expect(screen.getByTestId('rsi-chart')).toHaveTextContent('Period: 14')
    
    // Reorder indicators
    rerender(<IndicatorPanel {...defaultProps} indicators={['MACD', 'RSI']} />)
    
    // Settings should be preserved
    expect(screen.getByTestId('rsi-chart')).toHaveTextContent('Period: 14')
    expect(screen.getByTestId('macd-chart')).toHaveTextContent('Fast: 12, Slow: 26')
  })

  it('handles rapid indicator additions and removals', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<IndicatorPanel {...defaultProps} />)
    
    // Remove RSI
    const removeButtons = screen.getAllByLabelText(/remove/i)
    await user.click(removeButtons[0])
    expect(defaultProps.onRemoveIndicator).toHaveBeenCalledWith('RSI')
    
    // Simulate re-adding RSI
    rerender(<IndicatorPanel {...defaultProps} indicators={['MACD', 'RSI']} />)
    
    // Both indicators should be present
    expect(screen.getByTestId('rsi-chart')).toBeInTheDocument()
    expect(screen.getByTestId('macd-chart')).toBeInTheDocument()
  })

  it('supports custom indicator types', () => {
    const customIndicators = ['RSI', 'MACD', 'BOLLINGER_BANDS'] as IndicatorType[]
    render(<IndicatorPanel {...defaultProps} indicators={customIndicators} />)
    
    // Should handle unknown indicator types gracefully
    expect(screen.getByTestId('rsi-chart')).toBeInTheDocument()
    expect(screen.getByTestId('macd-chart')).toBeInTheDocument()
  })
})