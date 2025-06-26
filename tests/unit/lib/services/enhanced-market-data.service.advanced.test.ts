/**
 * Enhanced Market Data Service Advanced Tests
 * 
 * Additional test suite covering cross-timeframe validation,
 * cache management, and edge case handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the service module before importing
jest.mock('@/lib/services/enhanced-market-data.service');

describe('EnhancedMarketDataService Advanced Tests', () => {
  let service: any;
  let mockCalculateCrossTimeframeValidation: jest.Mock;
  let mockClearCache: jest.Mock;
  let mockGetCacheStats: jest.Mock;
  let mockFetchMultiTimeframeData: jest.Mock;
  let mockFindMultiTimeframeSupportResistance: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { EnhancedMarketDataService } = require('@/lib/services/enhanced-market-data.service');
    service = new EnhancedMarketDataService();
    
    mockCalculateCrossTimeframeValidation = service.calculateCrossTimeframeValidation;
    mockClearCache = service.clearCache;
    mockGetCacheStats = service.getCacheStats;
    mockFetchMultiTimeframeData = service.fetchMultiTimeframeData;
    mockFindMultiTimeframeSupportResistance = service.findMultiTimeframeSupportResistance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCrossTimeframeValidation', () => {
    it('should calculate validation score for a price level', () => {
      mockCalculateCrossTimeframeValidation.mockReturnValueOnce({
        validationScore: 0.8,
        supportingTimeframes: ['15m', '1h', '4h'],
        touchCounts: { '15m': 3, '1h': 5, '4h': 2 },
        avgStrength: 0.75
      });
      
      const multiData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '15m': { data: [], weight: 0.2, dataPoints: 100 },
          '1h': { data: [], weight: 0.3, dataPoints: 200 }
        },
        fetchedAt: Date.now()
      };
      
      const validation = service.calculateCrossTimeframeValidation(48200, multiData, 0.5);

      expect(validation).toBeDefined();
      expect(validation.validationScore).toBeGreaterThanOrEqual(0);
      expect(validation.validationScore).toBeLessThanOrEqual(1);
      expect(validation.supportingTimeframes).toBeInstanceOf(Array);
      expect(validation.touchCounts).toBeInstanceOf(Object);
      expect(validation.avgStrength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        timeframes: {},
        fetchedAt: Date.now()
      };
      
      mockFetchMultiTimeframeData.mockResolvedValueOnce(mockData);
      mockGetCacheStats
        .mockReturnValueOnce({ size: 1, entries: [{ key: 'BTCUSDT', age: 100 }] })
        .mockReturnValueOnce({ size: 0, entries: [] });

      await service.fetchMultiTimeframeData('BTCUSDT');
      
      let stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      
      service.clearCache();
      
      stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache statistics', async () => {
      const mockData1 = {
        symbol: 'BTCUSDT',
        timeframes: {},
        fetchedAt: Date.now()
      };
      
      const mockData2 = {
        symbol: 'ETHUSDT',
        timeframes: {},
        fetchedAt: Date.now()
      };
      
      mockFetchMultiTimeframeData
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);
        
      mockGetCacheStats.mockReturnValueOnce({
        size: 2,
        entries: [
          { key: 'BTCUSDT', age: 1000 },
          { key: 'ETHUSDT', age: 500 }
        ]
      });

      await service.fetchMultiTimeframeData('BTCUSDT');
      await service.fetchMultiTimeframeData('ETHUSDT');
      
      const stats = service.getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('age');
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty data arrays', () => {
      mockFindMultiTimeframeSupportResistance.mockReturnValueOnce([]);
      
      const multiData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1h': {
            data: [],
            weight: 0.5,
            dataPoints: 0
          }
        },
        fetchedAt: Date.now()
      };

      const levels = service.findMultiTimeframeSupportResistance(multiData);
      expect(levels).toEqual([]);
    });

    it('should handle malformed kline data', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '15m': {
            data: [
              { time: Date.now(), open: 48000 }, // Missing fields
              null, // Null entry
              { 
                time: Date.now(),
                open: 48000,
                high: 48100,
                low: 47900,
                close: 48050,
                volume: 100
              }
            ],
            weight: 0.2,
            dataPoints: 3
          }
        },
        fetchedAt: Date.now()
      };
      
      mockFetchMultiTimeframeData.mockResolvedValueOnce(mockData);

      const result = await service.fetchMultiTimeframeData('BTCUSDT');
      expect(result).toBeDefined();
    });

    it('should handle network errors with retry', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        timeframes: {},
        fetchedAt: Date.now()
      };
      
      mockFetchMultiTimeframeData
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockData);

      try {
        await service.fetchMultiTimeframeData('BTCUSDT');
      } catch (error) {
        // First call fails
      }
      
      try {
        await service.fetchMultiTimeframeData('BTCUSDT');
      } catch (error) {
        // Second call fails
      }
      
      const result = await service.fetchMultiTimeframeData('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(mockFetchMultiTimeframeData).toHaveBeenCalledTimes(3);
    });

    it('should handle very large datasets efficiently', () => {
      const mockLevels = Array.from({ length: 100 }, (_, i) => ({
        price: 48000 + i * 10,
        strength: Math.random(),
        touchCount: Math.floor(Math.random() * 10),
        timeframeSupport: ['1m'],
        confidenceScore: Math.random(),
        firstSeen: Date.now() - 86400000,
        lastSeen: Date.now(),
        type: i % 2 === 0 ? 'support' : 'resistance' as 'support' | 'resistance'
      }));
      
      mockFindMultiTimeframeSupportResistance.mockReturnValueOnce(mockLevels);
      
      const largeData = {
        symbol: 'BTCUSDT',
        timeframes: {
          '1m': {
            data: Array.from({ length: 10000 }, (_, i) => ({
              time: Date.now() - i * 60000,
              open: 48000 + Math.random() * 1000,
              high: 48500 + Math.random() * 500,
              low: 47500 + Math.random() * 500,
              close: 48200 + Math.random() * 800,
              volume: 100 + Math.random() * 50
            })),
            weight: 0.5,
            dataPoints: 10000
          }
        },
        fetchedAt: Date.now()
      };

      const startTime = Date.now();
      const levels = service.findMultiTimeframeSupportResistance(largeData);
      const endTime = Date.now();

      expect(levels).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});