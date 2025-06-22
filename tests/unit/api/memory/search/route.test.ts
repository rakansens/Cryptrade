import { NextRequest } from 'next/server';
import { POST } from '@/app/api/memory/search/route';
import { conversationMemoryService } from '@/lib/services/conversation-memory.service';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/conversation-memory.service', () => ({
  conversationMemoryService: {
    searchMemories: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Memory Search API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/memory/search', () => {
    it('should search memories successfully with valid query', async () => {
      const mockSearchResults = [
        {
          id: 'memory-1',
          sessionId: 'session-1',
          content: 'BTCUSDT analysis shows bullish trend',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          metadata: {
            symbol: 'BTCUSDT',
            type: 'analysis'
          },
          relevanceScore: 0.95
        },
        {
          id: 'memory-2',
          sessionId: 'session-1',
          content: 'Support level at 45000',
          timestamp: new Date('2024-01-01T01:00:00Z'),
          metadata: {
            symbol: 'BTCUSDT',
            type: 'technical'
          },
          relevanceScore: 0.85
        }
      ];

      (conversationMemoryService.searchMemories as jest.Mock).mockResolvedValueOnce(mockSearchResults);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'BTCUSDT bullish',
          sessionId: 'session-1',
          limit: 10
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      // The API might convert timestamp to string
      const resultsWithStringTimestamp = mockSearchResults.map(result => ({
        ...result,
        timestamp: result.timestamp.toISOString()
      }));
      expect(data.results).toEqual(resultsWithStringTimestamp);
      expect(data.count).toBe(2);
      expect(conversationMemoryService.searchMemories).toHaveBeenCalledWith({
        query: 'BTCUSDT bullish',
        sessionId: 'session-1',
        limit: 10
      });
    });

    it('should handle missing query parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-1'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // Zod validation error format
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({ 
            path: ['query'],
            message: 'Required'
          })
        ])
      });
    });

    it('should use default limit when not provided', async () => {
      (conversationMemoryService.searchMemories as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test query'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(conversationMemoryService.searchMemories).toHaveBeenCalledWith({
        query: 'test query',
        limit: 20
      });
    });

    it('should handle invalid limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          limit: 'invalid'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({ 
            path: ['limit'],
            message: expect.stringContaining('number')
          })
        ])
      });
    });

    it('should handle limit exceeding maximum', async () => {
      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test',
          limit: 101
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({ 
            path: ['limit'],
            maximum: 100,
            message: expect.stringContaining('100')
          })
        ])
      });
    });

    it('should handle search with filters', async () => {
      (conversationMemoryService.searchMemories as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'analysis',
          sessionId: 'session-1',
          filters: {
            type: 'technical',
            symbol: 'BTCUSDT',
            dateRange: {
              start: '2024-01-01',
              end: '2024-01-31'
            }
          },
          limit: 50
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(conversationMemoryService.searchMemories).toHaveBeenCalledWith({
        query: 'analysis',
        sessionId: 'session-1',
        filters: {
          type: 'technical',
          symbol: 'BTCUSDT',
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31'
          }
        },
        limit: 50
      });
    });

    it('should handle service errors gracefully', async () => {
      const mockError = new Error('Search service error');
      (conversationMemoryService.searchMemories as jest.Mock).mockRejectedValueOnce(mockError);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'test'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      // createApiHandler returns the error message directly
      expect(data.error).toMatchObject({
        message: 'Search service error'
      });
      expect(logger.error).toHaveBeenCalledWith('[MemorySearch] Search failed', { error: mockError });
    });

    it('should handle empty search results', async () => {
      (conversationMemoryService.searchMemories as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'nonexistent query'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // createApiHandler handles JSON parsing and returns validation error
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({ 
            path: ['query']
          })
        ])
      });
    });

    it('should sanitize search query', async () => {
      (conversationMemoryService.searchMemories as jest.Mock).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({
          query: '<script>alert("xss")</script>test'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(conversationMemoryService.searchMemories).toHaveBeenCalledWith({
        query: 'test',
        limit: 20
      });
    });
  });
});