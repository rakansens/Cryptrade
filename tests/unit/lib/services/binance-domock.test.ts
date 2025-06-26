// Test with jest.doMock to ensure mock is applied
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('BinanceAPIService with doMock Test', () => {
  let mockFetchKlines: jest.Mock;

  beforeEach(async () => {
    // Reset all modules to clear cache
    jest.resetModules();
    
    // Mock logger
    jest.doMock('@/lib/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }
    }));

    // Create mock function
    mockFetchKlines = jest.fn();
    
    // Mock BinanceAPIService
    jest.doMock('@/lib/binance/api-service', () => ({
      BinanceAPIService: jest.fn().mockImplementation(() => ({
        fetchKlines: mockFetchKlines,
        fetchTicker24hr: jest.fn(),
        fetchCurrentPrice: jest.fn(),
        fetchExchangeInfo: jest.fn(),
      })),
      binanceAPI: {
        fetchKlines: mockFetchKlines,
      },
    }));
  });

  it('should work with doMock', async () => {
    const mockProcessedKlines = [
      {
        time: 1640995200,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      }
    ];

    // Set up mock response
    mockFetchKlines.mockResolvedValue(mockProcessedKlines);

    // Dynamic import after mocks are set up
    const { BinanceAPIService } = await import('@/lib/binance/api-service');
    
    // Create service instance
    const service = new BinanceAPIService();

    const result = await service.fetchKlines('BTCUSDT', '1h', 100);

    expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
    expect(result).toEqual(mockProcessedKlines);
  });
});