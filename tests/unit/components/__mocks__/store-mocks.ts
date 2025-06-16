// Mock factories for store hooks with proper types
import { jest } from '@jest/globals'

export const createMockUseChart = () => ({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: { ma: true, rsi: false, macd: false, boll: false },
  settings: { boll: {} },
  setChartReady: jest.fn(),
  setSymbol: jest.fn(),
  setTimeframe: jest.fn()
})

export const createMockUseChat = () => ({
  sessions: {
    'session-1': { id: 'session-1', title: 'Test Session', createdAt: Date.now() }
  },
  currentSessionId: 'session-1',
  messages: [],
  inputValue: '',
  isInputFromHomeScreen: false,
  isStreaming: false,
  isLoading: false,
  setInputValue: jest.fn(),
  createSession: jest.fn(),
  error: null
})

export const createMockUseAIChat = () => ({
  isReady: true
})

export const createMockUseMessageHandling = () => ({
  handleSendMessage: jest.fn(),
  handleCopyMessage: jest.fn(),
  handleAnalysisComplete: jest.fn(),
  copiedMessageId: null,
  analysisInProgress: null
})

export const createMockUseProposalManagement = () => ({
  approvedDrawingIds: new Map(),
  handleApproveProposal: jest.fn(),
  handleRejectProposal: jest.fn(),
  handleApproveAllProposals: jest.fn(),
  handleRejectAllProposals: jest.fn(),
  handleCancelDrawing: jest.fn()
})