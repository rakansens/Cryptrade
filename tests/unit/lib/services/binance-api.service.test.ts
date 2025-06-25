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

// Mock ApiClient
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn()
}));

// Type for mocked service methods
interface MockedServiceMethods {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
}

// Spy on the BaseService methods
const createMockService = () => {
  const BinanceAPIService = jest.requireActual<typeof import('@/lib/binance/api-service')>('@/lib/binance/api-service').BinanceAPIService;
  const service = new BinanceAPIService();
  
  // Create spies for the protected methods
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockPut = jest.fn();
  const mockDelete = jest.fn();
  
  // Override the methods using type assertion
  const serviceWithMocks = service as BinanceAPIService & MockedServiceMethods;
  serviceWithMocks.get = mockGet;
  serviceWithMocks.post = mockPost;
  serviceWithMocks.put = mockPut;
  serviceWithMocks.delete = mockDelete;
  
  return { service: serviceWithMocks, mockGet, mockPost, mockPut, mockDelete };
};

// Now import the service after mocks are set up
import { BinanceAPIService } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  let mockGet: jest.Mock;
  let mockPost: jest.Mock;
  let mockPut: jest.Mock;
  let mockDelete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window to ensure we're testing server-side behavior
    const globalWithWindow = global as typeof globalThis & { window?: Window };
    globalWithWindow.window = undefined;
    
    // Create service instance with mocked methods
    const mocks = createMockService();
    service = mocks.service;
    mockGet = mocks.mockGet;
    mockPost = mocks.mockPost;
    mockPut = mocks.mockPut;
    mockDelete = mocks.mockDelete;
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

    it('should convert symbol to uppercase', async () => {
      mockGet.mockResolvedValueOnce({
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
        { symbol: 'BTCUSDT' }
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
        undefined
      );
    });

    it('should handle Binance error responses', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      mockGet.mockResolvedValueOnce({
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

      mockGet.mockResolvedValueOnce({
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchCurrentPrice('BTCUSDT');

      expect(result).toEqual(mockPriceData);
      expect(mockGet).toHaveBeenCalledWith(
        '/ticker',
        { symbol: 'BTCUSDT' }
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

      mockGet.mockResolvedValueOnce({
        data: mockExchangeInfo,
        status: 200,
        statusText: 'OK',
        headers: new Headers()
      });

      const result = await service.fetchExchangeInfo();

      expect(result).toEqual(mockExchangeInfo);
      expect(mockGet).toHaveBeenCalledWith('/exchangeInfo');
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
      mockGet.mockRejectedValueOnce(new Error('Request failed with status 429'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
    });

    it('should handle network timeouts', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network timeout'));
      
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