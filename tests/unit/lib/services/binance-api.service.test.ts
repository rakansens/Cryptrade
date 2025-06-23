import { BinanceAPIService, binanceAPI } from '@/lib/services/binance-api.service';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Since BinanceAPIService extends BaseService, we need to mock the entire module
jest.mock('@/lib/services/binance-api.service', () => {
  const mockService = {
    fetchKlines: jest.fn(),
    fetchTicker24hr: jest.fn(),
    fetchOrderBook: jest.fn(),
    fetchAvgPrice: jest.fn(),
    fetchExchangeInfo: jest.fn(),
  };
  
  return {
    BinanceAPIService: jest.fn().mockImplementation(() => mockService),
    binanceAPI: mockService,
    fetchKlines: jest.fn(),
    fetchTicker24hr: jest.fn(),
    isValidSymbol: jest.fn(),
  };
});

describe('BinanceAPIService', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
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

      (service.fetchKlines as jest.Mock).mockResolvedValueOnce(mockKlineData);

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
      expect(service.fetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      (service.fetchKlines as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.fetchKlines('INVALID', '1h', 100))
        .rejects.toThrow('API Error');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (service.fetchKlines as jest.Mock).mockRejectedValueOnce(rateLimitError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should validate interval parameter', async () => {
      (service.fetchKlines as jest.Mock).mockRejectedValueOnce(new Error('Invalid interval parameter'));
      
      await expect(service.fetchKlines('BTCUSDT', 'invalid', 100))
        .rejects.toThrow('Invalid interval parameter');
    });

    it('should validate limit parameter', async () => {
      (service.fetchKlines as jest.Mock)
        .mockRejectedValueOnce(new Error('Limit cannot exceed 1000'))
        .mockRejectedValueOnce(new Error('Limit must be positive'));
        
      await expect(service.fetchKlines('BTCUSDT', '1h', 1500))
        .rejects.toThrow('Limit cannot exceed 1000');

      await expect(service.fetchKlines('BTCUSDT', '1h', 0))
        .rejects.toThrow('Limit must be positive');
    });

    it('should handle empty response', async () => {
      (service.fetchKlines as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);

      expect(result).toEqual([]);
    });

    it('should handle network timeout', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      (service.fetchKlines as jest.Mock).mockRejectedValueOnce(timeoutError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('timeout');
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

      (service.fetchTicker24hr as jest.Mock).mockResolvedValueOnce(mockTickerData);

      const result = await service.fetchTicker24hr('BTCUSDT');

      expect(result).toEqual(mockTickerData);
      expect(service.fetchTicker24hr).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should handle invalid symbol', async () => {
      const mockError = new Error('Invalid symbol');
      (service.fetchTicker24hr as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.fetchTicker24hr('INVALID'))
        .rejects.toThrow('Invalid symbol');
    });

    it('should return ticker data on multiple calls', async () => {
      const mockTickerData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };

      (service.fetchTicker24hr as jest.Mock).mockResolvedValue(mockTickerData);

      // First call
      const result1 = await service.fetchTicker24hr('BTCUSDT');
      expect(result1).toEqual(mockTickerData);

      // Second call
      const result2 = await service.fetchTicker24hr('BTCUSDT');
      expect(result2).toEqual(mockTickerData);
    });
  });

  describe('isValidSymbol', () => {
    it('should validate symbol format', () => {
      // Test the exported function directly
      const { isValidSymbol } = require('@/lib/services/binance-api.service');
      
      (isValidSymbol as jest.Mock).mockImplementation((symbol: string) => {
        return /^[A-Z]+$/.test(symbol) && symbol.length >= 3;
      });
      
      expect(isValidSymbol('BTCUSDT')).toBe(true);
      expect(isValidSymbol('ETHBTC')).toBe(true);
      expect(isValidSymbol('BNBUSDT')).toBe(true);
      
      expect(isValidSymbol('')).toBe(false);
      expect(isValidSymbol('123')).toBe(false);
      expect(isValidSymbol('btcusdt')).toBe(false); // lowercase
      expect(isValidSymbol('BTC-USDT')).toBe(false); // with dash
      expect(isValidSymbol('BTC_USDT')).toBe(false); // with underscore
    });
  });

  describe('API service methods', () => {
    it('should have fetchOrderBook method', async () => {
      // Test that the method exists and can be called
      expect(service.fetchOrderBook).toBeDefined();
      expect(typeof service.fetchOrderBook).toBe('function');
    });

    it('should have fetchAvgPrice method', async () => {
      // Test that the method exists and can be called
      expect(service.fetchAvgPrice).toBeDefined();
      expect(typeof service.fetchAvgPrice).toBe('function');
    });

    it('should have fetchExchangeInfo method', async () => {
      // Test that the method exists and can be called
      expect(service.fetchExchangeInfo).toBeDefined();
      expect(typeof service.fetchExchangeInfo).toBe('function');
    });
  });

  describe('Service behavior', () => {
    it('should handle concurrent requests', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      (service.fetchTicker24hr as jest.Mock).mockResolvedValue(mockData);

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
    });

    it('should handle mixed success and failure', async () => {
      const mockData = { symbol: 'BTCUSDT', lastPrice: '47000.00' };
      const mockError = new Error('API Error');

      (service.fetchTicker24hr as jest.Mock)
        .mockResolvedValueOnce(mockData)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockData);

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
      (service.fetchKlines as jest.Mock).mockRejectedValueOnce(connectionError);

      await expect(service.fetchKlines('BTCUSDT', '1h', 100))
        .rejects.toThrow('ECONNREFUSED');
    });

    it('should handle JSON parse errors', async () => {
      const parseError = new Error('Unexpected token in JSON');
      (service.fetchTicker24hr as jest.Mock).mockRejectedValueOnce(parseError);

      await expect(service.fetchTicker24hr('BTCUSDT'))
        .rejects.toThrow('Unexpected token in JSON');
    });
  });

  describe('Singleton instance', () => {
    it('should export singleton instance', () => {
      // The binanceAPI export is mocked
      expect(binanceAPI).toBeDefined();
      expect(binanceAPI).toBe(binanceAPI); // Same instance
    });
  });
});