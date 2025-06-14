import { createTool } from '@mastra/core';
import { env } from '@/config/env';
import { z } from 'zod';
import { BaseService } from '@/lib/api/base-service';
import { APP_CONSTANTS } from '@/config/app-constants';
import { incrementMetric } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';
import { CircuitBreaker } from '@/lib/utils/retry-with-circuit-breaker';

/**
 * Resilient Market Data Tool - With Retry and Circuit Breaker
 * 
 * Enhanced version of market data tool with:
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Metrics tracking
 * - Configurable resilience settings
 */

const MarketDataInput = z.object({
  symbol: z.string()
    .min(1, 'Symbol is required')
    .regex(/^[A-Z]{2,10}USDT?$/i, 'Invalid symbol format (e.g., BTCUSDT)')
    .transform(s => s.toUpperCase()),
});

const MarketDataOutput = z.object({
  symbol: z.string(),
  currentPrice: z.number(),
  priceChange24h: z.number(),
  priceChangePercent24h: z.number(),
  volume24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  analysis: z.object({
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    volatility: z.enum(['low', 'medium', 'high']),
    recommendation: z.string(),
  }),
  metadata: z.object({
    fromCache: z.boolean().optional(),
    retryCount: z.number().optional(),
    latency: z.number().optional(),
  }).optional(),
});

// Market data service instance using BaseService
class MarketDataService extends BaseService {
  constructor() {
    super('https://api.binance.com/api/v3'); // Binance API base URL
  }

  async get24hrTicker(symbol: string) {
    return this.get<BinanceTicker24hr>('/ticker/24hr', { symbol });
  }
}

const marketDataService = new MarketDataService();

// Enhanced cache structure with dynamic TTL
interface CacheEntry {
  data: MarketStatsResult;
  timestamp: number;
  ttl: number; // Individual TTL for this entry
  volatility?: number; // Store volatility for monitoring
}

const marketDataCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 30000; // 30 seconds default
const MIN_CACHE_TTL = 5000; // 5 seconds minimum
const MAX_CACHE_TTL = 60000; // 60 seconds maximum

// Circuit breaker instance for market data API
const marketDataCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenAttempts: 3,
});

// Dynamic TTL calculation based on volatility
function calculateDynamicTTL(symbol: string, volatility: number): number {
  // High volatility = shorter TTL, low volatility = longer TTL
  const VOLATILITY_THRESHOLDS = {
    high: 5.0,    // 5%+ change = 5-10s TTL
    medium: 2.0,  // 2-5% change = 10-20s TTL
    low: 0.5,     // <0.5% change = 20-60s TTL
  };
  
  // Major pairs update more frequently
  const MAJOR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
  const isMajorPair = MAJOR_PAIRS.includes(symbol.toUpperCase());
  
  let ttl: number;
  
  if (volatility >= VOLATILITY_THRESHOLDS.high) {
    ttl = isMajorPair ? MIN_CACHE_TTL : 8000; // 5-8 seconds for high volatility
  } else if (volatility >= VOLATILITY_THRESHOLDS.medium) {
    ttl = isMajorPair ? 10000 : 15000; // 10-15 seconds for medium volatility
  } else {
    ttl = isMajorPair ? 20000 : DEFAULT_CACHE_TTL; // 20-30 seconds for low volatility
  }
  
  // Adjust for market hours (UTC)
  const hour = new Date().getUTCHours();
  const isActiveHours = (hour >= 13 && hour < 21) || // US market hours
                       (hour >= 8 && hour < 16) ||  // European hours
                       (hour >= 0 && hour < 8);     // Asian hours
  
  if (isActiveHours) {
    ttl = Math.max(MIN_CACHE_TTL, ttl * 0.8); // 20% shorter during active hours
  }
  
  // Weekend adjustment
  const dayOfWeek = new Date().getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    ttl = Math.min(MAX_CACHE_TTL, ttl * 1.5); // 50% longer on weekends
  }
  
  logger.debug('[Market Data] Dynamic TTL calculated', {
    symbol,
    volatility: `${volatility.toFixed(2)}%`,
    ttl: `${(ttl / 1000).toFixed(1)}s`,
    isMajorPair,
    isActiveHours,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  });
  
  return Math.min(Math.max(ttl, MIN_CACHE_TTL), MAX_CACHE_TTL);
}

// Export cache config for testing
export const getCacheConfig = () => ({ 
  defaultTtl: DEFAULT_CACHE_TTL,
  minTtl: MIN_CACHE_TTL,
  maxTtl: MAX_CACHE_TTL,
});

