import { GET } from '@/app/api/analysis/sessions/[sessionId]/records/route';
import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/database/analysis.service', () => ({
  AnalysisService: {
    getSessionAnalyses: jest.fn(),
  },
}));

jest.mock('@/lib/api/analysis-api', () => ({
  AnalysisAPI: {
    convertToAnalysisRecord: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('GET /api/analysis/sessions/[sessionId]/records', () => {
  const sessionId = 'session-123';
  const mockRouteContext = {
    params: Promise.resolve({ sessionId }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return analyses for a specific session', async () => {
    const mockDbRecords = [
      {
        id: 'analysis-1',
        sessionId: 'session-123',
        symbol: 'BTC/USD',
        data: {
          patterns: [{ type: 'support', level: 40000 }],
          sentiment: 'bullish',
        },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: 'analysis-2',
        sessionId: 'session-123',
        symbol: 'ETH/USD',
        data: {
          patterns: [{ type: 'resistance', level: 2500 }],
          sentiment: 'neutral',
        },
        createdAt: new Date('2024-01-01T11:00:00Z'),
      },
    ];

    const mockApiRecords = [
      {
        id: 'analysis-1',
        sessionId: 'session-123',
        symbol: 'BTC/USD',
        patterns: [{ type: 'support', level: 40000 }],
        sentiment: 'bullish',
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        id: 'analysis-2',
        sessionId: 'session-123',
        symbol: 'ETH/USD',
        patterns: [{ type: 'resistance', level: 2500 }],
        sentiment: 'neutral',
        timestamp: '2024-01-01T11:00:00Z',
      },
    ];

    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock)
      .mockReturnValueOnce(mockApiRecords[0])
      .mockReturnValueOnce(mockApiRecords[1]);

    const request = new NextRequest('http://localhost:3000/api/analysis/sessions/session-123/records');
    const response = await GET(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: mockApiRecords });
    expect(AnalysisService.getSessionAnalyses).toHaveBeenCalledWith(sessionId);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledTimes(2);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledWith(mockDbRecords[0]);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledWith(mockDbRecords[1]);
  });

  it('should return empty array when session has no analyses', async () => {
    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/analysis/sessions/session-123/records');
    const response = await GET(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: [] });
    expect(AnalysisService.getSessionAnalyses).toHaveBeenCalledWith(sessionId);
    expect(AnalysisAPI.convertToAnalysisRecord).not.toHaveBeenCalled();
  });

  it('should handle service errors', async () => {
    const mockError = new Error('Database connection failed');
    (AnalysisService.getSessionAnalyses as jest.Mock).mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost:3000/api/analysis/sessions/session-123/records');
    const response = await GET(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to get session analyses' });
    expect(logger.error).toHaveBeenCalledWith('[API] Failed to get session analyses', { error: mockError });
  });

  it('should handle conversion errors', async () => {
    const mockDbRecords = [
      { id: 'analysis-1', sessionId: 'session-123', data: {} },
    ];

    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid data format');
    });

    const request = new NextRequest('http://localhost:3000/api/analysis/sessions/session-123/records');
    const response = await GET(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to get session analyses' });
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle different session IDs', async () => {
    const differentSessionId = 'session-456';
    const differentRouteContext = {
      params: Promise.resolve({ sessionId: differentSessionId }),
    };

    const mockDbRecords = [
      {
        id: 'analysis-1',
        sessionId: differentSessionId,
        symbol: 'BTC/USD',
        data: {},
      },
    ];

    const mockApiRecord = {
      id: 'analysis-1',
      sessionId: differentSessionId,
      symbol: 'BTC/USD',
    };

    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockReturnValue(mockApiRecord);

    const request = new NextRequest(`http://localhost:3000/api/analysis/sessions/${differentSessionId}/records`);
    const response = await GET(request, differentRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: [mockApiRecord] });
    expect(AnalysisService.getSessionAnalyses).toHaveBeenCalledWith(differentSessionId);
  });

  it('should handle large number of analyses', async () => {
    // Create 50 mock records
    const mockDbRecords = Array.from({ length: 50 }, (_, i) => ({
      id: `analysis-${i}`,
      sessionId: 'session-123',
      symbol: i % 2 === 0 ? 'BTC/USD' : 'ETH/USD',
      data: { sentiment: i % 3 === 0 ? 'bullish' : 'bearish' },
      createdAt: new Date(`2024-01-01T${10 + Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}:00Z`),
    }));

    const mockApiRecords = mockDbRecords.map((record, i) => ({
      id: record.id,
      sessionId: record.sessionId,
      symbol: record.symbol,
      sentiment: i % 3 === 0 ? 'bullish' : 'bearish',
      timestamp: record.createdAt.toISOString(),
    }));

    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockImplementation((record) => {
      const index = mockDbRecords.findIndex(r => r.id === record.id);
      return mockApiRecords[index];
    });

    const request = new NextRequest('http://localhost:3000/api/analysis/sessions/session-123/records');
    const response = await GET(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(50);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledTimes(50);
  });

  it('should handle special characters in session ID', async () => {
    const specialSessionId = 'session-123-abc_xyz';
    const specialRouteContext = {
      params: Promise.resolve({ sessionId: specialSessionId }),
    };

    (AnalysisService.getSessionAnalyses as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest(`http://localhost:3000/api/analysis/sessions/${encodeURIComponent(specialSessionId)}/records`);
    const response = await GET(request, specialRouteContext);

    expect(response.status).toBe(200);
    expect(AnalysisService.getSessionAnalyses).toHaveBeenCalledWith(specialSessionId);
  });
});