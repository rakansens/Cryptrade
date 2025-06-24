// Mock dependencies first
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/api/client');

import { BinanceAPIService } from '@/lib/binance/api-service';
import { ApiClient } from '@/lib/api/client';

// Mock validateBinanceKlines to return data as-is for testing
jest.mock('@/types/market', () => ({
  validateBinanceKlines: jest.fn((data) => data || []),
  BinanceTicker24hr: {},
  ProcessedKline: {},
  BinanceKlineTuple: {}
}));

// Mock generateMockTicker helper
const generateMockTicker = (symbol = 'BTCUSDT') => ({
  symbol,
  priceChange: '0.00',
  priceChangePercent: '0.00',
  weightedAvgPrice: '100.00',
  prevClosePrice: '100.00',
  lastPrice: '100.00',
  lastQty: '1.00',
  bidPrice: '99.99',
  bidQty: '10.00',
  askPrice: '100.01',
  askQty: '10.00',
  openPrice: '100.00',
  highPrice: '101.00',
  lowPrice: '99.00',
  volume: '1000.00',
  quoteVolume: '100000.00',
  openTime: Date.now() - 86400000,
  closeTime: Date.now(),
  firstId: 1,
  lastId: 100,
  count: 100
});

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock ApiClient instance
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    } as any;
    
    // Mock the ApiClient constructor to return our mock instance
    (ApiClient as jest.MockedClass<typeof ApiClient>).mockImplementation(() => mockApiClient);
    
    service = new BinanceAPIService();
  });

  describe('fetchKlines', () => {
    it('should fetch klines successfully', async () => {
      const mockKlineData = [
        {
          time: 1640995200,
          open: 46000,
          high: 46500,
          low: 45800,
          close: 46200,
          volume: 1000
        },
        {
          time: 1641081600,
          open: 46200,
          high: 46700,
          low: 46000,
          close: 46500,
          volume: 1200
        }
      ];

      // Mock the HTTP response
      mockApiClient.get.mockResolvedValueOnce({
        data: mockKlineData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

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
      
      // Verify the HTTP call was made correctly
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/klines'),
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: '100'
        },
        undefined
      );
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      mockApiClient.get.mockRejectedValueOnce(mockError);

      await expect(service.fetchKlines('INVALID', '1h', 100))
        .rejects.toThrow('API Error');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockApiClient.get.mockRejectedValueOnce(rateLimitError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should include startTime and endTime when provided', async () => {
      const mockData = [
        { time: 1640995200, open: 46000, high: 46500, low: 45800, close: 46200, volume: 1000 }
      ];
      
      mockApiClient.get.mockResolvedValueOnce({
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      const startTime = 1640995200000;
      const endTime = 1641081600000;

      await service.fetchKlines('BTCUSDT', '1h', 100, startTime, endTime);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/klines'),
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: '100',
          startTime: startTime.toString(),
          endTime: endTime.toString()
        },
        undefined
      );
    });

    it('should handle empty response', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toEqual([]);
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      mockApiClient.get.mockRejectedValueOnce(timeoutError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('timeout');
    });

    it('should convert symbol to uppercase', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      await service.fetchKlines('btcusdt', '1h', 100);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          symbol: 'BTCUSDT'
        }),
        undefined
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

      mockApiClient.get.mockResolvedValueOnce({
        data: mockTickerData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'), 
        { symbol: 'BTCUSDT' }, 
        undefined
      );
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockTickersData = [
        { symbol: 'BTCUSDT', lastPrice: '47000.00' },
        { symbol: 'ETHUSDT', lastPrice: '3000.00' }
      ];

      mockApiClient.get.mockResolvedValueOnce({
        data: mockTickersData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      const result = await service.fetchTicker24hr();

      expect(result).toEqual(mockTickersData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'), 
        undefined, 
        undefined
      );
    });

    it('should handle Binance API error response', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.'
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: errorResponse,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol format correctly', () => {
      // Test valid symbols
      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHUSDT')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      expect(service.isValidSymbol('BTCUSD')).toBe(true);
      expect(service.isValidSymbol('ETHUSD')).toBe(true);
      
      // Test lowercase (should still work as method converts to uppercase)
      expect(service.isValidSymbol('btcusdt')).toBe(true);
      expect(service.isValidSymbol('ethusdt')).toBe(true);
      
      // Test invalid formats
      expect(service.isValidSymbol('')).toBe(false);
      expect(service.isValidSymbol('123')).toBe(false);
      expect(service.isValidSymbol('BTC-USDT')).toBe(false); // with dash
      expect(service.isValidSymbol('BTC_USDT')).toBe(false); // with underscore
      expect(service.isValidSymbol('BTCEUR')).toBe(false); // not USD/USDT
      expect(service.isValidSymbol('BTC')).toBe(false); // too short
      expect(service.isValidSymbol('VERYLONGASSETUSDT')).toBe(false); // too long
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockPriceData = {
        symbol: 'BTCUSDT',
        price: '47000.00'
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      const result = await service.fetchCurrentPrice('BTCUSDT');

      expect(result).toEqual(mockPriceData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/ticker'), 
        { symbol: 'BTCUSDT' }, 
        undefined
      );
    });

    it('should handle errors when fetching current price', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchCurrentPrice('BTCUSDT'))
        .rejects.toThrow('Network error');
    });
  });

  describe('fetchExchangeInfo', () => {
    it('should fetch exchange info successfully', async () => {
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
        headers: {}
      } as any);

      const result = await service.fetchExchangeInfo();

      expect(result).toEqual(mockExchangeInfo);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/exchangeInfo'), 
        undefined, 
        undefined
      );
    });

    it('should handle errors when fetching exchange info', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(service.fetchExchangeInfo())
        .rejects.toThrow('Service unavailable');
    });
  });

  describe('Service behavior', () => {
    it('should handle concurrent requests', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      
      // Mock the client.get to return the ticker data
      mockApiClient.get.mockResolvedValue({
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {}
      } as any);

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        service.fetchTicker24hr('BTCUSDT')
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual(mockData);
      });
      
      // Verify get was called 5 times
      expect(mockApiClient.get).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success and failure', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      const mockError = new Error('API Error');

      mockApiClient.get
        .mockResolvedValueOnce({
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {}
        } as any)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {}
        } as any);

      const results = await Promise.allSettled([
        service.fetchTicker24hr('BTCUSDT'),
        service.fetchTicker24hr('BTCUSDT'),
        service.fetchTicker24hr('BTCUSDT')
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Error handling patterns', () => {
    it('should handle connection errors', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockApiClient.get.mockRejectedValueOnce(connectionError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('ECONNREFUSED');
    });

    it('should handle JSON parse errors', async () => {
      const parseError = new Error('Unexpected token in JSON');
      mockApiClient.get.mockRejectedValueOnce(parseError);

      await expect(service.fetchTicker24hr('BTCUSDT'))
        .rejects.toThrow('Unexpected token in JSON');
    });
  });

  describe('Service instance creation', () => {
    it('should create service instance correctly', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(BinanceAPIService);
    });

    it('should have proper methods available', () => {
      expect(typeof service.fetchKlines).toBe('function');
      expect(typeof service.fetchTicker24hr).toBe('function');
      expect(typeof service.fetchCurrentPrice).toBe('function');
      expect(typeof service.fetchExchangeInfo).toBe('function');
      expect(typeof service.isValidSymbol).toBe('function');
    });
  });
});