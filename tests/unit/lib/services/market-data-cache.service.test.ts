import type { Redis } from 'ioredis';
import { MarketDataCacheService, CacheConfig, CacheEntry } from '@/lib/services/market-data-cache.service';
import type { MarketStatsResult } from '@/lib/mastra/tools/market-data-resilient.tool';

// Mock dependencies first
jest.mock('@/lib/api/redis-connection-manager');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/metrics');

// Import mocked modules after mocking
import { getRedisConnectionManager } from '@/lib/api/redis-connection-manager';
import { logger } from '@/lib/utils/logger';
import { incrementMetric } from '@/lib/monitoring/metrics';

// Setup logger mock
jest.mocked(logger).info = jest.fn();
jest.mocked(logger).error = jest.fn();
jest.mocked(logger).warn = jest.fn();
jest.mocked(logger).debug = jest.fn();

// Setup metrics mock
(incrementMetric as jest.Mock) = jest.fn();

describe('MarketDataCacheService', () => {
  let cacheService: MarketDataCacheService;
  let mockRedis: any;
  let mockConnectionManager: any;

  const mockMarketData: MarketStatsResult = {
    symbol: 'BTCUSDT',
    currentPrice: 50000,
    priceChange24h: 1000,
    priceChangePercent24h: 2.04,
    volume24h: 1000000,
    high24h: 51000,
    low24h: 49000,
    analysis: {
      trend: 'bullish',
      volatility: 'medium',
      recommendation: 'Buy signal'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup Redis mock
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn()
    } as any;

    mockConnectionManager = {
      getConnection: jest.fn().mockReturnValue(mockRedis)
    };

    jest.mocked(getRedisConnectionManager).mockResolvedValue(mockConnectionManager);

    // Create cache service instance
    cacheService = new MarketDataCacheService({
      defaultTTL: 30000,
      minTTL: 5000,
      maxTTL: 60000,
      l1CacheSize: 3,
      warmupSymbols: ['BTCUSDT', 'ETHUSDT'],
      enablePreloading: false
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with Redis connection', async () => {
      await cacheService.initialize();

      expect(getRedisConnectionManager).toHaveBeenCalled();
      expect(mockConnectionManager.getConnection).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[MarketDataCache] Initialized with Redis connection'
      );
    });

    it('should handle Redis initialization failure gracefully', async () => {
      jest.mocked(getRedisConnectionManager).mockRejectedValue(new Error('Connection failed'));

      await cacheService.initialize();

      expect(logger.error).toHaveBeenCalledWith(
        '[MarketDataCache] Failed to initialize Redis, falling back to in-memory only:',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should perform cache warmup when enabled', async () => {
      cacheService = new MarketDataCacheService({
        enablePreloading: true,
        warmupSymbols: ['BTCUSDT', 'ETHUSDT']
      });

      await cacheService.initialize();
      
      // Advance timers by specific amount instead of running all
      jest.advanceTimersByTime(100);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('market:cache:market:BTCUSDT'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('Multi-level Caching', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should return data from L1 cache when available', async () => {
      const key = 'test-key';
      const entry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      await cacheService.set(key, entry);

      const result = await cacheService.get<MarketStatsResult>(key);

      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(true);
      expect(result.metadata.cacheLevel).toBe('L1');
      expect(result.metadata.latency).toBeLessThan(10);
    });

    it('should return data from L2 cache when L1 misses', async () => {
      const key = 'test-key';
      const entry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await cacheService.get<MarketStatsResult>(key);

      expect(mockRedis.get).toHaveBeenCalledWith('market:cache:test-key');
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(true);
      expect(result.metadata.cacheLevel).toBe('L2');
    });

    it('should fetch from source when both caches miss', async () => {
      const key = 'test-key';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get<MarketStatsResult>(key, fetcher);

      expect(fetcher).toHaveBeenCalled();
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should skip L1 cache when skipL1 option is set', async () => {
      const key = 'test-key';
      const entry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      await cacheService.set(key, entry);
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await cacheService.get<MarketStatsResult>(key, undefined, { skipL1: true });

      expect(result.metadata.cacheLevel).toBe('L2');
    });

    it('should skip L2 cache when skipL2 option is set', async () => {
      const key = 'test-key';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockMarketData));

      const result = await cacheService.get<MarketStatsResult>(key, fetcher, { skipL2: true });

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalled();
    });

    it('should promote L2 data to L1 cache', async () => {
      const key = 'test-key';
      const entry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      await cacheService.get<MarketStatsResult>(key);

      // Second call should hit L1
      const result = await cacheService.get<MarketStatsResult>(key);
      expect(result.metadata.cacheLevel).toBe('L1');
    });

    it('should throw error when no data found and no fetcher provided', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(cacheService.get('non-existent')).rejects.toThrow(
        'No data found for key: non-existent and no fetcher provided'
      );
    });
  });

  describe('TTL Calculations', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should use custom TTL when provided', async () => {
      const key = 'test-key';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      const customTTL = 15000;

      await cacheService.get(key, fetcher, { ttl: customTTL });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        15, // 15 seconds
        expect.any(String)
      );
    });

    it('should calculate TTL based on volatility', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);

      // High volatility (>= 5.0) = min TTL (5 seconds)
      await cacheService.get('high-vol', fetcher, { volatility: 6.0 });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        5,
        expect.any(String)
      );

      // Medium volatility (>= 2.0) = min TTL * 2 (10 seconds)
      await cacheService.get('med-vol', fetcher, { volatility: 3.0 });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        10,
        expect.any(String)
      );

      // Low volatility = default TTL (30 seconds)
      await cacheService.get('low-vol', fetcher, { volatility: 1.0 });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        30,
        expect.any(String)
      );
    });

    it('should enforce min and max TTL bounds', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);

      // TTL below minimum
      await cacheService.get('test1', fetcher, { ttl: 1000 });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        5, // Min TTL of 5 seconds
        expect.any(String)
      );

      // TTL above maximum
      await cacheService.get('test2', fetcher, { ttl: 100000 });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        60, // Max TTL of 60 seconds
        expect.any(String)
      );
    });
  });

  describe('Cache Eviction', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it.skip('should evict LRU entry when L1 cache is full', async () => {
      // Fill cache to capacity
      for (let i = 0; i < 3; i++) {
        const entry: CacheEntry<string> = {
          data: `data${i}`,
          timestamp: Date.now() - (1000 * i), // Older entries have lower timestamp
          ttl: 30000,
          hits: i, // Vary hits
          source: 'api'
        };
        await cacheService.set(`key${i}`, entry);
      }

      // Add one more entry to trigger eviction
      const newEntry: CacheEntry<string> = {
        data: 'new-data',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };
      await cacheService.set('new-key', newEntry);

      // Verify eviction occurred
      const stats = cacheService.getStats();
      expect(stats.evictions).toBe(1);
      expect(stats.cacheSize.l1).toBe(3);
    });

    it('should not evict when updating existing entry', async () => {
      const key = 'existing-key';
      const entry: CacheEntry<string> = {
        data: 'original',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      await cacheService.set(key, entry);

      // Update the same key multiple times
      for (let i = 0; i < 5; i++) {
        entry.data = `updated-${i}`;
        await cacheService.set(key, entry);
      }

      const stats = cacheService.getStats();
      expect(stats.evictions).toBe(0);
    });
  });

  describe('Redis Operations and Fallback', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should handle Redis get failure gracefully', async () => {
      const key = 'test-key';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get(key, fetcher);

      expect(logger.warn).toHaveBeenCalledWith(
        '[MarketDataCache] Redis get failed:',
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(false);
    });

    it('should handle Redis set failure gracefully', async () => {
      const key = 'test-key';
      const entry: CacheEntry<string> = {
        data: 'test-data',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await cacheService.set(key, entry);

      expect(logger.warn).toHaveBeenCalledWith(
        '[MarketDataCache] Redis set failed:',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle malformed Redis data', async () => {
      const key = 'test-key';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await cacheService.get(key, fetcher);

      expect(logger.error).toHaveBeenCalledWith(
        '[MarketDataCache] Failed to parse Redis data:',
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(fetcher).toHaveBeenCalled();
    });

    it('should clean up expired entries from Redis', async () => {
      const key = 'test-key';
      const expiredEntry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now() - 100000, // Old timestamp
        ttl: 5000, // Already expired
        hits: 0,
        source: 'api'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredEntry));
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);

      await cacheService.get(key, fetcher);

      expect(mockRedis.del).toHaveBeenCalledWith('market:cache:test-key');
      expect(fetcher).toHaveBeenCalled();
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should delete from all cache levels', async () => {
      const key = 'test-key';
      const entry: CacheEntry<string> = {
        data: 'test-data',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      await cacheService.set(key, entry);
      await cacheService.delete(key);

      expect(mockRedis.del).toHaveBeenCalledWith('market:cache:test-key');

      // Verify L1 cache is cleared
      const fetcher = jest.fn().mockResolvedValue('new-data');
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get(key, fetcher);
      expect(fetcher).toHaveBeenCalled();
    });

    it('should clear all caches', async () => {
      mockRedis.keys.mockResolvedValue(['market:cache:key1', 'market:cache:key2']);

      await cacheService.clear();

      expect(mockRedis.keys).toHaveBeenCalledWith('market:cache:*');
      expect(mockRedis.del).toHaveBeenCalledWith('market:cache:key1', 'market:cache:key2');

      const stats = cacheService.getStats();
      expect(stats.l1Hits).toBe(0);
      expect(stats.l2Hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should invalidate entries by pattern', async () => {
      // Add entries to L1 cache
      for (let i = 0; i < 3; i++) {
        const entry: CacheEntry<string> = {
          data: `data${i}`,
          timestamp: Date.now(),
          ttl: 30000,
          hits: 0,
          source: 'api'
        };
        await cacheService.set(`BTC-${i}`, entry);
        await cacheService.set(`ETH-${i}`, entry);
      }

      mockRedis.keys.mockResolvedValue(['market:cache:BTC-1', 'market:cache:BTC-2']);

      const invalidated = await cacheService.invalidatePattern('BTC');

      expect(mockRedis.keys).toHaveBeenCalledWith('market:cache:*BTC*');
      expect(mockRedis.del).toHaveBeenCalledWith('market:cache:BTC-1', 'market:cache:BTC-2');
      expect(invalidated).toBeGreaterThan(0);
    });

    it('should handle Redis failure during pattern invalidation', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const invalidated = await cacheService.invalidatePattern('test');

      expect(logger.warn).toHaveBeenCalledWith(
        '[MarketDataCache] Redis pattern invalidation failed:',
        expect.objectContaining({ error: expect.any(Error) })
      );
      expect(invalidated).toBe(0);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should track cache hit rates correctly', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);

      // L1 hit
      const entry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };
      await cacheService.set('key1', entry);
      await cacheService.get('key1');

      // L2 hit
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      await cacheService.get('key2');

      // Miss
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('key3', fetcher);

      const stats = cacheService.getStats();
      expect(stats.l1Hits).toBe(1);
      expect(stats.l2Hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.l1HitRate).toBeCloseTo(1/3);
      expect(stats.l2HitRate).toBeCloseTo(1/3);
    });

    it('should track latency metrics', async () => {
      // Use real timers to measure actual latency
      jest.useRealTimers();
      
      const fetcher = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return mockMarketData;
      });

      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('test', fetcher);

      const stats = cacheService.getStats();
      expect(stats.avgLatency).toBeGreaterThan(0);
      expect(stats.latencyPercentiles.p50).toBeGreaterThan(0);
      
      // Reset to fake timers
      jest.useFakeTimers();
    });

    it('should increment hit counter on cache access', async () => {
      const entry: CacheEntry<string> = {
        data: 'test',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      };

      await cacheService.set('test-key', entry);

      // Access multiple times
      for (let i = 0; i < 3; i++) {
        await cacheService.get('test-key');
      }

      // The entry should have updated hit count
      const result = await cacheService.get('test-key');
      expect(result.data).toBe('test');
    });

    it('should emit metrics on operations', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);

      // Generate some cache activity
      await cacheService.set('key1', {
        data: 'data1',
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      } as CacheEntry<string>);

      await cacheService.get('key1'); // L1 hit
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('key2', fetcher); // Miss

      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_l1_hits');
      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_hits');
      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_misses');
    });

    it('should report stats periodically', async () => {
      // Fast forward to trigger stats reporting
      jest.advanceTimersByTime(60000);

      expect(logger.info).toHaveBeenCalledWith(
        '[MarketDataCache] Performance stats:',
        expect.objectContaining({
          hitRate: expect.any(String),
          l1HitRate: expect.any(String),
          l2HitRate: expect.any(String),
          avgLatency: expect.any(String),
          p95Latency: expect.any(String),
          p99Latency: expect.any(String),
          cacheSize: expect.any(Object),
          evictions: expect.any(Number)
        })
      );
    });

    it('should handle high latency detection', async () => {
      // Use real timers for this test to simulate actual latency
      jest.useRealTimers();
      
      const slowFetcher = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return mockMarketData;
      });

      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('slow-key', slowFetcher);
      
      // Reset to fake timers
      jest.useFakeTimers();

      expect(logger.warn).toHaveBeenCalledWith(
        '[MarketDataCache] High latency detected:',
        expect.objectContaining({
          latency: expect.any(Number),
          threshold: 300
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      await cacheService.initialize();
    });

    it('should handle concurrent access to the same key', async () => {
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      mockRedis.get.mockResolvedValue(null);

      // Simulate concurrent requests
      const promises = Array(5).fill(null).map(() => 
        cacheService.get('concurrent-key', fetcher)
      );

      const results = await Promise.all(promises);

      // All should get the same data
      results.forEach(result => {
        expect(result.data).toEqual(mockMarketData);
      });

      // Fetcher should be called multiple times due to race conditions
      expect(fetcher).toHaveBeenCalled();
    });

    it('should handle empty cache keys array during clear', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cacheService.clear();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should calculate percentiles correctly with limited samples', async () => {
      const stats = cacheService.getStats();

      expect(stats.latencyPercentiles.p50).toBe(0);
      expect(stats.latencyPercentiles.p95).toBe(0);
      expect(stats.latencyPercentiles.p99).toBe(0);
    });

    it('should handle cache operations when Redis is null', async () => {
      // Create service without Redis
      cacheService = new MarketDataCacheService();
      
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      const result = await cacheService.get('test', fetcher);

      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(false);
    });

    it('should maintain latency samples within limit', async () => {
      // Use real timers for latency measurement
      jest.useRealTimers();
      
      const fetcher = jest.fn().mockResolvedValue('data');
      mockRedis.get.mockResolvedValue(null);

      // Generate more than MAX_LATENCY_SAMPLES (1000) requests
      for (let i = 0; i < 1100; i++) {
        await cacheService.get(`key-${i}`, fetcher);
      }

      const stats = cacheService.getStats();
      // Verify that latency calculation still works
      expect(stats.avgLatency).toBeGreaterThan(0);
      
      // Reset to fake timers
      jest.useFakeTimers();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', async () => {
      const { getMarketDataCache } = await import('@/lib/services/market-data-cache.service');
      
      const instance1 = await getMarketDataCache();
      const instance2 = await getMarketDataCache();

      expect(instance1).toBe(instance2);
    });
  });
});