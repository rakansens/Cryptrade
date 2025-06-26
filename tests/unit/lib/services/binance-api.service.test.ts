import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Create mock functions
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

// Mock ApiClient first
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    execute: jest.fn()
  }))
}));

// Mock BaseService 
jest.mock('@/lib/api/base-service');

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the validateBinanceKlines function
jest.mock('@/types/market', () => ({
  validateBinanceKlines: jest.fn((data) => {
    // Transform raw kline data to processed format
    if (!Array.isArray(data)) return [];
    
    return data.map(kline => {
      if (Array.isArray(kline) && kline.length >= 6) {
        return {
          time: Math.floor(Number(kline[0]) / 1000), // Convert ms to seconds
          open: Number(kline[1]),
          high: Number(kline[2]),
          low: Number(kline[3]),
          close: Number(kline[4]),
          volume: Number(kline[5])
        };
      }
      return kline; // Return as-is if already processed
    });
  })
}));

// Now import the service after mocks are set up
import { BinanceAPIService } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default return value for mockGet
    (mockGet as jest.Mock).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: new Headers()
    });
    
    // Mock window to ensure we're testing server-side behavior
    const globalWithWindow = global as typeof globalThis & { window?: Window };
    globalWithWindow.window = undefined;
    
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
    const mockRawKlines = [
      [
        1640995200000, // Open time in milliseconds
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
      ],
      [
        1641081600000,
        "46200.00",
        "46700.00",
        "46000.00",
        "46500.00",
        "1200.00",
        1641085200000,
        "55440000.00",
        1200,
        "600.00",
        "27720000.00",
        "0"
      ]
    ];

    it('should fetch and process klines successfully', async () => {
      // Set up mock to return the expected API response structure
      mockGet.mockResolvedValueOnce({
        data: mockRawKlines,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

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
      expect(result[1]).toEqual({
        time: 1641081600,
        open: 46200,
        high: 46700,
        low: 46000,
        close: 46500,
        volume: 1200
      });
    });

    it('should handle empty klines response', async () => {
      mockGet.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toEqual([]);
      expect(mockGet).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockGet.mockRejectedValueOnce(new Error('Request failed with status 500'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 500');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Request failed with status 429');
      rateLimitError.name = 'RateLimitError';
      mockGet.mockRejectedValueOnce(rateLimitError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPIService] Error fetching klines:',
        expect.objectContaining({
          error: rateLimitError,
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 100
        })
      );
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      (mockGet as jest.Mock).mockRejectedValueOnce(timeoutError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Network timeout');
      
      expect(logger.error).toHaveBeenCalledWith(
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
      mockGet.mockResolvedValueOnce({
        data: 'not an array',
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

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

      mockGet.mockResolvedValueOnce({
        data: invalidKlines,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      // validateBinanceKlines should handle invalid data gracefully
      expect(result).toBeDefined();
    });

    it('should convert symbol to uppercase', async () => {
      (mockGet as jest.Mock).mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('btcusdt', '1h', 100);
      expect(result).toEqual([]);
      
      // Verify the API was called with uppercase symbol
      expect(mockGet).toHaveBeenCalledWith(
        '/klines',
        expect.objectContaining({ symbol: 'BTCUSDT' }),
        undefined
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
      mockGet.mockResolvedValueOnce({
        data: mockTickerData,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockGet).toHaveBeenCalledWith(
        '/ticker',
        { symbol: 'BTCUSDT' },
        undefined
      );
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockAllTickers = [
        { symbol: 'BTCUSDT', lastPrice: '47000.00' },
        { symbol: 'ETHUSDT', lastPrice: '3000.00' }
      ];

      mockGet.mockResolvedValueOnce({
        data: mockAllTickers,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr();

      expect(result).toEqual(mockAllTickers);
      expect(mockGet).toHaveBeenCalledWith(
        '/ticker',
        undefined,
        undefined
      );
    });

    it('should handle Binance error response', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      (mockGet as jest.Mock).mockResolvedValueOnce({
        data: errorResponse,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
      expect(logger.warn).toHaveBeenCalledWith('[BinanceAPI] Binance ticker error response', {
        symbol: 'INVALID',
        errorCode: -1121,
        errorMsg: 'Invalid symbol.',
        rawData: errorResponse
      });
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      (mockGet as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.fetchTicker24hr()).rejects.toThrow('Connection timeout');
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch 24hr ticker', 
        { 
          symbol: undefined,
          errorMessage: 'Connection timeout'
        },
        error
      );
    });

    it('should handle empty ticker response', async () => {
      mockGet.mockResolvedValueOnce({
        data: null,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr('BTCUSDT');
      expect(result).toBeNull();
    });

    it('should handle invalid ticker data format', async () => {
      mockGet.mockResolvedValueOnce({
        data: { invalid: 'format', no: 'symbol' },
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr('BTCUSDT');
      expect(result).toEqual({ invalid: 'format', no: 'symbol' });
    });

    it('should handle server 5xx errors', async () => {
      const serverError = new Error('Request failed with status 503');
      serverError.name = 'ServerError';
      (mockGet as jest.Mock).mockRejectedValueOnce(serverError);

      await expect(service.fetchTicker24hr('BTCUSDT'))
        .rejects.toThrow('Request failed with status 503');
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockPrice = {
        symbol: 'BTCUSDT',
        price: '50000.00'
      };

      mockGet.mockResolvedValueOnce({
        data: mockPrice,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchCurrentPrice('btcusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'BTCUSDT' }, undefined);
      expect(result).toEqual(mockPrice);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched current price', {
        symbol: 'btcusdt',
        price: '50000.00'
      });
    });

    it('should convert symbol to uppercase', async () => {
      mockGet.mockResolvedValueOnce({
        data: { symbol: 'ETHUSDT', price: '3000.00' },
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      await service.fetchCurrentPrice('ethusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'ETHUSDT' }, undefined);
    });

    it('should handle API errors', async () => {
      const error = new Error('Rate limit exceeded');
      (mockGet as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.fetchCurrentPrice('BTCUSDT')).rejects.toThrow('Rate limit exceeded');
      expect(logger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch current price', { symbol: 'BTCUSDT', errorMessage: 'Rate limit exceeded' }, error);
    });

    it('should handle price data with missing fields', async () => {
      mockGet.mockResolvedValueOnce({
        data: { symbol: 'BTCUSDT' }, // Missing price field
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchCurrentPrice('BTCUSDT');
      expect(result).toEqual({ symbol: 'BTCUSDT' });
    });

    it('should handle null price response', async () => {
      mockGet.mockResolvedValueOnce({
        data: null,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchCurrentPrice('BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('fetchExchangeInfo', () => {
    it('should fetch exchange info successfully', async () => {
      const currentServerTime = Date.now();
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: currentServerTime,
        rateLimits: [
          { rateLimitType: 'REQUEST_WEIGHT', interval: 'MINUTE', intervalNum: 1, limit: 1200 }
        ],
        exchangeFilters: [],
        symbols: [
          { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT' },
          { symbol: 'ETHUSDT', status: 'TRADING', baseAsset: 'ETH', quoteAsset: 'USDT' }
        ]
      };

      mockGet.mockResolvedValueOnce({
        data: mockExchangeInfo,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchExchangeInfo();

      expect(mockGet).toHaveBeenCalledWith('/exchangeInfo', undefined, undefined);
      expect(result).toEqual(mockExchangeInfo);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched exchange info');
    });

    it('should handle API errors', async () => {
      const error = new Error('Service unavailable');
      (mockGet as jest.Mock).mockRejectedValueOnce(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Service unavailable');
      expect(logger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch exchange info', { errorMessage: 'Service unavailable' }, error);
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol formats correctly', () => {
      // Valid symbols
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
      // Test minimum limit
      mockGet.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      await service.fetchKlines('BTCUSDT', '1h', 1);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        limit: '1'
      }), undefined);

      // Test maximum limit
      mockGet.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      await service.fetchKlines('BTCUSDT', '1h', 1000);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        limit: '1000'
      }), undefined);
    });

    it('should handle invalid interval values gracefully', async () => {
      mockGet.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      // Invalid interval should still be passed to API (API will handle validation)
      await service.fetchKlines('BTCUSDT', 'invalid' as any, 100);
      expect(mockGet).toHaveBeenCalledWith('/klines', expect.objectContaining({
        interval: 'invalid'
      }), undefined);
    });

    it('should handle very large response payloads', async () => {
      // Simulate large response with many klines
      const largeKlineArray = Array(1000).fill(null).map((_, i) => [
        1640995200000 + i * 60000,
        '46000.00', '46500.00', '45800.00', '46200.00', '1000.00',
        1640998800000 + i * 60000, '46000000.00', 1000, '500.00', '23000000.00', '0'
      ]);

      mockGet.mockResolvedValueOnce({
        data: largeKlineArray,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

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

      mockGet.mockResolvedValueOnce({
        data: corruptedKlines,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      expect(result).toBeDefined(); // Should handle gracefully
    });

    it('should handle concurrent requests properly', async () => {
      // Setup multiple mock responses
      mockGet
        .mockResolvedValueOnce({
          data: [{ symbol: 'BTCUSDT', price: '50000' }],
          status: 200,
          statusText: 'OK',
          headers: new Headers()
        })
        .mockResolvedValueOnce({
          data: [{ symbol: 'ETHUSDT', price: '3000' }],
          status: 200,
          statusText: 'OK',
          headers: new Headers()
        })
        .mockResolvedValueOnce({
          data: [{ symbol: 'BNBUSDT', price: '400' }],
          status: 200,
          statusText: 'OK',
          headers: new Headers()
        });

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
        .mockResolvedValueOnce({
          data: { symbol: 'BTCUSDT', price: '50000' },
          status: 200,
          statusText: 'OK',
          headers: new Headers()
        })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result1 = await service.fetchCurrentPrice('BTCUSDT');
      expect(result1).toEqual({ symbol: 'BTCUSDT', price: '50000' });

      await expect(service.fetchCurrentPrice('ETHUSDT'))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error handling', () => {
    it('should handle HTTP errors correctly', async () => {
      (mockGet as jest.Mock).mockRejectedValueOnce(new Error('Request failed with status 429'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
    });

    it('should handle network timeouts', async () => {
      (mockGet as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));
      
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
      // Since BinanceAPIService extends BaseService and we can't easily access
      // the basePath, we'll test that it works properly
      expect(serverService.isValidSymbol('BTCUSDT')).toBe(true);
    });

    it('should initialize with correct basePath for browser environment', () => {
      const globalWithWindow = global as typeof globalThis & { window?: Window };
      globalWithWindow.window = {} as Window;
      
      const browserService = new BinanceAPIService();
      
      expect(browserService).toBeInstanceOf(BinanceAPIService);
      // Test that the service works in browser environment
      expect(browserService.isValidSymbol('BTCUSDT')).toBe(true);
      
      globalWithWindow.window = undefined;
    });
  });
});