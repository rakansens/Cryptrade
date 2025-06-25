import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies first
jest.mock('@/lib/utils/logger');
jest.mock('@/types/market');

// Mock fetch globally for cleaner HTTP-level testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

import { BinanceAPIService } from '@/lib/binance/api-service';
import { validateBinanceKlines } from '@/types/market';
import { logger } from '@/lib/utils/logger';

// Setup type-safe mocks
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;
const mockedValidateBinanceKlines = validateBinanceKlines as jest.MockedFunction<typeof validateBinanceKlines>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe.skip('BinanceAPIService (Improved Architecture)', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock window for server-side behavior
    const globalWithWindow = global as typeof globalThis & { window?: Window };
    globalWithWindow.window = undefined;
    
    // Create service instance
    service = new BinanceAPIService();
    
    // Setup default validateBinanceKlines behavior
    mockedValidateBinanceKlines.mockImplementation((data) => {
      if (!Array.isArray(data)) return [];
      
      return data.map(kline => {
        if (Array.isArray(kline) && kline.length >= 6) {
          return {
            time: Math.floor(Number(kline[0]) / 1000),
            open: Number(kline[1]),
            high: Number(kline[2]),
            low: Number(kline[3]),
            close: Number(kline[4]),
            volume: Number(kline[5])
          };
        }
        return kline;
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchKlines', () => {
    const mockRawKlines = [
      [
        1640995200000,
        "46000.00",
        "46500.00",
        "45800.00",
        "46200.00",
        "1000.00",
        1640998800000,
        "46000000.00",
        1000,
        "500.00",
        "23000000.00",
        "0"
      ]
    ];

    it('should fetch and process klines successfully', async () => {
      // Mock the fetch response
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRawKlines,
        headers: new Headers(),
        statusText: 'OK'
      } as Response);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      // Verify fetch was called with correct URL
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100'),
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      );

      // Verify result
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        time: 1640995200,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock error response
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ code: -1003, msg: 'Too many requests' })
      } as Response);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed with status 429');
    });

    it('should handle network errors', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Network error');
    });
  });

  describe('fetchTicker24hr', () => {
    const mockTickerData = {
      symbol: 'BTCUSDT',
      priceChange: '1000.00',
      priceChangePercent: '2.17',
      lastPrice: '47000.00',
      volume: '10000.00'
    };

    it('should fetch ticker data successfully', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTickerData,
        headers: new Headers(),
        statusText: 'OK'
      } as Response);

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/binance/ticker?symbol=BTCUSDT'),
        expect.any(Object)
      );
    });

    it('should handle Binance API errors', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: -1121, msg: 'Invalid symbol.' }),
        headers: new Headers(),
        statusText: 'OK'
      } as Response);

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Binance API error: -1121 - Invalid symbol.');
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol formats correctly', () => {
      const validSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'btcusdt'];
      const invalidSymbols = ['', '123', 'BTC-USDT', 'BTC_USDT', 'BTCEUR'];

      validSymbols.forEach(symbol => {
        expect(service.isValidSymbol(symbol)).toBe(true);
      });

      invalidSymbols.forEach(symbol => {
        expect(service.isValidSymbol(symbol)).toBe(false);
      });
    });
  });

  describe('Error logging', () => {
    it('should log errors when requests fail', async () => {
      const error = new Error('Request failed');
      mockedFetch.mockRejectedValueOnce(error);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Request failed');

      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to fetch klines',
        expect.objectContaining({
          error: expect.any(Error),
          symbol: 'BTCUSDT',
          interval: '1h'
        })
      );
    });
  });
});

// Test helpers for integration testing
export const createMockBinanceService = () => {
  const mockService: Partial<BinanceAPIService> = {
    fetchKlines: jest.fn().mockResolvedValue([]),
    fetchTicker24hr: jest.fn().mockResolvedValue({}),
    fetchCurrentPrice: jest.fn().mockResolvedValue({}),
    fetchExchangeInfo: jest.fn().mockResolvedValue({}),
    isValidSymbol: jest.fn().mockReturnValue(true)
  };
  
  return mockService as BinanceAPIService;
};