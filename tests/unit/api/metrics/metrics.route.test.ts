// Setup test environment before any imports
import { mockTestEnv } from '@/tests/helpers/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/metrics/route';
import { metricsCollector } from '@/lib/monitoring/metrics';

// Mock the metrics collector
jest.mock('@/lib/monitoring/metrics', () => ({
  metricsCollector: {
    export: jest.fn(),
    toJSON: jest.fn(),
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock authentication
jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      email: 'test@example.com'
    }
  })
}));

describe('Metrics API Route', () => {
  const mockExport = metricsCollector.export as jest.Mock;
  const mockToJSON = metricsCollector.toJSON as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/metrics', () => {
    it('should return metrics in Prometheus format by default', async () => {
      const successCount = Math.floor(30 + Math.random() * 70);
      const failedCount = Math.floor(Math.random() * 10);
      const queueSize = Math.floor(Math.random() * 20);
      
      const prometheusMetrics = `# HELP drawing_success_total Total number of successful drawing operations
# TYPE drawing_success_total counter
drawing_success_total ${successCount}

# HELP drawing_failed_total Total number of failed drawing operations
# TYPE drawing_failed_total counter
drawing_failed_total ${failedCount}

# HELP drawing_queue_size Current size of the drawing operation queue
# TYPE drawing_queue_size gauge
drawing_queue_size ${queueSize}`;

      mockExport.mockReturnValue(prometheusMetrics);

      const request = new NextRequest('http://localhost/api/metrics');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/plain; version=0.0.4');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(text).toBe(prometheusMetrics);
      expect(mockExport).toHaveBeenCalled();
    });

    it('should return metrics in Prometheus format when explicitly requested', async () => {
      const metricValue = Math.floor(50 + Math.random() * 150);
      const prometheusMetrics = `# TYPE test_metric counter
test_metric ${metricValue}`;

      mockExport.mockReturnValue(prometheusMetrics);

      const request = new NextRequest('http://localhost/api/metrics?format=prometheus');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/plain; version=0.0.4');
      expect(text).toBe(prometheusMetrics);
    });

    it('should return metrics in JSON format when requested', async () => {
      const successValue = Math.floor(20 + Math.random() * 80);
      const failedValue = Math.floor(Math.random() * 15);
      const queueValue = Math.floor(Math.random() * 25);
      
      const jsonMetrics = {
        drawing_success_total: {
          type: 'counter',
          value: successValue,
          help: 'Total number of successful drawing operations'
        },
        drawing_failed_total: {
          type: 'counter',
          value: failedValue,
          help: 'Total number of failed drawing operations'
        },
        drawing_queue_size: {
          type: 'gauge',
          value: queueValue,
          help: 'Current size of the drawing operation queue'
        }
      };

      mockToJSON.mockReturnValue(jsonMetrics);

      const request = new NextRequest('http://localhost/api/metrics?format=json');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(jsonMetrics);
      expect(mockToJSON).toHaveBeenCalled();
    });

    it('should handle invalid format parameter', async () => {
      const request = new NextRequest('http://localhost/api/metrics?format=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
      expect(data.details).toBeDefined();
      expect(data.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['format'],
            message: expect.stringContaining("Expected 'prometheus' | 'json'")
          })
        ])
      );
    });

    it('should include CORS headers for all formats', async () => {
      // Test Prometheus format
      mockExport.mockReturnValue('test_metric 1');
      let request = new NextRequest('http://localhost/api/metrics');
      let response = await GET(request);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');

      // Test JSON format
      mockToJSON.mockReturnValue({});
      request = new NextRequest('http://localhost/api/metrics?format=json');
      response = await GET(request);

      // JSON format goes through standard handler which adds CORS headers
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('should handle empty metrics', async () => {
      mockExport.mockReturnValue('');

      const request = new NextRequest('http://localhost/api/metrics');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe('');
    });

    it('should handle metrics with labels', async () => {
      const getRequests = Math.floor(50 + Math.random() * 150);
      const postRequests = Math.floor(20 + Math.random() * 80);
      
      const metricsWithLabels = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/chat"} ${getRequests}
http_requests_total{method="POST",path="/api/chat"} ${postRequests}`;

      mockExport.mockReturnValue(metricsWithLabels);

      const request = new NextRequest('http://localhost/api/metrics');
      const response = await GET(request);
      const text = await response.text();

      expect(text).toBe(metricsWithLabels);
    });
  });
});