import { NextRequest } from 'next/server';
import { GET } from '@/app/api/binance/klines/route';

// Mock global fetch
global.fetch = jest.fn();

// Mock only the validateBinanceKlines function to return processed data
jest.mock('@/types/market', () => ({
  ...jest.requireActual('@/types/market'),
  validateBinanceKlines: jest.fn()
}));

describe('Binance Klines API Route', () => {
  const mockFetch = global.fetch as jest.Mock;
  const { validateBinanceKlines } = require('@/types/market');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/binance/klines', () => {
    it('should fetch klines successfully with valid parameters', async () => {
      // Generate dynamic test data
      const baseTime = Date.now() - 3600000; // 1 hour ago
      const openPrice = 40000 + Math.floor(Math.random() * 20000);
      const highPrice = openPrice + Math.floor(Math.random() * 1000);
      const lowPrice = openPrice - Math.floor(Math.random() * 1000);
      const closePrice = lowPrice + Math.floor(Math.random() * (highPrice - lowPrice));
      const volume = Math.floor(100 + Math.random() * 2000);
      
      const mockRawKlines = [
        [
          baseTime,                    // Open time
          openPrice.toFixed(2),        // Open
          highPrice.toFixed(2),        // High
          lowPrice.toFixed(2),         // Low
          closePrice.toFixed(2),       // Close
          volume.toFixed(2),           // Volume
          baseTime + 3600000,          // Close time (1 hour later)
          (volume * closePrice).toFixed(2), // Quote asset volume
          Math.floor(100 + Math.random() * 1000), // Number of trades
          (volume * 0.5).toFixed(2),   // Taker buy base asset volume
          (volume * closePrice * 0.5).toFixed(2), // Taker buy quote asset volume
          "0"                          // Ignore
        ]
      ];

      const mockProcessedKlines = [
        {
          time: Math.floor(baseTime / 1000), // Convert to seconds
          open: parseFloat(openPrice.toFixed(2)),
          high: parseFloat(highPrice.toFixed(2)),
          low: parseFloat(lowPrice.toFixed(2)),
          close: parseFloat(closePrice.toFixed(2)),
          volume: parseFloat(volume.toFixed(2))
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawKlines
      } as Response);

      // validateBinanceKlines will be called with the raw klines data
      validateBinanceKlines.mockReturnValueOnce(mockProcessedKlines);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: mockProcessedKlines,
        timestamp: expect.any(String)
      });
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
      // Check error message
      expect(data.error.message).toBe('Invalid limit: must be between 1 and 1000');
    });

    it('should handle limit exceeding maximum', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=1500');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // For now, just check the message
      expect(data.error.message).toBe('Invalid limit: must be between 1 and 1000');
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

      // validateBinanceKlines will be called with empty array
      validateBinanceKlines.mockReturnValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=ETHUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: [],
        timestamp: expect.any(String)
      });
    });

    it('should validate interval parameter', async () => {
      const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
      
      for (const interval of validIntervals) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);

        // validateBinanceKlines will be called with empty array for each valid interval
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
      expect(data.error).toBeDefined();
      expect(typeof data.error).toBe('object');
      expect(data.error.message).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      // Generate dynamic data for concurrent requests
      const baseTime = Date.now() - 3600000;
      const price = 40000 + Math.floor(Math.random() * 20000);
      const volume = 100 + Math.floor(Math.random() * 2000);
      
      const mockRawKlines = [[
        baseTime, price.toFixed(2), (price + 500).toFixed(2), (price - 200).toFixed(2), (price + 200).toFixed(2), volume.toFixed(2),
        baseTime + 3600000, (volume * price).toFixed(2), Math.floor(100 + Math.random() * 1000), (volume * 0.5).toFixed(2), (volume * price * 0.5).toFixed(2), "0"
      ]];
      
      const mockProcessedData = [{ 
        time: Math.floor(baseTime / 1000), 
        open: parseFloat(price.toFixed(2)), 
        high: parseFloat((price + 500).toFixed(2)), 
        low: parseFloat((price - 200).toFixed(2)), 
        close: parseFloat((price + 200).toFixed(2)), 
        volume: parseFloat(volume.toFixed(2)) 
      }];

      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h')
      );

      // Set up mocks for each request
      requests.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockRawKlines
        } as Response);

        // validateBinanceKlines will be called with the raw klines data
        validateBinanceKlines.mockReturnValueOnce(mockProcessedData);
      });

      const responses = await Promise.all(requests.map(req => GET(req)));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should handle invalid klines format from Binance API', async () => {
      // Mock invalid response that doesn't match the expected klines format
      const invalidResponse = {
        error: "Invalid data"
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid data format from upstream API',
        context: expect.objectContaining({
          symbol: 'BTCUSDT',
          interval: '1h',
          validationError: expect.any(Object)
        })
      });
    });

    it('should handle malformed klines data (not enough elements)', async () => {
      // Mock klines with not enough elements (should have at least 6)
      const timestamp = Date.now() - 3600000;
      const price = (40000 + Math.random() * 20000).toFixed(2);
      const malformedKlines = [
        [timestamp, price, (parseFloat(price) + 500).toFixed(2)] // Only 3 elements instead of at least 6
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedKlines
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error.message).toBe('Invalid data format from upstream API');
    });

    it('should validate processed kline data structure', async () => {
      // Generate dynamic test data for validation
      const currentTime = Date.now();
      const baseTime = currentTime - 3600000;
      const open = 40000 + Math.floor(Math.random() * 20000);
      const high = open + Math.floor(Math.random() * 2000);
      const low = open - Math.floor(Math.random() * 1000);
      const close = low + Math.floor(Math.random() * (high - low));
      const vol = 100 + Math.floor(Math.random() * 2000);
      
      const mockRawKlines = [
        [
          baseTime,                    // Open time
          open.toFixed(2),             // Open
          high.toFixed(2),             // High
          low.toFixed(2),              // Low
          close.toFixed(2),            // Close
          vol.toFixed(2),              // Volume
          baseTime + 3600000,          // Close time
          (vol * close).toFixed(2),    // Quote asset volume
          Math.floor(100 + Math.random() * 1000), // Number of trades
          (vol * 0.5).toFixed(2),      // Taker buy base asset volume
          (vol * close * 0.5).toFixed(2), // Taker buy quote asset volume
          "0"                          // Ignore
        ]
      ];

      const expectedProcessedData = [
        {
          time: Math.floor(baseTime / 1000),
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: parseFloat(vol.toFixed(2))
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRawKlines
      } as Response);

      // Mock validateBinanceKlines to test that it's called with valid parsed data
      validateBinanceKlines.mockImplementationOnce((data) => {
        // Verify the data passed to validateBinanceKlines is valid
        expect(data).toEqual(mockRawKlines);
        return expectedProcessedData;
      });

      const request = new NextRequest('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        data: expectedProcessedData,
        timestamp: expect.any(String)
      });
      expect(validateBinanceKlines).toHaveBeenCalledWith(mockRawKlines);
    });
  });
});