// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { enhancedLogger } from '@/lib/logging';

// Mock the enhanced logger
jest.mock('@/lib/logging', () => ({
  enhancedLogger: {
    getStats: jest.fn(),
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Logs Stats API Route', () => {
  const mockGetStats = enhancedLogger.getStats as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/logs/stats', () => {
    it('should return log statistics without filters', async () => {
      const mockStats = {
        total: 1000,
        byLevel: {
          debug: 200,
          info: 500,
          warn: 250,
          error: 50,
          critical: 0
        },
        bySource: {
          api: 400,
          websocket: 300,
          orchestrator: 200,
          tools: 100
        },
        byAgent: {
          orchestrator: 150,
          trading: 100,
          chartControl: 50
        },
        byTool: {
          'chart-control': 80,
          'market-data': 120,
          'proposal-generation': 100
        },
        averageDuration: 245.5,
        errorRate: 0.05,
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-02T00:00:00Z'
        }
      };

      mockGetStats.mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost/api/logs/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        ...mockStats,
        timestamp: expect.any(String)
      });
      expect(data.filter).toBeUndefined();
      expect(mockGetStats).toHaveBeenCalledWith({});
    });

    it('should filter stats by level', async () => {
      mockGetStats.mockResolvedValue({ total: 50 });

      const request = new NextRequest('http://localhost/api/logs/stats?level=error');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({ level: 'error' });
      expect(data.filter).toEqual({ level: 'error' });
    });

    it('should filter stats by multiple levels', async () => {
      mockGetStats.mockResolvedValue({ total: 100 });

      const request = new NextRequest('http://localhost/api/logs/stats?level=error,warn');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({ level: ['error', 'warn'] });
      expect(data.filter).toEqual({ level: ['error', 'warn'] });
    });

    it('should filter stats by source', async () => {
      mockGetStats.mockResolvedValue({ total: 200 });

      const request = new NextRequest('http://localhost/api/logs/stats?source=api,websocket');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({ source: ['api', 'websocket'] });
    });

    it('should filter stats by time range', async () => {
      mockGetStats.mockResolvedValue({ total: 300 });

      const from = '2024-01-01T00:00:00Z';
      const to = '2024-01-02T00:00:00Z';
      const request = new NextRequest(`http://localhost/api/logs/stats?from=${from}&to=${to}`);
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({
        timeRange: { from, to }
      });
      expect(data.filter).toEqual({
        timeRange: { from, to }
      });
    });

    it('should filter stats by agent and tool names', async () => {
      mockGetStats.mockResolvedValue({ total: 150 });

      const request = new NextRequest('http://localhost/api/logs/stats?agentName=orchestrator&toolName=chart-control');
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({
        agentName: 'orchestrator',
        toolName: 'chart-control'
      });
    });

    it('should handle multiple filters combined', async () => {
      mockGetStats.mockResolvedValue({ total: 75 });

      const request = new NextRequest(
        'http://localhost/api/logs/stats?level=error,warn&source=api&agentName=orchestrator&from=2024-01-01T00:00:00Z'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(mockGetStats).toHaveBeenCalledWith({
        level: ['error', 'warn'],
        source: 'api',
        agentName: 'orchestrator',
        timeRange: { from: '2024-01-01T00:00:00Z' }
      });
    });

    it('should handle empty statistics', async () => {
      mockGetStats.mockResolvedValue({
        total: 0,
        byLevel: {
          debug: 0,
          info: 0,
          warn: 0,
          error: 0,
          critical: 0
        },
        bySource: {},
        byAgent: {},
        byTool: {},
        averageDuration: 0,
        errorRate: 0,
        timeRange: null
      });

      const request = new NextRequest('http://localhost/api/logs/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(0);
      expect(data.errorRate).toBe(0);
    });

    it('should handle getStats errors', async () => {
      mockGetStats.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/logs/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Database error'
        })
      });
    });

    it('should include detailed breakdown in response', async () => {
      const detailedStats = {
        total: 5000,
        byLevel: {
          debug: 1000,
          info: 2500,
          warn: 1000,
          error: 400,
          critical: 100
        },
        bySource: {
          api: 2000,
          websocket: 1500,
          orchestrator: 1000,
          tools: 500
        },
        byAgent: {
          orchestrator: 800,
          trading: 600,
          chartControl: 400,
          uiState: 200
        },
        byTool: {
          'chart-control': 300,
          'market-data': 400,
          'proposal-generation': 200,
          'enhanced-line-analysis': 100
        },
        averageDuration: 123.45,
        errorRate: 0.1,
        peakHour: '14:00',
        topErrors: [
          { message: 'Connection timeout', count: 50 },
          { message: 'Rate limit exceeded', count: 30 }
        ],
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-02T00:00:00Z'
        }
      };

      mockGetStats.mockResolvedValue(detailedStats);

      const request = new NextRequest('http://localhost/api/logs/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toMatchObject(detailedStats);
      expect(data.timestamp).toBeDefined();
    });
  });
});