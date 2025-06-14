// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';
import { enhancedLogger } from '@/lib/logging';

// Mock the enhanced logger
jest.mock('@/lib/logging', () => ({
  enhancedLogger: {
    query: jest.fn(),
    cleanup: jest.fn(),
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Logs API Route', () => {
  const mockQuery = enhancedLogger.query as jest.Mock;
  const mockCleanup = enhancedLogger.cleanup as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/logs', () => {
    it('should query logs with default pagination', async () => {
      const mockLogs = {
        logs: [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Test log',
            source: 'test',
          }
        ],
        total: 1,
        page: 1,
        limit: 50,
      };

      mockQuery.mockResolvedValue(mockLogs);

      const request = new NextRequest('http://localhost/api/logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockLogs);
      
      expect(mockQuery).toHaveBeenCalledWith(
        {},
        {
          page: 1,
          limit: 50,
          sortBy: 'timestamp',
          order: 'desc',
        }
      );
    });

    it('should filter logs by level', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?level=error');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { level: 'error' },
        expect.any(Object)
      );
    });

    it('should filter logs by multiple levels', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?level=error,warn');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { level: ['error', 'warn'] },
        expect.any(Object)
      );
    });

    it('should filter logs by time range', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const from = '2024-01-01T00:00:00Z';
      const to = '2024-01-02T00:00:00Z';
      const request = new NextRequest(`http://localhost/api/logs?from=${from}&to=${to}`);
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        {
          timeRange: { from, to }
        },
        expect.any(Object)
      );
    });

    it('should filter logs by source', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?source=api,websocket');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { source: ['api', 'websocket'] },
        expect.any(Object)
      );
    });

    it('should filter logs by correlation ID', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?correlationId=abc123');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { correlationId: 'abc123' },
        expect.any(Object)
      );
    });

    it('should filter logs by agent and tool names', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?agentName=orchestrator&toolName=chart-control');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { 
          agentName: 'orchestrator',
          toolName: 'chart-control'
        },
        expect.any(Object)
      );
    });

    it('should support search parameter', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?search=error%20occurred');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { search: 'error occurred' },
        expect.any(Object)
      );
    });

    it('should filter by tags', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?tags=performance,critical');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { tags: ['performance', 'critical'] },
        expect.any(Object)
      );
    });

    it('should filter by duration range', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?minDuration=100&maxDuration=5000');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        { 
          minDuration: 100,
          maxDuration: 5000
        },
        expect.any(Object)
      );
    });

    it('should handle custom pagination parameters', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest('http://localhost/api/logs?page=3&limit=20&sortBy=level&order=asc');
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        {},
        {
          page: 3,
          limit: 20,
          sortBy: 'level',
          order: 'asc',
        }
      );
    });

    it('should handle complex filter combinations', async () => {
      mockQuery.mockResolvedValue({ logs: [], total: 0 });

      const request = new NextRequest(
        'http://localhost/api/logs?level=error,warn&source=api&sessionId=sess123&search=failed&tags=bug&minDuration=1000'
      );
      await GET(request);

      expect(mockQuery).toHaveBeenCalledWith(
        {
          level: ['error', 'warn'],
          source: 'api',
          sessionId: 'sess123',
          search: 'failed',
          tags: ['bug'],
          minDuration: 1000,
        },
        expect.any(Object)
      );
    });
  });

  describe('DELETE /api/logs', () => {
    it('should delete logs with filter', async () => {
      mockCleanup.mockResolvedValue(10);

      const request = new NextRequest('http://localhost/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'debug',
          timeRange: {
            to: '2024-01-01T00:00:00Z'
          }
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ deleted: 10 });
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should prevent deletion without filter', async () => {
      const request = new NextRequest('http://localhost/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Filter required for deletion'
        })
      });
      expect(mockCleanup).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      mockCleanup.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'debug' })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Database error'
        })
      });
    });
  });
});