import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IndicatorPanel from '@/components/chart/indicators/IndicatorPanel'

// Mock lucide-react
jest.mock('lucide-react', () => ({
  X: ({ className }: any) => <span className={className}>X</span>
}))

describe('IndicatorPanel', () => {
  const mockOnClose = jest.fn()
  const mockInitChart = jest.fn(() => jest.fn())

  const defaultProps = {
    title: 'RSI',
    height: 200,
    onClose: mockOnClose,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with title', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    expect(screen.getByText('RSI')).toBeInTheDocument()
  })

  it('renders with auto height', () => {
    render(<IndicatorPanel {...defaultProps} height="auto" />)
    
    const panel = screen.getByTestId('rsi-panel')
    expect(panel).toHaveStyle({ height: '100%' })
  })

  it('renders with numeric height', () => {
    render(<IndicatorPanel {...defaultProps} height={300} />)
    
    const panel = screen.getByTestId('rsi-panel')
    expect(panel).toHaveStyle({ height: '300px' })
  })

  it('shows close button when onClose is provided', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close RSI')
    expect(closeButton).toBeInTheDocument()
  })

  it('does not show close button when onClose is not provided', () => {
    render(<IndicatorPanel title="RSI" height={200} />)
    
    const closeButton = screen.queryByLabelText('Close RSI')
    expect(closeButton).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close RSI')
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders children content', () => {
    render(
      <IndicatorPanel {...defaultProps}>
        <div data-testid="child-content">Child Content</div>
      </IndicatorPanel>
    )
    
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<IndicatorPanel {...defaultProps} className="custom-class" />)
    
    const panel = screen.getByTestId('rsi-panel')
    expect(panel).toHaveClass('custom-class')
  })

  it('generates testid from title', () => {
    render(<IndicatorPanel title="MACD Histogram" height={200} />)
    
    const panel = screen.getByTestId('macd histogram-panel')
    expect(panel).toBeInTheDocument()
  })

  it('uses custom data-testid when provided', () => {
    render(<IndicatorPanel {...defaultProps} data-testid="custom-panel" />)
    
    const panel = screen.getByTestId('custom-panel')
    expect(panel).toBeInTheDocument()
  })

  it('calls initChart with container element', () => {
    render(<IndicatorPanel {...defaultProps} initChart={mockInitChart} />)
    
    expect(mockInitChart).toHaveBeenCalledTimes(1)
    expect(mockInitChart).toHaveBeenCalledWith(expect.any(HTMLDivElement))
  })

  it('calls cleanup function when unmounting', () => {
    const mockCleanup = jest.fn()
    mockInitChart.mockReturnValue(mockCleanup)
    
    const { unmount } = render(<IndicatorPanel {...defaultProps} initChart={mockInitChart} />)
    
    unmount()
    
    expect(mockCleanup).toHaveBeenCalledTimes(1)
  })

  it('handles initChart that returns undefined', () => {
    const mockInitChartNoCleanup = jest.fn(() => undefined)
    
    const { unmount } = render(<IndicatorPanel {...defaultProps} initChart={mockInitChartNoCleanup} />)
    
    // Should not throw when unmounting
    expect(() => unmount()).not.toThrow()
  })

  it('applies correct styling classes', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('rsi-panel')
    expect(panel).toHaveClass('premium-glass-subtle')
    expect(panel).toHaveClass('border-t')
    expect(panel).toHaveClass('flex-col')
    expect(panel).toHaveClass('overflow-hidden')
  })

  it('renders header with correct styling', () => {
    render(<IndicatorPanel {...defaultProps} />)
    
    const header = screen.getByText('RSI').parentElement
    expect(header).toHaveClass('border-b')
    expect(header).toHaveClass('bg-[hsl(var(--glass-bg))]')
  })

  it('applies hover effects to close button', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close RSI')
    
    // Check initial classes
    expect(closeButton).toHaveClass('text-[hsl(var(--text-muted))]')
    
    // Hover effects are applied via CSS, so we just verify the classes exist
    expect(closeButton).toHaveClass('hover:text-[hsl(var(--text-secondary))]')
    expect(closeButton).toHaveClass('hover:bg-[hsl(var(--glass-bg))]')
  })

  it('handles rapid close button clicks', async () => {
    const user = userEvent.setup()
    render(<IndicatorPanel {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close RSI')
    
    // Click multiple times rapidly
    await user.click(closeButton)
    await user.click(closeButton)
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(3)
  })

  it('maintains layout when content changes', () => {
    const { rerender } = render(
      <IndicatorPanel {...defaultProps}>
        <div>Content 1</div>
      </IndicatorPanel>
    )
    
    rerender(
      <IndicatorPanel {...defaultProps}>
        <div>Content 2 with much longer text that might affect layout</div>
      </IndicatorPanel>
    )
    
    const panel = screen.getByTestId('rsi-panel')
    expect(panel).toHaveClass('overflow-hidden')
  })
})