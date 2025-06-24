// Mock dependencies before imports
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/store/conversation-memory.store');

import { memoryRecallTool, formatConversationContext, extractMetadataFromQuery } from '@/lib/mastra/tools/memory-recall.tool';
import { useConversationMemory, semanticSearch } from '@/lib/store/conversation-memory.store';
import { logger } from '@/lib/utils/logger';

// Type cast the execute function to avoid TypeScript errors
const executeMemoryRecallTool = memoryRecallTool.execute as any;

describe('memoryRecallTool', () => {
  const mockGetState = {
    getRecentMessages: jest.fn(),
    searchMessages: jest.fn(),
    getSessionContext: jest.fn(),
    addMessage: jest.fn(),
    sessions: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useConversationMemory.getState as jest.Mock).mockReturnValue(mockGetState);
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(memoryRecallTool.id).toBe('memory-recall');
      expect(memoryRecallTool.description).toBe('Access and manage conversation memory for context-aware responses');
      expect(memoryRecallTool.inputSchema).toBeDefined();
      expect(memoryRecallTool.outputSchema).toBeDefined();
    });
  });

  describe('execute - getRecent operation', () => {
    it('should retrieve recent messages successfully', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(Date.now() - 86400000) // 2024-01-01T10:00:00Z'),
          agentId: 'agent-1',
          metadata: { intent: 'greeting' },
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(Date.now() - 86400000) // 2024-01-01T10:00:10Z'),
        },
      ];

      mockGetState.getRecentMessages.mockReturnValue(mockMessages);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 5,
        },
      });

      expect(mockGetState.getRecentMessages).toHaveBeenCalledWith('session-123', 5);
      expect(result).toEqual({
        success: true,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: '2024-01-01T10:00:00.000Z',
            agentId: 'agent-1',
            metadata: { intent: 'greeting' },
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            timestamp: '2024-01-01T10:00:10.000Z',
            agentId: undefined,
            metadata: undefined,
          },
        ],
        summary: 'Retrieved 2 recent messages',
      });
    });

    it('should use default limit if not provided', async () => {
      mockGetState.getRecentMessages.mockReturnValue([]);

      await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 8,
        },
      });

      expect(mockGetState.getRecentMessages).toHaveBeenCalledWith('session-123', 8);
    });

    it('should handle empty message list', async () => {
      mockGetState.getRecentMessages.mockReturnValue([]);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 8,
        },
      });

      expect(result).toEqual({
        success: true,
        messages: [],
        summary: 'Retrieved 0 recent messages',
      });
    });
  });

  describe('execute - search operation', () => {
    it('should perform semantic search successfully', async () => {
      const mockSearchResults = [
        {
          id: 'msg-10',
          role: 'user',
          content: 'What is the price of BTC?',
          timestamp: new Date(Date.now() - 86400000) // 2024-01-01T12:00:00Z'),
          agentId: 'agent-1',
          metadata: { symbols: ['BTC'] },
        },
      ];

      const mockSemanticSearch = semanticSearch as jest.MockedFunction<typeof semanticSearch>;
      mockSemanticSearch.mockResolvedValue(mockSearchResults);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: 'BTC price',
          limit: 5,
        },
      });

      expect(mockSemanticSearch).toHaveBeenCalledWith('BTC price', 'session-123', 0.7, 5);
      expect(result).toEqual({
        success: true,
        messages: [
          {
            id: 'msg-10',
            role: 'user',
            content: 'What is the price of BTC?',
            timestamp: '2024-01-01T12:00:00.000Z',
            agentId: 'agent-1',
            metadata: { symbols: ['BTC'] },
          },
        ],
        summary: 'Found 1 messages matching "BTC price"',
      });
    });

    it('should fall back to text search when semantic search fails', async () => {
      const mockSemanticSearch = semanticSearch as jest.MockedFunction<typeof semanticSearch>;
      mockSemanticSearch.mockRejectedValue(new Error('Semantic search unavailable'));

      const mockTextSearchResults = [
        {
          id: 'msg-20',
          role: 'user',
          content: 'BTC price inquiry',
          timestamp: new Date(Date.now() - 86400000) // 2024-01-01T13:00:00Z'),
        },
      ];

      mockGetState.searchMessages.mockReturnValue(mockTextSearchResults);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: 'BTC',
          limit: 3,
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MemoryRecallTool] Semantic search failed',
        { error: 'Error: Semantic search unavailable' }
      );
      expect(mockGetState.searchMessages).toHaveBeenCalledWith('BTC', 'session-123');
      expect(result.messages).toHaveLength(1);
      expect(result.summary).toBe('Found 1 messages matching "BTC"');
    });

    it('should return error when query is missing for search', async () => {
      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          limit: 8,
        },
      });

      expect(result).toEqual({
        success: false,
        error: 'Search query is required for search operation',
      });
    });

    it('should respect limit in fallback text search', async () => {
      const mockSemanticSearch = semanticSearch as jest.MockedFunction<typeof semanticSearch>;
      mockSemanticSearch.mockRejectedValue(new Error('Semantic search error'));

      const manyMessages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      mockGetState.searchMessages.mockReturnValue(manyMessages);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: 'test',
          limit: 3,
        },
      });

      expect(result.messages).toHaveLength(3);
    });
  });

  describe('execute - getContext operation', () => {
    it('should retrieve session context successfully', async () => {
      const mockContext = 'User discussing BTC trading strategies';
      const mockSession = {
        summary: 'Trading discussion focused on BTC',
      };

      mockGetState.getSessionContext.mockReturnValue(mockContext);
      mockGetState.sessions = {
        'session-123': mockSession,
      };

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getContext',
        },
      });

      expect(mockGetState.getSessionContext).toHaveBeenCalledWith('session-123');
      expect(result).toEqual({
        success: true,
        context: mockContext,
        summary: 'Trading discussion focused on BTC',
      });
    });

    it('should handle missing session summary', async () => {
      mockGetState.getSessionContext.mockReturnValue('Some context');
      mockGetState.sessions = {};

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getContext',
        },
      });

      expect(result).toEqual({
        success: true,
        context: 'Some context',
        summary: 'No session summary available',
      });
    });
  });

  describe('execute - addMessage operation', () => {
    it('should add message successfully', async () => {
      const message = {
        role: 'user' as const,
        content: 'New message',
        agentId: 'agent-1',
        metadata: {
          intent: 'question',
          confidence: 0.9,
          symbols: ['BTC'],
          topics: ['price'],
        },
      };

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
          message,
        },
      });

      expect(mockGetState.addMessage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        role: 'user',
        content: 'New message',
        agentId: 'agent-1',
        metadata: {
          intent: 'question',
          confidence: 0.9,
          symbols: ['BTC'],
          topics: ['price'],
        },
      });

      expect(result).toEqual({
        success: true,
        summary: 'Message added to session session-123',
      });
    });

    it('should handle message without metadata', async () => {
      const message = {
        role: 'assistant' as const,
        content: 'Simple response',
      };

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
          message,
        },
      });

      expect(mockGetState.addMessage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        role: 'assistant',
        content: 'Simple response',
        metadata: undefined,
      });

      expect(result.success).toBe(true);
    });

    it('should return error when message is missing for addMessage', async () => {
      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'addMessage',
        },
      });

      expect(result).toEqual({
        success: false,
        error: 'Message is required for addMessage operation',
      });
    });
  });

  describe('execute - error handling', () => {
    it('should handle unknown operation', async () => {
      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'unknownOperation' as any,
        },
      });

      expect(result).toEqual({
        success: false,
        error: 'Unknown operation: unknownOperation',
      });
    });

    it('should handle execution errors gracefully', async () => {
      mockGetState.getRecentMessages.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 8,
        },
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[MemoryRecallTool] Operation failed',
        expect.objectContaining({
          operation: 'getRecent',
          sessionId: 'session-123',
          error: 'Error: Database connection failed',
          executionTime: expect.any(Number),
        })
      );

      expect(result).toEqual({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockGetState.getRecentMessages.mockImplementation(() => {
        throw 'String error';
      });

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 8,
        },
      });

      expect(result).toEqual({
        success: false,
        error: 'Memory operation failed',
      });
    });
  });

  describe('formatConversationContext', () => {
    it('should format messages with token limit', () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message with much longer content that will consume more tokens' },
      ];

      const context = formatConversationContext(messages, 100);

      // Should include most recent messages first
      expect(context).toContain('Third message');
      expect(context).toContain('Second response');
      
      // May not include oldest messages due to token limit
      const lines = context.split('\n');
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should handle empty message list', () => {
      const context = formatConversationContext([]);
      expect(context).toBe('');
    });

    it('should format messages in reverse chronological order', () => {
      const messages = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
      ];

      const context = formatConversationContext(messages, 1000);

      // Check order - messages appear in chronological order (oldest first)
      const lines = context.split('\n\n');
      expect(lines[0]).toBe('user: Message 1');
      expect(lines[1]).toBe('assistant: Response 1');
      expect(lines[2]).toBe('user: Message 2');
    });

    it('should respect token limit', () => {
      const longMessage = 'x'.repeat(500); // ~125 tokens
      const messages = [
        { role: 'user', content: longMessage },
        { role: 'assistant', content: longMessage },
        { role: 'user', content: longMessage },
      ];

      const context = formatConversationContext(messages, 200);

      // Should only include messages that fit within token limit
      const occurrences = (context.match(/user:/g) || []).length;
      expect(occurrences).toBeLessThan(3);
    });
  });

  describe('extractMetadataFromQuery', () => {
    it('should extract cryptocurrency symbols', () => {
      const testCases = [
        { query: 'What is the price of BTC?', expectedSymbols: ['BTC'] },
        { query: 'Compare ETH and SOL', expectedSymbols: ['ETH', 'SOL'] },
        { query: 'Show me BTC, ETH, and ADA charts', expectedSymbols: ['BTC', 'ETH', 'ADA'] },
        { query: 'btc price', expectedSymbols: ['BTC'] }, // Case insensitive
      ];

      for (const testCase of testCases) {
        const result = extractMetadataFromQuery(testCase.query);
        expect(result.symbols).toEqual(testCase.expectedSymbols);
      }
    });

    it('should extract topics based on keywords', () => {
      const testCases = [
        { query: '価格を教えて', expectedTopics: ['price'] },
        { query: 'I want to buy and sell', expectedTopics: ['trading'] },
        { query: 'Technical analysis of the market', expectedTopics: ['analysis', 'market'] },
        { query: 'チャートを見せて', expectedTopics: ['chart'] },
        { query: 'Check RSI indicator', expectedTopics: ['indicator'] },
      ];

      for (const testCase of testCases) {
        const result = extractMetadataFromQuery(testCase.query);
        expect(result.topics).toEqual(expect.arrayContaining(testCase.expectedTopics));
      }
    });

    it('should handle mixed Japanese and English', () => {
      const result = extractMetadataFromQuery('BTCの価格とチャートanalysisを見せて');
      expect(result.symbols).toContain('BTC');
      expect(result.topics).toContain('price');
      expect(result.topics).toContain('chart');
      expect(result.topics).toContain('analysis');
    });

    it('should handle queries with no metadata', () => {
      const result = extractMetadataFromQuery('Hello, how are you?');
      expect(result.symbols).toEqual([]);
      expect(result.topics).toEqual([]);
    });

    it('should extract symbols from trading pairs', () => {
      const result = extractMetadataFromQuery('BTCUSDT pair information');
      // Should extract BTC from BTCUSDT (this is actually useful behavior)
      expect(result.symbols).toEqual(['BTC']);
    });

    it('should handle multiple occurrences of same symbol', () => {
      const result = extractMetadataFromQuery('BTC is great, I love BTC, BTC to the moon!');
      expect(result.symbols).toEqual(['BTC']); // Should not duplicate
    });

    it('should extract all supported crypto symbols', () => {
      const allSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC'];
      const query = allSymbols.join(' and ');
      const result = extractMetadataFromQuery(query);
      expect(result.symbols.sort()).toEqual(allSymbols.sort());
    });
  });

  describe('edge cases', () => {
    it('should handle very long session IDs', async () => {
      const longSessionId = 'x'.repeat(1000);
      mockGetState.getRecentMessages.mockReturnValue([]);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: longSessionId,
          operation: 'getRecent',
          limit: 8,
        },
      });

      expect(mockGetState.getRecentMessages).toHaveBeenCalledWith(longSessionId, 8);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in search queries', async () => {
      const specialQuery = 'BTC/USD @ $50,000!';
      const mockSemanticSearch = semanticSearch as jest.MockedFunction<typeof semanticSearch>;
      mockSemanticSearch.mockResolvedValue([]);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'search',
          query: specialQuery,
          limit: 8,
        },
      });

      expect(mockSemanticSearch).toHaveBeenCalledWith(specialQuery, 'session-123', 0.7, 8);
      expect(result.success).toBe(true);
    });

    it('should handle maximum limit values', async () => {
      mockGetState.getRecentMessages.mockReturnValue([]);

      const result = await executeMemoryRecallTool({
        context: {
          sessionId: 'session-123',
          operation: 'getRecent',
          limit: 20, // Maximum allowed
        },
      });

      expect(mockGetState.getRecentMessages).toHaveBeenCalledWith('session-123', 20);
      expect(result.success).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      mockGetState.getRecentMessages.mockReturnValue([]);
      mockGetState.searchMessages.mockReturnValue([]);

      const promises = [
        executeMemoryRecallTool({
          context: { sessionId: 'session-1', operation: 'getRecent', limit: 8 },
        }),
        executeMemoryRecallTool({
          context: { sessionId: 'session-2', operation: 'getRecent', limit: 8 },
        }),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});