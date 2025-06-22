import { NextRequest } from 'next/server';
import { GET } from '@/app/api/binance/klines/route';

// Mock global fetch
global.fetch = jest.fn();

// Mock validation helpers
jest.mock('@/types/market', () => ({
  BinanceKlinesResponseSchema: {
    safeParse: jest.fn()
  },
  validateBinanceKlines: jest.fn(data => data)
}));

describe('Binance Klines API Route', () => {
  const mockFetch = global.fetch as jest.Mock;
  const { BinanceKlinesResponseSchema, validateBinanceKlines } = require('@/types/market');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/binance/klines', () => {
    it('should fetch klines successfully with valid parameters', async () => {
      const mockRawKlines = [
        [
          1640995200000, // Open time
          "46000.00",    // Open
          "46500.00",    // High
          "45800.00",    // Low
          "46200.00",    // Close
          "1000.00",     // Volume
          1640998800000, // Close time
          "46000000.00", // Quote asset volume
          1000,          // Number of trades
          "500.00",      // Taker buy base asset volume
          "23000000.00", // Taker buy quote asset volume
          "0"            // Ignore
        ]
      ];

      const mockProcessedKlines = [
        {
          time: 1640995200,
          open: 46000,
          high: 46500,
          low: 45800,
          close: 46200,
          volume: 1000
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawKlines
      } as Response);

      BinanceKlinesResponseSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: mockRawKlines
      });

      validateBinanceKlines.mockReturnValueOnce(mockProcessedKlines);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockProcessedKlines);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      );
    });

    it('should fail when required parameters are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // The error field is an object when it comes from Zod validation
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({ 
            path: ['symbol'],
            message: 'Required'
          }),
          expect.objectContaining({ 
            path: ['interval'],
            message: 'Required'
          })
        ])
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle invalid limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid limit: must be between 1 and 1000',
        field: 'limit',
        value: 'invalid'
      });
    });

    it('should handle limit exceeding maximum', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=1500');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid limit: must be between 1 and 1000',
        field: 'limit',
        value: '1500'
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Binance API error: Internal Server Error',
        context: expect.objectContaining({
          symbol: 'BTCUSDT',
          interval: '1h'
        }),
        retryable: true
      });
    });

    it('should handle empty response from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response);

      BinanceKlinesResponseSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: []
      });

      validateBinanceKlines.mockReturnValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=ETHUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('should validate interval parameter', async () => {
      const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
      
      for (const interval of validIntervals) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);

        BinanceKlinesResponseSchema.safeParse.mockReturnValueOnce({
          success: true,
          data: []
        });

        validateBinanceKlines.mockReturnValueOnce([]);

        const request = new NextRequest(`http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=${interval}`);
        const response = await GET(request);
        expect(response.status).toBe(200);
      }
    });

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Binance API error: Too Many Requests',
        retryable: true
      });
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should handle concurrent requests', async () => {
      const mockRawKlines = [[
        1640995200000, "46000.00", "46500.00", "45800.00", "46200.00", "1000.00",
        1640998800000, "46000000.00", 1000, "500.00", "23000000.00", "0"
      ]];
      
      const mockProcessedData = [{ time: 1640995200, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 }];

      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h')
      );

      // Set up mocks for each request
      requests.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawKlines
        } as Response);

        BinanceKlinesResponseSchema.safeParse.mockReturnValueOnce({
          success: true,
          data: mockRawKlines
        });

        validateBinanceKlines.mockReturnValueOnce(mockProcessedData);
      });

      const responses = await Promise.all(requests.map(req => GET(req)));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });
});