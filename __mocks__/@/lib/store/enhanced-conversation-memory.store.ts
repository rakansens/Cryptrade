// Mock for enhanced-conversation-memory.store.ts
// 更新日: 2025-01-26 - enhanced-conversation-flow.test.ts完全動的実装対応

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

// 動的セッション・メッセージ管理
let dynamicSessions: Record<string, ConversationSession> = {};
let messageCounter = 0;

// Mock store implementation with full dynamic behavior
const createDynamicMockState = (): EnhancedConversationMemoryState => ({
  get sessions() { return dynamicSessions; },
  get currentSessionId() {
    const sessionIds = Object.keys(dynamicSessions);
    return sessionIds.length > 0 ? sessionIds[sessionIds.length - 1] : null;
  },
  defaultProcessors: [],
  isDbEnabled: false,
  isSyncing: false,

  // 動的セッション作成
  createSession: jest.fn().mockImplementation((sessionId?: string, processors: any[] = []) => {
    const newSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dynamicSessions[newSessionId] = {
      id: newSessionId,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      messages: [],
      processors,
      tokenUsage: { total: 0, input: 0, output: 0 }
    };
    return Promise.resolve(newSessionId);
  }),

  // 動的メッセージ追加
  addMessage: jest.fn().mockImplementation((message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
    messageCounter++;
    const newMessage: ConversationMessage = {
      ...message,
      id: `msg-${Date.now()}-${messageCounter}`,
      timestamp: new Date()
    };
    
    if (message.sessionId && dynamicSessions[message.sessionId]) {
      dynamicSessions[message.sessionId].messages.push(newMessage);
      dynamicSessions[message.sessionId].lastActiveAt = new Date();
    }
    
    return Promise.resolve();
  }),

  getProcessedMessages: jest.fn().mockImplementation((sessionId: string, limit = 10) => {
    const session = dynamicSessions[sessionId];
    if (!session) return [];
    return session.messages.slice(-limit);
  }),

  getRecentMessages: jest.fn().mockImplementation((sessionId: string, limit = 10) => {
    const session = dynamicSessions[sessionId];
    if (!session) return [];
    return session.messages.slice(-limit);
  }),

  // 動的コンテキスト生成
  getSessionContext: jest.fn().mockImplementation((sessionId: string) => {
    const session = dynamicSessions[sessionId];
    if (!session || session.messages.length === 0) {
      return 'No previous context available.';
    }
    
    // BTCに関連するメッセージからコンテキストを生成
    const btcMessages = session.messages.filter(msg =>
      msg.content && (msg.content.includes('BTC') || msg.content.includes('Bitcoin'))
    );
    
    if (btcMessages.length > 0) {
      return 'BTC';
    }
    
    return 'No previous context available.';
  }),

  updateMessageMetadata: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockImplementation((sessionId: string) => {
    if (dynamicSessions[sessionId]) {
      dynamicSessions[sessionId].messages = [];
    }
  }),
  
  searchMessages: jest.fn().mockReturnValue([]),

  // 動的サマリー生成
  summarizeSession: jest.fn().mockImplementation((sessionId: string) => {
    const session = dynamicSessions[sessionId];
    if (session && session.messages.length > 0) {
      const btcMessages = session.messages.filter(msg =>
        msg.content.includes('BTC') || msg.content.includes('ETH')
      );
      session.summary = `会話の要約: ${btcMessages.map(msg => msg.content).join(', ')}`;
    }
    return Promise.resolve();
  }),

  addProcessor: jest.fn(),
  removeProcessor: jest.fn(),
  setDefaultProcessors: jest.fn(),

  // 動的メモリ統計
  getMemoryStats: jest.fn().mockImplementation((sessionId?: string) => {
    if (sessionId && dynamicSessions[sessionId]) {
      const session = dynamicSessions[sessionId];
      return {
        totalMessages: session.messages.length,
        processedMessages: session.messages.length,
        estimatedTokens: session.messages.length * 50,
        processors: session.processors
      };
    }
    
    const totalMessages = Object.values(dynamicSessions).reduce((sum, session) => sum + session.messages.length, 0);
    return {
      totalMessages,
      processedMessages: totalMessages,
      estimatedTokens: totalMessages * 50,
      processors: []
    };
  }),

  enableDbSync: jest.fn().mockResolvedValue(undefined),
  disableDbSync: jest.fn(),
  syncWithDatabase: jest.fn().mockResolvedValue(undefined),
  loadFromDatabase: jest.fn().mockResolvedValue(undefined),
});

// Initialize dynamic mock state
const mockState = createDynamicMockState();

// Mock the zustand store
export const useEnhancedConversationMemory = {
  getState: jest.fn().mockReturnValue(mockState),
  setState: jest.fn(),
  subscribe: jest.fn(),
  destroy: jest.fn(),
};

// Mock the convenience functions with dynamic behavior
export const createEnhancedSession = jest.fn().mockImplementation((sessionId?: string, processors?: any[]) => {
  return mockState.createSession(sessionId, processors);
});

export const addToolCallMessage = jest.fn().mockImplementation((message: any) => {
  return mockState.addMessage(message);
});

// Export types for compatibility
export type { EnhancedConversationMemoryState, ConversationSession };

export const MAX_MESSAGES_IN_MEMORY = 50;