export const marketDataResilientTool = createTool({
  id: 'get-market-data-resilient',
  name: 'marketDataResilientTool',  // エージェントが参照する名前
  description: `
    Fetch real-time market data with enhanced resilience.
    Features retry logic, circuit breaker pattern, and caching.
    Automatically handles Binance API failures with exponential backoff.
    Provides fallback data when service is unavailable.
  `,
  inputSchema: MarketDataInput,
  outputSchema: MarketDataOutput,
  
  execute: async ({ context }): Promise<z.infer<typeof MarketDataOutput>> => {
    const { symbol } = context;
    const startTime = Date.now();
    
    logger.info('[Market Data Tool] Execute called', {
      symbol,
      timestamp: new Date().toISOString()
    });
    
    // Check cache with dynamic TTL
    const cached = marketDataCache.get(symbol);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      const isValid = age < cached.ttl;
      
      if (isValid) {
        logger.info(`[Market Data Resilient] Cache hit for ${symbol}`, {
          age: `${(age / 1000).toFixed(1)}s`,
          ttl: `${(cached.ttl / 1000).toFixed(1)}s`,
          remainingTtl: `${((cached.ttl - age) / 1000).toFixed(1)}s`,
          volatility: cached.volatility ? `${cached.volatility.toFixed(2)}%` : 'unknown',
        });
        incrementMetric('market_data_cache_hits');
        return {
          ...cached.data,
          metadata: {
            fromCache: true,
            latency: Date.now() - startTime,
            cacheAge: age,
            cacheTtl: cached.ttl,
          }
        };
      } else {
        logger.debug(`[Market Data Resilient] Cache expired for ${symbol}`, {
          age: `${(age / 1000).toFixed(1)}s`,
          ttl: `${(cached.ttl / 1000).toFixed(1)}s`,
        });
      }
    }
    
    incrementMetric('market_data_requests');
    
    // Check circuit breaker before making request
    if (!marketDataCircuitBreaker.shouldAllowRequest()) {
      logger.warn(`[Market Data Resilient] Circuit breaker is OPEN for ${symbol}`);
      incrementMetric('market_data_circuit_open');
      
      // Try to use stale cache if available
      const staleCache = marketDataCache.get(symbol);
      if (staleCache) {
        logger.warn(`[Market Data Resilient] Using stale cache for ${symbol}`);
        return {
          ...staleCache.data,
          metadata: {
            fromCache: true,
            latency: Date.now() - startTime,
          }
        };
      }
      
      // If no cache, throw error
      const error = new Error('Circuit breaker is OPEN');
      (error as Error & { code?: string }).code = 'CIRCUIT_OPEN';
      throw error;
    }
    
    try {
      logger.info(`[Market Data Resilient] Fetching ${symbol}`, {
        symbol,
        note: 'Using BaseService with built-in retry/circuit breaker'
      });
      
      const apiResponse = await marketDataService.get24hrTicker(symbol);
      const result = apiResponse.data;

      // Process successful response
      const currentPrice = parseFloat(result.lastPrice);
      const priceChange24h = parseFloat(result.priceChange);
      const priceChangePercent24h = parseFloat(result.priceChangePercent);
      const volume24h = parseFloat(result.volume);
      const high24h = parseFloat(result.highPrice);
      const low24h = parseFloat(result.lowPrice);

      const analysis = analyzeMarketData({
        priceChangePercent24h,
        volume24h,
        high24h,
        low24h,
        currentPrice,
      });

      // Calculate volatility for dynamic TTL
      const volatility = Math.abs(priceChangePercent24h);
      const dynamicTTL = calculateDynamicTTL(symbol, volatility);

      const marketData = {
        symbol,
        currentPrice,
        priceChange24h,
        priceChangePercent24h,
        volume24h,
        high24h,
        low24h,
        analysis,
        metadata: {
          fromCache: false,
          latency: Date.now() - startTime,
          volatility,
          ttl: dynamicTTL,
        }
      };

      // Update cache with dynamic TTL
      marketDataCache.set(symbol, {
        data: marketData,
        timestamp: Date.now(),
        ttl: dynamicTTL,
        volatility,
      });
      
      logger.info(`[Market Data Resilient] Cache updated with dynamic TTL`, {
        symbol,
        ttl: `${(dynamicTTL / 1000).toFixed(1)}s`,
        volatility: `${volatility.toFixed(2)}%`,
        reason: volatility >= 5 ? 'high-volatility' : 
                volatility >= 2 ? 'medium-volatility' : 'low-volatility',
      });

      // Record success in circuit breaker
      marketDataCircuitBreaker.recordSuccess();
      
      incrementMetric('market_data_success');
      logger.info(`[Market Data Resilient] Successfully fetched ${symbol}`, {
        latency: Date.now() - startTime,
        circuitState: marketDataCircuitBreaker.getState(),
        currentPrice,
        priceChangePercent24h
      });

      return marketData;

    } catch (error) {
      incrementMetric('market_data_failures');
      
      // Record failure in circuit breaker
      marketDataCircuitBreaker.recordFailure(error);
      
      // Log circuit breaker metrics
      const cbMetrics = marketDataCircuitBreaker.getMetrics();
      logger.error(`[Market Data Resilient] Failed to fetch ${symbol}`, {
        error: error.message,
        circuitBreakerState: cbMetrics.state,
        failureCount: cbMetrics.failureCount,
      });

      // If circuit is open, return degraded response immediately
      if (error.code === 'CIRCUIT_OPEN') {
        incrementMetric('market_data_circuit_open');
        
        // Try to use stale cache if available
        const staleCache = marketDataCache.get(symbol);
        if (staleCache) {
          const age = Date.now() - staleCache.timestamp;
          logger.warn(`[Market Data Resilient] Using stale cache for ${symbol}`, {
            age: `${(age / 1000).toFixed(1)}s`,
            originalTtl: `${(staleCache.ttl / 1000).toFixed(1)}s`,
            reason: 'circuit-breaker-open',
          });
          return {
            ...staleCache.data,
            metadata: {
              fromCache: true,
              isStale: true,
              latency: Date.now() - startTime,
              cacheAge: age,
            }
          };
        }
      }

      // Fallback to mock data
      logger.warn(`[Market Data Resilient] Using fallback data for ${symbol}`);
      incrementMetric('market_data_fallback');
      
      const mockPrice = 50000 + Math.random() * 20000;
      const mockChange = (Math.random() - 0.5) * 10;
      
      return {
        symbol,
        currentPrice: mockPrice,
        priceChange24h: mockPrice * (mockChange / 100),
        priceChangePercent24h: mockChange,
        volume24h: 1000000 + Math.random() * 5000000,
        high24h: mockPrice * 1.05,
        low24h: mockPrice * 0.95,
        analysis: {
          trend: (mockChange > 2 ? 'bullish' : mockChange < -2 ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
          volatility: (Math.abs(mockChange) > 5 ? 'high' : Math.abs(mockChange) > 2 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
          recommendation: '⚠️ 注意: この価格は参考値です。実際の市場データが一時的に利用できないため、仮の値を表示しています。',
        },
        metadata: {
          fromCache: false,
          latency: Date.now() - startTime,
          isFallback: true,  // フォールバックフラグを追加
        }
      };
    }
  },
});

/**
 * Get circuit breaker status for monitoring
 */
export function getMarketDataCircuitBreakerStatus() {
  return marketDataCircuitBreaker.getMetrics();
}

/**
 * Reset circuit breaker (for admin/recovery)
 */
export function resetMarketDataCircuitBreaker() {
  marketDataCircuitBreaker.reset();
  logger.info('[Market Data Resilient] Circuit breaker manually reset');
}

/**
 * Clear market data cache
 */
export function clearMarketDataCache() {
  marketDataCache.clear();
  logger.info('[Market Data Resilient] Cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{
    symbol: string;
    age: number;
    ttl: number;
    volatility?: number;
    isExpired: boolean;
  }>;
} {
  const entries = Array.from(marketDataCache.entries()).map(([symbol, entry]) => {
    const age = Date.now() - entry.timestamp;
    return {
      symbol,
      age,
      ttl: entry.ttl,
      volatility: entry.volatility,
      isExpired: age >= entry.ttl,
    };
  });
  
  return {
    size: marketDataCache.size,
    entries,
  };
}

/**
 * Simple market data analysis (reused from original)
 */
function analyzeMarketData({
  priceChangePercent24h,
  volume24h,
  high24h,
  low24h,
  currentPrice,
}: {
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  currentPrice: number;
}) {
  // Trend determination
  let trend: 'bullish' | 'bearish' | 'neutral';
  if (priceChangePercent24h > 3) {
    trend = 'bullish';
  } else if (priceChangePercent24h < -3) {
    trend = 'bearish';
  } else {
    trend = 'neutral';
  }

  // Volatility calculation
  const priceRange = ((high24h - low24h) / currentPrice) * 100;
  let volatility: 'low' | 'medium' | 'high';
  if (priceRange > 8) {
    volatility = 'high';
  } else if (priceRange > 4) {
    volatility = 'medium';
  } else {
    volatility = 'low';
  }

  // Generate recommendation
  let recommendation: string;
  if (trend === 'bullish' && volatility === 'low') {
    recommendation = 'Stable upward momentum - consider gradual position building';
  } else if (trend === 'bearish' && volatility === 'high') {
    recommendation = 'High volatility decline - exercise caution, wait for stabilization';
  } else if (volatility === 'high') {
    recommendation = 'High volatility detected - use smaller position sizes and tight stops';
  } else {
    recommendation = 'Monitor key support/resistance levels for breakout opportunities';
  }

  return {
    trend,
    volatility,
    recommendation,
  };
}