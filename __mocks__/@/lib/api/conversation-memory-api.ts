// Mock for ConversationMemoryAPI during tests
// Updated for Phase 4 type safety improvements

// Use relative types definition for mock
interface ConversationMessageMetadata {
  intent?: string;
  confidence?: number;
  symbols?: string[];
  topics?: string[];
  embedding?: number[];
  isToolCall?: boolean;
  toolName?: string;
  toolResult?: any;
  tokenCount?: number;
}

interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: ConversationMessageMetadata;
}

export interface ConversationMemoryAPIMock {
  addMessage: jest.MockedFunction<(message: Omit<ConversationMessage, 'id' | 'timestamp'>) => Promise<ConversationMessage>>;
  getRecentMessages: jest.MockedFunction<(sessionId: string, limit?: number) => Promise<ConversationMessage[]>>;
  searchMessages: jest.MockedFunction<(query: string, sessionId?: string) => Promise<ConversationMessage[]>>;
  getSessionContext: jest.MockedFunction<(sessionId: string) => Promise<string>>;
  updateSessionSummary: jest.MockedFunction<(sessionId: string, summary: string) => Promise<void>>;
}

export const ConversationMemoryAPI: ConversationMemoryAPIMock = {
  addMessage: jest.fn().mockImplementation(async (message) => {
    // Type-safe mock response
    const mockResponse: ConversationMessage = {
      ...message,
      id: `mock-${Date.now()}`,
      timestamp: new Date(),
    };
    return mockResponse;
  }),

  getRecentMessages: jest.fn().mockResolvedValue([]),

  searchMessages: jest.fn().mockResolvedValue([]),

  getSessionContext: jest.fn().mockResolvedValue('Mock context'),

  updateSessionSummary: jest.fn().mockResolvedValue(undefined),
};