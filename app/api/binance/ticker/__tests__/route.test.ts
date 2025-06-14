// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '../route';
import { BinanceTicker24hr } from '@/types/market';

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

describe('Binance Ticker API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/binance/ticker', () => {
    const mockSingleTicker: BinanceTicker24hr = {
      symbol: "BTCUSDT",
      priceChange: "-1234.56",
      priceChangePercent: "-1.23",
      weightedAvgPrice: "108234.56",
      prevClosePrice: "109876.54",
      lastPrice: "108641.98",
      lastQty: "0.00123",
      bidPrice: "108640.00",
      bidQty: "1.23456",
      askPrice: "108642.00",
      askQty: "2.34567",
      openPrice: "109876.54",
      highPrice: "110234.56",
      lowPrice: "107890.12",
      volume: "12345.67890",
      quoteVolume: "1338456789.12",
      openTime: 1640995200000,
      closeTime: 1641081599999,
      firstId: 100000000,
      lastId: 100100000,
      count: 100000
    };

    const mockMultipleTickers: BinanceTicker24hr[] = [
      mockSingleTicker,
      {
        ...mockSingleTicker,
        symbol: "ETHUSDT",
        lastPrice: "3856.78",
        priceChangePercent: "2.45"
      }
    ];

    it('should fetch single ticker data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockSingleTicker
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSingleTicker);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
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

    it('should fetch all tickers when no symbol is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMultipleTickers
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockMultipleTickers);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/24hr',
        expect.any(Object)
      );
    });

    it('should validate symbol format when provided', async () => {
      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=INVALID@SYMBOL');
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

    it('should handle Binance API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Binance API error: Too Many Requests'
        })
      });
    });

    it('should handle invalid response data from Binance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ 
          symbol: "BTCUSDT",
          // Missing required fields
          lastPrice: "108000"
        })
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Invalid data format from upstream API'
        })
      });
    });

    it('should handle array response validation', async () => {
      const invalidArrayData = [
        mockSingleTicker,
        { 
          symbol: "ETHUSDT",
          // Invalid ticker with missing fields
          lastPrice: "3800"
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => invalidArrayData
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.message).toBe('Invalid data format from upstream API');
    });

    it('should apply rate limiting', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSingleTicker
      } as Response);

      // Make 35 requests (rate limit is 30 per minute)
      const requests = Array(35).fill(null).map(() => 
        new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT')
      );

      const responses = await Promise.all(
        requests.map(req => GET(req))
      );

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(30);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle case-insensitive symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSingleTicker
      } as Response);

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=btcusdt');
      await GET(request);

      // Should convert to uppercase when calling Binance
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('symbol=BTCUSDT'),
        expect.any(Object)
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: expect.objectContaining({
          message: 'Network error'
        })
      });
    });

    it('should timeout appropriately', async () => {
      // Mock fetch to never resolve
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          // Never resolve to simulate timeout
        })
      );

      const request = new NextRequest('http://localhost/api/binance/ticker?symbol=BTCUSDT');
      
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

  describe('OPTIONS /api/binance/ticker', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toMatch(/GET|POST|OPTIONS/);
    });
  });
});