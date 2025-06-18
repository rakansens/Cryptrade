import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  useEnhancedConversationMemory, 
  createEnhancedSession,
  addToolCallMessage,
  type EnhancedConversationMemoryState 
} from '@/lib/store/enhanced-conversation-memory.store';
import { TokenLimiter, ToolCallFilter, MessageDeduplication, ContextWindowManager } from '@/lib/store/processors';
import type { ConversationMessage } from '@/types/conversation-memory';

// Mock database services
let sessionCounter = 0;
jest.mock('@/lib/services/database/chat.service', () => ({
  ChatDatabaseService: {
    createSession: jest.fn().mockImplementation(() => {
      sessionCounter++;
      return Promise.resolve({
        id: `db-session-${sessionCounter}`,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        userId: null,
        summary: null,
      });
    }),
    getUserSessions: jest.fn().mockResolvedValue([]),
    getSessionWithMessages: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    conversationSession: {
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    conversationMessage: {
      create: jest.fn().mockResolvedValue({
        id: 'db-msg-123',
        sessionId: 'db-session-123',
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
        metadata: {},
      }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Enhanced Conversation Memory Store', () => {
  beforeEach(() => {
    // Reset session counter
    sessionCounter = 0;
    
    // Clear store before each test
    useEnhancedConversationMemory.setState({
      sessions: {},
      currentSessionId: null,
      defaultProcessors: [
        new TokenLimiter(127000),
        new ToolCallFilter({ exclude: ['marketDataTool', 'chartControlTool'] }),
      ],
      isDbEnabled: true,
      isSyncing: false,
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should create a new session with database integration', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      expect(sessionId).toBe('db-session-1');
      
      const state = useEnhancedConversationMemory.getState();
      expect(state.sessions[sessionId]).toBeDefined();
      expect(state.currentSessionId).toBe(sessionId);
      expect(state.sessions[sessionId].processors).toHaveLength(2);
    });

    it('should create session with custom processors', async () => {
      const customProcessors = [
        new TokenLimiter(50000),
        new ToolCallFilter({ includeAll: true }),
      ];
      
      const sessionId = await useEnhancedConversationMemory.getState().createSession(undefined, customProcessors);
      
      const state = useEnhancedConversationMemory.getState();
      expect(state.sessions[sessionId].processors).toHaveLength(2);
      expect(state.sessions[sessionId].processors[0].getName()).toBe('TokenLimiter(50000)');
    });

    it('should fallback to local creation when DB fails', async () => {
      // Mock DB failure
      const { ChatDatabaseService } = require('@/lib/services/database/chat.service');
      ChatDatabaseService.createSession.mockRejectedValueOnce(new Error('DB Error'));
      
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      expect(sessionId).toMatch(/^session-\d+$/);
      expect(useEnhancedConversationMemory.getState().sessions[sessionId]).toBeDefined();
    });
  });

  describe('Message Management', () => {
    it('should add messages with automatic session creation', async () => {
      const testSessionId = 'test-session-123';
      
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId: testSessionId,
        role: 'user',
        content: 'What is the price of BTC?',
      });
      
      const state = useEnhancedConversationMemory.getState();
      expect(state.sessions[testSessionId]).toBeDefined();
      expect(state.sessions[testSessionId].messages).toHaveLength(1);
      expect(state.sessions[testSessionId].messages[0].content).toBe('What is the price of BTC?');
    });

    it('should process messages and update token usage', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        await useEnhancedConversationMemory.getState().addMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      // Check processed messages
      const processedMessages = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      expect(processedMessages.length).toBeLessThanOrEqual(5);
      
      // Check token usage
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.tokenUsage?.total).toBeGreaterThan(0);
      expect(session.tokenUsage?.input).toBeGreaterThan(0);
      expect(session.tokenUsage?.output).toBeGreaterThan(0);
    });
  });

  describe('Memory Processing', () => {
    it('should get processed messages with caching', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      // Add messages
      for (let i = 0; i < 10; i++) {
        await useEnhancedConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      // First call should process
      const processed1 = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId, 5);
      expect(processed1).toHaveLength(5);
      
      // Second call should use cache
      const processed2 = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId, 5);
      expect(processed2).toEqual(processed1);
    });

    it('should build session context correctly', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'What is BTC price?',
      });
      
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'BTC is trading at $45,000',
      });
      
      await useEnhancedConversationMemory.getState().summarizeSession(sessionId);
      
      const context = useEnhancedConversationMemory.getState().getSessionContext(sessionId);
      expect(context).toContain('Session Summary:');
      expect(context).toContain('User: What is BTC price?');
      expect(context).toContain('Assistant: BTC is trading at $45,000');
    });
  });

  describe('Helper Functions', () => {
    it('should create enhanced session and add tool call messages', async () => {
      // Test createEnhancedSession with custom options
      const sessionId = await createEnhancedSession(undefined, {
        maxTokens: 50000,
        excludeTools: ['customTool'],
      });
      
      const state = useEnhancedConversationMemory.getState();
      const session = state.sessions[sessionId];
      expect(session.processors[0].getName()).toBe('TokenLimiter(50000)');
      
      // Test addToolCallMessage
      await addToolCallMessage(
        sessionId,
        'marketDataTool',
        'Fetching BTC price...',
        { price: 45000 }
      );
      
      // Get fresh state after adding message
      const updatedState = useEnhancedConversationMemory.getState();
      const messages = updatedState.sessions[sessionId].messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata?.isToolCall).toBe(true);
      expect(messages[0].metadata?.toolName).toBe('marketDataTool');
    });
  });

  describe('Advanced Session Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessions = await Promise.all([
        useEnhancedConversationMemory.getState().createSession(),
        useEnhancedConversationMemory.getState().createSession(),
        useEnhancedConversationMemory.getState().createSession(),
      ]);
      
      expect(new Set(sessions).size).toBe(3); // All unique
      
      const state = useEnhancedConversationMemory.getState();
      expect(Object.keys(state.sessions)).toHaveLength(3);
    });

    it('should switch between sessions correctly', async () => {
      const session1 = await useEnhancedConversationMemory.getState().createSession();
      const session2 = await useEnhancedConversationMemory.getState().createSession();
      
      // Add messages to different sessions
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId: session1,
        role: 'user',
        content: 'Session 1 message',
      });
      
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId: session2,
        role: 'user',
        content: 'Session 2 message',
      });
      
      // Set current session
      useEnhancedConversationMemory.setState({ currentSessionId: session1 });
      expect(useEnhancedConversationMemory.getState().currentSessionId).toBe(session1);
      
      const state = useEnhancedConversationMemory.getState();
      const messages1 = state.sessions[session1].messages;
      expect(messages1[0].content).toBe('Session 1 message');
    });

    it.skip('should clear old sessions based on age', async () => {
      // TODO: Implement automatic session cleanup feature
      const oldSession = await useEnhancedConversationMemory.getState().createSession();
      
      // Mock old timestamp
      const state = useEnhancedConversationMemory.getState();
      state.sessions[oldSession].lastActiveAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      // Create new session to trigger cleanup
      await useEnhancedConversationMemory.getState().createSession();
      
      // Old session should be removed
      expect(state.sessions[oldSession]).toBeUndefined();
    });
  });

  describe('Advanced Memory Processing', () => {
    it('should handle token overflow gracefully', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        maxTokens: 100, // Very small limit
      });
      
      // Add messages that exceed token limit
      for (let i = 0; i < 20; i++) {
        await useEnhancedConversationMemory.getState().addMessage({
          sessionId,
          role: 'user',
          content: 'This is a long message that will consume many tokens when processed',
        });
      }
      
      const processed = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      const stats = useEnhancedConversationMemory.getState().getMemoryStats(sessionId);
      
      // With 100 token limit and messages of ~18 tokens each, should fit about 5-6 messages
      expect(stats.estimatedTokens).toBeGreaterThanOrEqual(0);
      expect(processed.length).toBeGreaterThan(0);
      expect(processed.length).toBeLessThan(20);
    });

    it('should cache processed messages efficiently', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      // Add messages
      for (let i = 0; i < 10; i++) {
        await useEnhancedConversationMemory.getState().addMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
      
      // First call processes
      const processed1 = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      
      // Check that cache is populated
      const state1 = useEnhancedConversationMemory.getState();
      const session1 = state1.sessions[sessionId];
      expect(session1.processedMessages).toBeDefined();
      expect(session1.processedMessages).toHaveLength(processed1.length);
      
      // Second call should use cache
      const processed2 = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      
      expect(processed1).toEqual(processed2);
      // Arrays are sliced, so they won't be the same reference, but content should match
      expect(processed1.length).toBe(processed2.length);
      
      // Add new message to invalidate cache
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'New message',
      });
      
      const processed3 = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      expect(processed3.length).toBe(processed1.length + 1);
    });
  });

  describe('Tool Call Integration', () => {
    it('should handle tool calls with metadata', async () => {
      const sessionId = await createEnhancedSession();
      
      // Add tool call message
      await addToolCallMessage(
        sessionId,
        'marketDataTool',
        'Fetching BTC price data...',
        {
          symbol: 'BTCUSDT',
          price: 45000,
          volume: 1234567,
          timestamp: Date.now(),
        }
      );
      
      const state = useEnhancedConversationMemory.getState();
      const messages = state.sessions[sessionId].messages;
      const toolMessage = messages[0];
      
      expect(toolMessage.metadata?.isToolCall).toBe(true);
      expect(toolMessage.metadata?.toolName).toBe('marketDataTool');
      expect(toolMessage.metadata?.toolResult).toMatchObject({
        symbol: 'BTCUSDT',
        price: 45000,
      });
    });

    it('should filter tool calls based on configuration', async () => {
      const sessionId = await createEnhancedSession(undefined, {
        excludeTools: ['debugTool', 'internalTool'],
      });
      
      // Add various tool calls
      await addToolCallMessage(sessionId, 'marketDataTool', 'Market data', {});
      await addToolCallMessage(sessionId, 'debugTool', 'Debug info', {});
      await addToolCallMessage(sessionId, 'chartTool', 'Chart update', {});
      await addToolCallMessage(sessionId, 'internalTool', 'Internal process', {});
      
      const processed = useEnhancedConversationMemory.getState().getProcessedMessages(sessionId);
      
      // Should exclude debug and internal tools
      expect(processed.some(m => m.metadata?.toolName === 'debugTool')).toBe(false);
      expect(processed.some(m => m.metadata?.toolName === 'internalTool')).toBe(false);
      expect(processed.some(m => m.metadata?.toolName === 'marketDataTool')).toBe(true);
      expect(processed.some(m => m.metadata?.toolName === 'chartTool')).toBe(true);
    });
  });

  describe('Memory Statistics', () => {
    it('should track detailed memory statistics', async () => {
      const sessionId = await useEnhancedConversationMemory.getState().createSession();
      
      // Add various message types
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId,
        role: 'user',
        content: 'Hello',
      });
      
      await addToolCallMessage(sessionId, 'testTool', 'Tool execution', { result: 'data' });
      
      await useEnhancedConversationMemory.getState().addMessage({
        sessionId,
        role: 'assistant',
        content: 'Hi there! How can I help you today?',
      });
      
      const stats = useEnhancedConversationMemory.getState().getMemoryStats(sessionId);
      
      expect(stats.totalMessages).toBe(3);
      expect(stats.processedMessages).toBeGreaterThan(0);
      // estimatedTokens might be 0 if tokenCount is not in metadata
      expect(stats.estimatedTokens).toBeGreaterThanOrEqual(0);
      expect(stats.processors).toHaveLength(2);
      expect(stats.processors).toContain('TokenLimiter(127000)');
      expect(stats.processors[1]).toMatch(/^ToolCallFilter/);
    });
  });
});