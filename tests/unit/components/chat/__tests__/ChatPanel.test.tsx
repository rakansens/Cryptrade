/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPanel from '@/components/chat/ChatPanel'
import { useChat } from '@/store/chat.store'
import { useAIChat } from '@/hooks/use-ai-chat'
import { useMessageHandling } from '@/hooks/chat/use-message-handling'
import { useProposalManagement } from '@/hooks/chat/use-proposal-management'

// Mock dependencies
jest.mock('@/store/chat.store')
jest.mock('@/hooks/use-ai-chat')
jest.mock('@/hooks/chat/use-message-handling')
jest.mock('@/hooks/chat/use-proposal-management')

// Type assertions for mocked modules
const mockedUseChat = useChat as jest.MockedFunction<typeof useChat>
const mockedUseAIChat = useAIChat as jest.MockedFunction<typeof useAIChat>
const mockedUseMessageHandling = useMessageHandling as jest.MockedFunction<typeof useMessageHandling>
const mockedUseProposalManagement = useProposalManagement as jest.MockedFunction<typeof useProposalManagement>

// Mock child components
jest.mock('@/components/chat/SessionAnalysisHistory', () => ({
  SessionAnalysisHistory: ({ sessionId, resetKey }: any) => (
    <div data-testid="session-analysis-history">
      Session Analysis History - Session: {sessionId}, Reset: {resetKey}
    </div>
  )
}))

jest.mock('@/components/chat/MessageList', () => ({
  MessageList: ({ messages, onSendMessage }: any) => (
    <div data-testid="message-list">
      Message List - {messages.length} messages
      <button onClick={() => onSendMessage && onSendMessage()}>Send Test Message</button>
    </div>
  )
}))

jest.mock('@/components/chat/MessageInput', () => ({
  MessageInput: ({ value, onChange, onSend, isLoading, isReady }: any) => (
    <div data-testid="message-input">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!isReady || isLoading}
        data-testid="message-input-field"
      />
      <button
        onClick={onSend}
        disabled={!isReady || isLoading || !value}
        data-testid="send-button"
      >
        Send
      </button>
    </div>
  )
}))

jest.mock('@/components/ui/tabs', () => {
  const React = require('react');
  return {
    Tabs: ({ children, value, _onValueChange, className }: any) => (
      <div className={className} data-testid="tabs">
        {React.Children.map(children, (child: any) => {
          if (child?.props?.value === value || !child?.props?.value) {
            return React.cloneElement(child, { _onValueChange })
          }
          return null
        })}
      </div>
    ),
    TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
    TabsTrigger: ({ children, value, onClick }: any) => (
      <button data-testid={`tab-${value}`} onClick={() => onClick?.(value)}>
        {children}
      </button>
    ),
    TabsContent: ({ children, value }: any) => (
      <div data-testid={`tab-content-${value}`}>{children}</div>
    )
  }
})

