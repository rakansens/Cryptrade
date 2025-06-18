import { BinanceAPIService, binanceAPI } from '@/lib/services/binance-api.service';
import { logger } from '@/lib/utils/logger';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('BinanceAPIService', () => {
  const mockAxios = axios as jest.Mocked<typeof axios>;
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BinanceAPIService();
  });

  describe('fetchKlines', () => {
    it('should fetch klines successfully', async () => {
      const mockKlineData = [
        [1640995200000, '46000', '46500', '45800', '46200', '1000', 1641081600000, '46000000', 100, '500', '23000000', '0'],
        [1641081600000, '46200', '46700', '46000', '46500', '1200', 1641168000000, '55800000', 120, '600', '27900000', '0']
      ];

      mockAxios.get.mockResolvedValueOnce({ data: mockKlineData });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        time: 1640995200,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      });
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/klines',
        {
          params: {
            symbol: 'BTCUSDT',
            interval: '1h',
            limit: 100
          }
        }
      );
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockError.response = {
        status: 400,
        data: { msg: 'Invalid symbol' }
      };

      mockAxios.get.mockRejectedValueOnce(mockError);

      await expect(service.fetchKlines('INVALID', '1h', 100))
        .rejects.toThrow('API Error');

      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        expect.objectContaining({
          symbol: 'INVALID',
          interval: '1h',
          error: mockError
        })
      );
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.response = {
        status: 429,
        headers: {
          'retry-after': '60'
        }
      };

      mockAxios.get.mockRejectedValueOnce(rateLimitError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Rate limit exceeded');

      expect(logger.warn).toHaveBeenCalledWith(
        '[BinanceAPI] Rate limit hit',
        expect.objectContaining({
          retryAfter: '60'
        })
      );
    });

    it('should validate interval parameter', async () => {
      await expect(service.fetchKlines('BTCUSDT', 'invalid', 100))
        .rejects.toThrow('Invalid interval parameter');
    });

    it('should validate limit parameter', async () => {
      await expect(service.fetchKlines('BTCUSDT', '1h', 1500))
        .rejects.toThrow('Limit cannot exceed 1000');

      await expect(service.fetchKlines('BTCUSDT', '1h', 0))
        .rejects.toThrow('Limit must be positive');
    });

    it('should handle empty response', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: [] });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toEqual([]);
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('timeout');

      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Network timeout',
        expect.any(Object)
      );
    });
  });

  describe('fetchTicker24hr', () => {
    it('should fetch 24hr ticker successfully', async () => {
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

      mockAxios.get.mockResolvedValueOnce({ data: mockTickerData });

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/24hr',
        {
          params: { symbol: 'BTCUSDT' }
        }
      );
    });

    it('should handle invalid symbol', async () => {
      const mockError = new Error('Invalid symbol');
      mockError.response = {
        status: 400,
        data: { msg: 'Invalid symbol' }
      };

      mockAxios.get.mockRejectedValueOnce(mockError);

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Invalid symbol');
    });

    it('should cache ticker data', async () => {
      const mockTickerData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };

      mockAxios.get.mockResolvedValueOnce({ data: mockTickerData });

      // First call
      const result1 = await service.fetchTicker24hr('BTCUSDT');
      expect(result1).toEqual(mockTickerData);
      expect(mockAxios.get).toHaveBeenCalledTimes(1);

      // Second call within cache window
      const result2 = await service.fetchTicker24hr('BTCUSDT');
      expect(result2).toEqual(mockTickerData);
      expect(mockAxios.get).toHaveBeenCalledTimes(1); // Still 1, cached
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol format', () => {
      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHBTC')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      
      expect(service.isValidSymbol('')).toBe(false);
      expect(service.isValidSymbol('123')).toBe(false);
      expect(service.isValidSymbol('btcusdt')).toBe(false); // lowercase
      expect(service.isValidSymbol('BTC-USDT')).toBe(false); // with dash
      expect(service.isValidSymbol('BTC_USDT')).toBe(false); // with underscore
    });
  });

  describe('WebSocket URL generation', () => {
    it('should generate correct WebSocket URLs', () => {
      expect(service.getWebSocketUrl('btcusdt@kline_1h')).toBe(
        'wss://stream.binance.com:9443/ws/btcusdt@kline_1h'
      );

      expect(service.getWebSocketUrl('ethusdt@trade')).toBe(
        'wss://stream.binance.com:9443/ws/ethusdt@trade'
      );
    });

    it('should handle combined streams', () => {
      const streams = ['btcusdt@kline_1h', 'ethusdt@kline_1h', 'bnbusdt@kline_1h'];
      expect(service.getCombinedStreamUrl(streams)).toBe(
        'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1h/ethusdt@kline_1h/bnbusdt@kline_1h'
      );
    });
  });

  describe('Retry mechanism', () => {
    it('should retry failed requests', async () => {
      const mockError = new Error('Network error');
      const mockData = [
        [1640995200000, '46000', '46500', '45800', '46200', '1000', 1641081600000, '46000000', 100, '500', '23000000', '0']
      ];

      // Fail first, succeed on retry
      mockAxios.get
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({ data: mockData });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toHaveLength(1);
      expect(mockAxios.get).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        '[BinanceAPI] Retrying request',
        expect.objectContaining({
          attempt: 2,
          maxAttempts: 3
        })
      );
    });

    it('should fail after max retries', async () => {
      const mockError = new Error('Persistent error');

      mockAxios.get
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Persistent error');

      expect(mockAxios.get).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Max retries exceeded',
        expect.any(Object)
      );
    });
  });

  describe('Request interceptors', () => {
    it('should add request headers', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      mockAxios.get.mockResolvedValueOnce({ data: mockData });

      await service.fetchTicker24hr('BTCUSDT');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-MBX-APIKEY': expect.any(String)
          })
        })
      );
    });

    it('should handle API key errors', async () => {
      const apiKeyError = new Error('API-key format invalid');
      apiKeyError.response = {
        status: 400,
        data: { code: -2014, msg: 'API-key format invalid' }
      };

      mockAxios.get.mockRejectedValueOnce(apiKeyError);

      await expect(service.fetchTicker24hr('BTCUSDT'))
        .rejects.toThrow('API-key format invalid');

      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] API key error',
        expect.any(Object)
      );
    });
  });

  describe('Singleton instance', () => {
    it('should use singleton instance', () => {
      expect(binanceAPI).toBeInstanceOf(BinanceAPIService);
      expect(binanceAPI).toBe(binanceAPI); // Same instance
    });
  });
});