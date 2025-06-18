import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainLayout } from '@/components/MainLayout'
import { useRouter } from 'next/navigation'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: jest.fn(() => false), // Default to desktop
}))

jest.mock('@/components/chart/core/CandlestickChart', () => ({
  CandlestickChart: () => <div data-testid="candlestick-chart">Chart</div>
}))

jest.mock('@/components/chat/ChatPanel', () => ({
  ChatPanel: ({ isOpen }: any) => (
    <div data-testid="chat-panel" data-open={isOpen}>Chat Panel</div>
  )
}))

jest.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children, ...props }: any) => (
    <div data-testid="resizable-panel-group" {...props}>{children}</div>
  ),
  ResizablePanel: ({ children, ...props }: any) => (
    <div data-testid="resizable-panel" {...props}>{children}</div>
  ),
  ResizableHandle: (props: any) => (
    <div data-testid="resizable-handle" {...props} />
  ),
}))

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('MainLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    } as any)
  })

  it('renders main layout structure', () => {
    render(<MainLayout />)
    
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('displays navigation header', () => {
    render(<MainLayout />)
    
    expect(screen.getByText(/cryptrade/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('toggles chat panel visibility', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const chatPanel = screen.getByTestId('chat-panel')
    const toggleButton = screen.getByRole('button', { name: /toggle chat/i })
    
    // Chat should be open by default
    expect(chatPanel).toHaveAttribute('data-open', 'true')
    
    // Click to close
    await user.click(toggleButton)
    expect(chatPanel).toHaveAttribute('data-open', 'false')
    
    // Click to open again
    await user.click(toggleButton)
    expect(chatPanel).toHaveAttribute('data-open', 'true')
  })

  it('handles responsive layout on mobile', async () => {
    const { useMediaQuery } = require('@/hooks/use-media-query')
    useMediaQuery.mockReturnValue(true) // Mobile view
    
    render(<MainLayout />)
    
    // On mobile, should show mobile-specific layout
    expect(screen.getByTestId('mobile-layout')).toBeInTheDocument()
    expect(screen.queryByTestId('resizable-panel-group')).not.toBeInTheDocument()
  })

  it('shows indicator toolbar', () => {
    render(<MainLayout />)
    
    expect(screen.getByRole('button', { name: /add indicator/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /drawing tools/i })).toBeInTheDocument()
  })

  it('handles symbol selection', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const symbolSelector = screen.getByRole('combobox', { name: /select symbol/i })
    await user.click(symbolSelector)
    
    // Should show symbol options
    await waitFor(() => {
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument()
      expect(screen.getByText('ETHUSDT')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('ETHUSDT'))
    expect(symbolSelector).toHaveTextContent('ETHUSDT')
  })

  it('handles timeframe selection', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const timeframeButtons = screen.getAllByRole('button', { name: /[1-9][mhDWM]/ })
    
    // Click on 4H timeframe
    const fourHourButton = timeframeButtons.find(btn => btn.textContent === '4H')
    if (fourHourButton) {
      await user.click(fourHourButton)
      expect(fourHourButton).toHaveClass('active')
    }
  })

  it('opens settings dialog', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    await user.click(screen.getByRole('button', { name: /settings/i }))
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Application Settings')).toBeInTheDocument()
    })
  })

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    // Test chat toggle shortcut (Ctrl/Cmd + /)
    await user.keyboard('{Control>/}')
    
    const chatPanel = screen.getByTestId('chat-panel')
    expect(chatPanel).toHaveAttribute('data-open', 'false')
    
    // Toggle back
    await user.keyboard('{Control>/}')
    expect(chatPanel).toHaveAttribute('data-open', 'true')
  })

  it('preserves layout state on re-render', () => {
    const { rerender } = render(<MainLayout />)
    
    // Initial render
    expect(screen.getByTestId('chat-panel')).toHaveAttribute('data-open', 'true')
    
    // Re-render
    rerender(<MainLayout />)
    
    // State should be preserved
    expect(screen.getByTestId('chat-panel')).toHaveAttribute('data-open', 'true')
  })

  it('shows connection status', () => {
    render(<MainLayout />)
    
    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  it('handles panel resizing', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const resizeHandle = screen.getByTestId('resizable-handle')
    
    // Simulate drag
    await user.pointer([
      { target: resizeHandle, keys: '[MouseLeft>]', coords: { x: 0, y: 0 } },
      { coords: { x: 100, y: 0 } },
      { keys: '[/MouseLeft]' }
    ])
    
    // Panel sizes should update (mocked in this test)
    expect(resizeHandle).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<MainLayout isLoading />)
    
    expect(screen.getByTestId('layout-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('candlestick-chart')).not.toBeInTheDocument()
  })

  it('handles error state', () => {
    render(<MainLayout error="Failed to load market data" />)
    
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Failed to load market data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('supports fullscreen mode', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const fullscreenButton = screen.getByRole('button', { name: /fullscreen/i })
    await user.click(fullscreenButton)
    
    expect(document.body).toHaveClass('fullscreen-mode')
    
    // Exit fullscreen
    await user.click(screen.getByRole('button', { name: /exit fullscreen/i }))
    expect(document.body).not.toHaveClass('fullscreen-mode')
  })

  it('displays market stats', () => {
    render(<MainLayout />)
    
    expect(screen.getByText(/24h volume/i)).toBeInTheDocument()
    expect(screen.getByText(/24h change/i)).toBeInTheDocument()
    expect(screen.getByText(/last price/i)).toBeInTheDocument()
  })

  it('handles theme switching', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const themeToggle = screen.getByRole('button', { name: /toggle theme/i })
    
    // Click to switch theme
    await user.click(themeToggle)
    
    expect(document.documentElement).toHaveClass('dark')
    
    // Switch back
    await user.click(themeToggle)
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('shows account info when authenticated', () => {
    render(<MainLayout isAuthenticated user={{ email: 'test@example.com' }} />)
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  it('shows login button when not authenticated', () => {
    render(<MainLayout isAuthenticated={false} />)
    
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
  })

  it('preserves user preferences', async () => {
    const user = userEvent.setup()
    
    // Mock localStorage
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
    
    render(<MainLayout />)
    
    // Toggle chat panel
    await user.click(screen.getByRole('button', { name: /toggle chat/i }))
    
    // Should save preference
    expect(setItemSpy).toHaveBeenCalledWith('chat-panel-open', 'false')
    
    // Clean up
    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it('handles workspace switching', async () => {
    const user = userEvent.setup()
    render(<MainLayout />)
    
    const workspaceSelector = screen.getByRole('button', { name: /workspace/i })
    await user.click(workspaceSelector)
    
    await waitFor(() => {
      expect(screen.getByText('Trading')).toBeInTheDocument()
      expect(screen.getByText('Analysis')).toBeInTheDocument()
      expect(screen.getByText('Research')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Analysis'))
    
    // Layout should update for analysis workspace
    expect(screen.getByTestId('analysis-layout')).toBeInTheDocument()
  })

  it('supports custom layout configurations', () => {
    const customConfig = {
      panels: {
        chart: { minSize: 40, defaultSize: 60 },
        chat: { minSize: 20, defaultSize: 40 },
      },
      showIndicatorPanel: true,
    }
    
    render(<MainLayout layoutConfig={customConfig} />)
    
    expect(screen.getByTestId('indicator-panel')).toBeInTheDocument()
  })
})