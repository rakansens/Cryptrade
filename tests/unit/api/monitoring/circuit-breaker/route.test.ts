import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/monitoring/circuit-breaker/route';
import { circuitBreakerService } from '@/lib/services/circuit-breaker.service';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/circuit-breaker.service', () => ({
  circuitBreakerService: {
    getStatus: jest.fn(),
    getAllStatuses: jest.fn(),
    reset: jest.fn(),
    resetAll: jest.fn(),
    trip: jest.fn(),
    getMetrics: jest.fn()
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

describe('Circuit Breaker Monitoring API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/monitoring/circuit-breaker', () => {
    it('should return circuit breaker status for specific service', async () => {
      const mockStatus = {
        service: 'binance-api',
        state: 'closed',
        failures: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        successCount: 150,
        errorRate: 0
      };

      (circuitBreakerService.getStatus as jest.Mock).mockReturnValueOnce(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker?service=binance-api');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockStatus);
      expect(circuitBreakerService.getStatus).toHaveBeenCalledWith('binance-api');
    });

    it('should return all circuit breaker statuses when no service specified', async () => {
      const mockStatuses = {
        'binance-api': {
          service: 'binance-api',
          state: 'closed',
          failures: 0,
          successCount: 150,
          errorRate: 0
        },
        'database': {
          service: 'database',
          state: 'open',
          failures: 5,
          successCount: 10,
          errorRate: 0.33
        }
      };

      (circuitBreakerService.getAllStatuses as jest.Mock).mockReturnValueOnce(mockStatuses);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockStatuses);
      expect(circuitBreakerService.getAllStatuses).toHaveBeenCalled();
    });

    it('should handle service not found', async () => {
      (circuitBreakerService.getStatus as jest.Mock).mockReturnValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker?service=unknown');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Service not found');
    });

    it('should include metrics when requested', async () => {
      const mockStatus = {
        service: 'binance-api',
        state: 'closed'
      };
      const mockMetrics = {
        totalRequests: 1000,
        totalFailures: 10,
        totalSuccesses: 990,
        averageResponseTime: 125,
        p95ResponseTime: 250,
        p99ResponseTime: 500
      };

      (circuitBreakerService.getStatus as jest.Mock).mockReturnValueOnce(mockStatus);
      (circuitBreakerService.getMetrics as jest.Mock).mockReturnValueOnce(mockMetrics);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker?service=binance-api&includeMetrics=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        ...mockStatus,
        metrics: mockMetrics
      });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Circuit breaker service error');
      (circuitBreakerService.getAllStatuses as jest.Mock).mockRejectedValueOnce(mockError);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to get circuit breaker status');
      expect(logger.error).toHaveBeenCalledWith('[CircuitBreaker] Failed to get status', { error: mockError });
    });
  });

  describe('POST /api/monitoring/circuit-breaker', () => {
    it('should reset circuit breaker for specific service', async () => {
      (circuitBreakerService.reset as jest.Mock).mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset',
          service: 'binance-api'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Circuit breaker reset successfully');
      expect(circuitBreakerService.reset).toHaveBeenCalledWith('binance-api');
    });

    it('should reset all circuit breakers', async () => {
      (circuitBreakerService.resetAll as jest.Mock).mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'resetAll'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('All circuit breakers reset successfully');
      expect(circuitBreakerService.resetAll).toHaveBeenCalled();
    });

    it('should trip circuit breaker manually', async () => {
      (circuitBreakerService.trip as jest.Mock).mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'trip',
          service: 'database',
          reason: 'Manual intervention required'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Circuit breaker tripped successfully');
      expect(circuitBreakerService.trip).toHaveBeenCalledWith('database', 'Manual intervention required');
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          // Missing action
          service: 'binance-api'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Action is required');
    });

    it('should validate action values', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid-action',
          service: 'binance-api'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid action');
    });

    it('should require service for reset and trip actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset'
          // Missing service
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Service is required for reset action');
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Reset failed');
      (circuitBreakerService.reset as jest.Mock).mockRejectedValueOnce(mockError);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset',
          service: 'binance-api'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to perform circuit breaker action');
      expect(logger.error).toHaveBeenCalledWith('[CircuitBreaker] Action failed', {
        action: 'reset',
        service: 'binance-api',
        error: mockError
      });
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('should log successful actions', async () => {
      (circuitBreakerService.reset as jest.Mock).mockResolvedValueOnce(true);

      const request = new NextRequest('http://localhost:3000/api/monitoring/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reset',
          service: 'binance-api'
        })
      });

      await POST(request);

      expect(logger.info).toHaveBeenCalledWith('[CircuitBreaker] Action performed', {
        action: 'reset',
        service: 'binance-api'
      });
    });
  });
});