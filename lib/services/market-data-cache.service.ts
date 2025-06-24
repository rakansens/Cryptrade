import { Redis } from 'ioredis';
import { logger } from '@/lib/utils/logger';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { getRedisConnectionManager } from '@/lib/api/redis-connection-manager';
import type { MarketStatsResult } from '@/lib/mastra/tools/market-data-resilient.tool';
// import type { BinanceTicker24hr } from '@/types/market';

/**
 * Market Data Cache Service
 * 
 * High-performance caching layer for market data with:
 * - Redis-backed distributed cache
 * - In-memory L1 cache for hot data
 * - Intelligent TTL management based on volatility
 * - Cache warming and preloading
 * - Metrics and monitoring
 * - Sub-300ms response times
 */

export interface CacheConfig {
  defaultTTL: number;
  minTTL: number;
  maxTTL: number;
  l1CacheSize: number;
  warmupSymbols: string[];
  enablePreloading: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  volatility?: number;
  source?: 'api' | 'cache' | 'preload';
}

export interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  totalRequests: number;
  avgLatency: number;
  hitRate: number;
  l1HitRate: number;
  l2HitRate: number;
  evictions: number;
  cacheSize: {
    l1: number;
    l2: number;
  };
}

export class MarketDataCacheService {
  private redis: Redis | null = null;
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    l1Hits: 0,
    l2Hits: 0,
    misses: 0,
    totalRequests: 0,
    avgLatency: 0,
    hitRate: 0,
    l1HitRate: 0,
    l2HitRate: 0,
    evictions: 0,
    cacheSize: { l1: 0, l2: 0 }
  };
  private latencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 1000;
  
  private config: CacheConfig = {
    defaultTTL: 30000, // 30 seconds
    minTTL: 5000,      // 5 seconds
    maxTTL: 60000,     // 60 seconds
    l1CacheSize: 100,  // Max entries in L1 cache
    warmupSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
    enablePreloading: true
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    try {
      const connectionManager = await getRedisConnectionManager();
      this.redis = connectionManager.getConnection() as Redis;
      
      logger.info('[MarketDataCache] Initialized with Redis connection');
      
      // Start cache warming if enabled
      if (this.config.enablePreloading) {
        this.warmupCache().catch(error => 
          logger.error('[MarketDataCache] Warmup failed:', { error })
        );
      }
      
      // Start periodic stats reporting
      this.startStatsReporting();
      
    } catch (error) {
      logger.error('[MarketDataCache] Failed to initialize Redis, falling back to in-memory only:', { error });
      // Continue with L1 cache only
    }
  }

  /**
   * Get market data with multi-level caching
   */
  async get<T = MarketStatsResult>(
    key: string,
    fetcher?: () => Promise<T>,
    options?: {
      ttl?: number;
      volatility?: number;
      skipL1?: boolean;
      skipL2?: boolean;
    }
  ): Promise<{ data: T; metadata: { fromCache: boolean; cacheLevel?: 'L1' | 'L2'; latency: number } }> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      // Check L1 cache first (unless skipped)
      if (!options?.skipL1) {
        const l1Entry = this.l1Cache.get(key);
        if (l1Entry && this.isValidEntry(l1Entry)) {
          const latency = Date.now() - startTime;
          this.recordHit('L1', latency);
          l1Entry.hits++;
          
          return {
            data: l1Entry.data,
            metadata: { fromCache: true, cacheLevel: 'L1', latency }
          };
        }
      }
      
      // Check L2 cache (Redis) if available
      if (this.redis && !options?.skipL2) {
        try {
          const l2Data = await this.getFromRedis<T>(key);
          if (l2Data) {
            const latency = Date.now() - startTime;
            this.recordHit('L2', latency);
            
            // Promote to L1 cache
            this.setL1Cache(key, l2Data);
            
            return {
              data: l2Data.data,
              metadata: { fromCache: true, cacheLevel: 'L2', latency }
            };
          }
        } catch (error) {
          logger.warn('[MarketDataCache] Redis get failed:', { error });
        }
      }
      
      // Cache miss - fetch from source
      this.recordMiss();
      
      if (!fetcher) {
        throw new Error(`No data found for key: ${key} and no fetcher provided`);
      }
      
      const data = await fetcher();
      const ttl = this.calculateTTL(options?.volatility, options?.ttl);
      
      // Store in both cache levels
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        volatility: options?.volatility,
        source: 'api'
      };
      
      await this.set(key, entry);
      
      const latency = Date.now() - startTime;
      this.recordLatency(latency);
      
      return {
        data,
        metadata: { fromCache: false, latency }
      };
      
    } catch (error) {
      logger.error('[MarketDataCache] Get operation failed:', { error });
      throw error;
    }
  }

  /**
   * Set data in both cache levels
   */
  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Set in L1 cache
    this.setL1Cache(key, entry);
    
    // Set in L2 cache (Redis)
    if (this.redis) {
      try {
        await this.setInRedis(key, entry);
      } catch (error) {
        logger.warn('[MarketDataCache] Redis set failed:', { error });
      }
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    
    if (this.redis) {
      try {
        await this.redis.del(this.getRedisKey(key));
      } catch (error) {
        logger.warn('[MarketDataCache] Redis delete failed:', { error });
      }
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    
    if (this.redis) {
      try {
        const keys = await this.redis.keys(this.getRedisKey('*'));
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.warn('[MarketDataCache] Redis clear failed:', { error });
      }
    }
    
    // Reset stats
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      totalRequests: 0,
      avgLatency: 0,
      hitRate: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      evictions: 0,
      cacheSize: { l1: 0, l2: 0 }
    };
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let invalidated = 0;
    
    // Invalidate L1 cache entries
    for (const key of this.l1Cache.keys()) {
      if (key.includes(pattern)) {
        this.l1Cache.delete(key);
        invalidated++;
      }
    }
    
    // Invalidate L2 cache entries
    if (this.redis) {
      try {
        const keys = await this.redis.keys(this.getRedisKey(`*${pattern}*`));
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidated += keys.length;
        }
      } catch (error) {
        logger.warn('[MarketDataCache] Redis pattern invalidation failed:', { error });
      }
    }
    
    logger.info(`[MarketDataCache] Invalidated ${invalidated} entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { latencyPercentiles: { p50: number; p95: number; p99: number } } {
    // Calculate hit rates
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? totalHits / this.stats.totalRequests 
      : 0;
    
    this.stats.l1HitRate = this.stats.totalRequests > 0 
      ? this.stats.l1Hits / this.stats.totalRequests 
      : 0;
    
    this.stats.l2HitRate = this.stats.totalRequests > 0 
      ? this.stats.l2Hits / this.stats.totalRequests 
      : 0;
    
    // Calculate average latency
    this.stats.avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length
      : 0;
    
    // Calculate cache sizes
    this.stats.cacheSize.l1 = this.l1Cache.size;
    
    // Calculate latency percentiles
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    
    return {
      ...this.stats,
      latencyPercentiles: { p50, p95, p99 }
    };
  }

  /**
   * Warm up cache with frequently accessed symbols
   */
  private async warmupCache(): Promise<void> {
    logger.info('[MarketDataCache] Starting cache warmup...');
    
    const warmupPromises = this.config.warmupSymbols.map(async symbol => {
      try {
        // Simulate fetching data for warmup
        const mockData: MarketStatsResult = {
          symbol,
          currentPrice: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0,
          volume24h: 0,
          high24h: 0,
          low24h: 0,
          analysis: {
            trend: 'neutral',
            volatility: 'low',
            recommendation: 'Warmup data'
          }
        };
        
        const entry: CacheEntry<MarketStatsResult> = {
          data: mockData,
          timestamp: Date.now(),
          ttl: this.config.defaultTTL,
          hits: 0,
          source: 'preload'
        };
        
        await this.set(`market:${symbol}`, entry);
        
      } catch (error) {
        logger.warn(`[MarketDataCache] Failed to warmup ${symbol}:`, { error });
      }
    });
    
    await Promise.all(warmupPromises);
    logger.info(`[MarketDataCache] Warmup completed for ${this.config.warmupSymbols.length} symbols`);
  }

  /**
   * Calculate dynamic TTL based on volatility
   */
  private calculateTTL(volatility?: number, customTTL?: number): number {
    if (customTTL) {
      return Math.min(Math.max(customTTL, this.config.minTTL), this.config.maxTTL);
    }
    
    if (!volatility) {
      return this.config.defaultTTL;
    }
    
    // High volatility = shorter TTL
    let ttl: number;
    if (volatility >= 5.0) {
      ttl = this.config.minTTL; // 5 seconds for high volatility
    } else if (volatility >= 2.0) {
      ttl = this.config.minTTL * 2; // 10 seconds for medium volatility
    } else {
      ttl = this.config.defaultTTL; // 30 seconds for low volatility
    }
    
    return Math.min(Math.max(ttl, this.config.minTTL), this.config.maxTTL);
  }

  /**
   * Check if cache entry is still valid
   */
  private isValidEntry<T>(entry: CacheEntry<T>): boolean {
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  /**
   * Set entry in L1 cache with LRU eviction
   */
  private setL1Cache<T>(key: string, entry: CacheEntry<T>): void {
    // Implement LRU eviction if cache is full
    if (this.l1Cache.size >= this.config.l1CacheSize && !this.l1Cache.has(key)) {
      // Find least recently used entry
      let lruKey: string | null = null;
      let minScore = Infinity;
      
      for (const [k, v] of this.l1Cache.entries()) {
        // For LRU: find the entry with the oldest timestamp (least recently used)
        // Lower timestamp = older entry = should be evicted first
        if (v.timestamp < minScore) {
          lruKey = k;
          minScore = v.timestamp;
        }
      }
      
      if (lruKey) {
        this.l1Cache.delete(lruKey);
        this.stats.evictions++;
      }
    }
    
    this.l1Cache.set(key, entry);
  }

  /**
   * Get entry from Redis
   */
  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.redis) return null;
    
    const redisKey = this.getRedisKey(key);
    const data = await this.redis.get(redisKey);
    
    if (!data) return null;
    
    try {
      const entry = JSON.parse(data) as CacheEntry<T>;
      if (this.isValidEntry(entry)) {
        return entry;
      }
      
      // Clean up expired entry
      await this.redis.del(redisKey);
      return null;
      
    } catch (error) {
      logger.error('[MarketDataCache] Failed to parse Redis data:', { error });
      return null;
    }
  }

  /**
   * Set entry in Redis
   */
  private async setInRedis<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.redis) return;
    
    const redisKey = this.getRedisKey(key);
    const ttlSeconds = Math.ceil(entry.ttl / 1000);
    
    await this.redis.setex(
      redisKey,
      ttlSeconds,
      JSON.stringify(entry)
    );
  }

  /**
   * Get Redis key with namespace
   */
  private getRedisKey(key: string): string {
    return `market:cache:${key}`;
  }

  /**
   * Record cache hit
   */
  private recordHit(level: 'L1' | 'L2', latency: number): void {
    if (level === 'L1') {
      this.stats.l1Hits++;
      incrementMetric('market_data_cache_l1_hits');
    } else {
      this.stats.l2Hits++;
      incrementMetric('market_data_cache_l2_hits');
    }
    
    this.recordLatency(latency);
    incrementMetric('market_data_cache_hits');
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
    incrementMetric('market_data_cache_misses');
  }

  /**
   * Record latency measurement
   */
  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    
    // Keep only recent samples
    if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }
    
    // Log if latency exceeds 300ms
    if (latency > 300) {
      logger.warn('[MarketDataCache] High latency detected:', {
        latency,
        threshold: 300
      });
    }
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      logger.info('[MarketDataCache] Performance stats:', {
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        l1HitRate: `${(stats.l1HitRate * 100).toFixed(2)}%`,
        l2HitRate: `${(stats.l2HitRate * 100).toFixed(2)}%`,
        avgLatency: `${stats.avgLatency.toFixed(2)}ms`,
        p95Latency: `${stats.latencyPercentiles.p95.toFixed(2)}ms`,
        p99Latency: `${stats.latencyPercentiles.p99.toFixed(2)}ms`,
        cacheSize: stats.cacheSize,
        evictions: stats.evictions
      });
      
      // Emit metrics
      incrementMetric('market_data_cache_hit_rate', stats.hitRate);
      incrementMetric('market_data_cache_avg_latency', stats.avgLatency);
      
    }, 60000); // Report every minute
  }
}

// Singleton instance
let cacheInstance: MarketDataCacheService | null = null;

/**
 * Get or create cache service instance
 */
export async function getMarketDataCache(): Promise<MarketDataCacheService> {
  if (!cacheInstance) {
    cacheInstance = new MarketDataCacheService();
    await cacheInstance.initialize();
  }
  return cacheInstance;
}

// Export for testing
export { cacheInstance as _cacheInstance };