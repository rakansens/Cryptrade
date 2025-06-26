import { POST } from '@/app/api/analysis/records/route';
import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { createApiSuccessResponse, createApiErrorResponse } from '@/app/api/utils/responses';

// Mock dependencies
jest.mock('@/lib/services/database/analysis.service', () => ({
  AnalysisService: {
    saveAnalysis: jest.fn(),
  },
}));

jest.mock('@/app/api/utils/responses', () => ({
  createApiSuccessResponse: jest.fn((data) => new Response(JSON.stringify(data), { status: 200 })),
  createApiErrorResponse: jest.fn((message, status = 500) => new Response(JSON.stringify({ error: message }), { status })),
}));

describe('POST /api/analysis/records', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save analysis record and return recordId', async () => {
    const mockRecordId = 'analysis-123';
    const analysisData = {
      symbol: 'BTC/USD',
      timeframe: '1h',
      patterns: [
        {
          type: 'support',
          level: 42000,
          strength: 85,
        },
      ],
      sentiment: 'bullish',
      confidence: 75,
    };

    (AnalysisService.saveAnalysis as jest.Mock).mockResolvedValue(mockRecordId);

    const request = new NextRequest('http://localhost:3000/api/analysis/records', {
      method: 'POST',
      body: JSON.stringify(analysisData),
    });

    const response = await POST(request);

    expect(AnalysisService.saveAnalysis).toHaveBeenCalledWith(analysisData);
    expect(createApiSuccessResponse).toHaveBeenCalledWith({ recordId: mockRecordId });
  });

  it('should handle empty analysis data', async () => {
    const mockRecordId = 'analysis-empty';
    const emptyData = {};

    (AnalysisService.saveAnalysis as jest.Mock).mockResolvedValue(mockRecordId);

    const request = new NextRequest('http://localhost:3000/api/analysis/records', {
      method: 'POST',
      body: JSON.stringify(emptyData),
    });

    const response = await POST(request);

    expect(AnalysisService.saveAnalysis).toHaveBeenCalledWith(emptyData);
    expect(createApiSuccessResponse).toHaveBeenCalledWith({ recordId: mockRecordId });
  });

  it('should handle service errors', async () => {
    const mockError = new Error('Database connection failed');
    const analysisData = {
      symbol: 'ETH/USD',
      timeframe: '4h',
    };

    (AnalysisService.saveAnalysis as jest.Mock).mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost:3000/api/analysis/records', {
      method: 'POST',
      body: JSON.stringify(analysisData),
    });

    const response = await POST(request);

    expect(createApiErrorResponse).toHaveBeenCalledWith('Database connection failed', 500);
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/analysis/records', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(createApiErrorResponse).toHaveBeenCalled();
    expect(AnalysisService.saveAnalysis).not.toHaveBeenCalled();
  });

  it('should handle complex nested analysis data', async () => {
    const mockRecordId = 'analysis-complex';
    const complexData = {
      symbol: 'BTC/USD',
      timeframe: '1d',
      patterns: [
        {
          type: 'resistance',
          level: 45000,
          strength: 90,
          touches: 3,
          lastTouchTime: new Date('2024-01-01T12:00:00Z').toISOString(),
        },
        {
          type: 'support',
          level: 40000,
          strength: 80,
          touches: 5,
        },
      ],
      indicators: {
        rsi: { value: 65, signal: 'overbought' },
        macd: { value: 100, signal: 'bullish', histogram: 50 },
        movingAverages: {
          ma20: 42000,
          ma50: 41000,
          ma200: 38000,
        },
      },
      sentiment: 'bullish',
      confidence: 85,
      metadata: {
        analysisVersion: '2.0',
        modelUsed: 'enhanced-pattern-recognition',
        timestamp: new Date().toISOString(),
      },
    };

    (AnalysisService.saveAnalysis as jest.Mock).mockResolvedValue(mockRecordId);

    const request = new NextRequest('http://localhost:3000/api/analysis/records', {
      method: 'POST',
      body: JSON.stringify(complexData),
    });

    const response = await POST(request);

    expect(AnalysisService.saveAnalysis).toHaveBeenCalledWith(complexData);
    expect(createApiSuccessResponse).toHaveBeenCalledWith({ recordId: mockRecordId });
  });
});