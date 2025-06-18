import { MarketDataCacheService, CacheConfig, CacheEntry, getMarketDataCache, _cacheInstance } from '@/lib/services/market-data-cache.service';
import { Redis } from 'ioredis';
import { logger } from '@/lib/utils/logger';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { getRedisConnectionManager } from '@/lib/api/redis-connection-manager';
import type { MarketStatsResult } from '@/lib/mastra/tools/market-data-resilient.tool';

// Mock dependencies
jest.mock('ioredis');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/metrics');
jest.mock('@/lib/api/redis-connection-manager');

describe('MarketDataCacheService', () => {
  let service: MarketDataCacheService;
  let mockRedis: jest.Mocked<Redis>;
  let mockConnectionManager: any;
  
  const mockMarketData: MarketStatsResult = {
    symbol: 'BTCUSDT',
    currentPrice: 50000,
    priceChange24h: 1000,
    priceChangePercent24h: 2.0,
    volume24h: 1000000,
    high24h: 51000,
    low24h: 49000,
    analysis: {
      trend: 'bullish',
      volatility: 'medium',
      recommendation: 'Buy signal detected'
    }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock Redis instance
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG')
    } as any;
    
    // Mock connection manager
    mockConnectionManager = {
      getConnection: jest.fn().mockReturnValue(mockRedis)
    };
    
    (getRedisConnectionManager as jest.Mock).mockResolvedValue(mockConnectionManager);
    
    // Reset singleton instance for testing
    if (_cacheInstance) {
      (_cacheInstance as any) = null;
    }
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    it('should initialize with Redis connection successfully', async () => {
      service = new MarketDataCacheService();
      await service.initialize();
      
      expect(getRedisConnectionManager).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('[MarketDataCache] Initialized with Redis connection');
    });
    
    it('should handle Redis connection failure gracefully', async () => {
      (getRedisConnectionManager as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      
      service = new MarketDataCacheService();
      await service.initialize();
      
      expect(logger.error).toHaveBeenCalledWith(
        '[MarketDataCache] Failed to initialize Redis, falling back to in-memory only:',
        expect.any(Error)
      );
    });
    
    it('should start cache warmup when enabled', async () => {
      const config: Partial<CacheConfig> = {
        enablePreloading: true,
        warmupSymbols: ['BTCUSDT', 'ETHUSDT']
      };
      
      service = new MarketDataCacheService(config);
      await service.initialize();
      
      // Wait for warmup to complete
      await jest.runAllTimersAsync();
      
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        '[MarketDataCache] Warmup completed for 2 symbols'
      );
    });
  });
  
  describe('get operation', () => {
    beforeEach(async () => {
      service = new MarketDataCacheService();
      await service.initialize();
    });
    
    it('should return data from L1 cache when available', async () => {
      const key = 'market:BTCUSDT';
      const cachedEntry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 5,
        source: 'cache'
      };
      
      // Manually add to L1 cache
      (service as any).l1Cache.set(key, cachedEntry);
      
      const result = await service.get<MarketStatsResult>(key);
      
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(true);
      expect(result.metadata.cacheLevel).toBe('L1');
      expect(result.metadata.latency).toBeLessThan(10);
      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_l1_hits');
    });
    
    it('should return data from L2 cache when L1 misses', async () => {
      const key = 'market:BTCUSDT';
      const cachedEntry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'cache'
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));
      
      const result = await service.get<MarketStatsResult>(key);
      
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(true);
      expect(result.metadata.cacheLevel).toBe('L2');
      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_l2_hits');
    });
    
    it('should fetch from source when cache misses', async () => {
      const key = 'market:BTCUSDT';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      
      mockRedis.get.mockResolvedValue(null);
      
      const result = await service.get<MarketStatsResult>(key, fetcher);
      
      expect(fetcher).toHaveBeenCalled();
      expect(result.data).toEqual(mockMarketData);
      expect(result.metadata.fromCache).toBe(false);
      expect(incrementMetric).toHaveBeenCalledWith('market_data_cache_misses');
    });
    
    it('should handle expired cache entries', async () => {
      const key = 'market:BTCUSDT';
      const expiredEntry: CacheEntry<MarketStatsResult> = {
        data: mockMarketData,
        timestamp: Date.now() - 60000, // 1 minute ago
        ttl: 30000, // 30 second TTL
        hits: 0,
        source: 'cache'
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredEntry));
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      
      const result = await service.get<MarketStatsResult>(key, fetcher);
      
      expect(fetcher).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`market:cache:${key}`);
    });
    
    it('should calculate dynamic TTL based on volatility', async () => {
      const key = 'market:BTCUSDT';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      
      mockRedis.get.mockResolvedValue(null);
      
      // High volatility
      await service.get<MarketStatsResult>(key, fetcher, { volatility: 6.0 });
      
      const lastCall = mockRedis.setex.mock.calls[mockRedis.setex.mock.calls.length - 1];
      expect(lastCall[1]).toBe(5); // 5 seconds for high volatility
      
      // Medium volatility
      await service.get<MarketStatsResult>(key, fetcher, { volatility: 3.0 });
      
      const lastCall2 = mockRedis.setex.mock.calls[mockRedis.setex.mock.calls.length - 1];
      expect(lastCall2[1]).toBe(10); // 10 seconds for medium volatility
    });
  });
  
  describe('cache management', () => {
    beforeEach(async () => {
      service = new MarketDataCacheService({ l1CacheSize: 3 });
      await service.initialize();
    });
    
    it('should implement LRU eviction when L1 cache is full', async () => {
      const entries = [
        { key: 'market:BTC', data: { ...mockMarketData, symbol: 'BTC' } },
        { key: 'market:ETH', data: { ...mockMarketData, symbol: 'ETH' } },
        { key: 'market:BNB', data: { ...mockMarketData, symbol: 'BNB' } },
        { key: 'market:SOL', data: { ...mockMarketData, symbol: 'SOL' } }
      ];
      
      // Fill cache
      for (const entry of entries.slice(0, 3)) {
        await service.set(entry.key, {
          data: entry.data,
          timestamp: Date.now(),
          ttl: 30000,
          hits: 0,
          source: 'api'
        });
      }
      
      // Add fourth entry - should evict least recently used
      await service.set(entries[3].key, {
        data: entries[3].data,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'api'
      });
      
      const stats = service.getStats();
      expect(stats.evictions).toBe(1);
      expect(stats.cacheSize.l1).toBe(3);
    });
    
    it('should invalidate cache entries by pattern', async () => {
      const entries = [
        { key: 'market:BTCUSDT', data: mockMarketData },
        { key: 'market:ETHUSDT', data: { ...mockMarketData, symbol: 'ETHUSDT' } },
        { key: 'market:BNBUSDT', data: { ...mockMarketData, symbol: 'BNBUSDT' } },
        { key: 'orderbook:BTCUSDT', data: { bids: [], asks: [] } }
      ];
      
      // Add entries to cache
      for (const entry of entries) {
        await service.set(entry.key, {
          data: entry.data,
          timestamp: Date.now(),
          ttl: 30000,
          hits: 0,
          source: 'api'
        });
      }
      
      mockRedis.keys.mockResolvedValue(['market:cache:market:BTCUSDT', 'market:cache:market:ETHUSDT']);
      
      const invalidated = await service.invalidatePattern('market:');
      
      expect(invalidated).toBe(5); // 3 L1 + 2 L2
      expect(mockRedis.del).toHaveBeenCalledWith(
        'market:cache:market:BTCUSDT',
        'market:cache:market:ETHUSDT'
      );
    });
  });
  
  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      service = new MarketDataCacheService();
      await service.initialize();
    });
    
    it('should track cache hit rates accurately', async () => {
      const key = 'market:BTCUSDT';
      const fetcher = jest.fn().mockResolvedValue(mockMarketData);
      
      // Cache miss
      await service.get(key, fetcher);
      
      // L1 hit
      await service.get(key, fetcher);
      
      // Force L2 hit by clearing L1
      (service as any).l1Cache.clear();
      mockRedis.get.mockResolvedValue(JSON.stringify({
        data: mockMarketData,
        timestamp: Date.now(),
        ttl: 30000,
        hits: 0,
        source: 'cache'
      }));
      await service.get(key, fetcher);
      
      const stats = service.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.l1Hits).toBe(1);
      expect(stats.l2Hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });
    
    it('should calculate latency percentiles', async () => {
      const key = 'market:BTCUSDT';
      const fetcher = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return mockMarketData;
      });
      
      // Generate multiple requests with varying latencies
      for (let i = 0; i < 10; i++) {
        await service.get(`${key}:${i}`, fetcher);
      }
      
      const stats = service.getStats();
      expect(stats.latencyPercentiles.p50).toBeGreaterThan(0);
      expect(stats.latencyPercentiles.p95).toBeGreaterThanOrEqual(stats.latencyPercentiles.p50);
      expect(stats.latencyPercentiles.p99).toBeGreaterThanOrEqual(stats.latencyPercentiles.p95);
    });
    
    it('should log warnings for high latency operations', async () => {
      const key = 'market:BTCUSDT';
      const slowFetcher = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
        return mockMarketData;
      });
      
      jest.useRealTimers();
      await service.get(key, slowFetcher);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[MarketDataCache] High latency detected:',
        expect.objectContaining({
          latency: expect.any(Number),
          threshold: 300
        })
      );
    });
  });
  
  describe('singleton pattern', () => {
    it('should return the same instance when called multiple times', async () => {
      const instance1 = await getMarketDataCache();
      const instance2 = await getMarketDataCache();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should initialize only once', async () => {
      await getMarketDataCache();
      await getMarketDataCache();
      
      expect(getRedisConnectionManager).toHaveBeenCalledTimes(1);
    });
  });
});
EOF < /dev/null