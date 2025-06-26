// Debug test to understand the mock setup
import { jest } from '@jest/globals';

// Create mock functions
const mockGet = jest.fn();

// Mock BaseService
jest.mock('@/lib/api/base-service', () => ({
  BaseService: class MockBaseService {
    constructor(basePath: string) {
      console.log('MockBaseService created with basePath:', basePath);
    }
    
    protected get = mockGet;
  }
}));

// Mock API Client
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
  }))
}));

// Mock logger and types
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/types/market', () => ({
  validateBinanceKlines: jest.fn((data) => data || [])
}));

import { BinanceAPIService } from '@/lib/binance/api-service';

describe('Debug Mock Setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockGet as any).mockResolvedValue({
      data: { test: 'response' },
      status: 200,
      statusText: 'OK',
      headers: new Headers()
    });
  });

  it('should create BinanceAPIService instance', () => {
    const service = new BinanceAPIService();
    expect(service).toBeDefined();
    console.log('Service created:', service);
    console.log('Service prototype:', Object.getPrototypeOf(service));
    console.log('Service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
  });

  it('should call mockGet when method is invoked', async () => {
    const service = new BinanceAPIService();
    console.log('Calling fetchKlines...');
    
    try {
      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      console.log('Result:', result);
      console.log('mockGet call count:', (mockGet as any).mock.calls.length);
      console.log('mockGet calls:', (mockGet as any).mock.calls);
    } catch (error) {
      console.error('Error:', error);
    }
    
    expect((mockGet as any)).toHaveBeenCalled();
  });
});