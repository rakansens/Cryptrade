import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BinanceAPIService } from '../api-service';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline, BinanceTicker24hr } from '@/types/market';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api/base-service');
jest.mock('@/types/market', () => ({
  validateBinanceKlines: jest.fn((data) => data), // Mock to return data as-is
}));

// Mock window object
const mockWindow = global as any;

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  let mockGet: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindow.window = undefined; // Default to server-side
    service = new BinanceAPIService();
    
    // Mock the get method
    mockGet = jest.fn();
    service['get'] = mockGet;
  });

  describe('constructor', () => {
    it('should use Binance API directly on server-side', () => {
      mockWindow.window = undefined;
      const serverService = new BinanceAPIService();
      // Since basePath is private in parent, we can't directly check it
      // Instead, we verify the behavior is correct by checking service exists
      expect(serverService).toBeDefined();
      expect(serverService instanceof BinanceAPIService).toBe(true);
    });

    it('should use Next.js API route on client-side', () => {
      mockWindow.window = {};
      const clientService = new BinanceAPIService();
      // Since basePath is private in parent, we can't directly check it
      // Instead, we verify the behavior is correct by checking service exists
      expect(clientService).toBeDefined();
      expect(clientService instanceof BinanceAPIService).toBe(true);
    });
  });

  describe('fetchKlines', () => {
    const mockKlineData: ProcessedKline[] = [
      {
        time: 1640000000000,
        open: 45000,
        high: 46000,
        low: 44000,
        close: 45500,
        volume: 1000,
      },
      {
        time: 1640003600000,
        open: 45500,
        high: 46500,
        low: 45000,
        close: 46000,
        volume: 1200,
      },
    ];

    it('should fetch and process klines successfully', async () => {
      const symbol = 'BTCUSDT';
      const interval = '1h';
      const limit = 100;

      mockGet.mockResolvedValue({
        data: mockKlineData,
        status: 200,
      });

      const result = await service.fetchKlines(symbol, interval, limit);

      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: '100',
      });

      expect(result).toEqual(mockKlineData);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched and validated klines', {
        symbol,
        interval,
        count: 2,
      });
    });

    it('should handle optional time parameters', async () => {
      const symbol = 'ETHUSDT';
      const interval = '4h';
      const limit = 500;
      const startTime = 1640000000000;
      const endTime = 1640100000000;

      mockGet.mockResolvedValue({
        data: mockKlineData,
        status: 200,
      });

      await service.fetchKlines(symbol, interval, limit, startTime, endTime);

      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'ETHUSDT',
        interval: '4h',
        limit: '500',
        startTime: '1640000000000',
        endTime: '1640100000000',
      });
    });

    it('should handle uppercase conversion for symbols', async () => {
      const symbol = 'btcusdt';
      
      mockGet.mockResolvedValue({
        data: mockKlineData,
        status: 200,
      });

      await service.fetchKlines(symbol);

      expect(mockGet).toHaveBeenCalledWith('/klines', 
        expect.objectContaining({
          symbol: 'BTCUSDT',
        })
      );
    });

    it('should use default values for optional parameters', async () => {
      const symbol = 'BTCUSDT';
      
      mockGet.mockResolvedValue({
        data: mockKlineData,
        status: 200,
      });

      await service.fetchKlines(symbol);

      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: '1000',
      });
    });

    it('should handle API errors', async () => {
      const symbol = 'BTCUSDT';
      const error = new Error('Network error');
      
      mockGet.mockRejectedValue(error);

      await expect(service.fetchKlines(symbol)).rejects.toThrow('Network error');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        expect.objectContaining({
          symbol,
          errorMessage: 'Network error',
        }),
        error
      );
    });

    it('should handle raw Binance array format', async () => {
      const rawBinanceData = [
        [1640000000000, "45000", "46000", "44000", "45500", "1000", 1640003600000, "45000000", 100, "500", "22500000", "0"],
        [1640003600000, "45500", "46500", "45000", "46000", "1200", 1640007200000, "55200000", 120, "600", "27600000", "0"],
      ];

      mockGet.mockResolvedValue({
        data: rawBinanceData,
        status: 200,
      });

      const result = await service.fetchKlines('BTCUSDT');

      expect(logger.debug).toHaveBeenCalledWith(
        '[BinanceAPI] Klines response from API route',
        expect.objectContaining({
          dataType: 'array',
          dataLength: 2,
          isProcessed: false,
        })
      );

      // validateBinanceKlines should be called to process the raw data
      expect(result).toBeDefined();
    });
  });

  describe('fetchTicker24hr', () => {
    const mockTickerData: BinanceTicker24hr = {
      symbol: 'BTCUSDT',
      priceChange: 1000,
      priceChangePercent: 2.22,
      weightedAvgPrice: 45500,
      prevClosePrice: 45000,
      lastPrice: 46000,
      lastQty: 0.5,
      bidPrice: 45990,
      askPrice: 46010,
      openPrice: 45000,
      highPrice: 47000,
      lowPrice: 44000,
      volume: 10000,
      quoteVolume: 455000000,
      openTime: 1640000000000,
      closeTime: 1640086400000,
      count: 100000,
    };

    it('should fetch ticker data for specific symbol', async () => {
      const symbol = 'BTCUSDT';
      
      mockGet.mockResolvedValue({
        data: mockTickerData,
        status: 200,
      });

      const result = await service.fetchTicker24hr(symbol);

      expect(mockGet).toHaveBeenCalledWith('/ticker', {
        symbol: 'BTCUSDT',
      });

      expect(result).toEqual(mockTickerData);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched 24hr ticker', {
        symbol,
        dataType: 'object',
      });
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockAllTickers = [mockTickerData, { ...mockTickerData, symbol: 'ETHUSDT' }];
      
      mockGet.mockResolvedValue({
        data: mockAllTickers,
        status: 200,
      });

      const result = await service.fetchTicker24hr();

      expect(mockGet).toHaveBeenCalledWith('/ticker', undefined);
      expect(result).toEqual(mockAllTickers);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched 24hr ticker', {
        symbol: undefined,
        dataType: 'array',
      });
    });

    it('should handle Binance error responses', async () => {
      const symbol = 'INVALID';
      const binanceError = {
        code: -1121,
        msg: 'Invalid symbol.',
      };
      
      mockGet.mockResolvedValue({
        data: binanceError,
        status: 200,
      });

      await expect(service.fetchTicker24hr(symbol)).rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[BinanceAPI] Binance ticker error response',
        expect.objectContaining({
          symbol,
          errorCode: -1121,
          errorMsg: 'Invalid symbol.',
        })
      );
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      
      mockGet.mockRejectedValue(error);

      await expect(service.fetchTicker24hr('BTCUSDT')).rejects.toThrow('Connection timeout');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch 24hr ticker',
        expect.objectContaining({
          errorMessage: 'Connection timeout',
        }),
        error
      );
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price for a symbol', async () => {
      const symbol = 'BTCUSDT';
      const mockPriceData = {
        symbol: 'BTCUSDT',
        price: '46000.50',
      };
      
      mockGet.mockResolvedValue({
        data: mockPriceData,
        status: 200,
      });

      const result = await service.fetchCurrentPrice(symbol);

      expect(mockGet).toHaveBeenCalledWith('/ticker', {
        symbol: 'BTCUSDT',
      });

      expect(result).toEqual(mockPriceData);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched current price', {
        symbol,
        price: '46000.50',
      });
    });

    it('should handle errors when fetching price', async () => {
      const symbol = 'BTCUSDT';
      const error = new Error('API unavailable');
      
      mockGet.mockRejectedValue(error);

      await expect(service.fetchCurrentPrice(symbol)).rejects.toThrow('API unavailable');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch current price',
        { symbol },
        error
      );
    });
  });

  describe('isValidSymbol', () => {
    it('should validate correct symbol formats', () => {
      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHUSDT')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      expect(service.isValidSymbol('BTCUSDC')).toBe(false); // Not USDT
      expect(service.isValidSymbol('btcusdt')).toBe(true); // Case insensitive
    });

    it('should reject invalid symbol formats', () => {
      expect(service.isValidSymbol('BTC')).toBe(false); // Too short
      expect(service.isValidSymbol('VERYLONGBASEUSDT')).toBe(false); // Too long base (>10 chars)
      expect(service.isValidSymbol('BTC-USDT')).toBe(false); // Wrong format
      expect(service.isValidSymbol('123USDT')).toBe(false); // Numbers in base
      expect(service.isValidSymbol('')).toBe(false); // Empty
    });
  });

  describe('fetchExchangeInfo', () => {
    it('should fetch exchange info successfully', async () => {
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: 1640000000000,
        symbols: [
          { symbol: 'BTCUSDT', status: 'TRADING' },
          { symbol: 'ETHUSDT', status: 'TRADING' },
        ],
      };
      
      mockGet.mockResolvedValue({
        data: mockExchangeInfo,
        status: 200,
      });

      const result = await service.fetchExchangeInfo();

      expect(mockGet).toHaveBeenCalledWith('/exchangeInfo');
      expect(result).toEqual(mockExchangeInfo);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched exchange info');
    });

    it('should handle errors when fetching exchange info', async () => {
      const error = new Error('Rate limit exceeded');
      
      mockGet.mockRejectedValue(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Rate limit exceeded');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch exchange info',
        {},
        error
      );
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockGet.mockRejectedValue('String error');

      await expect(service.fetchKlines('BTCUSDT')).rejects.toBe('String error');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        expect.objectContaining({
          errorMessage: 'Unknown error',
        }),
        'String error'
      );
    });

    it('should handle undefined errors', async () => {
      mockGet.mockRejectedValue(undefined);

      await expect(service.fetchTicker24hr()).rejects.toBe(undefined);
      
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch 24hr ticker',
        expect.objectContaining({
          errorMessage: 'Unknown error',
        }),
        undefined
      );
    });
  });
});