import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageItem } from '../MessageItem'
import type { ChatMessage } from '@/store/chat.store'
import type { ProposalMessage } from '@/types/proposal'

// Mock child components
jest.mock('../ProposalCard', () => ({
  ProposalCard: ({ proposalGroup, onApprove }: any) => (
    <div data-testid="proposal-card">
      Proposal Card - {proposalGroup.title}
      <button onClick={() => onApprove && onApprove('proposal-1')}>
        Approve Proposal
      </button>
    </div>
  )
}))

jest.mock('../AnalysisResultCard', () => ({
  AnalysisResultCard: ({ data }: any) => (
    <div data-testid="analysis-result-card">
      Analysis Result - {data.symbol}
    </div>
  )
}))

// Mock utilities
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}))

jest.mock('@/lib/utils/parse-analysis', () => ({
  parseAnalysisText: (text: string) => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    analyses: []
  }),
  isAnalysisMessage: (text: string) => text.includes('分析結果')
}))

describe('MessageItem', () => {
  const defaultProps = {
    message: {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello AI',
      timestamp: Date.now()
    },
    copiedMessageId: null,
    approvedDrawingIds: new Map<string, string>(),
    onCopyMessage: jest.fn(),
    onApproveProposal: jest.fn(),
    onRejectProposal: jest.fn(),
    onApproveAllProposals: jest.fn(),
    onRejectAllProposals: jest.fn(),
    onCancelDrawing: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('User Messages', () => {
    it('renders user message with correct styling', () => {
      render(<MessageItem {...defaultProps} />)
      
      expect(screen.getByText('Hello AI')).toBeInTheDocument()
      const messageDiv = screen.getByText('Hello AI')
      expect(messageDiv).toHaveClass('whitespace-pre-wrap')
    })

    it('shows copy button on hover', () => {
      render(<MessageItem {...defaultProps} />)
      
      const copyButton = screen.getByRole('button')
      expect(copyButton).toHaveClass('opacity-0')
      expect(copyButton).toHaveClass('group-hover:opacity-100')
    })

    it('calls onCopyMessage when copy button is clicked', () => {
      render(<MessageItem {...defaultProps} />)
      
      const copyButton = screen.getByRole('button')
      fireEvent.click(copyButton)
      
      expect(defaultProps.onCopyMessage).toHaveBeenCalledWith('msg-1', 'Hello AI')
    })

    it('shows check icon when message is copied', () => {
      const propsWithCopied = {
        ...defaultProps,
        copiedMessageId: 'msg-1'
      }
      
      render(<MessageItem {...propsWithCopied} />)
      
      // Check icon should be visible
      const copyButton = screen.getByRole('button')
      expect(copyButton.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Assistant Messages', () => {
    const assistantMessage: ChatMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: Date.now()
    }

    it('renders assistant message with AI avatar', () => {
      render(<MessageItem {...defaultProps} message={assistantMessage} />)
      
      expect(screen.getByText('AI')).toBeInTheDocument()
      expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument()
    })

    it('renders HTML content correctly', () => {
      const htmlMessage = {
        ...assistantMessage,
        content: '<p>This is <strong>bold</strong> text</p>'
      }
      
      render(<MessageItem {...defaultProps} message={htmlMessage} />)
      
      // Check that HTML is rendered
      const strongElement = screen.getByText('bold')
      expect(strongElement.tagName).toBe('STRONG')
      expect(strongElement.parentElement?.tagName).toBe('P')
    })

    it('strips HTML tags when copying', () => {
      const htmlMessage = {
        ...assistantMessage,
        content: '<p>This is <strong>bold</strong> text</p>'
      }
      
      render(<MessageItem {...defaultProps} message={htmlMessage} />)
      
      const copyButton = screen.getByRole('button')
      fireEvent.click(copyButton)
      
      expect(defaultProps.onCopyMessage).toHaveBeenCalledWith(
        'msg-2',
        'This is bold text'
      )
    })
  })

  describe('Proposal Messages', () => {
    const proposalMessage: ProposalMessage = {
      id: 'msg-3',
      role: 'assistant',
      type: 'proposal',
      content: 'Here is a trading proposal',
      timestamp: Date.now(),
      proposalGroup: {
        id: 'group-1',
        title: 'Trend Analysis',
        description: 'Based on current market trends',
        proposals: [],
        timestamp: Date.now()
      }
    }

    it('renders ProposalCard for proposal messages', () => {
      render(<MessageItem {...defaultProps} message={proposalMessage} />)
      
      expect(screen.getByTestId('proposal-card')).toBeInTheDocument()
      expect(screen.getByText('Proposal Card - Trend Analysis')).toBeInTheDocument()
    })

    it('passes handlers to ProposalCard', () => {
      render(<MessageItem {...defaultProps} message={proposalMessage} />)
      
      const approveButton = screen.getByText('Approve Proposal')
      fireEvent.click(approveButton)
      
      expect(defaultProps.onApproveProposal).toHaveBeenCalledWith(
        proposalMessage,
        'proposal-1'
      )
    })

    it('passes approved drawing IDs to ProposalCard', () => {
      const approvedIds = new Map([['proposal-1', 'drawing-1']])
      
      render(
        <MessageItem
          {...defaultProps}
          message={proposalMessage}
          approvedDrawingIds={approvedIds}
        />
      )
      
      expect(screen.getByTestId('proposal-card')).toBeInTheDocument()
    })
  })

  describe('JSON Proposal Handling', () => {
    it('renders ProposalCard for JSON proposal data', () => {
      const jsonProposalMessage = {
        id: 'msg-4',
        role: 'assistant' as const,
        content: JSON.stringify({
          type: 'proposalGroup',
          data: {
            id: 'group-2',
            title: 'JSON Proposal',
            description: 'From JSON data',
            proposals: [],
            timestamp: Date.now()
          }
        }),
        timestamp: Date.now()
      }
      
      render(<MessageItem {...defaultProps} message={jsonProposalMessage} />)
      
      expect(screen.getByTestId('proposal-card')).toBeInTheDocument()
      expect(screen.getByText('Proposal Card - JSON Proposal')).toBeInTheDocument()
    })

    it('handles malformed JSON gracefully', () => {
      const malformedMessage = {
        id: 'msg-5',
        role: 'assistant' as const,
        content: '{"type":"proposalGroup", invalid json}',
        timestamp: Date.now()
      }
      
      render(<MessageItem {...defaultProps} message={malformedMessage} />)
      
      // Should render as regular message
      expect(screen.queryByTestId('proposal-card')).not.toBeInTheDocument()
      expect(screen.getByText(/type.*proposalGroup/)).toBeInTheDocument()
    })
  })

  describe('Analysis Messages', () => {
    it('renders AnalysisResultCard for analysis messages', () => {
      const analysisMessage = {
        id: 'msg-6',
        role: 'assistant' as const,
        content: '分析結果: BTCUSDT の詳細分析',
        timestamp: Date.now()
      }
      
      render(<MessageItem {...defaultProps} message={analysisMessage} />)
      
      expect(screen.getByTestId('analysis-result-card')).toBeInTheDocument()
      expect(screen.getByText('Analysis Result - BTCUSDT')).toBeInTheDocument()
    })
  })

  describe('Memoization', () => {
    it('does not re-render when props are unchanged', () => {
      const { rerender } = render(<MessageItem {...defaultProps} />)
      
      const initialContent = screen.getByText('Hello AI')
      
      // Re-render with same props
      rerender(<MessageItem {...defaultProps} />)
      
      // Element should be the same instance
      expect(screen.getByText('Hello AI')).toBe(initialContent)
    })

    it('re-renders when message content changes', () => {
      const { rerender } = render(<MessageItem {...defaultProps} />)
      
      expect(screen.getByText('Hello AI')).toBeInTheDocument()
      
      // Change message content
      const updatedProps = {
        ...defaultProps,
        message: {
          ...defaultProps.message,
          content: 'Updated message'
        }
      }
      
      rerender(<MessageItem {...updatedProps} />)
      
      expect(screen.queryByText('Hello AI')).not.toBeInTheDocument()
      expect(screen.getByText('Updated message')).toBeInTheDocument()
    })

    it('re-renders when copiedMessageId changes', () => {
      const { rerender } = render(<MessageItem {...defaultProps} />)
      
      // Initial render - no check icon
      const copyButton = screen.getByRole('button')
      expect(copyButton.querySelector('[class*="Check"]')).not.toBeInTheDocument()
      
      // Update copiedMessageId
      rerender(<MessageItem {...defaultProps} copiedMessageId="msg-1" />)
      
      // Check icon should now be present
      expect(copyButton.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      const emptyMessage = {
        ...defaultProps.message,
        content: ''
      }
      
      render(<MessageItem {...defaultProps} message={emptyMessage} />)
      
      // Should still render the message container
      expect(screen.getByRole('button')).toBeInTheDocument() // Copy button
    })

    it('handles very long content', () => {
      const longMessage = {
        ...defaultProps.message,
        content: 'A'.repeat(1000)
      }
      
      render(<MessageItem {...defaultProps} message={longMessage} />)
      
      const content = screen.getByText(/A{50,}/)
      expect(content).toBeInTheDocument()
      expect(content).toHaveClass('whitespace-pre-wrap')
    })

    it('handles special characters in content', () => {
      const specialMessage = {
        ...defaultProps.message,
        content: 'Hello <script>alert("XSS")</script> & "quotes" \'single\''
      }
      
      render(<MessageItem {...defaultProps} message={specialMessage} />)
      
      // For user messages, special characters should be rendered as-is
      expect(screen.getByText(/Hello.*script.*alert/)).toBeInTheDocument()
    })
  })
})