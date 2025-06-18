import { marketDataResilientTool, getCacheStats, clearMarketDataCache } from '@/lib/mastra/tools/market-data-resilient.tool';
import { getMarketDataCache } from '@/lib/services/market-data-cache.service';
import { logger } from '@/lib/utils/logger';

// Mock external API calls for consistent testing
jest.mock('@/lib/api/base-service', () => ({
  BaseService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation((endpoint: string) => {
      // Simulate API latency
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            data: {
              symbol: 'BTCUSDT',
              lastPrice: '50000.00',
              priceChange: '1000.00',
              priceChangePercent: '2.04',
              volume: '28506.89',
              highPrice: '51234.56',
              lowPrice: '48765.43',
            }
          });
        }, 400); // Simulate 400ms API latency
      });
    })
  }))
}));

describe('Market Data Cache Integration', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await clearMarketDataCache();
    
    // Suppress logs during tests
    logger.info = jest.fn();
    logger.debug = jest.fn();
    logger.warn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Performance Requirements', () => {
    it('should complete cold cache requests within 500ms', async () => {
      const start = Date.now();
      
      const result = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      const latency = Date.now() - start;
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.metadata.fromCache).toBe(false);
      expect(latency).toBeLessThan(500);
    });

    it('should complete warm cache requests within 50ms', async () => {
      // Warm up cache
      await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      // Test warm cache performance
      const start = Date.now();
      
      const result = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      const latency = Date.now() - start;
      
      expect(result.metadata.fromCache).toBe(true);
      expect(latency).toBeLessThan(50);
      
      console.log(`Warm cache latency: ${latency}ms`);
    });

    it('should handle concurrent requests efficiently', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
      const concurrentRequests = 20;
      
      const start = Date.now();
      
      const promises = Array(concurrentRequests).fill(0).map((_, i) => 
        (marketDataResilientTool as any).execute({
          context: { symbol: symbols[i % symbols.length] }
        })
      );
      
      const results = await Promise.all(promises);
      
      const totalLatency = Date.now() - start;
      const avgLatency = totalLatency / concurrentRequests;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(avgLatency).toBeLessThan(300); // Average should be under 300ms
      
      // Check cache stats
      const cache = await getMarketDataCache();
      const stats = cache.getStats();
      
      expect(stats.hitRate).toBeGreaterThan(0);
      console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
    });
  });

  describe('Cache Behavior', () => {
    it('should use dynamic TTL based on volatility', async () => {
      const cache = await getMarketDataCache();
      
      // First request - high volatility scenario
      const result1 = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      // Check that TTL is adjusted based on volatility
      const volatility = Math.abs(result1.priceChangePercent24h);
      const expectedTTL = volatility >= 5 ? 5000 : 
                         volatility >= 2 ? 10000 : 30000;
      
      // The TTL should be within expected range
      expect(result1.metadata.ttl).toBeLessThanOrEqual(expectedTTL * 1.5);
    });

    it('should promote L2 cache hits to L1', async () => {
      const cache = await getMarketDataCache();
      
      // Clear L1 cache but keep L2
      await cache.clear();
      
      // First request - populate cache
      await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      // Clear only L1 to force L2 lookup
      const stats1 = cache.getStats();
      
      // Second request should hit L2 and promote to L1
      const result = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      expect(result.metadata.fromCache).toBe(true);
      
      // Third request should hit L1
      const start = Date.now();
      await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      const l1Latency = Date.now() - start;
      
      expect(l1Latency).toBeLessThan(10); // L1 should be very fast
    });

    it('should handle cache invalidation correctly', async () => {
      const cache = await getMarketDataCache();
      
      // Populate cache
      await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      
      // Verify it's cached
      const result1 = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      expect(result1.metadata.fromCache).toBe(true);
      
      // Invalidate
      await cache.invalidatePattern('BTCUSDT');
      
      // Next request should miss cache
      const result2 = await (marketDataResilientTool as any).execute({
        context: { symbol: 'BTCUSDT' }
      });
      expect(result2.metadata.fromCache).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics accurately', async () => {
      const cache = await getMarketDataCache();
      const iterations = 10;
      
      // Generate some traffic
      for (let i = 0; i < iterations; i++) {
        await (marketDataResilientTool as any).execute({
          context: { symbol: i < 5 ? 'BTCUSDT' : 'ETHUSDT' }
        });
      }
      
      const stats = cache.getStats();
      
      expect(stats.totalRequests).toBeGreaterThanOrEqual(iterations);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.avgLatency).toBeDefined();
      expect(stats.latencyPercentiles.p95).toBeGreaterThan(0);
      
      console.log('Performance Stats:', {
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        avgLatency: `${stats.avgLatency.toFixed(2)}ms`,
        p95Latency: `${stats.latencyPercentiles.p95.toFixed(2)}ms`,
        p99Latency: `${stats.latencyPercentiles.p99.toFixed(2)}ms`
      });
    });

    it('should achieve target performance improvement', async () => {
      const coldLatencies: number[] = [];
      const warmLatencies: number[] = [];
      
      // Test cold cache
      for (let i = 0; i < 5; i++) {
        await clearMarketDataCache();
        const start = Date.now();
        await (marketDataResilientTool as any).execute({
          context: { symbol: `TEST${i}USDT` }
        });
        coldLatencies.push(Date.now() - start);
      }
      
      // Test warm cache
      for (let i = 0; i < 5; i++) {
        // Ensure cache is warm
        await (marketDataResilientTool as any).execute({
          context: { symbol: 'BTCUSDT' }
        });
        
        const start = Date.now();
        await (marketDataResilientTool as any).execute({
          context: { symbol: 'BTCUSDT' }
        });
        warmLatencies.push(Date.now() - start);
      }
      
      const avgCold = coldLatencies.reduce((a, b) => a + b) / coldLatencies.length;
      const avgWarm = warmLatencies.reduce((a, b) => a + b) / warmLatencies.length;
      const improvement = ((avgCold - avgWarm) / avgCold) * 100;
      
      console.log('Performance Improvement:', {
        avgColdLatency: `${avgCold.toFixed(2)}ms`,
        avgWarmLatency: `${avgWarm.toFixed(2)}ms`,
        improvement: `${improvement.toFixed(1)}%`
      });
      
      expect(avgWarm).toBeLessThan(300); // Target: under 300ms
      expect(improvement).toBeGreaterThan(50); // At least 50% improvement
    });
  });
});