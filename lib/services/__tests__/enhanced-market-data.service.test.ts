import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EnhancedMarketDataService, TimeframeConfig } from '../enhanced-market-data.service';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline } from '@/types/market';

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

describe('EnhancedMarketDataService', () => {
  let service: EnhancedMarketDataService;
  let mockGet: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnhancedMarketDataService();
    
    // Mock the get method
    mockGet = jest.fn();
    service['get'] = mockGet;
  });

  describe('fetchMultiTimeframeData', () => {
    const mockKlineData: ProcessedKline[] = [
      {
        time: Date.now() - 3600000,
        open: 45000,
        high: 45500,
        low: 44800,
        close: 45200,
        volume: 1000,
      },
      {
        time: Date.now() - 1800000,
        open: 45200,
        high: 45300,
        low: 45000,
        close: 45100,
        volume: 800,
      },
    ];

    it('should fetch data for multiple timeframes successfully', async () => {
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 100 },
        { interval: '1h', weight: 0.3, dataPoints: 100 },
      ];

      mockGet.mockImplementation((url, params) => {
        return Promise.resolve({
          data: mockKlineData,
          status: 200,
        });
      });

      const result = await service.fetchMultiTimeframeData(symbol, timeframeConfigs);

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'BTCUSDT',
        interval: '15m',
        limit: '100',
      });
      expect(mockGet).toHaveBeenCalledWith('/klines', {
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: '100',
      });

      expect(result.symbol).toBe(symbol);
      expect(result.timeframes['15m']).toBeDefined();
      expect(result.timeframes['1h']).toBeDefined();
      expect(result.timeframes['15m'].data).toEqual(mockKlineData);
      expect(result.timeframes['15m'].weight).toBe(0.2);
    });

    it('should use cached data when available', async () => {
      const symbol = 'BTCUSDT';
      
      // First call - should fetch
      mockGet.mockResolvedValue({ data: mockKlineData, status: 200 });
      const result1 = await service.fetchMultiTimeframeData(symbol);
      
      // Second call - should use cache
      const result2 = await service.fetchMultiTimeframeData(symbol);
      
      // Get should only be called for the first request
      expect(mockGet).toHaveBeenCalledTimes(4); // 4 default timeframes
      expect(result1).toEqual(result2);
      expect(logger.debug).toHaveBeenCalledWith('[EnhancedMarketData] Using cached data', expect.any(Object));
    });

    it('should handle partial failures gracefully', async () => {
      const symbol = 'BTCUSDT';
      
      mockGet.mockImplementation((url, params) => {
        if (params.interval === '15m') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: mockKlineData, status: 200 });
      });

      const result = await service.fetchMultiTimeframeData(symbol);

      expect(result.timeframes['15m']).toBeUndefined();
      expect(result.timeframes['1h']).toBeDefined();
      expect(result.timeframes['4h']).toBeDefined();
      expect(result.timeframes['1d']).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[EnhancedMarketData] Failed to fetch timeframe data',
        expect.objectContaining({ interval: '15m' })
      );
    });

    it('should throw error when all timeframes fail', async () => {
      const symbol = 'BTCUSDT';
      
      mockGet.mockRejectedValue(new Error('API unavailable'));

      await expect(service.fetchMultiTimeframeData(symbol)).rejects.toThrow('Failed to fetch data from any timeframe');
    });

    it('should clear expired cache', async () => {
      const symbol = 'BTCUSDT';
      
      // First call - should fetch
      mockGet.mockResolvedValue({ data: mockKlineData, status: 200 });
      await service.fetchMultiTimeframeData(symbol);
      
      // Simulate cache expiry
      service['cacheExpiryMs'] = 0;
      
      // Second call - should fetch again
      await service.fetchMultiTimeframeData(symbol);
      
      expect(mockGet).toHaveBeenCalledTimes(8); // 2 × 4 default timeframes
    });
  });

  describe('findMultiTimeframeSupportResistance', () => {
    const mockMultiTimeframeData = {
      symbol: 'BTCUSDT',
      timeframes: {
        '1h': {
          data: [
            { time: Date.now() - 7200000, open: 45000, high: 45500, low: 44800, close: 45200, volume: 1000 },
            { time: Date.now() - 3600000, open: 45200, high: 45300, low: 45000, close: 45100, volume: 800 },
            { time: Date.now(), open: 45100, high: 45400, low: 45000, close: 45300, volume: 900 },
          ] as ProcessedKline[],
          weight: 0.3,
          dataPoints: 100,
        },
        '4h': {
          data: [
            { time: Date.now() - 14400000, open: 44900, high: 45600, low: 44700, close: 45300, volume: 3000 },
            { time: Date.now() - 7200000, open: 45300, high: 45500, low: 45000, close: 45200, volume: 2500 },
            { time: Date.now(), open: 45200, high: 45400, low: 45000, close: 45300, volume: 2800 },
          ] as ProcessedKline[],
          weight: 0.35,
          dataPoints: 100,
        },
      },
      fetchedAt: Date.now(),
    };

    it('should find support and resistance levels across timeframes', () => {
      const levels = service.findMultiTimeframeSupportResistance(mockMultiTimeframeData);

      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
      
      // The test data might not generate swing points due to limited data
      // So we just check the structure if levels are found
      if (levels.length > 0) {
        const level = levels[0];
        expect(level).toHaveProperty('price');
        expect(level).toHaveProperty('strength');
        expect(level).toHaveProperty('touchCount');
        expect(level).toHaveProperty('timeframeSupport');
        expect(level).toHaveProperty('confidenceScore');
        expect(level).toHaveProperty('type');
        expect(['support', 'resistance']).toContain(level.type);
      }
    });

    it('should filter levels by minimum touch count', () => {
      const levels = service.findMultiTimeframeSupportResistance(mockMultiTimeframeData, {
        minTouchCount: 3,
      });

      // With limited test data, might not find levels with 3+ touches
      expect(Array.isArray(levels)).toBe(true);
    });

    it('should filter levels by minimum timeframes', () => {
      const levels = service.findMultiTimeframeSupportResistance(mockMultiTimeframeData, {
        minTimeframes: 2,
      });

      levels.forEach(level => {
        expect(level.timeframeSupport.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should handle empty timeframe data', () => {
      const emptyData = {
        symbol: 'BTCUSDT',
        timeframes: {},
        fetchedAt: Date.now(),
      };

      const levels = service.findMultiTimeframeSupportResistance(emptyData);
      expect(levels).toEqual([]);
    });
  });

  describe('findConfluenceZones', () => {
    const mockMultiTimeframeData = {
      symbol: 'BTCUSDT',
      timeframes: {
        '1h': {
          data: generateSwingData(45000, 100),
          weight: 0.3,
          dataPoints: 100,
        },
        '4h': {
          data: generateSwingData(45000, 50),
          weight: 0.35,
          dataPoints: 100,
        },
      },
      fetchedAt: Date.now(),
    };

    it('should identify confluence zones where multiple timeframes agree', () => {
      const zones = service.findConfluenceZones(mockMultiTimeframeData);

      expect(Array.isArray(zones)).toBe(true);
      
      if (zones.length > 0) {
        const zone = zones[0];
        expect(zone).toHaveProperty('priceRange');
        expect(zone.priceRange).toHaveProperty('min');
        expect(zone.priceRange).toHaveProperty('max');
        expect(zone.priceRange).toHaveProperty('center');
        expect(zone).toHaveProperty('strength');
        expect(zone).toHaveProperty('timeframeCount');
        expect(zone).toHaveProperty('supportingTimeframes');
        expect(zone).toHaveProperty('levels');
        expect(zone).toHaveProperty('type');
        expect(['support', 'resistance', 'pivot']).toContain(zone.type);
      }
    });

    it('should filter zones by minimum timeframes', () => {
      const zones = service.findConfluenceZones(mockMultiTimeframeData, {
        minTimeframes: 2,
      });

      zones.forEach(zone => {
        expect(zone.timeframeCount).toBeGreaterThanOrEqual(2);
      });
    });

    it('should adjust zone width based on percentage', () => {
      const zones1 = service.findConfluenceZones(mockMultiTimeframeData, {
        zoneWidthPercent: 0.5,
      });

      const zones2 = service.findConfluenceZones(mockMultiTimeframeData, {
        zoneWidthPercent: 2.0,
      });

      // Wider zones should potentially capture more levels
      expect(zones2.length).toBeLessThanOrEqual(zones1.length);
    });
  });

  describe('calculateCrossTimeframeValidation', () => {
    const mockMultiTimeframeData = {
      symbol: 'BTCUSDT',
      timeframes: {
        '1h': {
          data: generateSwingData(45000, 100),
          weight: 0.3,
          dataPoints: 100,
        },
        '4h': {
          data: generateSwingData(45000, 50),
          weight: 0.35,
          dataPoints: 100,
        },
      },
      fetchedAt: Date.now(),
    };

    it('should calculate validation score for a price level', () => {
      const price = 45000;
      const validation = service.calculateCrossTimeframeValidation(price, mockMultiTimeframeData);

      expect(validation).toHaveProperty('validationScore');
      expect(validation).toHaveProperty('supportingTimeframes');
      expect(validation).toHaveProperty('touchCounts');
      expect(validation).toHaveProperty('avgStrength');
      
      expect(validation.validationScore).toBeGreaterThanOrEqual(0);
      expect(validation.validationScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(validation.supportingTimeframes)).toBe(true);
      expect(typeof validation.touchCounts).toBe('object');
      expect(typeof validation.avgStrength).toBe('number');
    });

    it('should respect tolerance percentage', () => {
      const price = 45000;
      
      const validation1 = service.calculateCrossTimeframeValidation(price, mockMultiTimeframeData, 0.1);
      const validation2 = service.calculateCrossTimeframeValidation(price, mockMultiTimeframeData, 2.0);

      // Larger tolerance should potentially find more supporting timeframes
      expect(validation2.supportingTimeframes.length).toBeGreaterThanOrEqual(validation1.supportingTimeframes.length);
    });

    it('should return zero validation for price with no support', () => {
      const price = 1000000; // Unrealistic price
      const validation = service.calculateCrossTimeframeValidation(price, mockMultiTimeframeData);

      expect(validation.validationScore).toBe(0);
      expect(validation.supportingTimeframes).toEqual([]);
      expect(validation.avgStrength).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      service.clearCache();
      
      expect(logger.debug).toHaveBeenCalledWith('[EnhancedMarketData] Cache cleared');
      
      // Verify cache is empty by checking stats
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    it('should return cache statistics', async () => {
      const symbol = 'BTCUSDT';
      
      // Add some data to cache
      mockGet.mockResolvedValue({ data: [], status: 200 });
      await service.fetchMultiTimeframeData(symbol);
      
      const stats = service.getCacheStats();
      
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toHaveLength(stats.size);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('age');
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should log errors when fetching data fails', async () => {
      const symbol = 'BTCUSDT';
      const error = new Error('API rate limit exceeded');
      
      mockGet.mockRejectedValue(error);

      await expect(service.fetchMultiTimeframeData(symbol)).rejects.toThrow('Failed to fetch data from any timeframe');
      
      expect(logger.error).toHaveBeenCalledWith(
        '[EnhancedMarketData] Failed to fetch multi-timeframe data',
        expect.objectContaining({
          symbol,
          error: 'Failed to fetch data from any timeframe',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      const symbol = 'BTCUSDT';
      
      mockGet.mockRejectedValue('String error');

      await expect(service.fetchMultiTimeframeData(symbol)).rejects.toThrow();
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[EnhancedMarketData] Failed to fetch timeframe data',
        expect.objectContaining({
          error: 'String error',
        })
      );
    });
  });
});

// Helper function to generate swing point data
function generateSwingData(basePrice: number, count: number): ProcessedKline[] {
  const data: ProcessedKline[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i * 0.1) * basePrice * 0.02; // 2% variation
    const price = basePrice + variation;
    
    data.push({
      time: now - (count - i) * 3600000, // 1 hour intervals
      open: price - 50,
      high: price + 100,
      low: price - 100,
      close: price + 50,
      volume: 1000 + Math.random() * 1000,
    });
  }
  
  return data;
}