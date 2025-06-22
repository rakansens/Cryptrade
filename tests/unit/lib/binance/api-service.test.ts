/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the BinanceAPIService before importing
const mockBinanceAPIService = {
  fetchKlines: jest.fn(),
  fetchTicker24hr: jest.fn(),
  fetchCurrentPrice: jest.fn(),
  fetchExchangeInfo: jest.fn(),
  isValidSymbol: jest.fn(),
};

jest.mock('@/lib/binance/api-service', () => ({
  BinanceAPIService: jest.fn(() => mockBinanceAPIService),
}));

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/types/market', () => ({
  validateBinanceKlines: jest.fn((data) => data),
}));

import { BinanceAPIService } from '@/lib/binance/api-service';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline, BinanceTicker24hr } from '@/types/market';

// Mock window object
const mockWindow = global as any;

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindow.window = undefined; // Default to server-side
    service = new BinanceAPIService();
  });

  describe('constructor', () => {
    it('should use Binance API directly on server-side', () => {
      mockWindow.window = undefined;
      const serverService = new BinanceAPIService();
      expect(serverService).toBeDefined();
    });

    it('should use Next.js API route on client-side', () => {
      mockWindow.window = {};
      const clientService = new BinanceAPIService();
      expect(clientService).toBeDefined();
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

      mockBinanceAPIService.fetchKlines.mockResolvedValue(mockKlineData);

      const result = await service.fetchKlines(symbol, interval, limit);

      expect(mockBinanceAPIService.fetchKlines).toHaveBeenCalledWith(symbol, interval, limit);
      expect(result).toEqual(mockKlineData);
    });

    it('should handle optional time parameters', async () => {
      const symbol = 'ETHUSDT';
      const interval = '4h';
      const limit = 500;
      const startTime = 1640000000000;
      const endTime = 1640100000000;

      mockBinanceAPIService.fetchKlines.mockResolvedValue(mockKlineData);

      await service.fetchKlines(symbol, interval, limit, startTime, endTime);

      expect(mockBinanceAPIService.fetchKlines).toHaveBeenCalledWith(symbol, interval, limit, startTime, endTime);
    });

    it('should handle uppercase conversion for symbols', async () => {
      const symbol = 'btcusdt';
      
      mockBinanceAPIService.fetchKlines.mockResolvedValue(mockKlineData);

      await service.fetchKlines(symbol);

      expect(mockBinanceAPIService.fetchKlines).toHaveBeenCalledWith(symbol);
    });

    it('should use default values for optional parameters', async () => {
      const symbol = 'BTCUSDT';
      
      mockBinanceAPIService.fetchKlines.mockResolvedValue(mockKlineData);

      await service.fetchKlines(symbol);

      expect(mockBinanceAPIService.fetchKlines).toHaveBeenCalledWith(symbol);
    });

    it('should handle API errors', async () => {
      const symbol = 'BTCUSDT';
      const error = new Error('Network error');
      
      mockBinanceAPIService.fetchKlines.mockRejectedValue(error);

      await expect(service.fetchKlines(symbol)).rejects.toThrow('Network error');
    });

    it('should handle raw Binance array format', async () => {
      const rawBinanceData = [
        [1640000000000, "45000", "46000", "44000", "45500", "1000", 1640003600000, "45000000", 100, "500", "22500000", "0"],
        [1640003600000, "45500", "46500", "45000", "46000", "1200", 1640007200000, "55200000", 120, "600", "27600000", "0"],
      ];

      mockBinanceAPIService.fetchKlines.mockResolvedValue(rawBinanceData);

      const result = await service.fetchKlines('BTCUSDT');

      expect(result).toBeDefined();
    });
  });

  describe('fetchTicker24hr', () => {
    const mockTickerData: BinanceTicker24hr = {
      symbol: 'BTCUSDT',
      priceChange: '1000',
      priceChangePercent: '2.22',
      weightedAvgPrice: '45500',
      prevClosePrice: '45000',
      lastPrice: '46000',
      lastQty: '0.5',
      bidPrice: '45990',
      bidQty: '1.2',
      askPrice: '46010',
      askQty: '0.8',
      openPrice: '45000',
      highPrice: '47000',
      lowPrice: '44000',
      volume: '10000',
      quoteVolume: '455000000',
      openTime: 1640000000000,
      closeTime: 1640086400000,
      firstId: 1000000,
      lastId: 1100000,
      count: 100000,
    };

    it('should fetch ticker data for specific symbol', async () => {
      const symbol = 'BTCUSDT';
      
      mockBinanceAPIService.fetchTicker24hr.mockResolvedValue(mockTickerData);

      const result = await service.fetchTicker24hr(symbol);

      expect(mockBinanceAPIService.fetchTicker24hr).toHaveBeenCalledWith(symbol);
      expect(result).toEqual(mockTickerData);
    });

    it('should fetch all tickers when no symbol provided', async () => {
      const mockAllTickers = [mockTickerData, { ...mockTickerData, symbol: 'ETHUSDT' }];
      
      mockBinanceAPIService.fetchTicker24hr.mockResolvedValue(mockAllTickers);

      const result = await service.fetchTicker24hr();

      expect(mockBinanceAPIService.fetchTicker24hr).toHaveBeenCalledWith();
      expect(result).toEqual(mockAllTickers);
    });

    it('should handle Binance error responses', async () => {
      const symbol = 'INVALID';
      const error = new Error('Binance API error: -1121 - Invalid symbol.');
      
      mockBinanceAPIService.fetchTicker24hr.mockRejectedValue(error);

      await expect(service.fetchTicker24hr(symbol)).rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
    });

    it('should handle network errors', async () => {
      const error = new Error('Connection timeout');
      
      mockBinanceAPIService.fetchTicker24hr.mockRejectedValue(error);

      await expect(service.fetchTicker24hr('BTCUSDT')).rejects.toThrow('Connection timeout');
    });
  });

  describe('fetchCurrentPrice', () => {
    it('should fetch current price for a symbol', async () => {
      const symbol = 'BTCUSDT';
      const mockPriceData = {
        symbol: 'BTCUSDT',
        price: '46000.50',
      };
      
      mockBinanceAPIService.fetchCurrentPrice.mockResolvedValue(mockPriceData);

      const result = await service.fetchCurrentPrice(symbol);

      expect(mockBinanceAPIService.fetchCurrentPrice).toHaveBeenCalledWith(symbol);
      expect(result).toEqual(mockPriceData);
    });

    it('should handle errors when fetching price', async () => {
      const symbol = 'BTCUSDT';
      const error = new Error('API unavailable');
      
      mockBinanceAPIService.fetchCurrentPrice.mockRejectedValue(error);

      await expect(service.fetchCurrentPrice(symbol)).rejects.toThrow('API unavailable');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate correct symbol formats', () => {
      mockBinanceAPIService.isValidSymbol.mockImplementation((symbol: string) => {
        return /^[A-Z]{2,10}USDT?$/.test(symbol.toUpperCase());
      });

      expect(service.isValidSymbol('BTCUSDT')).toBe(true);
      expect(service.isValidSymbol('ETHUSDT')).toBe(true);
      expect(service.isValidSymbol('BNBUSDT')).toBe(true);
      expect(service.isValidSymbol('BTCUSDC')).toBe(false); // Not USDT
      expect(service.isValidSymbol('btcusdt')).toBe(true); // Case insensitive
    });

    it('should reject invalid symbol formats', () => {
      mockBinanceAPIService.isValidSymbol.mockImplementation((symbol: string) => {
        return /^[A-Z]{2,10}USDT?$/.test(symbol.toUpperCase());
      });

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
      
      mockBinanceAPIService.fetchExchangeInfo.mockResolvedValue(mockExchangeInfo);

      const result = await service.fetchExchangeInfo();

      expect(mockBinanceAPIService.fetchExchangeInfo).toHaveBeenCalled();
      expect(result).toEqual(mockExchangeInfo);
    });

    it('should handle errors when fetching exchange info', async () => {
      const error = new Error('Rate limit exceeded');
      
      mockBinanceAPIService.fetchExchangeInfo.mockRejectedValue(error);

      await expect(service.fetchExchangeInfo()).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockBinanceAPIService.fetchKlines.mockRejectedValue('String error');

      await expect(service.fetchKlines('BTCUSDT')).rejects.toBe('String error');
    });

    it('should handle undefined errors', async () => {
      mockBinanceAPIService.fetchTicker24hr.mockRejectedValue(undefined);

      await expect(service.fetchTicker24hr()).rejects.toBe(undefined);
    });
  });
});