import 'dotenv/config';
import { config } from 'dotenv';
import { 
  createMockFetchResponse,
  mockFetch,
  createTestSessionId 
} from '../../helpers/test-utils';
import { MockAPIResponseBuilder } from '../../helpers/mock-builders';

// Load environment variables
config({ path: '.env.local' });

describe('Memory API Integration Tests', () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = mockFetch([]);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Conversation Memory Persistence', () => {
    const sessionId = createTestSessionId('memory');

    test('should save conversation to memory', async () => {
      const conversationData = {
        sessionId,
        message: 'BTCの価格を教えて',
        response: 'BTCの現在価格は$45,000です。',
        metadata: {
          intent: 'price_inquiry',
          confidence: 0.95,
          processedBy: 'trading-agent'
        }
      };

      const mockResponse = new MockAPIResponseBuilder()
        .withData({ success: true, id: 'conv-123' })
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });

      const result = await response.json();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/save'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(conversationData)
        })
      );
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    test('should recall conversation history', async () => {
      const mockHistory = {
        conversations: [
          {
            id: 'conv-1',
            sessionId,
            message: 'BTCの価格は？',
            response: 'BTCは$45,000です',
            timestamp: new Date().toISOString(),
            metadata: { intent: 'price_inquiry' }
          },
          {
            id: 'conv-2',
            sessionId,
            message: 'さらに詳しく分析して',
            response: 'BTCは上昇トレンドにあります...',
            timestamp: new Date().toISOString(),
            metadata: { intent: 'analysis' }
          }
        ],
        totalCount: 2
      };

      const mockResponse = new MockAPIResponseBuilder()
        .withData(mockHistory)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/recall?sessionId=${sessionId}`);
      const result = await response.json();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/memory/recall?sessionId=${sessionId}`),
        expect.any(Object)
      );
      expect(result.conversations).toHaveLength(2);
      expect(result.conversations[0].message).toBe('BTCの価格は？');
    });

    test('should handle memory recall with limit', async () => {
      const limit = 5;
      const mockResponse = new MockAPIResponseBuilder()
        .withData({
          conversations: Array(limit).fill(null).map((_, i) => ({
            id: `conv-${i}`,
            message: `Message ${i}`,
            response: `Response ${i}`,
            timestamp: new Date().toISOString()
          })),
          totalCount: 10
        })
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(
        `${baseUrl}/api/memory/recall?sessionId=${sessionId}&limit=${limit}`
      );
      const result = await response.json();

      expect(result.conversations).toHaveLength(limit);
      expect(result.totalCount).toBe(10);
    });
  });

  describe('Semantic Search', () => {
    test('should search conversations by content', async () => {
      const searchQuery = 'エントリーポイント';
      const mockResults = {
        results: [
          {
            id: 'conv-123',
            message: 'エントリーポイントを教えて',
            response: 'サポートライン付近の$44,500がエントリーポイントです',
            similarity: 0.92,
            timestamp: new Date().toISOString()
          },
          {
            id: 'conv-456',
            message: 'いつエントリーすべき？',
            response: 'RSIが30以下になったタイミングでエントリー',
            similarity: 0.85,
            timestamp: new Date().toISOString()
          }
        ],
        totalResults: 2
      };

      const mockResponse = new MockAPIResponseBuilder()
        .withData(mockResults)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 })
      });

      const result = await response.json();

      expect(result.results).toHaveLength(2);
      expect(result.results[0].similarity).toBeGreaterThan(0.9);
      expect(result.results[0].message).toContain('エントリーポイント');
    });

    test('should filter search by date range', async () => {
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const dateTo = new Date();

      const mockResponse = new MockAPIResponseBuilder()
        .withData({ results: [], totalResults: 0 })
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      await fetch(`${baseUrl}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'BTC',
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString()
        })
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('dateFrom')
        })
      );
    });
  });

  describe('Streaming with Memory Integration', () => {
    test('should maintain context in streaming conversations', async () => {
      const sessionId = createTestSessionId('stream');
      
      // Mock streaming response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"chunk": "BTC"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"chunk": "の価格は"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"chunk": "$45,000です"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: mockStream,
        json: jest.fn(),
        text: jest.fn(),
        blob: jest.fn(),
        arrayBuffer: jest.fn(),
        formData: jest.fn(),
        clone: jest.fn()
      } as unknown as Response;

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'BTCの価格を教えて',
          agentId: 'tradingAgent',
          sessionId
        })
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      // Read stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
        }
      }

      expect(content).toContain('BTC');
      expect(content).toContain('45,000');
    });

    test('should handle follow-up questions with context', async () => {
      const sessionId = createTestSessionId('followup');
      
      // First message
      const firstMessage = {
        message: 'BTCについて教えて',
        agentId: 'tradingAgent',
        sessionId
      };

      const mockResponse1 = new MockAPIResponseBuilder()
        .withData({ response: 'BTCは最も人気のある暗号通貨です。' })
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse1);

      await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstMessage)
      });

      // Follow-up message
      const followUpMessage = {
        message: 'その価格は？', // Context-dependent question
        agentId: 'tradingAgent',
        sessionId
      };

      const mockResponse2 = new MockAPIResponseBuilder()
        .withData({ response: 'BTCの現在価格は$45,000です。' })
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse2);

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpMessage)
      });

      const result = await response.json();

      expect(result.response).toContain('BTC');
      expect(result.response).toContain('45,000');
    });
  });

  describe('Memory Analytics', () => {
    test('should get conversation statistics', async () => {
      const mockStats = {
        totalConversations: 150,
        uniqueSessions: 25,
        averageConversationLength: 4.5,
        topIntents: [
          { intent: 'price_inquiry', count: 45 },
          { intent: 'analysis', count: 38 },
          { intent: 'ui_control', count: 27 }
        ],
        recentActivity: {
          last24Hours: 32,
          last7Days: 89,
          last30Days: 150
        }
      };

      const mockResponse = new MockAPIResponseBuilder()
        .withData(mockStats)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/stats`);
      const result = await response.json();

      expect(result.totalConversations).toBe(150);
      expect(result.topIntents).toHaveLength(3);
      expect(result.topIntents[0].intent).toBe('price_inquiry');
    });

    test('should export conversation history', async () => {
      const sessionId = createTestSessionId('export');
      
      const mockExport = {
        sessionId,
        exportDate: new Date().toISOString(),
        conversations: [
          { message: 'Test 1', response: 'Response 1' },
          { message: 'Test 2', response: 'Response 2' }
        ],
        format: 'json'
      };

      const mockResponse = new MockAPIResponseBuilder()
        .withData(mockExport)
        .withHeader('content-disposition', 'attachment; filename=conversations.json')
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/export?sessionId=${sessionId}`);
      const result = await response.json();

      expect(result.conversations).toHaveLength(2);
      expect(result.format).toBe('json');
      expect(response.headers.get('content-disposition')).toContain('conversations.json');
    });
  });

  describe('Error Handling', () => {
    test('should handle memory save failures', async () => {
      const mockResponse = new MockAPIResponseBuilder()
        .withError({ error: 'Database connection failed' }, 500)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test', message: 'test' })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    test('should handle invalid session ID', async () => {
      const mockResponse = new MockAPIResponseBuilder()
        .withError({ error: 'Invalid session ID' }, 400)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/recall?sessionId=`);

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    test('should handle memory quota exceeded', async () => {
      const mockResponse = new MockAPIResponseBuilder()
        .withError({ 
          error: 'Memory quota exceeded',
          details: {
            used: 1000,
            limit: 1000,
            sessionId: 'test'
          }
        }, 429)
        .build();

      fetchMock.mockResolvedValueOnce(mockResponse);

      const response = await fetch(`${baseUrl}/api/memory/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test', message: 'exceeds quota' })
      });

      expect(response.status).toBe(429);
      const error = await response.json();
      expect(error.error).toContain('quota');
    });
  });
});