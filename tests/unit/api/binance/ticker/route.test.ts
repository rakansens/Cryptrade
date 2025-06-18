import { NextRequest } from 'next/server';
import { GET } from '@/app/api/binance/ticker/route';
import { fetchTicker24hr } from '@/lib/services/binance-api.service';
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

describe('Binance Ticker API Route', () => {
  const mockFetchTicker24hr = fetchTicker24hr as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/binance/ticker', () => {
    it('should fetch ticker data successfully', async () => {
      const mockTickerData = {
        symbol: 'BTCUSDT',
        priceChange: '1000.00',
        priceChangePercent: '2.17',
        weightedAvgPrice: '46234.56',
        prevClosePrice: '46000.00',
        lastPrice: '47000.00',
        lastQty: '0.005',
        bidPrice: '46999.00',
        bidQty: '0.1',
        askPrice: '47001.00',
        askQty: '0.1',
        openPrice: '46000.00',
        highPrice: '47500.00',
        lowPrice: '45500.00',
        volume: '10000.00',
        quoteVolume: '462345600.00',
        openTime: 1640995200000,
        closeTime: 1641081600000,
        firstId: 100000,
        lastId: 200000,
        count: 100000
      };

      mockFetchTicker24hr.mockResolvedValueOnce(mockTickerData);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockTickerData);
      expect(mockFetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should use default symbol when not provided', async () => {
      mockFetchTicker24hr.mockResolvedValueOnce({});

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockFetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Binance API error');
      mockFetchTicker24hr.mockRejectedValueOnce(mockError);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=ETHUSDT');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch ticker data');
      expect(logger.error).toHaveBeenCalledWith('[BinanceTicker] Failed to fetch ticker', { error: mockError });
    });

    it('should handle invalid symbol', async () => {
      const invalidSymbolError = new Error('Invalid symbol');
      invalidSymbolError.name = 'InvalidSymbolError';
      mockFetchTicker24hr.mockRejectedValueOnce(invalidSymbolError);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=INVALID');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid symbol');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.name = 'RateLimitError';
      mockFetchTicker24hr.mockRejectedValueOnce(rateLimitError);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockFetchTicker24hr.mockRejectedValueOnce(timeoutError);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
      const response = await GET(request);

      expect(response.status).toBe(504);
      const data = await response.json();
      expect(data.error).toBe('Request timeout');
    });

    it('should validate response data structure', async () => {
      const incompleteData = {
        symbol: 'BTCUSDT',
        lastPrice: '47000.00'
        // Missing other required fields
      };

      mockFetchTicker24hr.mockResolvedValueOnce(incompleteData);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.symbol).toBe('BTCUSDT');
      expect(data.lastPrice).toBe('47000.00');
    });

    it('should handle multiple concurrent requests', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      mockFetchTicker24hr.mockResolvedValue(mockData);

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const requests = symbols.map(symbol => 
        new NextRequest(`http://localhost:3000/api/binance/ticker?symbol=${symbol}`)
      );

      const responses = await Promise.all(requests.map(req => GET(req)));

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(mockFetchTicker24hr).toHaveBeenNthCalledWith(index + 1, symbols[index]);
      });
    });

    it('should handle empty response from API', async () => {
      mockFetchTicker24hr.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('No ticker data found');
    });

    it('should cache responses appropriately', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      mockFetchTicker24hr.mockResolvedValueOnce(mockData);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const headers = response.headers;
      expect(headers.get('Cache-Control')).toContain('s-maxage=5');
    });
  });
});