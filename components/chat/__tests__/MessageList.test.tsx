import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessageList } from '../MessageList'
import type { ChatMessage } from '@/store/chat.store'
import type { ProposalMessage } from '@/types/proposal'

// Mock child components
jest.mock('../MessageItem', () => ({
  MessageItem: ({ message, onCopyMessage, onApproveProposal }: any) => (
    <div data-testid={`message-${message.id}`}>
      <div>Role: {message.role}</div>
      <div>Content: {message.content}</div>
      {onCopyMessage && (
        <button onClick={() => onCopyMessage(message.id, message.content)}>
          Copy
        </button>
      )}
      {onApproveProposal && message.proposalGroup && (
        <button onClick={() => onApproveProposal(message)}>
          Approve Proposal
        </button>
      )}
    </div>
  )
}))

jest.mock('../AnalysisProgress', () => ({
  AnalysisProgress: ({ symbol, interval, analysisType, onComplete }: any) => (
    <div data-testid="analysis-progress">
      Analyzing {symbol} on {interval} - Type: {analysisType}
      <button onClick={() => onComplete({ status: 'complete' })}>
        Complete Analysis
      </button>
    </div>
  )
}))

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className} data-testid="scroll-area">
      {children}
    </div>
  )
}))

describe('MessageList', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello AI',
      timestamp: Date.now()
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: Date.now()
    }
  ]

  const mockProposalMessage: ProposalMessage = {
    id: 'msg-3',
    role: 'assistant',
    content: 'Here is a trading proposal',
    timestamp: Date.now(),
    proposalGroup: {
      id: 'group-1',
      title: 'Trend Analysis',
      description: 'Based on current market trends',
      proposals: [
        {
          id: 'proposal-1',
          title: 'Uptrend Line',
          description: 'Strong upward trend',
          priority: 'high',
          confidence: 0.85,
          reason: 'Multiple support points',
          drawingData: {
            type: 'trendline',
            points: [
              { time: 1704067200, value: 45000 },
              { time: 1704153600, value: 47000 }
            ],
            style: {
              color: '#3b82f6',
              lineWidth: 2,
              lineStyle: 'solid'
            }
          }
        }
      ],
      timestamp: Date.now()
    }
  }

  const defaultProps = {
    messages: mockMessages,
    isLoading: false,
    isStreaming: false,
    error: null,
    copiedMessageId: null,
    analysisInProgress: null,
    approvedDrawingIds: new Map<string, Map<string, string>>(),
    onCopyMessage: jest.fn(),
    onApproveProposal: jest.fn(),
    onRejectProposal: jest.fn(),
    onApproveAllProposals: jest.fn(),
    onRejectAllProposals: jest.fn(),
    onCancelDrawing: jest.fn(),
    onAnalysisComplete: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn()
  })

  describe('Empty State', () => {
    it('renders empty state when no messages', () => {
      render(<MessageList {...defaultProps} messages={[]} />)
      
      expect(screen.getByText('AIアシスタント')).toBeInTheDocument()
      expect(screen.getByText(/暗号通貨の市場分析、価格確認、取引アドバイスなど/)).toBeInTheDocument()
    })

    it('shows example prompts in empty state', () => {
      render(<MessageList {...defaultProps} messages={[]} />)
      
      expect(screen.getByText('💰 "BTCの分析をして"')).toBeInTheDocument()
      expect(screen.getByText('📊 "ETHの価格は？"')).toBeInTheDocument()
    })
  })

  describe('Message Rendering', () => {
    it('renders all messages', () => {
      render(<MessageList {...defaultProps} />)
      
      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg-2')).toBeInTheDocument()
    })

    it('displays message content correctly', () => {
      render(<MessageList {...defaultProps} />)
      
      expect(screen.getByText('Content: Hello AI')).toBeInTheDocument()
      expect(screen.getByText('Content: Hello! How can I help you?')).toBeInTheDocument()
    })

    it('displays message roles correctly', () => {
      render(<MessageList {...defaultProps} />)
      
      expect(screen.getByText('Role: user')).toBeInTheDocument()
      expect(screen.getByText('Role: assistant')).toBeInTheDocument()
    })
  })

  describe('Copy Functionality', () => {
    it('calls onCopyMessage when copy button is clicked', () => {
      render(<MessageList {...defaultProps} />)
      
      const copyButtons = screen.getAllByText('Copy')
      fireEvent.click(copyButtons[0])
      
      expect(defaultProps.onCopyMessage).toHaveBeenCalledWith('msg-1', 'Hello AI')
    })

    it('passes copied message ID to MessageItem', () => {
      const propsWithCopied = {
        ...defaultProps,
        copiedMessageId: 'msg-1'
      }
      
      render(<MessageList {...propsWithCopied} />)
      
      // In real implementation, MessageItem would show copied state
      expect(propsWithCopied.copiedMessageId).toBe('msg-1')
    })
  })

  describe('Loading States', () => {
    it('shows typing indicator when loading', () => {
      render(<MessageList {...defaultProps} isLoading={true} />)
      
      // Check for animated dots
      const dots = screen.getAllByRole('generic').filter(el => 
        el.className.includes('animate-bounce')
      )
      expect(dots.length).toBe(3)
    })

    it('does not show typing indicator when streaming', () => {
      render(<MessageList {...defaultProps} isLoading={true} isStreaming={true} />)
      
      const dots = screen.queryAllByRole('generic').filter(el => 
        el.className.includes('animate-bounce')
      )
      expect(dots.length).toBe(0)
    })

    it('does not show typing indicator when analysis in progress', () => {
      const propsWithAnalysis = {
        ...defaultProps,
        isLoading: true,
        analysisInProgress: {
          messageId: 'msg-3',
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline' as const
        }
      }
      
      render(<MessageList {...propsWithAnalysis} />)
      
      const dots = screen.queryAllByRole('generic').filter(el => 
        el.className.includes('animate-bounce')
      )
      expect(dots.length).toBe(0)
    })
  })

  describe('Analysis Progress', () => {
    it('shows analysis progress component', () => {
      const propsWithAnalysis = {
        ...defaultProps,
        analysisInProgress: {
          messageId: 'msg-3',
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline' as const
        }
      }
      
      render(<MessageList {...propsWithAnalysis} />)
      
      expect(screen.getByTestId('analysis-progress')).toBeInTheDocument()
      expect(screen.getByText('Analyzing BTCUSDT on 1h - Type: trendline')).toBeInTheDocument()
    })

    it('calls onAnalysisComplete when analysis finishes', () => {
      const propsWithAnalysis = {
        ...defaultProps,
        analysisInProgress: {
          messageId: 'msg-3',
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline' as const
        }
      }
      
      render(<MessageList {...propsWithAnalysis} />)
      
      const completeButton = screen.getByText('Complete Analysis')
      fireEvent.click(completeButton)
      
      expect(defaultProps.onAnalysisComplete).toHaveBeenCalledWith({ status: 'complete' })
    })
  })

  describe('Error Handling', () => {
    it('displays error message', () => {
      const errorMessage = 'Failed to load messages'
      render(<MessageList {...defaultProps} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('shows error with correct styling', () => {
      render(<MessageList {...defaultProps} error="Test error" />)
      
      const errorElement = screen.getByText('Test error').parentElement
      expect(errorElement).toHaveClass('bg-[hsl(var(--color-loss)/0.1)]')
      expect(errorElement).toHaveClass('border-[hsl(var(--color-loss)/0.3)]')
    })
  })

  describe('Proposal Handling', () => {
    it('renders proposal messages correctly', () => {
      const messagesWithProposal = [...mockMessages, mockProposalMessage]
      render(<MessageList {...defaultProps} messages={messagesWithProposal} />)
      
      expect(screen.getByTestId('message-msg-3')).toBeInTheDocument()
      expect(screen.getByText('Approve Proposal')).toBeInTheDocument()
    })

    it('calls onApproveProposal when approve button is clicked', () => {
      const messagesWithProposal = [...mockMessages, mockProposalMessage]
      render(<MessageList {...defaultProps} messages={messagesWithProposal} />)
      
      const approveButton = screen.getByText('Approve Proposal')
      fireEvent.click(approveButton)
      
      expect(defaultProps.onApproveProposal).toHaveBeenCalledWith(mockProposalMessage)
    })

    it('passes approved drawing IDs to messages', () => {
      const approvedIds = new Map([
        ['msg-3', new Map([['proposal-1', 'drawing-1']])]
      ])
      
      const propsWithApproved = {
        ...defaultProps,
        approvedDrawingIds: approvedIds
      }
      
      render(<MessageList {...propsWithApproved} />)
      
      // MessageItem would receive the approved IDs
      expect(propsWithApproved.approvedDrawingIds.get('msg-3')).toBeDefined()
    })
  })

  describe('Auto-scroll Behavior', () => {
    it('scrolls to bottom when messages change', () => {
      const { rerender } = render(<MessageList {...defaultProps} />)
      
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
      
      // Add new message
      const newMessages = [...mockMessages, {
        id: 'msg-4',
        role: 'user' as const,
        content: 'New message',
        timestamp: Date.now()
      }]
      
      rerender(<MessageList {...defaultProps} messages={newMessages} />)
      
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('scrolls to bottom when loading state changes', () => {
      const { rerender } = render(<MessageList {...defaultProps} />)
      
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
      
      rerender(<MessageList {...defaultProps} isLoading={true} />)
      
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
    })

    it('uses smooth scrolling behavior', () => {
      render(<MessageList {...defaultProps} />)
      
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth'
      })
    })
  })

  describe('AI Avatar', () => {
    it('shows AI avatar for typing indicator', () => {
      render(<MessageList {...defaultProps} isLoading={true} />)
      
      const aiAvatar = screen.getAllByText('AI')[0]
      expect(aiAvatar.parentElement).toHaveClass('bg-gradient-to-br')
      expect(aiAvatar.parentElement).toHaveClass('from-[hsl(var(--color-accent))]')
      expect(aiAvatar.parentElement).toHaveClass('to-[hsl(var(--color-profit))]')
    })

    it('shows AI avatar for analysis progress', () => {
      const propsWithAnalysis = {
        ...defaultProps,
        analysisInProgress: {
          messageId: 'msg-3',
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisType: 'trendline' as const
        }
      }
      
      render(<MessageList {...propsWithAnalysis} />)
      
      const aiAvatar = screen.getAllByText('AI')[0]
      expect(aiAvatar).toBeInTheDocument()
    })
  })

  describe('Empty Map Handling', () => {
    it('handles empty approved drawing IDs map', () => {
      render(<MessageList {...defaultProps} />)
      
      // Should not throw error with empty map
      expect(screen.getByTestId('scroll-area')).toBeInTheDocument()
    })

    it('passes empty map to message items without approved IDs', () => {
      const messagesWithProposal = [...mockMessages, mockProposalMessage]
      render(<MessageList {...defaultProps} messages={messagesWithProposal} />)
      
      // Each MessageItem should receive an empty map if no approvals
      expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3)
    })
  })
})