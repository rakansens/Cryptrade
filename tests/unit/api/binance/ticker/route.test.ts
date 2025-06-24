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
      const mockAllTickers = [
        {
          symbol: 'BTCUSDT',
          priceChange: '100.00',
          priceChangePercent: '1.00',
          weightedAvgPrice: '47000.00',
          prevClosePrice: '46000.00',
          lastPrice: '47000.00',
          lastQty: '0.1',
          bidPrice: '46999.00',
          bidQty: '1.0',
          askPrice: '47001.00',
          askQty: '1.0',
          openPrice: '46000.00',
          highPrice: '48000.00',
          lowPrice: '45000.00',
          volume: '1000.00',
          quoteVolume: '47000000.00',
          openTime: Date.now() - 86400000,
          closeTime: Date.now(),
          firstId: 1000,
          lastId: 2000,
          count: 1000
        },
        {
          symbol: 'ETHUSDT',
          priceChange: '50.00',
          priceChangePercent: '1.50',
          weightedAvgPrice: '3200.00',
          prevClosePrice: '3150.00',
          lastPrice: '3200.00',
          lastQty: '0.5',
          bidPrice: '3199.00',
          bidQty: '2.0',
          askPrice: '3201.00',
          askQty: '2.0',
          openPrice: '3150.00',
          highPrice: '3250.00',
          lowPrice: '3100.00',
          volume: '5000.00',
          quoteVolume: '16000000.00',
          openTime: Date.now() - 86400000,
          closeTime: Date.now(),
          firstId: 5000,
          lastId: 6000,
          count: 1000
        }
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
      expect(Array.isArray(data.data)).toBe(true);
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
      expect(data.error).toBeTruthy();
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
      const createMockData = (symbol: string) => ({
        symbol,
        priceChange: '100.00',
        priceChangePercent: '1.00',
        weightedAvgPrice: '47000.00',
        prevClosePrice: '46000.00',
        lastPrice: '47000.00',
        lastQty: '0.1',
        bidPrice: '46999.00',
        bidQty: '1.0',
        askPrice: '47001.00',
        askQty: '1.0',
        openPrice: '46000.00',
        highPrice: '48000.00',
        lowPrice: '45000.00',
        volume: '1000.00',
        quoteVolume: '47000000.00',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1000,
        lastId: 2000,
        count: 1000
      });

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
      const mockData = {
        symbol: 'BTCUSDT',
        priceChange: '100.00',
        priceChangePercent: '1.00',
        weightedAvgPrice: '47000.00',
        prevClosePrice: '46000.00',
        lastPrice: '47000.00',
        lastQty: '0.1',
        bidPrice: '46999.00',
        bidQty: '1.0',
        askPrice: '47001.00',
        askQty: '1.0',
        openPrice: '46000.00',
        highPrice: '48000.00',
        lowPrice: '45000.00',
        volume: '1000.00',
        quoteVolume: '47000000.00',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1000,
        lastId: 2000,
        count: 1000
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