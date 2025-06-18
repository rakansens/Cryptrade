import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IndicatorSettings } from '@/components/chart/indicators/IndicatorSettings'
import { IndicatorType } from '@/types/indicator-types'

describe('IndicatorSettings', () => {
  const defaultProps = {
    indicator: 'RSI' as IndicatorType,
    settings: { period: 14 },
    onSettingsChange: jest.fn(),
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders settings dialog with title', () => {
    render(<IndicatorSettings {...defaultProps} />)
    
    expect(screen.getByText('RSI Settings')).toBeInTheDocument()
  })

  it('displays current settings values', () => {
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i) as HTMLInputElement
    expect(periodInput.value).toBe('14')
  })

  it('updates RSI period setting', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, '20')
    
    await user.click(screen.getByText('Apply'))
    
    expect(defaultProps.onSettingsChange).toHaveBeenCalledWith({ period: 20 })
  })

  it('validates RSI period range', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    
    // Test minimum value
    await user.clear(periodInput)
    await user.type(periodInput, '1')
    expect(screen.getByText(/must be between 2 and 100/i)).toBeInTheDocument()
    
    // Test maximum value
    await user.clear(periodInput)
    await user.type(periodInput, '101')
    expect(screen.getByText(/must be between 2 and 100/i)).toBeInTheDocument()
    
    // Test valid value
    await user.clear(periodInput)
    await user.type(periodInput, '50')
    expect(screen.queryByText(/must be between 2 and 100/i)).not.toBeInTheDocument()
  })

  it('renders MACD settings correctly', () => {
    const macdProps = {
      ...defaultProps,
      indicator: 'MACD' as IndicatorType,
      settings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    }
    
    render(<IndicatorSettings {...macdProps} />)
    
    expect(screen.getByText('MACD Settings')).toBeInTheDocument()
    expect((screen.getByLabelText(/fast period/i) as HTMLInputElement).value).toBe('12')
    expect((screen.getByLabelText(/slow period/i) as HTMLInputElement).value).toBe('26')
    expect((screen.getByLabelText(/signal period/i) as HTMLInputElement).value).toBe('9')
  })

  it('updates MACD settings', async () => {
    const user = userEvent.setup()
    const macdProps = {
      ...defaultProps,
      indicator: 'MACD' as IndicatorType,
      settings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    }
    
    render(<IndicatorSettings {...macdProps} />)
    
    const fastInput = screen.getByLabelText(/fast period/i)
    await user.clear(fastInput)
    await user.type(fastInput, '10')
    
    await user.click(screen.getByText('Apply'))
    
    expect(macdProps.onSettingsChange).toHaveBeenCalledWith({
      fastPeriod: 10,
      slowPeriod: 26,
      signalPeriod: 9,
    })
  })

  it('validates MACD period relationships', async () => {
    const user = userEvent.setup()
    const macdProps = {
      ...defaultProps,
      indicator: 'MACD' as IndicatorType,
      settings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    }
    
    render(<IndicatorSettings {...macdProps} />)
    
    const fastInput = screen.getByLabelText(/fast period/i)
    const slowInput = screen.getByLabelText(/slow period/i)
    
    // Fast period should be less than slow period
    await user.clear(fastInput)
    await user.type(fastInput, '30')
    
    expect(screen.getByText(/fast period must be less than slow period/i)).toBeInTheDocument()
    
    // Fix the error
    await user.clear(fastInput)
    await user.type(fastInput, '10')
    expect(screen.queryByText(/fast period must be less than slow period/i)).not.toBeInTheDocument()
  })

  it('closes dialog on cancel', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    await user.click(screen.getByText('Cancel'))
    
    expect(defaultProps.onClose).toHaveBeenCalled()
    expect(defaultProps.onSettingsChange).not.toHaveBeenCalled()
  })

  it('closes dialog after applying settings', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    await user.click(screen.getByText('Apply'))
    
    expect(defaultProps.onSettingsChange).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('resets to default values', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} settings={{ period: 20 }} />)
    
    const periodInput = screen.getByLabelText(/period/i) as HTMLInputElement
    expect(periodInput.value).toBe('20')
    
    await user.click(screen.getByText('Reset to Default'))
    
    expect(periodInput.value).toBe('14')
  })

  it('disables apply button when validation fails', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, '0')
    
    const applyButton = screen.getByText('Apply')
    expect(applyButton).toBeDisabled()
  })

  it('enables apply button when all validations pass', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, '25')
    
    const applyButton = screen.getByText('Apply')
    expect(applyButton).not.toBeDisabled()
  })

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    // Press Escape to close
    await user.keyboard('{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows tooltips for settings', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const helpIcon = screen.getByLabelText(/help/i)
    await user.hover(helpIcon)
    
    expect(screen.getByText(/number of periods used to calculate/i)).toBeInTheDocument()
  })

  it('preserves unsaved changes warning', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, '25')
    
    // Try to close without saving
    await user.click(screen.getByText('Cancel'))
    
    // Should show confirmation dialog
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    
    // Confirm discard
    await user.click(screen.getByText('Discard'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('supports custom indicator types', () => {
    const customProps = {
      ...defaultProps,
      indicator: 'BOLLINGER_BANDS' as IndicatorType,
      settings: { period: 20, standardDeviations: 2 },
    }
    
    render(<IndicatorSettings {...customProps} />)
    
    expect(screen.getByText('BOLLINGER_BANDS Settings')).toBeInTheDocument()
    expect((screen.getByLabelText(/period/i) as HTMLInputElement).value).toBe('20')
    expect((screen.getByLabelText(/standard deviations/i) as HTMLInputElement).value).toBe('2')
  })

  it('handles number input with keyboard', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    periodInput.focus()
    
    // Arrow up should increase value
    await user.keyboard('{ArrowUp}')
    expect((periodInput as HTMLInputElement).value).toBe('15')
    
    // Arrow down should decrease value
    await user.keyboard('{ArrowDown}')
    expect((periodInput as HTMLInputElement).value).toBe('14')
  })

  it('prevents non-numeric input', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, 'abc')
    
    expect((periodInput as HTMLInputElement).value).toBe('')
  })

  it('applies settings on Enter key', async () => {
    const user = userEvent.setup()
    render(<IndicatorSettings {...defaultProps} />)
    
    const periodInput = screen.getByLabelText(/period/i)
    await user.clear(periodInput)
    await user.type(periodInput, '30')
    
    await user.keyboard('{Enter}')
    
    expect(defaultProps.onSettingsChange).toHaveBeenCalledWith({ period: 30 })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})