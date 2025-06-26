// Mock for enhanced-conversation-memory.store.ts

// Define types locally to avoid import issues
interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: any;
}

interface ConversationSession {
  id: string;
  startedAt: Date;
  lastActiveAt: Date;
  messages: ConversationMessage[];
  summary?: string;
  processors: any[];
  processedMessages?: ConversationMessage[];
  tokenUsage?: { total: number; input: number; output: number };
}

interface EnhancedConversationMemoryState {
  sessions: Record<string, ConversationSession>;
  currentSessionId: string | null;
  defaultProcessors: any[];
  isDbEnabled: boolean;
  isSyncing: boolean;
  createSession: (sessionId?: string, processors?: any[]) => Promise<string>;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => Promise<void>;
  getProcessedMessages: (sessionId: string, limit?: number) => ConversationMessage[];
  getRecentMessages: (sessionId: string, limit?: number) => ConversationMessage[];
  getSessionContext: (sessionId: string) => string;
  updateMessageMetadata: (messageId: string, metadata: any) => Promise<void>;
  clearSession: (sessionId: string) => void;
  searchMessages: (query: string, sessionId?: string) => ConversationMessage[];
  summarizeSession: (sessionId: string) => Promise<void>;
  addProcessor: (sessionId: string, processor: any) => void;
  removeProcessor: (sessionId: string, processorName: string) => void;
  setDefaultProcessors: (processors: any[]) => void;
  getMemoryStats: (sessionId: string) => any;
  enableDbSync: () => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

// Mock store implementation for testing
const mockSession: ConversationSession = {
  id: 'test-session-debug',
  startedAt: new Date(),
  lastActiveAt: new Date(),
  messages: [],
  processors: [],
  tokenUsage: { total: 0, input: 0, output: 0 }
};

const mockState: EnhancedConversationMemoryState = {
  sessions: {
    'test-session-debug': mockSession,
    'session-1': mockSession
  },
  currentSessionId: 'test-session-debug',
  defaultProcessors: [],
  isDbEnabled: false,
  isSyncing: false,

  createSession: jest.fn().mockResolvedValue('test-session-debug'),
  addMessage: jest.fn().mockResolvedValue(undefined),
  getProcessedMessages: jest.fn().mockReturnValue([]),
  getRecentMessages: jest.fn().mockReturnValue([]),
  getSessionContext: jest.fn().mockReturnValue('No previous context available.'),
  updateMessageMetadata: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn(),
  searchMessages: jest.fn().mockReturnValue([]),
  summarizeSession: jest.fn().mockResolvedValue(undefined),
  addProcessor: jest.fn(),
  removeProcessor: jest.fn(),
  setDefaultProcessors: jest.fn(),
  getMemoryStats: jest.fn().mockReturnValue({
    totalMessages: 0,
    processedMessages: 0,
    estimatedTokens: 0,
    processors: []
  }),
  enableDbSync: jest.fn().mockResolvedValue(undefined),
  disableDbSync: jest.fn(),
  syncWithDatabase: jest.fn().mockResolvedValue(undefined),
  loadFromDatabase: jest.fn().mockResolvedValue(undefined),
};

// Mock the zustand store
export const useEnhancedConversationMemory = {
  getState: jest.fn().mockReturnValue(mockState),
  setState: jest.fn(),
  subscribe: jest.fn(),
  destroy: jest.fn(),
};

// Mock the convenience functions
export const createEnhancedSession = jest.fn().mockResolvedValue('test-session-debug');
export const addToolCallMessage = jest.fn().mockResolvedValue(undefined);

// Export types for compatibility
export type { EnhancedConversationMemoryState, ConversationSession };

export const MAX_MESSAGES_IN_MEMORY = 50;