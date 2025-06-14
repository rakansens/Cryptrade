import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageInput } from '../MessageInput'

describe('MessageInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSend: jest.fn(),
    isLoading: false,
    isReady: true,
    placeholder: 'Type a message...'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders textarea with placeholder', () => {
      render(<MessageInput {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      expect(textarea).toBeInTheDocument()
    })

    it('renders send button', () => {
      render(<MessageInput {...defaultProps} />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeInTheDocument()
    })

    it('shows ready status indicator', () => {
      render(<MessageInput {...defaultProps} />)
      
      expect(screen.getByText('AI準備完了')).toBeInTheDocument()
    })

    it('shows connecting status when not ready', () => {
      render(<MessageInput {...defaultProps} isReady={false} />)
      
      expect(screen.getByText('AI接続中...')).toBeInTheDocument()
    })

    it('shows loading indicator when loading', () => {
      render(<MessageInput {...defaultProps} isLoading={true} />)
      
      expect(screen.getByText('分析中...')).toBeInTheDocument()
    })
  })

  describe('Input Handling', () => {
    it('calls onChange when typing', () => {
      render(<MessageInput {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(textarea, { target: { value: 'Hello' } })
      
      expect(defaultProps.onChange).toHaveBeenCalledWith('Hello')
    })

    it('displays controlled value', () => {
      render(<MessageInput {...defaultProps} value="Test message" />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      expect(textarea).toHaveValue('Test message')
    })

    it('auto-resizes textarea on input', () => {
      render(<MessageInput {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement
      
      // Mock scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        writable: true,
        configurable: true,
        value: 100
      })
      
      // Trigger input event
      fireEvent.input(textarea)
      
      expect(textarea.style.height).toBe('100px')
    })

    it('limits textarea height to maximum', () => {
      render(<MessageInput {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement
      
      // Mock large scrollHeight
      Object.defineProperty(textarea, 'scrollHeight', {
        writable: true,
        configurable: true,
        value: 300
      })
      
      // Trigger input event
      fireEvent.input(textarea)
      
      expect(textarea.style.height).toBe('200px') // Max height
    })
  })

  describe('Send Functionality', () => {
    it('calls onSend when send button is clicked', () => {
      render(<MessageInput {...defaultProps} value="Test message" />)
      
      const sendButton = screen.getByRole('button')
      fireEvent.click(sendButton)
      
      expect(defaultProps.onSend).toHaveBeenCalledTimes(1)
    })

    it('calls onSend when Enter is pressed', () => {
      render(<MessageInput {...defaultProps} value="Test message" />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
      
      expect(defaultProps.onSend).toHaveBeenCalledTimes(1)
    })

    it('does not call onSend when Shift+Enter is pressed', () => {
      render(<MessageInput {...defaultProps} value="Test message" />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
      
      expect(defaultProps.onSend).not.toHaveBeenCalled()
    })

    it.skip('prevents default Enter key behavior', () => {
      render(<MessageInput {...defaultProps} value="Test message" />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      
      // Create a mock event with preventDefault
      const mockEvent = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: jest.fn()
      }
      
      fireEvent.keyDown(textarea, mockEvent)
      
      expect(defaultProps.onSend).toHaveBeenCalled()
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('Button States', () => {
    it('disables send button when value is empty', () => {
      render(<MessageInput {...defaultProps} value="" />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeDisabled()
    })

    it('disables send button when value is only whitespace', () => {
      render(<MessageInput {...defaultProps} value="   " />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeDisabled()
    })

    it('enables send button when value has content', () => {
      render(<MessageInput {...defaultProps} value="Hello" />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).not.toBeDisabled()
    })

    it('disables send button when loading', () => {
      render(<MessageInput {...defaultProps} value="Hello" isLoading={true} />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeDisabled()
    })

    it('disables send button when not ready', () => {
      render(<MessageInput {...defaultProps} value="Hello" isReady={false} />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeDisabled()
    })

    it('disables textarea when loading', () => {
      render(<MessageInput {...defaultProps} isLoading={true} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      expect(textarea).toBeDisabled()
    })
  })

  describe('Styling', () => {
    it('applies correct classes to container', () => {
      render(<MessageInput {...defaultProps} />)
      
      const container = screen.getByText('AI準備完了').closest('div')?.parentElement
      expect(container).toHaveClass('flex-shrink-0')
      expect(container).toHaveClass('border-t')
    })

    it('applies gradient styling to send button', () => {
      render(<MessageInput {...defaultProps} />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toHaveClass('bg-gradient-to-r')
      expect(sendButton).toHaveClass('from-[hsl(var(--color-accent))]')
      expect(sendButton).toHaveClass('to-[hsl(var(--color-profit))]')
    })

    it('shows disabled styling when button is disabled', () => {
      render(<MessageInput {...defaultProps} value="" />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toHaveClass('disabled:from-[hsl(var(--text-disabled))]')
      expect(sendButton).toHaveClass('disabled:to-[hsl(var(--text-disabled))]')
    })

    it('shows pulsing animation for status indicator', () => {
      render(<MessageInput {...defaultProps} />)
      
      // Find the status dot by its sibling text
      const statusText = screen.getByText('AI準備完了')
      const statusContainer = statusText.parentElement
      const statusDot = statusContainer?.querySelector('div[class*="rounded-full"]')
      
      expect(statusDot).toHaveClass('animate-pulse')
    })
  })

  describe('Custom Placeholder', () => {
    it('uses default placeholder when not provided', () => {
      const propsWithoutPlaceholder = {
        ...defaultProps,
        placeholder: undefined
      }
      
      render(<MessageInput {...propsWithoutPlaceholder} />)
      
      expect(screen.getByPlaceholderText('メッセージ入力...')).toBeInTheDocument()
    })

    it('uses custom placeholder when provided', () => {
      render(<MessageInput {...defaultProps} placeholder="Ask me anything..." />)
      
      expect(screen.getByPlaceholderText('Ask me anything...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('textarea is focusable', () => {
      render(<MessageInput {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      textarea.focus()
      
      expect(document.activeElement).toBe(textarea)
    })

    it('send button has accessible role', () => {
      render(<MessageInput {...defaultProps} />)
      
      const sendButton = screen.getByRole('button')
      expect(sendButton).toBeInTheDocument()
    })

    it('disabled states are properly communicated', () => {
      render(<MessageInput {...defaultProps} isLoading={true} />)
      
      const textarea = screen.getByPlaceholderText('Type a message...')
      const sendButton = screen.getByRole('button')
      
      expect(textarea).toHaveAttribute('disabled')
      expect(sendButton).toHaveAttribute('disabled')
    })
  })

  describe('Status Indicators', () => {
    it('shows ready indicator with correct color', () => {
      render(<MessageInput {...defaultProps} isReady={true} />)
      
      const statusText = screen.getByText('AI準備完了')
      const statusContainer = statusText.parentElement
      const statusDot = statusContainer?.querySelector('div[class*="rounded-full"]')
      
      expect(statusDot).toHaveClass('bg-[hsl(var(--color-accent))]')
    })

    it('shows not ready indicator with warning color', () => {
      render(<MessageInput {...defaultProps} isReady={false} />)
      
      const statusText = screen.getByText('AI接続中...')
      const statusContainer = statusText.parentElement
      const statusDot = statusContainer?.querySelector('div[class*="rounded-full"]')
      
      expect(statusDot).toHaveClass('bg-[hsl(var(--color-warning))]')
    })

    it('shows both ready and loading status', () => {
      render(<MessageInput {...defaultProps} isReady={true} isLoading={true} />)
      
      expect(screen.getByText('AI準備完了')).toBeInTheDocument()
      expect(screen.getByText('分析中...')).toBeInTheDocument()
    })
  })
})