import { GET } from '@/app/api/analysis/active/route';
import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/database/analysis.service', () => ({
  AnalysisService: {
    getActiveAnalyses: jest.fn(),
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

describe('GET /api/analysis/active', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all active analyses without symbol filter', async () => {
    const mockDbRecords = [
      {
        id: '1',
        symbol: 'BTC/USD',
        data: { patterns: [], sentiment: 'neutral' },
        isActive: true,
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        symbol: 'ETH/USD',
        data: { patterns: [], sentiment: 'bullish' },
        isActive: true,
        createdAt: new Date('2024-01-01T11:00:00Z'),
      },
    ];

    const mockApiRecords = [
      {
        id: '1',
        symbol: 'BTC/USD',
        patterns: [],
        sentiment: 'neutral',
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        id: '2',
        symbol: 'ETH/USD',
        patterns: [],
        sentiment: 'bullish',
        timestamp: '2024-01-01T11:00:00Z',
      },
    ];

    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock)
      .mockReturnValueOnce(mockApiRecords[0])
      .mockReturnValueOnce(mockApiRecords[1]);

    const request = new NextRequest('http://localhost:3000/api/analysis/active');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: mockApiRecords });
    expect(AnalysisService.getActiveAnalyses).toHaveBeenCalledWith(undefined);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledTimes(2);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledWith(mockDbRecords[0]);
    expect(AnalysisAPI.convertToAnalysisRecord).toHaveBeenCalledWith(mockDbRecords[1]);
  });

  it('should filter active analyses by symbol', async () => {
    const mockDbRecords = [
      {
        id: '1',
        symbol: 'BTC/USD',
        data: { patterns: [], sentiment: 'bullish' },
        isActive: true,
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    const mockApiRecord = {
      id: '1',
      symbol: 'BTC/USD',
      patterns: [],
      sentiment: 'bullish',
      timestamp: '2024-01-01T10:00:00Z',
    };

    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockReturnValue(mockApiRecord);

    const request = new NextRequest('http://localhost:3000/api/analysis/active?symbol=BTC/USD');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: [mockApiRecord] });
    expect(AnalysisService.getActiveAnalyses).toHaveBeenCalledWith('BTC/USD');
  });

  it('should return empty array when no active analyses exist', async () => {
    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/analysis/active');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ records: [] });
    expect(AnalysisService.getActiveAnalyses).toHaveBeenCalledWith(undefined);
    expect(AnalysisAPI.convertToAnalysisRecord).not.toHaveBeenCalled();
  });

  it('should handle service errors', async () => {
    const mockError = new Error('Database connection failed');
    (AnalysisService.getActiveAnalyses as jest.Mock).mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost:3000/api/analysis/active');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to get active analyses' });
    expect(logger.error).toHaveBeenCalledWith('[API] Failed to get active analyses', { error: mockError });
  });

  it('should handle multiple symbol queries (use first one)', async () => {
    const mockDbRecords = [
      {
        id: '1',
        symbol: 'BTC/USD',
        data: { patterns: [] },
        isActive: true,
      },
    ];

    const mockApiRecord = { id: '1', symbol: 'BTC/USD' };

    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockReturnValue(mockApiRecord);

    // Multiple symbol parameters - should use first one
    const request = new NextRequest('http://localhost:3000/api/analysis/active?symbol=BTC/USD&symbol=ETH/USD');
    const response = await GET(request);

    expect(AnalysisService.getActiveAnalyses).toHaveBeenCalledWith('BTC/USD');
  });

  it('should handle conversion errors gracefully', async () => {
    const mockDbRecords = [
      { id: '1', symbol: 'BTC/USD', data: {} },
      { id: '2', symbol: 'ETH/USD', data: {} },
    ];

    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    // First conversion succeeds, second fails
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock)
      .mockReturnValueOnce({ id: '1', symbol: 'BTC/USD' })
      .mockImplementationOnce(() => {
        throw new Error('Conversion failed');
      });

    const request = new NextRequest('http://localhost:3000/api/analysis/active');
    const response = await GET(request);

    // Should fail the entire request
    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle empty symbol parameter', async () => {
    const mockDbRecords = [{ id: '1', symbol: 'BTC/USD' }];
    const mockApiRecord = { id: '1', symbol: 'BTC/USD' };

    (AnalysisService.getActiveAnalyses as jest.Mock).mockResolvedValue(mockDbRecords);
    (AnalysisAPI.convertToAnalysisRecord as jest.Mock).mockReturnValue(mockApiRecord);

    // Empty symbol parameter is treated as undefined by Next.js
    const request = new NextRequest('http://localhost:3000/api/analysis/active?symbol=');
    const response = await GET(request);

    expect(AnalysisService.getActiveAnalyses).toHaveBeenCalledWith(undefined);
  });
});