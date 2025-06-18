import { Redis } from 'ioredis';
import { logger } from '@/lib/logging';

// Helper function for optional env vars not in schema
function getOptionalEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

function getOptionalEnvVarInt(key: string, defaultValue: number): number {
  const value = getOptionalEnvVar(key);
  return value ? parseInt(value, 10) : defaultValue;
}

interface RateLimitConfig {
  windowSec: number;
  maxRequests: number;
  keyPrefix?: string;
  enablePersistence?: boolean;
}

interface RateLimitResult {
  success: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
}

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number | void;
  maxRetriesPerRequest?: number;
  enableOfflineQueue?: boolean;
  lazyConnect?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;
  enableReadyCheck?: boolean;
  // Persistence configuration
  save?: string[];
  appendonly?: 'yes' | 'no';
  appendfsync?: 'always' | 'everysec' | 'no';
}

/**
 * Redis-based rate limiter with persistence support
 */
export class RedisRateLimiter {
  private redis: Redis | null = null;
  private isConnected = false;
  private readonly maxConnectionRetries = 5;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly config: RedisConfig;
  private readonly keyPrefix: string = 'ratelimit';

  constructor(config?: Partial<RedisConfig>) {
    this.config = {
      host: getOptionalEnvVar('REDIS_HOST') || 'localhost',
      port: getOptionalEnvVarInt('REDIS_PORT', 6379),
      password: getOptionalEnvVar('REDIS_PASSWORD'),
      db: getOptionalEnvVarInt('REDIS_DB', 0),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 10000,
      enableReadyCheck: true,
      // Persistence defaults
      save: ['900 1', '300 10', '60 10000'], // Save after 900s if 1 key changed, etc.
      appendonly: 'yes',
      appendfsync: 'everysec',
      ...config,
      retryStrategy: this.retryStrategy.bind(this),
    };
  }

  /**
   * Custom retry strategy for Redis connection
   */
  private retryStrategy(times: number): number | void {
    if (times > this.maxConnectionRetries) {
      logger.error('[RedisRateLimiter] Max connection retries exceeded');
      return undefined; // Stop retrying
    }

    const delay = Math.min(times * 1000, 5000); // Max 5 seconds
    logger.warn(`[RedisRateLimiter] Retrying connection in ${delay}ms (attempt ${times})`);
    return delay;
  }

