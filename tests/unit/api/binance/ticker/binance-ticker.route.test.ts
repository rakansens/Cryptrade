import { NextRequest } from 'next/server';
import { GET } from '@/app/api/binance/ticker/route';

// Mock global fetch
global.fetch = jest.fn();

describe('Binance Ticker API Route', () => {
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/binance/ticker', () => {
    it('should fetch ticker data successfully', async () => {
      // Generate dynamic ticker data
      const basePrice = 40000 + Math.floor(Math.random() * 20000);
      const priceChange = (Math.random() - 0.5) * 2000;
      const currentTime = Date.now();
      const volume = 5000 + Math.floor(Math.random() * 10000);
      
      const mockTickerData = {
        symbol: 'BTCUSDT',
        priceChange: priceChange.toFixed(2),
        priceChangePercent: ((priceChange / basePrice) * 100).toFixed(2),
        weightedAvgPrice: (basePrice + priceChange / 2).toFixed(2),
        prevClosePrice: basePrice.toFixed(2),
        lastPrice: (basePrice + priceChange).toFixed(2),
        lastQty: (Math.random() * 0.1).toFixed(3),
        bidPrice: (basePrice + priceChange - 1).toFixed(2),
        bidQty: (Math.random() * 1).toFixed(1),
        askPrice: (basePrice + priceChange + 1).toFixed(2),
        askQty: (Math.random() * 1).toFixed(1),
        openPrice: basePrice.toFixed(2),
        highPrice: (basePrice + Math.abs(priceChange) + Math.random() * 1000).toFixed(2),
        lowPrice: (basePrice - Math.abs(priceChange) - Math.random() * 1000).toFixed(2),
        volume: volume.toFixed(2),
        quoteVolume: (volume * (basePrice + priceChange / 2)).toFixed(2),
        openTime: currentTime - 86400000,
        closeTime: currentTime,
        firstId: Math.floor(Math.random() * 1000000),
        lastId: Math.floor(Math.random() * 1000000) + 100000,
        count: Math.floor(50000 + Math.random() * 100000)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTickerData
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Response is wrapped in 'data' property
      expect(data.data).toEqual(mockTickerData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      );
    });

    it('should fetch all tickers when symbol not provided', async () => {
      // Generate dynamic data for multiple tickers
      const currentTime = Date.now();
      const generateTickerData = (symbol: string, basePrice: number) => {
        const change = (Math.random() - 0.5) * basePrice * 0.05; // ±5% change
        const volume = 1000 + Math.floor(Math.random() * 5000);
        return {
          symbol,
          priceChange: change.toFixed(2),
          priceChangePercent: ((change / basePrice) * 100).toFixed(2),
          weightedAvgPrice: (basePrice + change / 2).toFixed(2),
          prevClosePrice: basePrice.toFixed(2),
          lastPrice: (basePrice + change).toFixed(2),
          lastQty: (Math.random() * 0.5).toFixed(1),
          bidPrice: (basePrice + change - 1).toFixed(2),
          bidQty: (Math.random() * 2).toFixed(1),
          askPrice: (basePrice + change + 1).toFixed(2),
          askQty: (Math.random() * 2).toFixed(1),
          openPrice: basePrice.toFixed(2),
          highPrice: (basePrice + Math.abs(change) + Math.random() * basePrice * 0.02).toFixed(2),
          lowPrice: (basePrice - Math.abs(change) - Math.random() * basePrice * 0.02).toFixed(2),
          volume: volume.toFixed(2),
          quoteVolume: (volume * (basePrice + change / 2)).toFixed(2),
          openTime: currentTime - 86400000,
          closeTime: currentTime,
          firstId: Math.floor(Math.random() * 10000),
          lastId: Math.floor(Math.random() * 10000) + 1000,
          count: Math.floor(500 + Math.random() * 2000)
        };
      };
      
      const mockAllTickers = [
        generateTickerData('BTCUSDT', 40000 + Math.random() * 20000),
        generateTickerData('ETHUSDT', 2500 + Math.random() * 1000)
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllTickers
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Response is wrapped in 'data' property
      expect(data.data).toBeInstanceOf(Array);
      expect(data.data.length).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/24hr',
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=ETHUSDT');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Binance API error: Internal Server Error',
        context: { symbol: 'ETHUSDT' },
        retryable: true
      });
    });

    it('should handle invalid symbol', async () => {
      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=INVALID_SYMBOL_123');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.message).toBe('Invalid symbol format');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
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

      const request = new NextRequest('http://localhost:3000/api/binance/ticker');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(typeof data.error).toBe('object');
      expect(data.error.message).toBeDefined();
      expect(data.error.message).toContain('operation was aborted');
    });

    it('should validate response data structure', async () => {
      const incompleteData = {
        symbol: 'BTCUSDT',
        lastPrice: '47000.00'
        // Missing other required fields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => incompleteData
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid data format from upstream API',
        context: expect.objectContaining({
          symbol: 'BTCUSDT'
        })
      });
    });

    it('should handle multiple concurrent requests', async () => {
      const createMockData = (symbol: string) => {
        const basePrice = symbol === 'BTCUSDT' ? 40000 + Math.random() * 20000 : 
                         symbol === 'ETHUSDT' ? 2500 + Math.random() * 1000 : 
                         1000 + Math.random() * 500;
        const change = (Math.random() - 0.5) * basePrice * 0.03;
        const volume = 500 + Math.floor(Math.random() * 2000);
        const currentTime = Date.now();
        
        return {
          symbol,
          priceChange: change.toFixed(2),
          priceChangePercent: ((change / basePrice) * 100).toFixed(2),
          weightedAvgPrice: (basePrice + change / 2).toFixed(2),
          prevClosePrice: basePrice.toFixed(2),
          lastPrice: (basePrice + change).toFixed(2),
          lastQty: (Math.random() * 0.2).toFixed(1),
          bidPrice: (basePrice + change - 1).toFixed(2),
          bidQty: (Math.random() * 1.5).toFixed(1),
          askPrice: (basePrice + change + 1).toFixed(2),
          askQty: (Math.random() * 1.5).toFixed(1),
          openPrice: basePrice.toFixed(2),
          highPrice: (basePrice + Math.abs(change) + Math.random() * basePrice * 0.01).toFixed(2),
          lowPrice: (basePrice - Math.abs(change) - Math.random() * basePrice * 0.01).toFixed(2),
          volume: volume.toFixed(2),
          quoteVolume: (volume * (basePrice + change / 2)).toFixed(2),
          openTime: currentTime - 86400000,
          closeTime: currentTime,
          firstId: Math.floor(Math.random() * 5000),
          lastId: Math.floor(Math.random() * 5000) + 1000,
          count: Math.floor(500 + Math.random() * 1500)
        };
      };

      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      
      symbols.forEach(symbol => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockData(symbol)
        } as Response);
      });

      const requests = symbols.map(symbol => 
        new NextRequest(`http://localhost:3000/api/binance/ticker?symbol=${symbol}`)
      );

      const responses = await Promise.all(requests.map(req => GET(req)));

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
      });
      
      symbols.forEach((symbol, index) => {
        expect(mockFetch).toHaveBeenNthCalledWith(
          index + 1,
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
          expect.any(Object)
        );
      });
    });

    it('should handle empty response from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error).toMatchObject({
        message: 'Invalid data format from upstream API',
        context: expect.objectContaining({
          symbol: 'BTCUSDT'
        })
      });
    });

    it('should not set specific cache headers', async () => {
      // Generate dynamic data for cache test
      const basePrice = 40000 + Math.floor(Math.random() * 20000);
      const change = (Math.random() - 0.5) * 1000;
      const vol = 800 + Math.floor(Math.random() * 2000);
      const now = Date.now();
      
      const mockData = {
        symbol: 'BTCUSDT',
        priceChange: change.toFixed(2),
        priceChangePercent: ((change / basePrice) * 100).toFixed(2),
        weightedAvgPrice: (basePrice + change / 2).toFixed(2),
        prevClosePrice: basePrice.toFixed(2),
        lastPrice: (basePrice + change).toFixed(2),
        lastQty: (Math.random() * 0.15).toFixed(1),
        bidPrice: (basePrice + change - 1).toFixed(2),
        bidQty: (Math.random() * 1.2).toFixed(1),
        askPrice: (basePrice + change + 1).toFixed(2),
        askQty: (Math.random() * 1.2).toFixed(1),
        openPrice: basePrice.toFixed(2),
        highPrice: (basePrice + Math.abs(change) * 1.5).toFixed(2),
        lowPrice: (basePrice - Math.abs(change) * 1.5).toFixed(2),
        volume: vol.toFixed(2),
        quoteVolume: (vol * (basePrice + change / 2)).toFixed(2),
        openTime: now - 86400000,
        closeTime: now,
        firstId: Math.floor(Math.random() * 2000),
        lastId: Math.floor(Math.random() * 2000) + 1000,
        count: Math.floor(800 + Math.random() * 500)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response);

      const request = new NextRequest('http://localhost:3000/api/binance/ticker?symbol=BTCUSDT');
      const response = await GET(request);

      expect(response.status).toBe(200);
      // The implementation doesn't set specific cache headers
      const headers = response.headers;
      expect(headers.get('Cache-Control')).toBeNull();
    });
  });
});