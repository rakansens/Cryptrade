import { NextRequest } from 'next/server';
import { GET } from '@/app/api/binance/klines/route';
import { fetchKlines } from '@/lib/services/binance-api.service';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/services/binance-api.service');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Binance Klines API Route', () => {
  const mockFetchKlines = fetchKlines as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/binance/klines', () => {
    it('should fetch klines successfully with valid parameters', async () => {
      const mockKlines = [
        {
          time: 1640995200,
          open: 46000,
          high: 46500,
          low: 45800,
          close: 46200,
          volume: 1000
        }
      ];

      mockFetchKlines.mockResolvedValueOnce(mockKlines);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockKlines);
      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
    });

    it('should use default values when parameters are missing', async () => {
      mockFetchKlines.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/binance/klines');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
    });

    it('should handle invalid limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines?limit=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid limit parameter');
    });

    it('should handle limit exceeding maximum', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines?limit=1500');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Limit cannot exceed 1000');
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Binance API error');
      mockFetchKlines.mockRejectedValueOnce(mockError);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch klines');
      expect(logger.error).toHaveBeenCalledWith('[BinanceKlines] Failed to fetch klines', { error: mockError });
    });

    it('should handle empty response from API', async () => {
      mockFetchKlines.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=ETHUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('should validate interval parameter', async () => {
      mockFetchKlines.mockResolvedValueOnce([]);

      const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
      
      for (const interval of validIntervals) {
        const request = new NextRequest(`http://localhost:3000/api/binance/klines?interval=${interval}`);
        const response = await GET(request);
        expect(response.status).toBe(200);
      }
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.name = 'RateLimitError';
      mockFetchKlines.mockRejectedValueOnce(rateLimitError);

      const request = new NextRequest('http://localhost:3000/api/binance/klines');
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockFetchKlines.mockRejectedValueOnce(timeoutError);

      const request = new NextRequest('http://localhost:3000/api/binance/klines');
      const response = await GET(request);

      expect(response.status).toBe(504);
      const data = await response.json();
      expect(data.error).toBe('Request timeout');
    });

    it('should handle concurrent requests', async () => {
      const mockData = [{ time: 1640995200, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 }];
      mockFetchKlines.mockResolvedValue(mockData);

      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT')
      );

      const responses = await Promise.all(requests.map(req => GET(req)));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockFetchKlines).toHaveBeenCalledTimes(5);
    });
  });
});