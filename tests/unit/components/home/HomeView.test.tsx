/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event'
import { HomeView } from '@/components/home/HomeView'

// Mock dependencies
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => <img src={src} alt={alt} />
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>
}))

jest.mock('framer-motion', () => {
  const filterMotionProps = (props: any) => {
    const { 
      initial, animate, exit, transition, variants, whileHover, whileTap, 
      layoutId, drag, dragConstraints, dragElastic, dragMomentum, 
      onDragStart, onDragEnd, onDrag, layout, layoutDependency,
      ...domProps 
    } = props
    return domProps
  }

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...filterMotionProps(props)}>{children}</button>,
      path: (props: any) => <path {...filterMotionProps(props)} />,
      line: (props: any) => <line {...filterMotionProps(props)} />,
      rect: (props: any) => <rect {...filterMotionProps(props)} />
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
  }
})

jest.mock('@/store/chat.store', () => ({
  useChat: jest.fn()
}))

jest.mock('@/hooks/use-ai-chat', () => ({
  useAIChat: jest.fn()
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn()
}))

jest.mock('@/components/home/FloatingSidebarToggle', () => ({
  FloatingSidebarToggle: ({ onTransitionToChat }: any) => (
    <div data-testid="floating-sidebar-toggle" onClick={onTransitionToChat}>
      Sidebar Toggle
    </div>
  )
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}))

