import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock logger first
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

// Import types before mocking
import type { ApiResponse } from '@/lib/api/client';

// Create a mock ApiClient instance to use in tests
let mockApiClientInstance: any;

// Mock ApiClient to control responses
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn().mockImplementation(() => {
    mockApiClientInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    return mockApiClientInstance;
  })
}));

// Now import the service after mocks are set up
import { BinanceAPIService } from '@/lib/binance/api-service';
import { ApiClient } from '@/lib/api/client';
import { logger } from '@/lib/utils/logger';

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  let mockApiClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock instance
    mockApiClientInstance = null;
    
    // Mock window to ensure we're testing server-side behavior
    (global as any).window = undefined;
    
    // Create service instance
    service = new BinanceAPIService();
    
    // Use the captured mock instance
    mockApiClient = mockApiClientInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Methods', () => {
    it('should create an instance of BinanceAPIService', () => {
      expect(service).toBeInstanceOf(BinanceAPIService);
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
      mockApiClient.get.mockResolvedValueOnce({
        data: mockRawKlines,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/klines'),
        expect.objectContaining({
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: '100'
        }),
        undefined
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
      mockApiClient.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toEqual([]);
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Request failed with status 500'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 500');
    });

    it('should convert symbol to uppercase', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchKlines('btcusdt', '1h', 100);
      expect(result).toEqual([]);
      
      // Verify the API was called with uppercase symbol
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.any(String),
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
      mockApiClient.get.mockResolvedValueOnce({
        data: mockTickerData,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'),
        { symbol: 'BTCUSDT' },
        undefined
      );
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockAllTickers = [
        { symbol: 'BTCUSDT', lastPrice: '47000.00' },
        { symbol: 'ETHUSDT', lastPrice: '3000.00' }
      ];

      mockApiClient.get.mockResolvedValueOnce({
        data: mockAllTickers,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchTicker24hr();

      expect(result).toEqual(mockAllTickers);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'),
        undefined,
        undefined
      );
    });

    it('should handle Binance error responses', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: errorResponse,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price for a symbol', async () => {
      const mockPriceData = {
        symbol: 'BTCUSDT',
        price: '47000.00'
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchCurrentPrice('BTCUSDT');

      expect(result).toEqual(mockPriceData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'),
        { symbol: 'BTCUSDT' },
        undefined
      );
    });
  });

  describe('fetchExchangeInfo', () => {
    it('should fetch exchange information', async () => {
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: Date.now(),
        rateLimits: [],
        exchangeFilters: [],
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'TRADING',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            baseAssetPrecision: 8,
            quotePrecision: 8,
            quoteAssetPrecision: 8,
            orderTypes: ['LIMIT', 'MARKET'],
            icebergAllowed: true,
            ocoAllowed: true,
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: true,
            filters: [],
            permissions: ['SPOT', 'MARGIN']
          }
        ]
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: mockExchangeInfo,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchExchangeInfo();

      expect(result).toEqual(mockExchangeInfo);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/exchangeInfo'),
        undefined,
        undefined
      );
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

  describe('Error handling', () => {
    it('should handle HTTP errors correctly', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Request failed with status 429'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
    });

    it('should handle network timeouts', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network timeout'));
      
      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('Browser vs Server behavior', () => {
    it('should initialize with correct basePath for server environment', () => {
      (global as any).window = undefined;
      const ApiClientMock = ApiClient as jest.MockedClass<typeof ApiClient>;
      ApiClientMock.mockClear();
      
      const serverService = new BinanceAPIService();
      
      expect(serverService).toBeInstanceOf(BinanceAPIService);
      expect(ApiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.binance.com/api/v3'
        })
      );
    });

    it('should initialize with correct basePath for browser environment', () => {
      (global as any).window = {};
      const ApiClientMock = ApiClient as jest.MockedClass<typeof ApiClient>;
      ApiClientMock.mockClear();
      
      const browserService = new BinanceAPIService();
      
      expect(browserService).toBeInstanceOf(BinanceAPIService);
      expect(ApiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: '/api/binance'
        })
      );
      
      (global as any).window = undefined;
    });
  });
});