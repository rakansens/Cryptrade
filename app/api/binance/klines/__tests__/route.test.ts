// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '../route';
import { BinanceKlinesResponseSchema } from '@/types/market';

// Mock fetch globally
const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch;

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Binance Klines API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/binance/klines', () => {
    const mockKlinesData = [
      [
        1640995200000,     // Open time
        "46432.01",        // Open
        "46505.00",        // High
        "46247.01",        // Low
        "46306.01",        // Close
        "1458.50600000",   // Volume
        1640998799999,     // Close time
        "67591014.88",     // Quote asset volume
        7890,              // Number of trades
        "729.25300000",    // Taker buy base asset volume
        "33784638.26",     // Taker buy quote asset volume
        "0"                // Ignore
      ],
      [
        1640998800000,
        "46306.00",
        "46370.00",
        "46242.48",
        "46273.51",
        "1234.56700000",
        1641002399999,
        "57123456.78",
        6543,
        "617.28350000",
        "28561728.14",
        "0"
      ]
    ];

    it('should fetch klines data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockKlinesData
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            openTime: expect.any(Number),
            open: expect.any(String),
            high: expect.any(String),
            low: expect.any(String),
            close: expect.any(String),
            volume: expect.any(String),
            closeTime: expect.any(Number),
            quoteAssetVolume: expect.any(String),
            numberOfTrades: expect.any(Number),
            takerBuyBaseAssetVolume: expect.any(String),
            takerBuyQuoteAssetVolume: expect.any(String)
          })
        ])
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Cryptrade-API-Proxy/1.0'
          }),
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should validate symbol format', async () => {
      const request = new NextRequest('http://localhost/api/binance/klines?symbol=INVALID@SYMBOL&interval=1h');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Invalid symbol format'
        })
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate interval format', async () => {
      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Invalid interval format'
        })
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate limit parameter', async () => {
      const invalidLimits = ['0', '-1', '1001', 'abc'];

      for (const limit of invalidLimits) {
        const request = new NextRequest(`http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=${limit}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toMatchObject({
          error: expect.objectContaining({
            message: 'Invalid limit: must be between 1 and 1000'
          })
        });
      }
    });

    it('should use default limit when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => []
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h');
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=1000'),
        expect.any(Object)
      );
    });

    it('should handle Binance API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Binance API error: Service Unavailable'
        })
      });
    });

    it('should handle invalid response data from Binance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'data' }) // Not an array
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Invalid data format from upstream API'
        })
      });
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      } as Response);

      // Make 65 requests (rate limit is 60 per minute)
      const requests = Array(65).fill(null).map(() => 
        new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h')
      );

      const responses = await Promise.all(
        requests.map(req => GET(req))
      );

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(60);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle timeout appropriately', async () => {
      // Mock fetch to never resolve
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          // Never resolve to simulate timeout
        })
      );

      const request = new NextRequest('http://localhost/api/binance/klines?symbol=BTCUSDT&interval=1h');
      
      // This should eventually timeout due to AbortSignal
      const responsePromise = GET(request);
      
      // Wait a bit and verify fetch was called with abort signal
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  describe('OPTIONS /api/binance/klines', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toMatch(/GET|POST|OPTIONS/);
    });
  });
});