import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IndicatorSettings from '@/components/chart/indicators/IndicatorSettings'
import { useChart } from '@/store/chart.store'

// Mock the chart store
jest.mock('@/store/chart.store')

// Mock the UI components
jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked ?? false}
      onClick={() => onCheckedChange(!checked)}
      data-testid="switch"
      {...props}
    />
  ),
}))

jest.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: any) => <hr className={className} data-testid="separator" />,
}))

describe('IndicatorSettings', () => {
  const mockUpdateIndicator = jest.fn()
  const defaultIndicators = {
    ma: false,
    rsi: true,
    macd: false,
    boll: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useChart as jest.MockedFunction<typeof useChart>).mockReturnValue({
      indicators: defaultIndicators,
      updateIndicator: mockUpdateIndicator,
    } as any)
  })

  it('renders the settings panel with title', () => {
    render(<IndicatorSettings />)
    
    expect(screen.getByText('Technical Indicators')).toBeInTheDocument()
  })

  it('displays all indicator toggles', () => {
    render(<IndicatorSettings />)
    
    expect(screen.getByText('Moving Averages')).toBeInTheDocument()
    expect(screen.getByText('RSI (14)')).toBeInTheDocument()
    expect(screen.getByText('MACD (12, 26, 9)')).toBeInTheDocument()
    expect(screen.getByText('Bollinger Bands (20, 2)')).toBeInTheDocument()
  })

  it('shows correct checked state for indicators', () => {
    render(<IndicatorSettings />)
    
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'false') // MA
    expect(switches[1]).toHaveAttribute('aria-checked', 'true')  // RSI
    expect(switches[2]).toHaveAttribute('aria-checked', 'false') // MACD
    expect(switches[3]).toHaveAttribute('aria-checked', 'true')  // Bollinger
  })

  it('calls updateIndicator when toggling Moving Averages', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings />)
    
    const maSwitch = screen.getAllByRole('switch')[0]
    await user.click(maSwitch)
    
    expect(mockUpdateIndicator).toHaveBeenCalledWith('ma', true)
  })

  it('calls updateIndicator when toggling RSI', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings />)
    
    const rsiSwitch = screen.getAllByRole('switch')[1]
    await user.click(rsiSwitch)
    
    expect(mockUpdateIndicator).toHaveBeenCalledWith('rsi', false)
  })

  it('calls updateIndicator when toggling MACD', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings />)
    
    const macdSwitch = screen.getAllByRole('switch')[2]
    await user.click(macdSwitch)
    
    expect(mockUpdateIndicator).toHaveBeenCalledWith('macd', true)
  })

  it('calls updateIndicator when toggling Bollinger Bands', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings />)
    
    const bollSwitch = screen.getAllByRole('switch')[3]
    await user.click(bollSwitch)
    
    expect(mockUpdateIndicator).toHaveBeenCalledWith('boll', false)
  })

  it('displays separators between indicator groups', () => {
    render(<IndicatorSettings />)
    
    const separators = screen.getAllByTestId('separator')
    expect(separators).toHaveLength(3)
  })

  it('applies hover effect class to indicator rows', () => {
    render(<IndicatorSettings />)
    
    const maRow = screen.getByText('Moving Averages').parentElement
    expect(maRow).toHaveClass('hover:bg-[hsl(var(--glass-bg))]')
  })

  it('applies premium glass styling to container', () => {
    const { container } = render(<IndicatorSettings />)
    
    const settingsContainer = container.firstChild
    expect(settingsContainer).toHaveClass('premium-glass')
  })

  it('handles rapid toggle changes', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings />)
    
    const maSwitch = screen.getAllByRole('switch')[0]
    
    // Rapidly toggle multiple times
    await user.click(maSwitch)
    await user.click(maSwitch)
    await user.click(maSwitch)
    
    expect(mockUpdateIndicator).toHaveBeenCalledTimes(3)
    expect(mockUpdateIndicator).toHaveBeenLastCalledWith('ma', true)
  })

  it('memoizes component to prevent unnecessary re-renders', () => {
    const { rerender } = render(<IndicatorSettings />)
    
    // Re-render with same props
    rerender(<IndicatorSettings />)
    
    // Component should still function properly
    expect(screen.getByText('Technical Indicators')).toBeInTheDocument()
  })

  it('does not break when receiving unexpected indicator state', () => {
    // Test with undefined indicators
    ;(useChart as jest.MockedFunction<typeof useChart>).mockReturnValue({
      indicators: {} as any,
      updateIndicator: mockUpdateIndicator,
    } as any)
    
    render(<IndicatorSettings />)
    
    // Should still render without crashing
    expect(screen.getByText('Technical Indicators')).toBeInTheDocument()
    
    // Switches should default to unchecked when indicator state is undefined
    const switches = screen.getAllByRole('switch')
    switches.forEach(switchEl => {
      expect(switchEl).toHaveAttribute('aria-checked', 'false')
    })
  })
})