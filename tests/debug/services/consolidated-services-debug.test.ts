/**
 * Created: 2025-06-27
 * Changes: サービス関連デバッグテストの統合
 * Purpose: 重複を排除し、テスト保守性を向上
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// グローバルモックを先に定義
const mockGet = jest.fn() as jest.MockedFunction<any>;
const mockPost = jest.fn() as jest.MockedFunction<any>;
const mockPut = jest.fn() as jest.MockedFunction<any>;
const mockDelete = jest.fn() as jest.MockedFunction<any>;

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock ApiClient
jest.mock('@/lib/api/client', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  })),
}));

// Mock BinanceAPIService methods
const mockFetchKlines = jest.fn() as jest.MockedFunction<any>;
jest.mock('@/lib/binance/api-service', () => ({
  BinanceAPIService: jest.fn().mockImplementation(() => ({
    fetchKlines: mockFetchKlines,
    fetchTicker24hr: jest.fn(),
    fetchCurrentPrice: jest.fn(),
    fetchExchangeInfo: jest.fn(),
  })),
}));

describe('🟢 Consolidated Services Debug Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { result: 'test' } });
    mockPost.mockResolvedValue({ data: { result: 'test' } });
  });

  describe('Intent Analysis Service', () => {
    it('should test greeting patterns correctly', () => {
      
      const greetingPatterns = [
        /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?\.?$/i,
        /^(よろしく)\.?$/i,
        /^hi\s+there$/i,
        /^(こんにちは|おはよう|おはようございます|こんばんは|はじめまして|hello|hi|hey|yo|やあ|どうも)[!！]?[、。\s]/i,
      ];

      const shouldMatch = [
        'こんにちは！',
        'こんにちは',
        'hello',
        'hi',
        'よろしく',
        'hi there',
        'おはようございます！',
      ];

      const shouldNotMatch = [
        'さようなら',
        'ビットコインの価格は？',
        'thank you',
      ];

      shouldMatch.forEach(str => {
        const strLower = str.toLowerCase();
        const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
        expect(matchesAny).toBe(true);
      });

      shouldNotMatch.forEach(str => {
        const strLower = str.toLowerCase();
        const matchesAny = greetingPatterns.some(pattern => pattern.test(str) || pattern.test(strLower));
        expect(matchesAny).toBe(false);
      });
    });
  });

  describe('BaseService Mock Testing', () => {
    it('should test basic mock functionality', () => {
      mockGet.mockResolvedValue({ data: 'test' });
      
      expect(mockGet).not.toHaveBeenCalled();
      mockGet();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should test ApiClient instantiation', () => {
      const { ApiClient } = require('@/lib/api/client');
      
      expect(ApiClient).toBeDefined();
      expect(typeof ApiClient).toBe('function');
      
      const client = new ApiClient();
      expect(client).toBeDefined();
      expect(client.get).toBe(mockGet);
      expect(client.post).toBe(mockPost);
    });

    it('should test BaseService with mocked ApiClient', async () => {
      const { BaseService } = require('@/lib/api/base-service');
      const { ApiClient } = require('@/lib/api/client');
      
      mockGet.mockResolvedValue({ data: { success: true } });
      
      class TestService extends BaseService {
        constructor() {
          super('/api/test');
        }
        
        async testGet(url: string) {
          return this.client.get(url);
        }
      }
      
      (ApiClient as jest.Mock).mockClear();
      
      const service = new TestService();
      
      expect(ApiClient).toHaveBeenCalledTimes(1);
      expect(ApiClient).toHaveBeenCalledWith({
        baseUrl: '/api/test',
        timeout: expect.any(Number),
        retries: 3,
        retryDelay: 1000,
        rateLimit: expect.any(Object),
      });
      
      const result = await service.testGet('/items');
      
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith('/items');
      expect(result).toEqual({ data: { success: true } });
    });
  });

  describe('BinanceAPIService Testing', () => {
    let service: any;

    beforeEach(() => {
      const { BinanceAPIService } = require('@/lib/binance/api-service');
      service = new BinanceAPIService();
    });

    it('should check service instantiation', () => {
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('BinanceAPIService');
    });

    it('should mock fetchKlines correctly', async () => {
      const mockData = [{
        time: 1640995200,
        open: 46000,
        high: 46500,
        low: 45800,
        close: 46200,
        volume: 1000
      }];
      
      mockFetchKlines.mockResolvedValueOnce(mockData);

      const result = await service.fetchKlines('BTCUSDT', '1h', 100);
      
      expect(mockFetchKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 100);
      expect(result).toEqual(mockData);
    });

    it('should handle service properties correctly', () => {
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('BinanceAPIService');
      
      // Test without actual network calls
      expect(typeof service.fetchKlines).toBe('function');
      expect(typeof service.fetchTicker24hr).toBe('function');
      expect(typeof service.fetchCurrentPrice).toBe('function');
      expect(typeof service.fetchExchangeInfo).toBe('function');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      const { BinanceAPIService } = require('@/lib/binance/api-service');
      const testService = new BinanceAPIService();
      
      mockFetchKlines.mockRejectedValueOnce(new Error('Network error'));
      
      try {
        await testService.fetchKlines('BTCUSDT', '1h', 1);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle invalid parameters', () => {
      expect(() => {
        mockGet('invalid-url');
      }).not.toThrow();
      
      expect(mockGet).toHaveBeenCalledWith('invalid-url');
    });
  });
});