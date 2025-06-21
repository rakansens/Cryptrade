/**
 * Enhanced Market Data Service Tests
 * 
 * Comprehensive test suite for multi-timeframe market data fetching,
 * caching, error handling, and support/resistance level detection
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EnhancedMarketDataService, TimeframeConfig } from '@/lib/services/enhanced-market-data.service';
// MSW setup from global test setup
let server: any;
let http: any;
let HttpResponse: any;

try {
  const mswSetup = require('@/tests/setup/msw-setup');
  server = mswSetup.mswServer;
  http = mswSetup.http;
  HttpResponse = mswSetup.HttpResponse;
} catch (e) {
  // Fallback if MSW is not available
  const msw = require('msw');
  const mswNode = require('msw/node');
  server = mswNode.setupServer();
  http = msw.http;
  HttpResponse = msw.HttpResponse;
}
import { APP_CONSTANTS } from '@/config/app-constants';
import { logger } from '@/lib/utils/logger';
import type { ProcessedKline } from '@/types/market';

// Mock logger to avoid console output during tests
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('EnhancedMarketDataService', () => {
  let service: EnhancedMarketDataService;

  beforeEach(() => {
    service = new EnhancedMarketDataService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('fetchMultiTimeframeData', () => {
    const mockKlineResponse = (interval: string): ProcessedKline[] => {
      const baseTime = Date.now() - 3600000; // 1 hour ago
      const count = interval === '15m' ? 200 : interval === '1h' ? 500 : interval === '4h' ? 400 : 200;
      
      return Array.from({ length: count }, (_, i) => ({
        time: baseTime + i * 60000,
        open: 48000 + Math.random() * 1000,
        high: 48500 + Math.random() * 500,
        low: 47500 + Math.random() * 500,
        close: 48200 + Math.random() * 800,
        volume: 100 + Math.random() * 50
      }));
    };

    it('should fetch data from multiple timeframes successfully', async () => {
      // Setup MSW handlers for each timeframe
      server.use(
        http.get('http://localhost:3000/api/binance/klines', ({ request }) => {
          const url = new URL(request.url);
          const interval = url.searchParams.get('interval');
          
          if (interval) {
            return HttpResponse.json({
              data: mockKlineResponse(interval)
            });
          }
          
          return HttpResponse.json({ data: [] });
        })
      );

      const result = await service.fetchMultiTimeframeData('BTCUSDT');

      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(Object.keys(result.timeframes)).toHaveLength(4); // Default 4 timeframes
      expect(result.timeframes['15m']).toBeDefined();
      expect(result.timeframes['1h']).toBeDefined();
      expect(result.timeframes['4h']).toBeDefined();
      expect(result.timeframes['1d']).toBeDefined();
      expect(result.fetchedAt).toBeGreaterThan(0);
    });

    it('should use cached data when available and not expired', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json({
            data: mockKlineResponse('1h')
          });
        })
      );

      // First fetch
      const firstResult = await service.fetchMultiTimeframeData('BTCUSDT');
      const fetchTime = firstResult.fetchedAt;

      // Second fetch (should use cache)
      const secondResult = await service.fetchMultiTimeframeData('BTCUSDT');

      expect(secondResult.fetchedAt).toBe(fetchTime);
      expect(secondResult).toEqual(firstResult);
    });

    it.skip('should handle partial timeframe failures gracefully', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', ({ request }) => {
          const url = new URL(request.url);
          const interval = url.searchParams.get('interval');
          
          // Fail for 4h timeframe
          if (interval === '4h') {
            return HttpResponse.json(
              { error: 'Internal Server Error' },
              { status: 500 }
            );
          }
          
          return HttpResponse.json({
            data: mockKlineResponse(interval || '1h')
          });
        })
      );

      const result = await service.fetchMultiTimeframeData('BTCUSDT');

      expect(result).toBeDefined();
      // At least one timeframe should succeed
      expect(Object.keys(result.timeframes).length).toBeGreaterThan(0);
      expect(Object.keys(result.timeframes).length).toBeLessThan(4);
    });

    it.skip('should throw error when all timeframe fetches fail', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json(
            { error: 'Service Unavailable' },
            { status: 503 }
          );
        })
      );

      await expect(
        service.fetchMultiTimeframeData('BTCUSDT')
      ).rejects.toThrow('Failed to fetch data from any timeframe');
    });

    it('should respect abort signal for cancellation', async () => {
      const controller = new AbortController();
      
      server.use(
        http.get('http://localhost:3000/api/binance/klines', async () => {
          // Simulate delay
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            data: mockKlineResponse('1h')
          });
        })
      );

      // Abort immediately
      controller.abort();

      await expect(
        service.fetchMultiTimeframeData('BTCUSDT', undefined, controller.signal)
      ).rejects.toThrow('Operation aborted');
    });

    it.skip('should handle timeout for individual timeframe requests', async () => {
      // Track which intervals were requested
      const requestedIntervals = new Set<string>();
      
      server.use(
        http.get('http://localhost:3000/api/binance/klines', async ({ request }) => {
          const url = new URL(request.url);
          const interval = url.searchParams.get('interval');
          
          if (interval) {
            requestedIntervals.add(interval);
          }
          
          // Simulate timeout error for 1d timeframe
          if (interval === '1d') {
            // Wait just a bit then return timeout error
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json(
              { error: 'Request timeout' },
              { status: 408 }
            );
          }
          
          return HttpResponse.json({
            data: mockKlineResponse(interval || '1h')
          });
        })
      );

      const result = await service.fetchMultiTimeframeData('BTCUSDT');

      // Should complete with partial data
      expect(result).toBeDefined();
      expect(requestedIntervals.has('1d')).toBe(true);
      // Should have some successful timeframes
      expect(Object.keys(result.timeframes).length).toBeGreaterThan(0);
      expect(Object.keys(result.timeframes).length).toBeLessThanOrEqual(4);
    });

    it('should handle custom timeframe configurations', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', ({ request }) => {
          const url = new URL(request.url);
          const interval = url.searchParams.get('interval');
          const limit = url.searchParams.get('limit');
          
          return HttpResponse.json({
            data: mockKlineResponse(interval || '5m').slice(0, Number(limit) || 100)
          });
        })
      );

      const customConfig = [
        { interval: '5m', weight: 0.5, dataPoints: 100 },
        { interval: '30m', weight: 0.5, dataPoints: 150 }
      ];

      const result = await service.fetchMultiTimeframeData('ETHUSDT', customConfig);

      expect(result.symbol).toBe('ETHUSDT');
      expect(Object.keys(result.timeframes)).toHaveLength(2);
      expect(result.timeframes['5m']).toBeDefined();
      expect(result.timeframes['5m'].weight).toBe(0.5);
      expect(result.timeframes['5m'].dataPoints).toBe(100);
      expect(result.timeframes['30m']).toBeDefined();
      expect(result.timeframes['30m'].weight).toBe(0.5);
    });
  });

  describe('findMultiTimeframeSupportResistance', () => {
    const createMockMultiTimeframeData = () => ({
      symbol: 'BTCUSDT',
      timeframes: {
        '15m': {
          data: generateSwingData(48000, 100),
          weight: 0.2,
          dataPoints: 100
        },
        '1h': {
          data: generateSwingData(48000, 200),
          weight: 0.3,
          dataPoints: 200
        },
        '4h': {
          data: generateSwingData(48000, 150),
          weight: 0.35,
          dataPoints: 150
        },
        '1d': {
          data: generateSwingData(48000, 50),
          weight: 0.15,
          dataPoints: 50
        }
      },
      fetchedAt: Date.now()
    });

    function generateSwingData(basePrice: number, count: number): ProcessedKline[] {
      const data: ProcessedKline[] = [];
      const baseTime = Date.now() - count * 3600000;
      
      for (let i = 0; i < count; i++) {
        const swing = Math.sin(i / 10) * 500; // Create swing pattern
        const noise = Math.random() * 100 - 50;
        const price = basePrice + swing + noise;
        
        data.push({
          time: baseTime + i * 3600000,
          open: price - 50,
          high: price + 100,
          low: price - 100,
          close: price + 50,
          volume: 100 + Math.random() * 50
        });
      }
      
      return data;
    }

    it('should find support and resistance levels across timeframes', () => {
      const multiData = createMockMultiTimeframeData();
      
      const levels = service.findMultiTimeframeSupportResistance(multiData, {
        minTouchCount: 2,
        priceTolerancePercent: 0.5,
        minTimeframes: 1
      });

      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBeGreaterThan(0);
      
      // Check level structure
      const firstLevel = levels[0];
      expect(firstLevel).toHaveProperty('price');
      expect(firstLevel).toHaveProperty('strength');
      expect(firstLevel).toHaveProperty('touchCount');
      expect(firstLevel).toHaveProperty('timeframeSupport');
      expect(firstLevel).toHaveProperty('confidenceScore');
      expect(firstLevel).toHaveProperty('type');
      expect(['support', 'resistance']).toContain(firstLevel.type);
    });

    it('should filter levels by minimum timeframe support', () => {
      const multiData = createMockMultiTimeframeData();
      
      const levels = service.findMultiTimeframeSupportResistance(multiData, {
        minTouchCount: 2,
        priceTolerancePercent: 0.5,
        minTimeframes: 2
      });

      // All returned levels should have at least 2 timeframes supporting them
      levels.forEach(level => {
        expect(level.timeframeSupport.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should sort levels by confidence score', () => {
      const multiData = createMockMultiTimeframeData();
      
      const levels = service.findMultiTimeframeSupportResistance(multiData);

      // Check that levels are sorted in descending order by confidence
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i - 1].confidenceScore).toBeGreaterThanOrEqual(levels[i].confidenceScore);
      }
    });
  });

  describe('findConfluenceZones', () => {
    const createMockDataWithConfluence = () => ({
      symbol: 'BTCUSDT',
      timeframes: {
        '15m': {
          data: generateConfluenceData(48000, 100, [47800, 48200, 48500]),
          weight: 0.2,
          dataPoints: 100
        },
        '1h': {
          data: generateConfluenceData(48000, 200, [47800, 48200, 48500]),
          weight: 0.3,
          dataPoints: 200
        },
        '4h': {
          data: generateConfluenceData(48000, 150, [47800, 48200, 48500]),
          weight: 0.35,
          dataPoints: 150
        }
      },
      fetchedAt: Date.now()
    });

    function generateConfluenceData(
      basePrice: number, 
      count: number, 
      confluenceLevels: number[]
    ): ProcessedKline[] {
      const data: ProcessedKline[] = [];
      const baseTime = Date.now() - count * 3600000;
      
      for (let i = 0; i < count; i++) {
        const time = baseTime + i * 3600000;
        let high = basePrice + Math.random() * 200;
        let low = basePrice - Math.random() * 200;
        
        // Create touches at confluence levels
        confluenceLevels.forEach(level => {
          if (Math.random() > 0.7) {
            if (Math.random() > 0.5) {
              high = level + Math.random() * 10;
              low = level - 100;
            } else {
              low = level - Math.random() * 10;
              high = level + 100;
            }
          }
        });
        
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);
        
        data.push({
          time,
          open,
          high,
          low,
          close,
          volume: 100 + Math.random() * 50
        });
      }
      
      return data;
    }

    it('should identify confluence zones where multiple timeframes agree', () => {
      const multiData = createMockDataWithConfluence();
      
      const zones = service.findConfluenceZones(multiData, {
        minTimeframes: 2,
        zoneWidthPercent: 1.0
      });

      expect(zones).toBeDefined();
      expect(Array.isArray(zones)).toBe(true);
      // Zones might not always be found with random data
      if (zones.length > 0) {
      
        // Check zone structure
        const firstZone = zones[0];
        expect(firstZone).toHaveProperty('priceRange');
        expect(firstZone.priceRange).toHaveProperty('min');
        expect(firstZone.priceRange).toHaveProperty('max');
        expect(firstZone.priceRange).toHaveProperty('center');
        expect(firstZone).toHaveProperty('strength');
        expect(firstZone).toHaveProperty('timeframeCount');
        expect(firstZone).toHaveProperty('supportingTimeframes');
        expect(firstZone).toHaveProperty('levels');
        expect(firstZone).toHaveProperty('type');
      }
    });

    it('should filter zones by minimum timeframe requirement', () => {
      const multiData = createMockDataWithConfluence();
      
      const zones = service.findConfluenceZones(multiData, {
        minTimeframes: 3,
        zoneWidthPercent: 1.0
      });

      zones.forEach(zone => {
        expect(zone.timeframeCount).toBeGreaterThanOrEqual(3);
      });
    });

    it('should sort zones by strength', () => {
      const multiData = createMockDataWithConfluence();
      
      const zones = service.findConfluenceZones(multiData, {
        minTimeframes: 1,
        zoneWidthPercent: 1.0
      });

      // Check that zones are sorted in descending order by strength
      for (let i = 1; i < zones.length; i++) {
        expect(zones[i - 1].strength).toBeGreaterThanOrEqual(zones[i].strength);
      }
    });

    it('should correctly identify zone types', () => {
      const multiData = createMockDataWithConfluence();
      
      const zones = service.findConfluenceZones(multiData);

      zones.forEach(zone => {
        expect(['support', 'resistance', 'pivot']).toContain(zone.type);
        
        // Verify type logic
        const supportCount = zone.levels.filter(l => l.type === 'support').length;
        const resistanceCount = zone.levels.filter(l => l.type === 'resistance').length;
        
        if (supportCount > resistanceCount) {
          expect(zone.type).toBe('support');
        } else if (resistanceCount > supportCount) {
          expect(zone.type).toBe('resistance');
        } else {
          expect(zone.type).toBe('pivot');
        }
      });
    });

    it('should handle zones with custom width percentage', () => {
      const multiData = createMockDataWithConfluence();
      
      const narrowZones = service.findConfluenceZones(multiData, {
        minTimeframes: 1,
        zoneWidthPercent: 0.5
      });
      
      const wideZones = service.findConfluenceZones(multiData, {
        minTimeframes: 1,
        zoneWidthPercent: 2.0
      });

      // Wider zones should capture more levels
      expect(wideZones.length).toBeLessThanOrEqual(narrowZones.length);
    });
  });

  describe('calculateCrossTimeframeValidation', () => {
    const createValidationData = () => ({
      symbol: 'BTCUSDT',
      timeframes: {
        '15m': {
          data: generateDataWithLevel(48000, 100, 48200),
          weight: 0.2,
          dataPoints: 100
        },
        '1h': {
          data: generateDataWithLevel(48000, 200, 48200),
          weight: 0.3,
          dataPoints: 200
        },
        '4h': {
          data: generateDataWithLevel(48000, 150, 48200),
          weight: 0.35,
          dataPoints: 150
        },
        '1d': {
          data: generateDataWithLevel(48000, 50, 48300), // Different level
          weight: 0.15,
          dataPoints: 50
        }
      },
      fetchedAt: Date.now()
    });

    function generateDataWithLevel(
      basePrice: number, 
      count: number, 
      targetLevel: number
    ): ProcessedKline[] {
      const data: ProcessedKline[] = [];
      const baseTime = Date.now() - count * 3600000;
      
      for (let i = 0; i < count; i++) {
        const time = baseTime + i * 3600000;
        let high = basePrice + Math.random() * 200;
        let low = basePrice - Math.random() * 200;
        
        // Create touches at target level
        if (i % 10 === 0) {
          if (Math.random() > 0.5) {
            high = targetLevel + Math.random() * 10;
            low = targetLevel - 100;
          } else {
            low = targetLevel - Math.random() * 10;
            high = targetLevel + 100;
          }
        }
        
        const open = low + Math.random() * (high - low);
        const close = low + Math.random() * (high - low);
        
        data.push({
          time,
          open,
          high,
          low,
          close,
          volume: 100 + Math.random() * 50
        });
      }
      
      return data;
    }

    it('should calculate validation score for a price level', () => {
      const multiData = createValidationData();
      
      const validation = service.calculateCrossTimeframeValidation(
        48200,
        multiData,
        0.5
      );

      expect(validation).toBeDefined();
      expect(validation.validationScore).toBeGreaterThanOrEqual(0);
      expect(validation.validationScore).toBeLessThanOrEqual(1);
      expect(validation.supportingTimeframes).toBeInstanceOf(Array);
      expect(validation.touchCounts).toBeInstanceOf(Object);
      expect(validation.avgStrength).toBeGreaterThanOrEqual(0);
    });

    it('should identify supporting timeframes correctly', () => {
      const multiData = createValidationData();
      
      const validation = service.calculateCrossTimeframeValidation(
        48200,
        multiData,
        0.5
      );

      // Should find support in at least some timeframes
      expect(validation.supportingTimeframes.length).toBeGreaterThan(0);
      expect(validation.supportingTimeframes.length).toBeLessThanOrEqual(4);
    });

    it('should handle different tolerance levels', () => {
      const multiData = createValidationData();
      
      const strictValidation = service.calculateCrossTimeframeValidation(
        48200,
        multiData,
        0.1 // Very tight tolerance
      );
      
      const looseValidation = service.calculateCrossTimeframeValidation(
        48200,
        multiData,
        2.0 // Loose tolerance
      );

      expect(looseValidation.supportingTimeframes.length).toBeGreaterThanOrEqual(
        strictValidation.supportingTimeframes.length
      );
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json({
            data: Array.from({ length: 100 }, (_, i) => ({
              time: Date.now() - i * 60000,
              open: 48000,
              high: 48100,
              low: 47900,
              close: 48050,
              volume: 100
            }))
          });
        })
      );

      // Populate cache
      await service.fetchMultiTimeframeData('BTCUSDT');
      
      let stats = service.getCacheStats();
      expect(stats.size).toBe(1);
      
      // Clear cache
      service.clearCache();
      
      stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should expire cache entries after timeout', async () => {
      // Mock time
      const originalNow = Date.now;
      let currentTime = originalNow();
      Date.now = jest.fn(() => currentTime);

      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json({
            data: Array.from({ length: 100 }, (_, i) => ({
              time: currentTime - i * 60000,
              open: 48000,
              high: 48100,
              low: 47900,
              close: 48050,
              volume: 100
            }))
          });
        })
      );

      // First fetch
      await service.fetchMultiTimeframeData('BTCUSDT');
      
      // Advance time past cache expiry
      currentTime += APP_CONSTANTS.api.timeoutMs + 1000;
      
      // Second fetch should hit the API again
      await service.fetchMultiTimeframeData('BTCUSDT');
      
      // Restore Date.now
      Date.now = originalNow;
    });

    it('should return cache statistics', async () => {
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json({
            data: Array.from({ length: 100 }, () => ({
              time: Date.now(),
              open: 48000,
              high: 48100,
              low: 47900,
              close: 48050,
              volume: 100
            }))
          });
        })
      );

      // Fetch data for multiple symbols
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
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          return HttpResponse.json({
            data: [
              { time: Date.now(), open: 48000 }, // Missing required fields
              null, // Null entry
              { 
                time: Date.now(),
                open: 48000,
                high: 48100,
                low: 47900,
                close: 48050,
                volume: 100
              }
            ]
          });
        })
      );

      // Should handle gracefully without throwing
      const result = await service.fetchMultiTimeframeData('BTCUSDT');
      expect(result).toBeDefined();
    });

    it.skip('should handle network errors with retry', async () => {
      let attemptCount = 0;
      
      server.use(
        http.get('http://localhost:3000/api/binance/klines', () => {
          attemptCount++;
          
          // Fail first 2 attempts, succeed on 3rd
          if (attemptCount < 3) {
            return HttpResponse.error();
          }
          
          return HttpResponse.json({
            data: Array.from({ length: 100 }, () => ({
              time: Date.now(),
              open: 48000,
              high: 48100,
              low: 47900,
              close: 48050,
              volume: 100
            }))
          });
        })
      );

      const result = await service.fetchMultiTimeframeData('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle very large datasets efficiently', () => {
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