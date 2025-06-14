// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, POST, OPTIONS } from '../route';
import { 
  getMarketDataCircuitBreakerStatus, 
  resetMarketDataCircuitBreaker 
} from '@/lib/mastra/tools/market-data-resilient.tool';

// Mock the circuit breaker functions
jest.mock('@/lib/mastra/tools/market-data-resilient.tool', () => ({
  getMarketDataCircuitBreakerStatus: jest.fn(),
  resetMarketDataCircuitBreaker: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Circuit Breaker API Route', () => {
  const mockGetStatus = getMarketDataCircuitBreakerStatus as jest.Mock;
  const mockReset = resetMarketDataCircuitBreaker as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/monitoring/circuit-breaker', () => {
    it('should return circuit breaker status', async () => {
      const mockStatus = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        successRate: 100,
      };

      mockGetStatus.mockReturnValue(mockStatus);

      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        timestamp: expect.any(String),
        circuitBreaker: {
          marketData: mockStatus
        }
      });
      expect(mockGetStatus).toHaveBeenCalled();
    });

    it('should handle open circuit breaker state', async () => {
      const mockStatus = {
        state: 'open',
        failureCount: 5,
        lastFailureTime: new Date().toISOString(),
        nextAttemptTime: new Date(Date.now() + 60000).toISOString(),
        successRate: 0,
      };

      mockGetStatus.mockReturnValue(mockStatus);

      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.circuitBreaker.marketData).toEqual(mockStatus);
    });

    it('should handle half-open circuit breaker state', async () => {
      const mockStatus = {
        state: 'half-open',
        failureCount: 3,
        lastFailureTime: new Date(Date.now() - 30000).toISOString(),
        nextAttemptTime: null,
        successRate: 40,
      };

      mockGetStatus.mockReturnValue(mockStatus);

      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.circuitBreaker.marketData.state).toBe('half-open');
    });
  });

  describe('POST /api/monitoring/circuit-breaker', () => {
    it('should reset circuit breaker with valid admin authorization', async () => {
      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer admin-secret'
        },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Circuit breaker reset successfully'
      });
      expect(mockReset).toHaveBeenCalled();
    });

    it('should reject request without authorization', async () => {
      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Unauthorized: Admin access required'
        })
      });
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization', async () => {
      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer wrong-token'
        },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Unauthorized: Admin access required'
        })
      });
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('should handle reset errors', async () => {
      mockReset.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      const request = new NextRequest('http://localhost/api/monitoring/circuit-breaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer admin-secret'
        },
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Reset failed'
        })
      });
    });
  });

  describe('OPTIONS /api/monitoring/circuit-breaker', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toMatch(/GET|POST|OPTIONS/);
    });
  });
});