  /**
   * Initialize Redis connection with retry logic
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.redis) {
      return;
    }

    try {
      this.redis = new Redis(this.config);

      // Set up event handlers
      this.redis.on('connect', () => {
        logger.info('[RedisRateLimiter] Connected to Redis');
      });

      this.redis.on('ready', () => {
        logger.info('[RedisRateLimiter] Redis ready');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('[RedisRateLimiter] Redis error:', { error });
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('[RedisRateLimiter] Redis connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', (delay: number) => {
        logger.info(`[RedisRateLimiter] Reconnecting to Redis in ${delay}ms`);
      });

      // Wait for connection
      await this.redis.connect();

      // Configure persistence if enabled
      if (this.config.appendonly === 'yes') {
        await this.configurePersistence();
      }

      // Start health check monitoring
      this.startHealthCheck();

    } catch (error) {
      logger.error('[RedisRateLimiter] Failed to connect to Redis:', { error });
      throw error;
    }
  }

  /**
   * Configure Redis persistence settings
   */
  private async configurePersistence(): Promise<void> {
    if (!this.redis) return;

    try {
      // Enable AOF (Append Only File) for persistence
      await this.redis.config('SET', 'appendonly', this.config.appendonly!);
      await this.redis.config('SET', 'appendfsync', this.config.appendfsync!);

      // Configure save points
      if (this.config.save && this.config.save.length > 0) {
        const saveConfig = this.config.save.join(' ');
        await this.redis.config('SET', 'save', saveConfig);
      }

      logger.info('[RedisRateLimiter] Persistence configured successfully');
    } catch (error) {
      logger.error('[RedisRateLimiter] Failed to configure persistence:', { error });
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check Redis health and connection status
   */
  async checkHealth(): Promise<{ healthy: boolean; latency?: number; info?: any }> {
    if (!this.redis) {
      return { healthy: false };
    }

    try {
      const start = Date.now();
      const pong = await this.redis.ping();
      const latency = Date.now() - start;

      if (pong !== 'PONG') {
        throw new Error('Invalid ping response');
      }

      // Get Redis info for monitoring
      const info = await this.redis.info();
      const memoryInfo = await this.redis.info('memory');

      return {
        healthy: true,
        latency,
        info: {
          connected_clients: this.parseInfo(info, 'connected_clients'),
          used_memory_human: this.parseInfo(memoryInfo, 'used_memory_human'),
          total_commands_processed: this.parseInfo(info, 'total_commands_processed'),
        },
      };
    } catch (error) {
      logger.error('[RedisRateLimiter] Health check failed:', { error });
      return { healthy: false };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseInfo(info: string, key: string): string | undefined {
    const match = info.match(new RegExp(`^${key}:(.+)$`, 'm'));
    return match?.[1]?.trim();
  }

  /**
   * Check rate limit with persistence
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig = { windowSec: 60, maxRequests: 60 }
  ): Promise<RateLimitResult> {
    if (!this.isConnected || !this.redis) {
      await this.connect();
    }

    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / config.windowSec);
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}:${window}`;
    const resetTime = (window + 1) * config.windowSec;
    const ttl = config.windowSec;

    try {
      // Use pipeline for atomic operations
      const pipeline = this.redis!.pipeline();
      
      // Increment counter
      pipeline.incr(key);
      
      // Set TTL only if key is new (NX flag)
      pipeline.expire(key, ttl, 'NX');
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      if (!results || results.length < 2) {
        throw new Error('Pipeline execution failed');
      }

      const [incrResult] = results;
      
      if (incrResult && incrResult[0] !== null) {
        throw incrResult[0];
      }

      const current = (incrResult?.[1] as number) || 0;
      const remainingRequests = Math.max(0, config.maxRequests - current);

      const result: RateLimitResult = {
        success: current <= config.maxRequests,
        remainingRequests,
        resetTime,
      };

      if (current > config.maxRequests) {
        result.retryAfter = resetTime - now;
      }

      return result;

    } catch (error) {
      logger.error('[RedisRateLimiter] Rate limit check failed:', { error });
      
      // Fallback behavior on error
      if (getOptionalEnvVar('RATE_LIMIT_FAIL_OPEN') === 'true') {
        // Fail open - allow request
        return {
          success: true,
          remainingRequests: config.maxRequests,
          resetTime,
        };
      } else {
        // Fail closed - deny request
        return {
          success: false,
          remainingRequests: 0,
          resetTime,
          retryAfter: config.windowSec,
        };
      }
    }
  }

  /**
   * Get current usage for an identifier
   */
  async getUsage(
    identifier: string,
    config: RateLimitConfig = { windowSec: 60, maxRequests: 60 }
  ): Promise<{ current: number; remaining: number; resetTime: number }> {
    if (!this.isConnected || !this.redis) {
      await this.connect();
    }

    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / config.windowSec);
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}:${window}`;
    const resetTime = (window + 1) * config.windowSec;

    try {
      const current = await this.redis!.get(key);
      const count = current ? parseInt(current, 10) : 0;

      return {
        current: count,
        remaining: Math.max(0, config.maxRequests - count),
        resetTime,
      };
    } catch (error) {
      logger.error('[RedisRateLimiter] Failed to get usage:', { error });
      return {
        current: 0,
        remaining: config.maxRequests,
        resetTime,
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, config: RateLimitConfig = { windowSec: 60, maxRequests: 60 }): Promise<void> {
    if (!this.isConnected || !this.redis) {
      await this.connect();
    }

    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / config.windowSec);
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}:${window}`;

    try {
      await this.redis!.del(key);
      logger.info(`[RedisRateLimiter] Reset rate limit for ${identifier}`);
    } catch (error) {
      logger.error('[RedisRateLimiter] Failed to reset rate limit:', { error });
      throw error;
    }
  }

  /**
   * Clean up expired keys (housekeeping)
   */
  async cleanup(): Promise<number> {
    if (!this.isConnected || !this.redis) {
      await this.connect();
    }

    try {
      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis!.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.redis!.pipeline();
      let expiredCount = 0;

      for (const key of keys) {
        const ttl = await this.redis!.ttl(key);
        if (ttl === -1) {
          // Key has no TTL, likely expired
          pipeline.del(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        await pipeline.exec();
      }

      logger.info(`[RedisRateLimiter] Cleaned up ${expiredCount} expired keys`);
      return expiredCount;

    } catch (error) {
      logger.error('[RedisRateLimiter] Cleanup failed:', { error });
      return 0;
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info('[RedisRateLimiter] Disconnected from Redis');
    }
  }

  /**
   * Get Redis metrics for monitoring
   */
  async getMetrics(): Promise<{
    connected: boolean;
    latency?: number;
    memoryUsage?: string;
    totalCommands?: string;
    connectedClients?: string;
    keyCount?: number;
  }> {
    const health = await this.checkHealth();
    
    const metrics: any = {
      connected: health.healthy,
      latency: health.latency,
    };

    if (health.info) {
      metrics.memoryUsage = health.info.used_memory_human;
      metrics.totalCommands = health.info.total_commands_processed;
      metrics.connectedClients = health.info.connected_clients;
    }

    if (this.redis && this.isConnected) {
      try {
        metrics.keyCount = await this.redis.dbsize();
      } catch (error) {
        logger.error('[RedisRateLimiter] Failed to get key count:', { error });
      }
    }

    return metrics;
  }
}

// Singleton instance
let rateLimiterInstance: RedisRateLimiter | null = null;

/**
 * Get or create Redis rate limiter instance
 */
export async function getRedisRateLimiter(): Promise<RedisRateLimiter> {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RedisRateLimiter();
    await rateLimiterInstance.connect();
  }
  return rateLimiterInstance;
}

/**
 * Express/Next.js middleware
 */
export function createRedisRateLimitMiddleware(config?: RateLimitConfig) {
  return async (identifier: string): Promise<RateLimitResult> => {
    const limiter = await getRedisRateLimiter();
    return limiter.checkLimit(identifier, config);
  };
}

// Export types
export type { RateLimitConfig, RateLimitResult };