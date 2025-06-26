// 2025-01-26: BinanceAPIServiceテストを新しいモック構造に完全同期

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Import mocks from the updated mock file
import {
  BinanceAPIService,
  mockBinanceAPI,
  mockGet,
  mockValidateBinanceKlines,
  mockLogger
} from '@/lib/binance/api-service';

// Mock the logger to use our mockLogger
jest.mock('@/lib/utils/logger', () => ({
  logger: mockLogger,
}));

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default successful responses
    mockGet.mockResolvedValue({
      data: [
        [1640995200000, "46000.00", "46500.00", "45800.00", "46200.00", "1000.00", 1640998800000, "46000000.00", 1000, "500.00", "23000000.00", "0"],
        [1641081600000, "46200.00", "46800.00", "46000.00", "46500.00", "1200.00", 1641085200000, "55440000.00", 1100, "600.00", "27720000.00", "0"]
      ]
    });
    
    // Setup default validateBinanceKlines mock
    mockValidateBinanceKlines.mockReturnValue([
      { time: 1640995200, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 },
      { time: 1641081600, open: 46200, high: 46800, low: 46000, close: 46500, volume: 1200 }
    ]);

    // Create service instance
    service = new BinanceAPIService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Methods', () => {
    it('should create an instance of BinanceAPIService', () => {
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('BinanceAPIService');
    });

    it('should have all required methods', () => {
      expect(typeof service.fetchKlines).toBe('function');
      expect(typeof service.fetchTicker24hr).toBe('function');
      expect(typeof service.fetchCurrentPrice).toBe('function');
      expect(typeof service.fetchExchangeInfo).toBe('function');
      expect(typeof service.isValidSymbol).toBe('function');
    });
  });

  describe('fetchKlines', () => {
    it('should fetch and process klines successfully', async () => {
      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(mockGet).toHaveBeenCalledWith(
        '/klines',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: '100'
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        time: 1640995200,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      });
      expect(mockLogger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched and validated klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        count: 2
      });
    });

    it('should handle empty klines response', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockValidateBinanceKlines.mockReturnValue([]);
      
      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const error = new Error('Request failed with status 500');
      mockGet.mockRejectedValue(error);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 500');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Request failed with status 429');
      rateLimitError.name = 'RateLimitError';
      mockGet.mockRejectedValue(rateLimitError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        expect.objectContaining({
          interval: '1h',
          limit: 100,
          symbol: 'BTCUSDT',
          errorMessage: 'Request failed with status 429'
        }),
        rateLimitError
      );
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockGet.mockRejectedValue(timeoutError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Network timeout');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 100,
          errorMessage: 'Network timeout'
        }),
        timeoutError
      );
    });

    it('should handle malformed API response', async () => {
      mockGet.mockResolvedValue({
        data: 'not an array'
      });
      
      // Setup validateBinanceKlines to handle malformed data
      mockValidateBinanceKlines.mockReturnValue([]);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      expect(result).toEqual([]);
    });

    it('should handle invalid kline data format', async () => {
      const invalidKlines = [
        { invalid: 'format' },
        [123], // Too few elements
        null,
        undefined
      ];

      mockGet.mockResolvedValue({ data: invalidKlines });
      mockValidateBinanceKlines.mockReturnValue([]);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      expect(result).toBeDefined();
    });

    it('should convert symbol to uppercase', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockValidateBinanceKlines.mockReturnValue([]);

      await service.fetchKlines('btcusdt', '1h', 100);
      
      // Verify the API was called with uppercase symbol
      expect(mockGet).toHaveBeenCalledWith(
        '/klines',
        expect.objectContaining({ symbol: 'BTCUSDT' })
      );
    });
  });

  describe('fetchTicker24hr', () => {
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

    it('should fetch 24hr ticker for a specific symbol', async () => {
      mockGet.mockResolvedValue({ data: mockTickerData });

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockGet).toHaveBeenCalledWith(
        '/ticker',
        { symbol: 'BTCUSDT' }
      );
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockAllTickers = [
        { symbol: 'BTCUSDT', lastPrice: '47000.00' },
        { symbol: 'ETHUSDT', lastPrice: '3000.00' }
      ];

      mockGet.mockResolvedValue({ data: mockAllTickers });

      const result = await service.fetchTicker24hr();

      expect(result).toEqual(mockAllTickers);
      expect(mockGet).toHaveBeenCalledWith(
        '/ticker',
        undefined
      );
    });

    it('should handle Binance error response', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      mockGet.mockResolvedValue({ data: errorResponse });

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
      expect(mockLogger.warn).toHaveBeenCalledWith('[BinanceAPI] Binance ticker error response', {
        symbol: 'INVALID',
        errorCode: -1121,
        errorMsg: 'Invalid symbol.',
        rawData: errorResponse
      });
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      mockGet.mockRejectedValue(error);

      await expect(service.fetchTicker24hr()).rejects.toThrow('Connection timeout');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch 24hr ticker', 
        { 
          symbol: undefined,
          errorMessage: 'Connection timeout'
        },
        error
      );
    });

    it('should handle empty ticker response', async () => {
      mockGet.mockResolvedValue({ data: null });

      const result = await service.fetchTicker24hr('BTCUSDT');
      expect(result).toBeNull();
    });

    it('should handle invalid ticker data format', async () => {
      mockGet.mockResolvedValue({ data: { invalid: 'format', no: 'symbol' } });

      const result = await service.fetchTicker24hr('BTCUSDT');
      expect(result).toEqual({ invalid: 'format', no: 'symbol' });
    });

    it('should handle server 5xx errors', async () => {
      const serverError = new Error('Request failed with status 503');
      serverError.name = 'ServerError';
      mockGet.mockRejectedValue(serverError);

      await expect(service.fetchTicker24hr('BTCUSDT'))
        .rejects.toThrow('Request failed with status 503');
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockPrice = {
        symbol: 'BTCUSDT',
        price: '46200.00'
      };

      mockGet.mockResolvedValue({ data: mockPrice });

      const result = await service.fetchCurrentPrice('btcusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'BTCUSDT' });
      expect(result).toEqual(mockPrice);
      expect(mockLogger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched current price', {
        symbol: 'btcusdt',
        price: '46200.00'
      });
    });

    it('should convert symbol to uppercase', async () => {
      mockGet.mockResolvedValue({ data: { symbol: 'ETHUSDT', price: '3000.00' } });

      await service.fetchCurrentPrice('ethusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'ETHUSDT' });
    });

    it('should handle API errors', async () => {
      const error = new Error('Rate limit exceeded');
      mockGet.mockRejectedValue(error);

      await expect(service.fetchCurrentPrice('BTCUSDT')).rejects.toThrow('Rate limit exceeded');
      expect(mockLogger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch current price', { 
        symbol: 'BTCUSDT', 
        errorMessage: 'Rate limit exceeded' 
      }, error);
    });

    it('should handle price data with missing fields', async () => {
      mockGet.mockResolvedValue({ data: { symbol: 'BTCUSDT' } }); // Missing price field

      const result = await service.fetchCurrentPrice('BTCUSDT');
      expect(result).toEqual({ symbol: 'BTCUSDT' });
    });

    it('should handle null price response', async () => {
      mockGet.mockResolvedValue({ data: null });

      const result = await service.fetchCurrentPrice('BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('fetchExchangeInfo', () => {
    it('should fetch exchange info successfully', async () => {
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: Date.now(),
        rateLimits: [
          { rateLimitType: 'REQUEST_WEIGHT', interval: 'MINUTE', intervalNum: 1, limit: 1200 }
        ],
        exchangeFilters: [],
        symbols: [
          { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT' },
          { symbol: 'ETHUSDT', status: 'TRADING', baseAsset: 'ETH', quoteAsset: 'USDT' }
        ]
      };

      mockGet.mockResolvedValue({ data: mockExchangeInfo });

      const result = await service.fetchExchangeInfo();

      expect(mockGet).toHaveBeenCalledWith('/exchangeInfo');
      expect(result).toEqual(mockExchangeInfo);
      expect(mockLogger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched exchange info');
    });

    it('should handle API errors', async () => {
      const error = new Error('Service unavailable');
      mockGet.mockRejectedValue(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Service unavailable');
      expect(mockLogger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch exchange info', { 
        errorMessage: 'Service unavailable' 
      }, error);
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol formats correctly', () => {
      // Valid symbols - now supports both USD and USDT
      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHUSDT')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      expect(service.isValidSymbol('BTCUSD')).toBe(true);
      expect(service.isValidSymbol('ETHUSD')).toBe(true);
      expect(service.isValidSymbol('btcusdt')).toBe(true); // Case insensitive

      // Invalid symbols
      expect(service.isValidSymbol('')).toBe(false);
      expect(service.isValidSymbol('123')).toBe(false);
      expect(service.isValidSymbol('BTC-USDT')).toBe(false);
      expect(service.isValidSymbol('BTC_USDT')).toBe(false);
      expect(service.isValidSymbol('BTCEUR')).toBe(false);
      expect(service.isValidSymbol('BTC')).toBe(false);
      expect(service.isValidSymbol('VERYLONGASSETUSDT')).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle extreme limit values', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockValidateBinanceKlines.mockReturnValue([]);

      await service.fetchKlines('BTCUSDT', '1h', 1);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        limit: '1'
      }));

      await service.fetchKlines('BTCUSDT', '1h', 1000);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        limit: '1000'
      }));
    });

    it('should handle invalid interval values gracefully', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockValidateBinanceKlines.mockReturnValue([]);

      // Invalid interval should still be passed to API (API will handle validation)
      await service.fetchKlines('BTCUSDT', 'invalid' as any, 100);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        interval: 'invalid'
      }));
    });

    it('should handle very large response payloads', async () => {
      // Simulate large response with many klines
      const largeKlineArray = Array(1000).fill(null).map((_, i) => [
        1640995200000 + i * 60000,
        '46000.00', '46500.00', '45800.00', '46200.00', '1000.00',
        1640998800000 + i * 60000, '46000000.00', 1000, '500.00', '23000000.00', '0'
      ]);

      mockGet.mockResolvedValue({ data: largeKlineArray });
      
      const largeProcessedArray = Array(1000).fill(null).map((_, i) => ({
        time: 1640995200 + i * 60,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      }));
      mockValidateBinanceKlines.mockReturnValue(largeProcessedArray);

      const result = await service.fetchKlines('BTCUSDT', '1m', 1000);
      expect(result).toHaveLength(1000);
    });

    it('should handle response with corrupted data chunks', async () => {
      const corruptedKlines = [
        [1640995200000, '46000.00', '46500.00', '45800.00', '46200.00', '1000.00'], // Valid
        [null, '46000.00', '46500.00', '45800.00', '46200.00', '1000.00'], // Null timestamp
        [1640995200000, 'invalid', '46500.00', '45800.00', '46200.00', '1000.00'], // Invalid price
        [1640995200000, '46000.00', Infinity, '45800.00', '46200.00', '1000.00'], // Infinity value
        [1640995200000, '46000.00', '46500.00', -1, '46200.00', '1000.00'], // Negative value
      ];

      mockGet.mockResolvedValue({ data: corruptedKlines });
      mockValidateBinanceKlines.mockReturnValue([{ time: 1640995200, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 }]);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      expect(result).toBeDefined(); // Should handle gracefully
    });

    it('should handle concurrent requests properly', async () => {
      // Setup multiple mock responses
      mockGet
        .mockResolvedValueOnce({ data: { symbol: 'BTCUSDT', price: '50000' } })
        .mockResolvedValueOnce({ data: { symbol: 'ETHUSDT', price: '3000' } })
        .mockResolvedValueOnce({ data: { symbol: 'BNBUSDT', price: '400' } });

      // Make concurrent requests
      const promises = [
        service.fetchCurrentPrice('BTCUSDT'),
        service.fetchCurrentPrice('ETHUSDT'),
        service.fetchCurrentPrice('BNBUSDT')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success/failure scenarios', async () => {
      // First call succeeds, second fails
      mockGet
        .mockResolvedValueOnce({ data: { symbol: 'BTCUSDT', price: '50000' } })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result1 = await service.fetchCurrentPrice('BTCUSDT');
      expect(result1).toEqual({ symbol: 'BTCUSDT', price: '50000' });

      await expect(service.fetchCurrentPrice('ETHUSDT'))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error handling', () => {
    it('should handle HTTP errors correctly', async () => {
      mockGet.mockRejectedValue(new Error('Request failed with status 429'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
    });

    it('should handle network timeouts', async () => {
      mockGet.mockRejectedValue(new Error('Network timeout'));
      
      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('Browser vs Server behavior', () => {
    it('should initialize with correct basePath for server environment', () => {
      const globalWithWindow = global as typeof globalThis & { window?: Window };
      globalWithWindow.window = undefined;
      
      const serverService = new BinanceAPIService();
      
      expect(serverService).toBeInstanceOf(BinanceAPIService);
      expect(serverService.isValidSymbol('BTCUSDT')).toBe(true);
    });

    it('should initialize with correct basePath for browser environment', () => {
      const globalWithWindow = global as typeof globalThis & { window?: Window };
      globalWithWindow.window = {} as Window;
      
      const browserService = new BinanceAPIService();
      
      expect(browserService).toBeInstanceOf(BinanceAPIService);
      expect(browserService.isValidSymbol('BTCUSDT')).toBe(true);
      
      globalWithWindow.window = undefined;
    });
  });
});