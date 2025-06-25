import { POST } from '@/app/api/analysis/records/[recordId]/touch/route';
import { NextRequest } from 'next/server';
import { AnalysisService } from '@/lib/services/database/analysis.service';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/database/analysis.service', () => ({
  AnalysisService: {
    recordTouchEvent: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('POST /api/analysis/records/[recordId]/touch', () => {
  const recordId = 'analysis-123';
  const mockRouteContext = {
    params: Promise.resolve({ recordId }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should record a touch event with all fields', async () => {
    const touchData = {
      price: 42000,
      result: 'bounce',
      strength: 85,
      volume: 1500000,
    };

    (AnalysisService.recordTouchEvent as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(touchData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(AnalysisService.recordTouchEvent).toHaveBeenCalledWith({
      recordId,
      price: 42000,
      result: 'bounce',
      strength: 85,
      volume: 1500000,
    });
  });

  it('should record a touch event without optional volume', async () => {
    const touchData = {
      price: 38000,
      result: 'break',
      strength: 65,
    };

    (AnalysisService.recordTouchEvent as jest.Mock).mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(touchData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(AnalysisService.recordTouchEvent).toHaveBeenCalledWith({
      recordId,
      price: 38000,
      result: 'break',
      strength: 65,
    });
  });

  it('should validate result enum values', async () => {
    const invalidData = {
      price: 40000,
      result: 'invalid-result', // Invalid enum value
      strength: 50,
    };

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
    expect(AnalysisService.recordTouchEvent).not.toHaveBeenCalled();
  });

  it('should validate price is positive', async () => {
    const invalidData = {
      price: -100, // Negative price
      result: 'test',
      strength: 50,
    };

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(AnalysisService.recordTouchEvent).not.toHaveBeenCalled();
  });

  it('should validate strength range (0-100)', async () => {
    const invalidData = {
      price: 40000,
      result: 'bounce',
      strength: 150, // Out of range
    };

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(AnalysisService.recordTouchEvent).not.toHaveBeenCalled();
  });

  it('should handle missing required fields', async () => {
    const incompleteData = {
      price: 40000,
      // Missing result and strength
    };

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(incompleteData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
    expect(AnalysisService.recordTouchEvent).not.toHaveBeenCalled();
  });

  it('should handle service errors', async () => {
    const touchData = {
      price: 42000,
      result: 'bounce',
      strength: 85,
    };

    const mockError = new Error('Database error');
    (AnalysisService.recordTouchEvent as jest.Mock).mockRejectedValue(mockError);

    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(touchData),
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to record touch event' });
    expect(logger.error).toHaveBeenCalledWith('[API] Failed to record touch event', { error: mockError });
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to record touch event' });
    expect(logger.error).toHaveBeenCalled();
    expect(AnalysisService.recordTouchEvent).not.toHaveBeenCalled();
  });

  it('should handle all valid result types', async () => {
    const resultTypes = ['bounce', 'break', 'test'];

    for (const result of resultTypes) {
      jest.clearAllMocks();
      
      const touchData = {
        price: 40000,
        result,
        strength: 70,
      };

      (AnalysisService.recordTouchEvent as jest.Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
        method: 'POST',
        body: JSON.stringify(touchData),
      });

      const response = await POST(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(AnalysisService.recordTouchEvent).toHaveBeenCalledWith({
        recordId,
        price: 40000,
        result,
        strength: 70,
      });
    }
  });

  it('should handle edge case strength values', async () => {
    // Test minimum strength (0)
    const minStrengthData = {
      price: 40000,
      result: 'test',
      strength: 0,
    };

    (AnalysisService.recordTouchEvent as jest.Mock).mockResolvedValue(undefined);

    let request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(minStrengthData),
    });

    let response = await POST(request, mockRouteContext);
    expect(response.status).toBe(200);

    // Test maximum strength (100)
    jest.clearAllMocks();
    const maxStrengthData = {
      price: 40000,
      result: 'test',
      strength: 100,
    };

    request = new NextRequest('http://localhost:3000/api/analysis/records/analysis-123/touch', {
      method: 'POST',
      body: JSON.stringify(maxStrengthData),
    });

    response = await POST(request, mockRouteContext);
    expect(response.status).toBe(200);
  });
});