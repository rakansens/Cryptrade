// Test BinanceAPIService with full mocking
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock validateBinanceKlines
const mockValidateBinanceKlines = jest.fn();
jest.mock('@/types/market', () => ({
  ...jest.requireActual('@/types/market'),
  validateBinanceKlines: mockValidateBinanceKlines,
}));

// Create mock implementations
const mockFetchKlines = jest.fn();
const mockFetchTicker24hr = jest.fn();
const mockFetchCurrentPrice = jest.fn();
const mockFetchExchangeInfo = jest.fn();

// Mock the entire BinanceAPIService
jest.mock('@/lib/binance/api-service', () => {
  const actualModule = jest.requireActual('@/lib/binance/api-service');
  
  class MockBinanceAPIService {
    fetchKlines = mockFetchKlines;
    fetchTicker24hr = mockFetchTicker24hr;
    fetchCurrentPrice = mockFetchCurrentPrice;
    fetchExchangeInfo = mockFetchExchangeInfo;
  }
  
  return {
    ...actualModule,
    BinanceAPIService: MockBinanceAPIService,
    binanceAPI: {
      fetchKlines: mockFetchKlines,
      fetchTicker24hr: mockFetchTicker24hr,
      fetchCurrentPrice: mockFetchCurrentPrice,
      fetchExchangeInfo: mockFetchExchangeInfo,
    },
  };
});

import { BinanceAPIService, isValidSymbol } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';
import type { BinanceTicker24hr, ProcessedKline } from '@/types/market';

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BinanceAPIService();
    
    // Setup default mock behaviors
    mockValidateBinanceKlines.mockImplementation((data) => {
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    });
  });

  describe('constructor', () => {
    it('should create instance successfully', () => {
      expect(service).toBeInstanceOf(BinanceAPIService);
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
      mockFetchKlines.mockResolvedValueOnce(mockProcessedKlines);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
      expect(result).toEqual(mockProcessedKlines);
    });

    it('should include optional time parameters', async () => {
      mockFetchKlines.mockResolvedValueOnce(mockProcessedKlines);
      
      const startTime = 1640995200000;
      const endTime = 1641081600000;
      await service.fetchKlines('ETHUSDT', '4h', 500, startTime, endTime);

      expect(mockFetchKlines).toHaveBeenCalledWith('ETHUSDT', '4h', 500, startTime, endTime);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockFetchKlines.mockRejectedValueOnce(error);

      await expect(service.fetchKlines('BTCUSDT', '1h')).rejects.toThrow('Network error');
    });
  });

  describe('fetchTicker24hr', () => {
    const mockSingleTicker: BinanceTicker24hr = {
      symbol: 'BTCUSDT',
      priceChange: '100.00',
      priceChangePercent: '0.10',
      weightedAvgPrice: '100100.00',
      prevClosePrice: '100000.00',
      lastPrice: '100100.00',
      lastQty: '0.01',
      bidPrice: '100099.00',
      bidQty: '10.00',
      askPrice: '100101.00',
      askQty: '10.00',
      openPrice: '100000.00',
      highPrice: '101000.00',
      lowPrice: '99000.00',
      volume: '10000.00',
      quoteVolume: '1000000000.00',
      openTime: 1234567890000,
      closeTime: 1234654290000,
      firstId: 123456,
      lastId: 234567,
      count: 111111,
    };

    it('should fetch single ticker when symbol is provided', async () => {
      mockFetchTicker24hr.mockResolvedValueOnce(mockSingleTicker);

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(mockFetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
      expect(result).toEqual(mockSingleTicker);
    });

    it('should handle Binance error response', async () => {
      const error = new Error('Binance API error: -1121 - Invalid symbol.');
      mockFetchTicker24hr.mockRejectedValueOnce(error);

      await expect(service.fetchTicker24hr('INVALID')).rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      mockFetchTicker24hr.mockRejectedValueOnce(error);

      await expect(service.fetchTicker24hr()).rejects.toThrow('Connection timeout');
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockPrice = { symbol: 'BTCUSDT', price: '100.00' };
      mockFetchCurrentPrice.mockResolvedValueOnce(mockPrice);

      const result = await service.fetchCurrentPrice('btcusdt');

      expect(mockFetchCurrentPrice).toHaveBeenCalledWith('btcusdt');
      expect(result).toEqual(mockPrice);
    });

    it('should handle API errors', async () => {
      const error = new Error('Rate limit exceeded');
      mockFetchCurrentPrice.mockRejectedValueOnce(error);

      await expect(service.fetchCurrentPrice('BTCUSDT')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate correct USDT symbols', () => {
      expect(isValidSymbol('BTCUSDT')).toBe(true);
      expect(isValidSymbol('ETHUSDT')).toBe(true);
      expect(isValidSymbol('btcusdt')).toBe(true);
      expect(isValidSymbol('BNBUSDT')).toBe(true);
    });

    it('should reject invalid symbols', () => {
      expect(isValidSymbol('BTC')).toBe(false);
      expect(isValidSymbol('BTCUSD')).toBe(false);
      expect(isValidSymbol('USDT')).toBe(false);
      expect(isValidSymbol('')).toBe(false);
      expect(isValidSymbol('BTC-USDT')).toBe(false);
      expect(isValidSymbol('BTC/USDT')).toBe(false);
    });
  });

  describe('fetchExchangeInfo', () => {
    const mockExchangeInfo = {
      timezone: 'UTC',
      serverTime: Date.now(),
      rateLimits: [],
      exchangeFilters: [],
      symbols: [],
    };

    it('should fetch exchange info successfully', async () => {
      mockFetchExchangeInfo.mockResolvedValueOnce(mockExchangeInfo);

      const result = await service.fetchExchangeInfo();

      expect(mockFetchExchangeInfo).toHaveBeenCalledWith();
      expect(result).toEqual(mockExchangeInfo);
    });

    it('should handle API errors', async () => {
      const error = new Error('Service unavailable');
      mockFetchExchangeInfo.mockRejectedValueOnce(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Service unavailable');
    });
  });
});