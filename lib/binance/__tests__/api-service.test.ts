// Mock dependencies before imports
jest.mock('@/lib/utils/logger');
jest.mock('@/types/market', () => ({
  ...jest.requireActual('@/types/market'),
  validateBinanceKlines: jest.fn(),
}));

// Mock BaseService
jest.mock('@/lib/api/base-service', () => ({
  BaseService: jest.fn().mockImplementation((basePath: string) => ({
    basePath,
    get: jest.fn(),
  })),
}));

import { BinanceAPIService } from '../api-service';
import { logger } from '@/lib/utils/logger';
import { validateBinanceKlines } from '@/types/market';
import type { BinanceTicker24hr, ProcessedKline, BinanceKlineTuple } from '@/types/market';

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BinanceAPIService();
    mockGet = (service as any).get;
  });

  describe('constructor', () => {
    it('should use Next.js API route in browser environment', () => {
      const originalWindow = global.window;
      global.window = {} as any;

      const browserService = new BinanceAPIService();
      expect((browserService as any).basePath).toBe('/api/binance');

      global.window = originalWindow;
    });

    it('should use Binance public API in server environment', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const serverService = new BinanceAPIService();
      expect((serverService as any).basePath).toBe('https://api.binance.com/api/v3');

      global.window = originalWindow;
    });
  });

  describe('fetchKlines', () => {
    const mockProcessedKlines: ProcessedKline[] = [
      {
        time: 1640995200000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000,
      },
      {
        time: 1640998800000,
        open: 50500,
        high: 51500,
        low: 50000,
        close: 51000,
        volume: 1200,
      },
    ];

    it('should fetch and process klines successfully', async () => {
      mockGet.mockResolvedValueOnce({ data: mockProcessedKlines });
      jest.mocked(validateBinanceKlines).mockReturnValue(mockProcessedKlines);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: '100',
      });
      expect(validateBinanceKlines).toHaveBeenCalledWith(mockProcessedKlines);
      expect(result).toEqual(mockProcessedKlines);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched and validated klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        count: 2,
      });
    });

    it('should include optional time parameters', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });
      jest.mocked(validateBinanceKlines).mockReturnValue([]);

      const startTime = 1640995200000;
      const endTime = 1641081600000;

      await service.fetchKlines('ETHUSDT', '4h', 500, startTime, endTime);

      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'ETHUSDT',
        interval: '4h',
        limit: '500',
        startTime: '1640995200000',
        endTime: '1641081600000',
      });
    });

    it('should handle raw Binance kline tuples', async () => {
      const rawKlines: BinanceKlineTuple[] = [
        [
          1640995200000, // Open time
          '50000.00',    // Open
          '51000.00',    // High
          '49000.00',    // Low
          '50500.00',    // Close
          '1000.00',     // Volume
          1640998800000, // Close time
          '50500000.00', // Quote asset volume
          1000,          // Number of trades
          '500.00',      // Taker buy base asset volume
          '25250000.00', // Taker buy quote asset volume
          '0'            // Ignore
        ],
      ];

      mockGet.mockResolvedValueOnce({ data: rawKlines });
      jest.mocked(validateBinanceKlines).mockReturnValue(mockProcessedKlines);

      const result = await service.fetchKlines('BTCUSDT', '1h');

      expect(validateBinanceKlines).toHaveBeenCalledWith(rawKlines);
      expect(result).toEqual(mockProcessedKlines);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockGet.mockRejectedValueOnce(error);

      await expect(service.fetchKlines('BTCUSDT', '1h')).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch klines',
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 1000,
          errorMessage: 'Network error',
        },
        error
      );
    });

    it('should log debug information about response', async () => {
      const mockData = [{ time: 1640995200000, open: 50000 }];
      mockGet.mockResolvedValueOnce({ data: mockData });
      jest.mocked(validateBinanceKlines).mockReturnValue(mockProcessedKlines);

      await service.fetchKlines('BTCUSDT', '1h');

      expect(logger.debug).toHaveBeenCalledWith('[BinanceAPI] Klines response from API route', {
        symbol: 'BTCUSDT',
        interval: '1h',
        dataType: 'array',
        dataLength: 1,
        isProcessed: true,
        sample: expect.any(String),
      });
    });
  });

  describe('fetchTicker24hr', () => {
    const mockSingleTicker: BinanceTicker24hr = {
      symbol: 'BTCUSDT',
      priceChange: '1000.00',
      priceChangePercent: '2.00',
      weightedAvgPrice: '50000.00',
      prevClosePrice: '49000.00',
      lastPrice: '51000.00',
      lastQty: '0.5',
      bidPrice: '50900.00',
      bidQty: '1.0',
      askPrice: '51100.00',
      askQty: '1.0',
      openPrice: '49000.00',
      highPrice: '52000.00',
      lowPrice: '48000.00',
      volume: '10000.00',
      quoteVolume: '500000000.00',
      openTime: 1640995200000,
      closeTime: 1641081600000,
      firstId: 1000000,
      lastId: 2000000,
      count: 1000000,
    };

    it('should fetch single ticker when symbol is provided', async () => {
      mockGet.mockResolvedValueOnce({ data: mockSingleTicker });

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'BTCUSDT' });
      expect(result).toEqual(mockSingleTicker);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched 24hr ticker', {
        symbol: 'BTCUSDT',
        dataType: 'object',
      });
    });

    it('should fetch all tickers when no symbol is provided', async () => {
      const mockMultipleTickers: BinanceTicker24hr[] = [mockSingleTicker, { ...mockSingleTicker, symbol: 'ETHUSDT' }];
      mockGet.mockResolvedValueOnce({ data: mockMultipleTickers });

      const result = await service.fetchTicker24hr();

      expect(mockGet).toHaveBeenCalledWith('/ticker', undefined);
      expect(result).toEqual(mockMultipleTickers);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched 24hr ticker', {
        symbol: undefined,
        dataType: 'array',
      });
    });

    it('should handle Binance error response', async () => {
      const errorResponse = {
        code: -1121,
        msg: 'Invalid symbol.',
      };
      mockGet.mockResolvedValueOnce({ data: errorResponse });

      await expect(service.fetchTicker24hr('INVALID')).rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
      expect(logger.warn).toHaveBeenCalledWith('[BinanceAPI] Binance ticker error response', {
        symbol: 'INVALID',
        errorCode: -1121,
        errorMsg: 'Invalid symbol.',
        rawData: errorResponse,
      });
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      mockGet.mockRejectedValueOnce(error);

      await expect(service.fetchTicker24hr()).rejects.toThrow('Connection timeout');
      expect(logger.error).toHaveBeenCalledWith(
        '[BinanceAPI] Failed to fetch 24hr ticker',
        {
          symbol: undefined,
          errorMessage: 'Connection timeout',
        },
        error
      );
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockPrice = { symbol: 'BTCUSDT', price: '51234.56' };
      mockGet.mockResolvedValueOnce({ data: mockPrice });

      const result = await service.fetchCurrentPrice('btcusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'BTCUSDT' });
      expect(result).toEqual(mockPrice);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched current price', {
        symbol: 'btcusdt',
        price: '51234.56',
      });
    });

    it('should convert symbol to uppercase', async () => {
      const mockPrice = { symbol: 'ETHUSDT', price: '3456.78' };
      mockGet.mockResolvedValueOnce({ data: mockPrice });

      await service.fetchCurrentPrice('ethusdt');

      expect(mockGet).toHaveBeenCalledWith('/ticker', { symbol: 'ETHUSDT' });
    });

    it('should handle API errors', async () => {
      const error = new Error('Rate limit exceeded');
      mockGet.mockRejectedValueOnce(error);

      await expect(service.fetchCurrentPrice('BTCUSDT')).rejects.toThrow('Rate limit exceeded');
      expect(logger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch current price', { symbol: 'BTCUSDT' }, error);
    });
  });

  describe('isValidSymbol', () => {
    it('should validate correct USDT symbols', () => {
      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHUSDT')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      expect(service.isValidSymbol('btcusdt')).toBe(true); // Case insensitive
    });

    it('should validate USDT symbols without T', () => {
      expect(service.isValidSymbol('BTCUSD')).toBe(true);
      expect(service.isValidSymbol('ETHUSD')).toBe(true);
    });

    it('should reject invalid symbols', () => {
      expect(service.isValidSymbol('BTC')).toBe(false);
      expect(service.isValidSymbol('BTCEUR')).toBe(false);
      expect(service.isValidSymbol('123USDT')).toBe(false);
      expect(service.isValidSymbol('BTC-USDT')).toBe(false);
      expect(service.isValidSymbol('BTCUSDTTTT')).toBe(false);
      expect(service.isValidSymbol('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(service.isValidSymbol('AAUSDT')).toBe(true); // 2 char base asset
      expect(service.isValidSymbol('AAAAAAAAAUSDT')).toBe(true); // 10 char base asset
      expect(service.isValidSymbol('AAAAAAAAAAUSDT')).toBe(false); // 11 char base asset
    });
  });

  describe('fetchExchangeInfo', () => {
    const mockExchangeInfo = {
      timezone: 'UTC',
      serverTime: 1640995200000,
      rateLimits: [
        {
          rateLimitType: 'REQUEST_WEIGHT',
          interval: 'MINUTE',
          intervalNum: 1,
          limit: 1200,
        },
      ],
      exchangeFilters: [],
      symbols: [
        {
          symbol: 'BTCUSDT',
          status: 'TRADING',
          baseAsset: 'BTC',
          baseAssetPrecision: 8,
          quoteAsset: 'USDT',
          quotePrecision: 8,
          quoteAssetPrecision: 8,
          orderTypes: ['LIMIT', 'MARKET'],
          icebergAllowed: true,
          ocoAllowed: true,
          isSpotTradingAllowed: true,
          isMarginTradingAllowed: true,
          filters: [],
          permissions: ['SPOT', 'MARGIN'],
        },
      ],
    };

    it('should fetch exchange info successfully', async () => {
      mockGet.mockResolvedValueOnce({ data: mockExchangeInfo });

      const result = await service.fetchExchangeInfo();

      expect(mockGet).toHaveBeenCalledWith('/exchangeInfo');
      expect(result).toEqual(mockExchangeInfo);
      expect(logger.info).toHaveBeenCalledWith('[BinanceAPI] Fetched exchange info');
    });

    it('should handle API errors', async () => {
      const error = new Error('Service unavailable');
      mockGet.mockRejectedValueOnce(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Service unavailable');
      expect(logger.error).toHaveBeenCalledWith('[BinanceAPI] Failed to fetch exchange info', {}, error);
    });
  });

  describe('legacy singleton export', () => {
    it('should export a singleton instance', () => {
      const { binanceAPI } = require('../api-service');
      expect(binanceAPI).toBeInstanceOf(BinanceAPIService);
    });
  });
});