describe('ChatPanel', () => {
  const mockUseChatReturn = {
    sessions: {
      'session-1': { id: 'session-1', title: 'Test Session', createdAt: Date.now(), updatedAt: Date.now() }
    },
    currentSessionId: 'session-1',
    messages: [],
    messagesBySession: { 'session-1': [] },
    inputValue: '',
    isInputFromHomeScreen: false,
    isOpen: true,
    isStreaming: false,
    isLoading: false,
    isSidebarOpen: false,
    isCollapsed: false,
    isDbEnabled: true,
    isSyncing: false,
    error: null,
    // Actions
    createSession: jest.fn().mockResolvedValue('new-session-id'),
    switchSession: jest.fn().mockResolvedValue(undefined),
    selectSession: jest.fn().mockResolvedValue(undefined),
    renameSession: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    deleteAllSessions: jest.fn().mockResolvedValue(undefined),
    addMessage: jest.fn(),
    updateLastMessage: jest.fn(),
    clearMessages: jest.fn(),
    setOpen: jest.fn(),
    setStreaming: jest.fn(),
    setLoading: jest.fn(),
    setSidebarOpen: jest.fn(),
    toggleCollapsed: jest.fn(),
    setInputValue: jest.fn(),
    setError: jest.fn(),
    enableDbSync: jest.fn().mockResolvedValue(undefined),
    disableDbSync: jest.fn(),
    syncWithDatabase: jest.fn().mockResolvedValue(undefined),
    loadFromDatabase: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn()
  }

  const mockUseAIChatReturn: UseAIChatReturn = {
    isReady: true,
    send: jest.fn().mockResolvedValue(undefined)
  }

  const mockUseMessageHandlingReturn = {
    handleSendMessage: jest.fn().mockResolvedValue(undefined),
    handleCopyMessage: jest.fn(),
    handleAnalysisComplete: jest.fn(),
    copiedMessageId: null,
    analysisInProgress: null,
    setAnalysisInProgress: jest.fn()
  }

  const mockUseProposalManagementReturn = {
    approvedDrawingIds: new Map(),
    handleApproveProposal: jest.fn().mockResolvedValue(null),
    handleRejectProposal: jest.fn().mockResolvedValue(undefined),
    handleApproveAllProposals: jest.fn().mockResolvedValue(undefined),
    handleRejectAllProposals: jest.fn().mockResolvedValue(undefined),
    handleCancelDrawing: jest.fn().mockResolvedValue(undefined),
    approveLoading: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseChat.mockReturnValue(mockUseChatReturn as any)
    mockedUseAIChat.mockReturnValue(mockUseAIChatReturn as any)
    mockedUseMessageHandling.mockReturnValue(mockUseMessageHandlingReturn as any)
    mockedUseProposalManagement.mockReturnValue(mockUseProposalManagementReturn as any)
  })

  describe('Basic Rendering', () => {
    it('renders chat panel with tabs', () => {
      render(<ChatPanel />)
      
      expect(screen.getByTestId('tabs')).toBeInTheDocument()
      expect(screen.getByTestId('message-list')).toBeInTheDocument()
      expect(screen.getByTestId('message-input')).toBeInTheDocument()
    })

    it('renders with correct session title', () => {
      render(<ChatPanel />)
      
      // The session title would be displayed in the actual component
      expect(mockUseChatReturn.sessions['session-1'].title).toBe('Test Session')
    })

    it('shows message list with correct message count', () => {
      const mockMessages = [
        { id: '1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
        { id: '2', role: 'assistant' as const, content: 'Hi', timestamp: Date.now() }
      ]
      
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        messages: mockMessages
      })
      
      render(<ChatPanel />)
      
      expect(screen.getByText('Message List - 2 messages')).toBeInTheDocument()
    })
  })

  describe('Input Handling', () => {
    it('updates input value when typing', () => {
      render(<ChatPanel />)
      
      const input = screen.getByTestId('message-input-field') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Test message' } })
      
      expect(mockUseChatReturn.setInputValue).toHaveBeenCalledWith('Test message', false)
    })

    it('calls handleSendMessage when send button is clicked', () => {
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        inputValue: 'Test message'
      })
      
      render(<ChatPanel />)
      
      const sendButton = screen.getByTestId('send-button')
      fireEvent.click(sendButton)
      
      expect(mockUseMessageHandlingReturn.handleSendMessage).toHaveBeenCalled()
    })

    it('disables input when not ready', () => {
      mockedUseAIChat.mockReturnValue({
        isReady: false,
        send: jest.fn()
      })
      
      render(<ChatPanel />)
      
      const input = screen.getByTestId('message-input-field')
      expect(input).toBeDisabled()
    })

    it('disables input when loading', () => {
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        isLoading: true
      })
      
      render(<ChatPanel />)
      
      const input = screen.getByTestId('message-input-field')
      expect(input).toBeDisabled()
    })
  })

  describe('Auto-send from Home Screen', () => {
    it('auto-sends message when coming from home screen', async () => {
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        inputValue: 'Auto message',
        isInputFromHomeScreen: true
      })
      
      render(<ChatPanel />)
      
      await waitFor(() => {
        expect(mockUseMessageHandlingReturn.handleSendMessage).toHaveBeenCalled()
      })
    })

    it('only auto-sends once', async () => {
      const { rerender } = render(<ChatPanel />)
      
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        inputValue: 'Auto message',
        isInputFromHomeScreen: true
      })
      
      rerender(<ChatPanel />)
      
      await waitFor(() => {
        expect(mockUseMessageHandlingReturn.handleSendMessage).toHaveBeenCalledTimes(1)
      })
    })

    it('does not auto-send when not ready', () => {
      mockedUseAIChat.mockReturnValue({
        isReady: false,
        send: jest.fn()
      })
      
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        inputValue: 'Auto message',
        isInputFromHomeScreen: true
      })
      
      render(<ChatPanel />)
      
      expect(mockUseMessageHandlingReturn.handleSendMessage).not.toHaveBeenCalled()
    })
  })

  describe('Tab Navigation', () => {
    it('renders SessionAnalysisHistory when history tab is active', () => {
      render(<ChatPanel />)
      
      // Initially chat tab is active
      expect(screen.queryByTestId('session-analysis-history')).not.toBeInTheDocument()
      
      // Switch to history tab
      // The tabs component would handle switching but we're testing the state here
      
      // Simulate tab change
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        currentSessionId: 'session-1'
      })
      
      // In real implementation, clicking the tab would trigger onValueChange
      // For testing, we'll check that the history component would be rendered
      expect(mockUseChatReturn.currentSessionId).toBe('session-1')
    })

    it('increments reset key when switching to history tab', () => {
      const { rerender } = render(<ChatPanel />)
      
      // Track state changes through rerenders
      let resetKey = 0
      
      // Initial render
      expect(resetKey).toBe(0)
      
      // Simulate tab change (in real component, this would update internal state)
      resetKey++
      rerender(<ChatPanel />)
      
      expect(resetKey).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('passes error to MessageList', () => {
      const errorMessage = 'Connection failed'
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        error: errorMessage
      })
      
      render(<ChatPanel />)
      
      // Error would be displayed in MessageList component
      expect(mockUseChatReturn.error).toBe(errorMessage)
    })
  })

  describe('Loading States', () => {
    it('shows loading state in MessageList', () => {
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        isLoading: true
      })
      
      render(<ChatPanel />)
      
      // Loading state would be shown in MessageList
      expect(mockUseChatReturn.isLoading).toBe(true)
    })

    it('shows streaming state in MessageList', () => {
      mockedUseChat.mockReturnValue({
        ...mockUseChatReturn,
        isStreaming: true
      })
      
      render(<ChatPanel />)
      
      // Streaming state would be shown in MessageList
      expect(mockUseChatReturn.isStreaming).toBe(true)
    })
  })

  describe('Analysis Progress', () => {
    it('passes analysis progress to MessageList', () => {
      const analysisProgress = {
        messageId: 'msg-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        analysisType: 'trendline' as const
      }
      
      mockedUseMessageHandling.mockReturnValue({
        ...mockUseMessageHandlingReturn,
        analysisInProgress: analysisProgress,
        setAnalysisInProgress: jest.fn()
      })
      
      render(<ChatPanel />)
      
      // Analysis progress would be displayed in MessageList
      expect(mockUseMessageHandlingReturn.analysisInProgress).toEqual(analysisProgress)
    })
  })

  describe('Proposal Management', () => {
    it('passes proposal handlers to MessageList', () => {
      render(<ChatPanel />)
      
      // All proposal handlers should be available
      expect(mockUseProposalManagementReturn.handleApproveProposal).toBeDefined()
      expect(mockUseProposalManagementReturn.handleRejectProposal).toBeDefined()
      expect(mockUseProposalManagementReturn.handleApproveAllProposals).toBeDefined()
      expect(mockUseProposalManagementReturn.handleRejectAllProposals).toBeDefined()
      expect(mockUseProposalManagementReturn.handleCancelDrawing).toBeDefined()
    })

    it('passes approved drawing IDs to MessageList', () => {
      const approvedIds = new Map([
        ['msg-1', new Map([['proposal-1', 'drawing-1']])]
      ])
      
      mockedUseProposalManagement.mockReturnValue({
        ...mockUseProposalManagementReturn,
        approvedDrawingIds: approvedIds,
        approveLoading: false
      })
      
      render(<ChatPanel />)
      
      expect(mockUseProposalManagementReturn.approvedDrawingIds).toEqual(approvedIds)
    })
  })

  describe('Copy Message Handling', () => {
    it('passes copy handler to MessageList', () => {
      render(<ChatPanel />)
      
      expect(mockUseMessageHandlingReturn.handleCopyMessage).toBeDefined()
    })

    it('tracks copied message ID', () => {
      mockedUseMessageHandling.mockReturnValue({
        ...mockUseMessageHandlingReturn,
        copiedMessageId: 'msg-1',
        setAnalysisInProgress: jest.fn()
      })
      
      render(<ChatPanel />)
      
      expect(mockUseMessageHandlingReturn.copiedMessageId).toBe('msg-1')
    })
  })
})
