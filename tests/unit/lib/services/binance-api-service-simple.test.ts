// Simple test to verify our mocking approach works
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock BinanceAPIService
const mockFetchKlines = jest.fn();
jest.mock('@/lib/binance/api-service', () => ({
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

import { BinanceAPIService } from '@/lib/binance/api-service';

describe('BinanceAPIService Simple Test', () => {
  let service: BinanceAPIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BinanceAPIService();
  });

  it('should call get method when fetchKlines is called', async () => {
    const mockKlines = [{
      time: 1640995200,
      open: 46000,
      high: 46500,
      low: 45800,
      close: 46200,
      volume: 1000
    }];
    
    mockFetchKlines.mockResolvedValueOnce(mockKlines);
    
    const result = await service.fetchKlines('BTCUSDT', '1h', 100);
    
    expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
    expect(result).toEqual(mockKlines);
  });
});