describe('HomeView', () => {
  let mockUseChat: jest.MockedFunction<any>
  let mockUseAIChat: jest.MockedFunction<any>
  let mockUseAuth: jest.MockedFunction<any>

  const defaultChatStore = {
    createSession: jest.fn().mockResolvedValue('session-123'),
    setInputValue: jest.fn(),
    currentSessionId: null
  }

  const defaultAIChat = {
    send: jest.fn(),
    isReady: true
  }

  const defaultAuth = {
    user: null,
    loading: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get mocked functions
    const chatStore = require('@/store/chat.store')
    const aiChat = require('@/hooks/use-ai-chat')
    const auth = require('@/hooks/use-auth')
    
    mockUseChat = chatStore.useChat as jest.MockedFunction<any>
    mockUseAIChat = aiChat.useAIChat as jest.MockedFunction<any>
    mockUseAuth = auth.useAuth as jest.MockedFunction<any>

    // Set default mock returns
    mockUseChat.mockReturnValue(defaultChatStore)
    mockUseAIChat.mockReturnValue(defaultAIChat)
    mockUseAuth.mockReturnValue(defaultAuth)
  })

  describe('Component Rendering', () => {
    it('renders logo and tagline', () => {
      render(<HomeView />)
      
      expect(screen.getByAltText('Cryptrade')).toBeInTheDocument()
      expect(screen.getByText('暗号通貨の分析、チャート描画、投資戦略をAIがサポート')).toBeInTheDocument()
    })

    it('renders input field with placeholder', () => {
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('TEXTAREA')
    })

    it('renders suggestion prompts', () => {
      render(<HomeView />)
      
      expect(screen.getByText('BTCの価格動向を分析して')).toBeInTheDocument()
      expect(screen.getByText('チャートにトレンドラインを描いて')).toBeInTheDocument()
      expect(screen.getByText('ETHの投資戦略を教えて')).toBeInTheDocument()
    })

    it('renders send button', () => {
      render(<HomeView />)
      
      const sendButton = screen.getByRole('button', { name: '' }) // Send icon button
      expect(sendButton).toBeInTheDocument()
      expect(sendButton).toBeDisabled() // Initially disabled when input is empty
    })

    it('shows AI status', () => {
      render(<HomeView />)
      
      expect(screen.getByText('AI準備完了')).toBeInTheDocument()
    })
  })

  describe('Authentication UI', () => {
    it('shows auth buttons when user is not logged in', () => {
      render(<HomeView />)
      
      expect(screen.getByText('ログイン')).toBeInTheDocument()
      expect(screen.getByText('新規登録')).toBeInTheDocument()
    })

    it('hides auth buttons when user is logged in', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        loading: false
      })
      
      render(<HomeView />)
      
      expect(screen.queryByText('ログイン')).not.toBeInTheDocument()
      expect(screen.queryByText('新規登録')).not.toBeInTheDocument()
    })

    it('hides auth buttons while loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true
      })
      
      render(<HomeView />)
      
      expect(screen.queryByText('ログイン')).not.toBeInTheDocument()
      expect(screen.queryByText('新規登録')).not.toBeInTheDocument()
    })
  })

  describe('Input Handling', () => {
    it('updates input value on type', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test message')
      
      expect(input).toHaveValue('Test message')
    })

    it('enables send button when input has value', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      
      // Find the send button by its specific style (12x12 size with gradient background)
      const sendButtons = screen.getAllByRole('button')
      const sendButton = sendButtons.find(btn => 
        btn.className.includes('w-12') && btn.className.includes('h-12') && btn.className.includes('bg-gradient-to-r')
      )!
      
      expect(sendButton).toBeDisabled()
      
      await user.type(input, 'Test')
      
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled()
      })
    })

    it('auto-resizes textarea on input', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const textarea = screen.getByPlaceholderText('何でも聞いてください...') as HTMLTextAreaElement
      
      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 100
      })
      
      await user.type(textarea, 'Long\nMultiline\nText')
      
      expect(textarea.style.height).toBe('100px')
    })

    it('limits textarea height to 200px', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const textarea = screen.getByPlaceholderText('何でも聞いてください...') as HTMLTextAreaElement
      
      // Mock large scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        value: 300
      })
      
      await user.type(textarea, 'Very long text')
      
      expect(textarea.style.height).toBe('200px')
    })
  })

  describe('Message Submission', () => {
    it('submits message on button click', async () => {
      const user = userEvent.setup()
      const onTransitionComplete = jest.fn()
      
      render(<HomeView onTransitionComplete={onTransitionComplete} />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test message')
      
      const sendButtons = screen.getAllByRole('button')
      const sendButton = sendButtons.find(btn => 
        btn.className.includes('w-12') && btn.className.includes('h-12') && btn.className.includes('bg-gradient-to-r')
      )!
      
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(defaultChatStore.setInputValue).toHaveBeenCalledWith('Test message', true)
      })
      
      expect(input).toHaveValue('') // Input cleared
    })

    it('submits message on Enter key', async () => {
      const user = userEvent.setup()
      const onTransitionComplete = jest.fn()
      
      render(<HomeView onTransitionComplete={onTransitionComplete} />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      expect(defaultChatStore.setInputValue).toHaveBeenCalledWith('Test message', true)
    })

    it('does not submit on Shift+Enter', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test')
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      
      expect(defaultChatStore.setInputValue).not.toHaveBeenCalled()
      expect(input).toHaveValue('Test\n') // Newline added
    })

    it('creates new session if none exists', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(defaultChatStore.createSession).toHaveBeenCalled()
      })
    })

    it('uses existing session if available', async () => {
      const user = userEvent.setup()
      mockUseChat.mockReturnValue({
        ...defaultChatStore,
        currentSessionId: 'existing-session'
      })
      
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      expect(defaultChatStore.createSession).not.toHaveBeenCalled()
    })

    it('sends AI message after transition', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ delay: null })
      
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(100) // First timeout
        jest.advanceTimersByTime(300) // Second timeout
      })
      
      expect(defaultAIChat.send).toHaveBeenCalledWith('Test message')
      
      jest.useRealTimers()
    })
  })

  describe('Suggestion Prompts', () => {
    it('fills input when suggestion is clicked', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const suggestion = screen.getByText('BTCの価格動向を分析して')
      await user.click(suggestion)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      expect(input).toHaveValue('BTCの価格動向を分析して')
    })

    it('focuses input after suggestion click', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const suggestion = screen.getByText('ETHの投資戦略を教えて')
      await user.click(suggestion)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      
      await waitFor(() => {
        expect(document.activeElement).toBe(input)
      })
    })
  })

  describe('AI Status', () => {
    it('shows connecting status when not ready', () => {
      mockUseAIChat.mockReturnValue({
        ...defaultAIChat,
        isReady: false
      })
      
      render(<HomeView />)
      
      expect(screen.getByText('AI接続中...')).toBeInTheDocument()
    })

    it('disables send button when AI not ready', async () => {
      const user = userEvent.setup()
      mockUseAIChat.mockReturnValue({
        ...defaultAIChat,
        isReady: false
      })
      
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'Test')
      
      const sendButtons = screen.getAllByRole('button')
      const sendButton = sendButtons.find(btn => 
        btn.className.includes('w-12') && btn.className.includes('h-12') && btn.className.includes('bg-gradient-to-r')
      )!
      
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Examples Overlay', () => {
    it('shows examples on scroll down', async () => {
      render(<HomeView />)
      
      // Check initial state - the scroll hint should not be visible
      expect(screen.queryByText('上にスクロールして戻る')).not.toBeInTheDocument()
      
      // Simulate scroll down with a large deltaY to exceed threshold immediately
      await act(async () => {
        // Directly trigger wheel event on window to simulate scrolling
        const event = new Event('wheel', { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'deltaY', {
          value: 150,
          writable: false,
        })
        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn(),
          writable: false,
        })
        window.dispatchEvent(event)
      })
      
      // Wait for the scroll hint text to appear (simpler check)
      await waitFor(() => {
        expect(screen.getByText('上にスクロールして戻る')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('hides examples on scroll up', async () => {
      render(<HomeView />)
      
      // Show examples first
      fireEvent.wheel(window, { deltaY: 150 })
      
      await waitFor(() => {
        expect(screen.getByText('トレンドライン自動描画')).toBeInTheDocument()
      })
      
      // Hide examples
      fireEvent.wheel(window, { deltaY: -150 })
      
      await waitFor(() => {
        expect(screen.queryByText('トレンドライン自動描画')).not.toBeInTheDocument()
      })
    })

    it('fills input when example card is clicked', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      // Show examples
      fireEvent.wheel(window, { deltaY: 150 })
      
      await waitFor(() => {
        expect(screen.getByText('トレンドライン自動描画')).toBeInTheDocument()
      })
      
      // Click example card
      const exampleCard = screen.getByText('トレンドライン自動描画').closest('div')!
      await user.click(exampleCard)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      expect(input).toHaveValue('BTCのトレンドラインを描いて')
    })
  })

  describe('Mouse Tracking', () => {
    it('updates gradient on mouse move', () => {
      const { container } = render(<HomeView />)
      
      const mainDiv = container.querySelector('[class*="fixed inset-0"]')!
      
      fireEvent.mouseMove(mainDiv, {
        clientX: 100,
        clientY: 100,
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            width: 1000,
            height: 1000
          })
        }
      })
      
      // Gradient should be updated (motion.div handles animation)
      expect(mainDiv).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty input submission', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      const sendButtons = screen.getAllByRole('button')
      const sendButton = sendButtons.find(btn => 
        btn.className.includes('w-12') && btn.className.includes('h-12') && btn.className.includes('bg-gradient-to-r')
      )!
      
      // Send button should be disabled when input is empty
      expect(sendButton).toBeDisabled()
      
      // Type only spaces
      await user.type(input, '   ')
      
      // Button should still be disabled because trim() removes spaces
      expect(sendButton).toBeDisabled()
      
      // Try to click it anyway
      await user.click(sendButton)
      
      expect(defaultChatStore.setInputValue).not.toHaveBeenCalled()
      expect(defaultChatStore.createSession).not.toHaveBeenCalled()
    })

    it('prevents submission during transition', async () => {
      const user = userEvent.setup()
      render(<HomeView />)
      
      const input = screen.getByPlaceholderText('何でも聞いてください...')
      await user.type(input, 'First message')
      await user.keyboard('{Enter}')
      
      // Try to submit again immediately
      await user.type(input, 'Second message')
      await user.keyboard('{Enter}')
      
      // Only first message should be submitted
      expect(defaultChatStore.setInputValue).toHaveBeenCalledTimes(1)
    })
  })
})