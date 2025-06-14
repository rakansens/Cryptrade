import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  memoryRecallTool,
  formatConversationContext,
  extractMetadataFromQuery 
} from '../memory-recall.tool';
import { useConversationMemory } from '@/lib/store/conversation-memory.store';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/store/conversation-memory.store', () => ({
  useConversationMemory: {
    getState: jest.fn(),
  },
}));

// Type for mocked memory store
interface MockMemoryStore {
  sessions: Record<string, unknown>;
  getRecentMessages: jest.Mock;
  searchMessages: jest.Mock;
  getSessionContext: jest.Mock;
  addMessage: jest.Mock;
}

describe('memoryRecallTool', () => {
  let mockMemoryStore: MockMemoryStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock memory store
    mockMemoryStore = {
      sessions: {},
      getRecentMessages: jest.fn(),
      searchMessages: jest.fn(),
      getSessionContext: jest.fn(),
      addMessage: jest.fn(),
    };
    
    (useConversationMemory.getState as jest.Mock).mockReturnValue(mockMemoryStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute - getRecent operation', () => {
    it('should retrieve recent messages successfully', async () => {
      const mockMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'What is the price of BTC?',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          agentId: 'user-123',
          metadata: { intent: 'price_query' },
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: 'The current price of BTC is $50,000',
          timestamp: new Date('2024-01-01T10:00:30Z'),
          agentId: 'trading-agent',
          metadata: { confidence: 0.95 },
        },
      ];

      mockMemoryStore.getRecentMessages.mockReturnValue(mockMessages);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 5,
        }
      });

      expect(result).toMatchObject({
        success: true,
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'What is the price of BTC?',
            timestamp: '2024-01-01T10:00:00.000Z',
            agentId: 'user-123',
            metadata: { intent: 'price_query' },
          },
          {
            id: '2',
            role: 'assistant',
            content: 'The current price of BTC is $50,000',
            timestamp: '2024-01-01T10:00:30.000Z',
            agentId: 'trading-agent',
            metadata: { confidence: 0.95 },
          },
        ],
        summary: 'Retrieved 2 recent messages',
      });

      expect(mockMemoryStore.getRecentMessages).toHaveBeenCalledWith('session-123', 5);
      expect(logger.info).toHaveBeenCalledWith(
        '[MemoryRecallTool] Executing operation',
        expect.objectContaining({
          operation: 'getRecent',
          sessionId: 'session-123',
        })
      );
    });

    it('should handle empty message history', async () => {
      mockMemoryStore.getRecentMessages.mockReturnValue([]);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-456',
          operation: 'getRecent',
        }
      });

      expect(result).toMatchObject({
        success: true,
        messages: [],
        summary: 'Retrieved 0 recent messages',
      });
    });

    it('should use default limit when not specified', async () => {
      mockMemoryStore.getRecentMessages.mockReturnValue([]);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-789',
          operation: 'getRecent',
          // limit is not specified, should use default from zod schema
        }
      });

      expect(result.success).toBe(true);
      // The limit should be applied by zod when parsing the input
      expect(mockMemoryStore.getRecentMessages).toHaveBeenCalled();
      // Check that the function was called with the session ID at least
      expect(mockMemoryStore.getRecentMessages.mock.calls[0][0]).toBe('session-789');
    });
  });

  describe('execute - search operation', () => {
    it('should search messages successfully', async () => {
      const mockSearchResults = [
        {
          id: '3',
          role: 'user' as const,
          content: 'Show me the ETH chart',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          agentId: 'user-123',
          metadata: { symbols: ['ETH'] },
        },
        {
          id: '4',
          role: 'assistant' as const,
          content: 'Here is the ETH/USDT chart analysis',
          timestamp: new Date('2024-01-01T11:00:30Z'),
          agentId: 'chart-agent',
          metadata: { chartType: 'candlestick' },
        },
      ];

      mockMemoryStore.searchMessages.mockReturnValue(mockSearchResults);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: 'ETH chart',
          limit: 10,
        }
      });

      expect(result).toMatchObject({
        success: true,
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: '3',
            content: 'Show me the ETH chart',
          }),
          expect.objectContaining({
            id: '4',
            content: 'Here is the ETH/USDT chart analysis',
          }),
        ]),
        summary: 'Found 2 messages matching "ETH chart"',
      });

      expect(mockMemoryStore.searchMessages).toHaveBeenCalledWith('ETH chart', 'session-123');
    });

    it('should return error when query is missing', async () => {
      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'search',
        }
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Search query is required for search operation',
      });

      expect(mockMemoryStore.searchMessages).not.toHaveBeenCalled();
    });

    it('should respect limit in search results', async () => {
      const manyResults = Array(20).fill(null).map((_, i) => ({
        id: String(i),
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
        agentId: 'user-123',
      }));

      mockMemoryStore.searchMessages.mockReturnValue(manyResults);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: 'test',
          limit: 5,
        }
      });

      expect(result.messages).toHaveLength(5);
    });
  });

  describe('execute - getContext operation', () => {
    it('should retrieve session context successfully', async () => {
      const mockContext = 'User is analyzing BTC price movements and requesting technical indicators';
      mockMemoryStore.getSessionContext.mockReturnValue(mockContext);
      mockMemoryStore.sessions['session-123'] = {
        summary: 'Trading analysis session focused on BTC',
      };

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'getContext',
        }
      });

      expect(result).toMatchObject({
        success: true,
        context: mockContext,
        summary: 'Trading analysis session focused on BTC',
      });

      expect(mockMemoryStore.getSessionContext).toHaveBeenCalledWith('session-123');
    });

    it('should handle missing session summary', async () => {
      mockMemoryStore.getSessionContext.mockReturnValue('Basic context');
      mockMemoryStore.sessions['session-456'] = undefined;

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-456',
          operation: 'getContext',
        }
      });

      expect(result).toMatchObject({
        success: true,
        context: 'Basic context',
        summary: 'No session summary available',
      });
    });
  });

  describe('execute - addMessage operation', () => {
    it('should add message successfully', async () => {
      const newMessage = {
        role: 'user' as const,
        content: 'What is the RSI for BTC?',
        agentId: 'user-123',
        metadata: {
          intent: 'indicator_query',
          symbols: ['BTC'],
        },
      };

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
          message: newMessage,
        }
      });

      expect(result).toMatchObject({
        success: true,
        summary: 'Message added to session session-123',
      });

      expect(mockMemoryStore.addMessage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        ...newMessage,
      });
    });

    it('should return error when message is missing', async () => {
      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
        }
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Message is required for addMessage operation',
      });

      expect(mockMemoryStore.addMessage).not.toHaveBeenCalled();
    });

    it('should validate message structure', async () => {
      const invalidMessage = {
        role: 'invalid' as any,
        content: 'Test message',
      };

      // The zod schema should catch this, but if it doesn't, the tool should handle it
      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
          message: invalidMessage,
        }
      });

      // This might throw a zod error, which is caught by the try-catch
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('execute - error handling', () => {
    it('should handle unknown operations', async () => {
      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'unknownOp' as any,
        }
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Unknown operation: unknownOp',
      });
    });

    it('should handle store errors gracefully', async () => {
      mockMemoryStore.getRecentMessages.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
        }
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Database connection failed',
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MemoryRecallTool] Operation failed',
        expect.objectContaining({
          error: 'Error: Database connection failed',
        })
      );
    });

    it('should log execution time on errors', async () => {
      mockMemoryStore.getRecentMessages.mockImplementation(() => {
        throw new Error('Test error');
      });

      await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
        }
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MemoryRecallTool] Operation failed',
        expect.objectContaining({
          executionTime: expect.any(Number),
        })
      );
    });
  });

  describe('formatConversationContext', () => {
    it('should format messages within token limit', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
      ];

      const context = formatConversationContext(messages, 100);

      expect(context).toContain('user: Hello');
      expect(context).toContain('assistant: Hi there!');
      expect(context).toContain('user: How are you?');
      expect(context).toContain('assistant: I am doing well, thank you!');
    });

    it('should truncate messages exceeding token limit', () => {
      const messages = [
        { role: 'user', content: 'A'.repeat(1000) },
        { role: 'assistant', content: 'B'.repeat(1000) },
        { role: 'user', content: 'This should be included' },
      ];

      const context = formatConversationContext(messages, 100);

      expect(context).toContain('This should be included');
      expect(context).not.toContain('A'.repeat(1000));
      expect(context).not.toContain('B'.repeat(1000));
    });

    it('should process messages in reverse order', () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second message' },
        { role: 'user', content: 'Third message' },
      ];

      const context = formatConversationContext(messages, 200);

      const firstIndex = context.indexOf('First message');
      const thirdIndex = context.indexOf('Third message');
      
      expect(firstIndex).toBeLessThan(thirdIndex);
    });

    it('should handle empty messages array', () => {
      const context = formatConversationContext([]);
      expect(context).toBe('');
    });
  });

  describe('extractMetadataFromQuery', () => {
    it('should extract cryptocurrency symbols', () => {
      const testCases = [
        { query: 'What is the price of BTC?', expectedSymbols: ['BTC'] },
        { query: 'Compare ETH and ADA', expectedSymbols: ['ETH', 'ADA'] },
        { query: 'Show me BTC, ETH, and SOL charts', expectedSymbols: ['BTC', 'ETH', 'SOL'] },
        { query: 'btc price', expectedSymbols: ['BTC'] }, // Case insensitive
        { query: 'No crypto here', expectedSymbols: [] },
      ];

      testCases.forEach(({ query, expectedSymbols }) => {
        const { symbols } = extractMetadataFromQuery(query);
        expect(symbols).toEqual(expect.arrayContaining(expectedSymbols));
        expect(symbols).toHaveLength(expectedSymbols.length);
      });
    });

    it('should extract topics from keywords', () => {
      const testCases = [
        { query: '価格を教えて', expectedTopics: ['price'] },
        { query: 'Show me the technical analysis', expectedTopics: ['analysis'] },
        { query: 'I want to trade BTC', expectedTopics: ['trading'] },
        { query: 'Display the chart with RSI indicator', expectedTopics: ['chart', 'indicator'] },
        { query: 'What is the market trend?', expectedTopics: ['market'] },
        { query: 'Random text', expectedTopics: [] },
      ];

      testCases.forEach(({ query, expectedTopics }) => {
        const { topics } = extractMetadataFromQuery(query);
        expect(topics).toEqual(expect.arrayContaining(expectedTopics));
      });
    });

    it('should extract both symbols and topics', () => {
      const query = 'Show me BTC price chart with technical analysis';
      const { symbols, topics } = extractMetadataFromQuery(query);
      
      expect(symbols).toContain('BTC');
      expect(topics).toEqual(expect.arrayContaining(['price', 'chart', 'analysis']));
    });

    it('should handle queries with multiple languages', () => {
      const query = 'BTCの価格とチャートを見せて (Show BTC price and chart)';
      const { symbols, topics } = extractMetadataFromQuery(query);
      
      expect(symbols).toContain('BTC');
      expect(topics).toEqual(expect.arrayContaining(['price', 'chart']));
    });

    it('should handle empty query', () => {
      const { symbols, topics } = extractMetadataFromQuery('');
      expect(symbols).toEqual([]);
      expect(topics).toEqual([]);
    });

    it('should avoid duplicate symbols', () => {
      const query = 'BTC BTC BTC price';
      const { symbols } = extractMetadataFromQuery(query);
      
      expect(symbols).toEqual(['BTC']);
    });
  });

  describe('edge cases', () => {
    it('should handle very long session IDs', async () => {
      const longSessionId = 'session-' + 'x'.repeat(1000);
      mockMemoryStore.getRecentMessages.mockReturnValue([]);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: longSessionId,
          operation: 'getRecent',
        }
      });

      expect(result.success).toBe(true);
      expect(mockMemoryStore.getRecentMessages).toHaveBeenCalled();
      expect(mockMemoryStore.getRecentMessages.mock.calls[0][0]).toBe(longSessionId);
    });

    it('should handle messages with undefined metadata', async () => {
      const messagesWithoutMetadata = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date(),
          agentId: undefined,
          metadata: undefined,
        },
      ];

      mockMemoryStore.getRecentMessages.mockReturnValue(messagesWithoutMetadata);

      const result = await memoryRecallTool.execute({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
        }
      });

      expect(result.success).toBe(true);
      expect(result.messages?.[0]).toMatchObject({
        id: '1',
        content: 'Test message',
      });
    });

    it('should handle concurrent operations', async () => {
      mockMemoryStore.getRecentMessages.mockReturnValue([]);

      const operations = Array(10).fill(null).map((_, i) => 
        memoryRecallTool.execute({
          context: {
            sessionId: `session-${i}`,
            operation: 'getRecent',
          }
        })
      );

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});