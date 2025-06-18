import { edgeEnv } from '@/config/env-edge';
import { env } from '@/config/env';
import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs/promises';

// Helper function for optional env vars not in schema
function getOptionalEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

// Production-ready rate limiting with persistent storage fallback
// Supports Vercel KV, Upstash Redis, and SQLite fallback

interface RateLimitConfig {
  windowSec: number;
  maxRequests: number;
}

interface RateLimitResult {
  success: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * SQLite-based persistent rate limiting fallback
 * Provides persistence across server restarts
 */
class SQLiteRateLimiter {
  private db: any = null;
  private initialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Dynamic import for server-side only
      const Database = (await import('better-sqlite3')).default;
      
      // Use data directory for persistence
      const dbPath = getOptionalEnvVar('RATE_LIMIT_DB_PATH') || './data/rate-limit.db';
      
      // Ensure directory exists
      const dir = path.dirname(dbPath);
      await fs.mkdir(dir, { recursive: true });
      
      this.db = new Database(dbPath);
      
      // Create table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_time INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_reset_time ON rate_limits(reset_time);
      `);
      
      // Clean up expired entries every minute
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
      
      this.initialized = true;
      console.log('[RateLimit] SQLite persistence initialized');
    } catch (error) {
      console.error('[RateLimit] SQLite initialization failed:', error);
      throw error;
    }
  }
  
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.initialized) {
      await this.init();
    }
    
    const now = Math.floor(Date.now() / 1000);
    const bucket = `${key}:${Math.floor(now / config.windowSec)}`;
    const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
    
    // Get current entry
    const stmt = this.db.prepare('SELECT count, reset_time FROM rate_limits WHERE key = ?');
    const entry = stmt.get(bucket) as RateLimitEntry | undefined;
    
    if (!entry || now >= entry.resetTime) {
      // Create new entry
      const insertStmt = this.db.prepare(
        'INSERT OR REPLACE INTO rate_limits (key, count, reset_time) VALUES (?, ?, ?)'
      );
      insertStmt.run(bucket, 1, resetTime);
      
      return {
        success: true,
        remainingRequests: config.maxRequests - 1,
        resetTime,
      };
    }
    
    // Update count
    const newCount = entry.count + 1;
    const updateStmt = this.db.prepare(
      'UPDATE rate_limits SET count = ? WHERE key = ?'
    );
    updateStmt.run(newCount, bucket);
    
    const remainingRequests = Math.max(0, config.maxRequests - newCount);
    
    const result: RateLimitResult = {
      success: newCount <= config.maxRequests,
      remainingRequests,
      resetTime,
    };
    
    if (newCount > config.maxRequests) {
      result.retryAfter = resetTime - now;
    }
    
    return result;
  }
  
  private cleanup(): void {
    if (!this.db) return;
    
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('DELETE FROM rate_limits WHERE reset_time < ?');
    const result = stmt.run(now);
    
    if (result.changes > 0) {
      console.log(`[RateLimit] Cleaned up ${result.changes} expired entries`);
    }
  }
  
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.initialized = false;
  }
}

// Singleton instance for SQLite fallback
let sqliteRateLimiter: SQLiteRateLimiter | null = null;

/**
 * Get or create SQLite rate limiter instance
 */
async function getSQLiteRateLimiter(): Promise<SQLiteRateLimiter> {
  if (!sqliteRateLimiter) {
    sqliteRateLimiter = new SQLiteRateLimiter();
    await sqliteRateLimiter.init();
  }
  return sqliteRateLimiter;
}

/**
 * Vercel KV implementation (when available)
 */
async function vercelKVRateLimit(
  key: string, 
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Dynamic import to avoid errors when @vercel/kv is not available
    const kvModule = await import('@vercel' + '/kv').catch(() => null);
    if (!kvModule) throw new Error('Vercel KV not available');
    const { kv } = kvModule;
    
    const now = Math.floor(Date.now() / 1000);
    const bucket = `ratelimit:${key}:${Math.floor(now / config.windowSec)}`;
    
    const current = await kv.incr(bucket);
    
    // Set expiration on first request
    if (current === 1) {
      await kv.expire(bucket, config.windowSec);
    }
    
    const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
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
    console.warn('[RateLimit] Vercel KV unavailable, falling back');
    throw error;
  }
}

/**
 * Upstash Redis implementation (when available)
 */
async function upstashRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Dynamic import to avoid errors when @upstash/redis is not available
    const redisModule = await import('@upstash' + '/redis').catch(() => null);
    if (!redisModule) throw new Error('Upstash Redis not available');
    const { Redis } = redisModule;
    
    const redis = new Redis({
      url: edgeEnv.UPSTASH_REDIS_REST_URL!,
      token: edgeEnv.UPSTASH_REDIS_REST_TOKEN!,
    });
    
    const now = Math.floor(Date.now() / 1000);
    const bucket = `ratelimit:${key}:${Math.floor(now / config.windowSec)}`;
    
    const pipeline = redis.pipeline();
    pipeline.incr(bucket);
    pipeline.expire(bucket, config.windowSec);
    
    const results = await pipeline.exec();
    const current = results[0] as number;
    
    const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
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
    console.warn('[RateLimit] Upstash Redis unavailable, falling back');
    throw error;
  }
}

/**
 * Memory-based fallback (last resort, not persistent)
 */
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const bucket = `${key}:${Math.floor(now / config.windowSec)}`;
  
  // Clean up expired entries
  for (const [storeKey, value] of memoryStore.entries()) {
    if (now > value.resetTime) {
      memoryStore.delete(storeKey);
    }
  }
  
  const entry = memoryStore.get(bucket);
  const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
  
  if (!entry) {
    memoryStore.set(bucket, { count: 1, resetTime });
    return {
      success: true,
      remainingRequests: config.maxRequests - 1,
      resetTime,
    };
  }
  
  entry.count++;
  const remainingRequests = Math.max(0, config.maxRequests - entry.count);
  
  const result: RateLimitResult = {
    success: entry.count <= config.maxRequests,
    remainingRequests,
    resetTime,
  };
  
  if (entry.count > config.maxRequests) {
    result.retryAfter = resetTime - now;
  }
  
  return result;
}

/**
 * Main rate limiting function with automatic fallback
 * Tries in order: Vercel KV -> Upstash Redis -> SQLite -> Memory
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowSec: 60, maxRequests: 60 }
): Promise<RateLimitResult> {
  const key = `api:${identifier}`;
  
  // Try Vercel KV first (if available)
  if (edgeEnv.KV_REST_API_URL && edgeEnv.KV_REST_API_TOKEN) {
    try {
      return await vercelKVRateLimit(key, config);
    } catch (error) {
      console.warn('[RateLimit] Vercel KV failed:', error);
    }
  }
  
  // Try Upstash Redis second (if available)
  if (edgeEnv.UPSTASH_REDIS_REST_URL && edgeEnv.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashRedisRateLimit(key, config);
    } catch (error) {
      console.warn('[RateLimit] Upstash Redis failed:', error);
    }
  }
  
  // Try SQLite fallback for persistent storage (server-side only)
  if (typeof window === 'undefined' && env.NODE_ENV !== 'test') {
    try {
      const limiter = await getSQLiteRateLimiter();
      return await limiter.checkLimit(key, config);
    } catch (error) {
      console.error('[RateLimit] SQLite fallback failed:', error);
    }
  }
  
  // Final fallback to memory-based rate limiting
  console.warn('[RateLimit] Using memory fallback (not persistent across restarts)');
  return memoryRateLimit(key, config);
}

/**
 * Express/Next.js middleware wrapper
 */
export function createRateLimitMiddleware(config?: RateLimitConfig) {
  return async (identifier: string): Promise<RateLimitResult> => {
    return checkRateLimit(identifier, config);
  };
}

/**
 * Utility to get client identifier from request
 */
export function getClientIdentifier(request: NextRequest | Request | { headers: Headers | Record<string, string | string[]> }): string {
  // Try to get real IP from various headers
  let forwarded: string | string[] | null | undefined;
  let realIp: string | string[] | null | undefined;
  let cfConnectingIp: string | string[] | null | undefined;
  let userAgent: string | string[] | undefined = '';
  
  if ('headers' in request) {
    const headers = request.headers;
    if ('get' in headers && typeof headers.get === 'function') {
      // NextRequest or standard Headers
      forwarded = headers.get('x-forwarded-for');
      realIp = headers.get('x-real-ip');
      cfConnectingIp = headers.get('cf-connecting-ip');
      userAgent = headers.get('user-agent') || '';
    } else {
      // Plain object headers
      const h = headers as Record<string, string | string[]>;
      forwarded = h['x-forwarded-for'];
      realIp = h['x-real-ip'];
      cfConnectingIp = h['cf-connecting-ip'];
      userAgent = h['user-agent'] || '';
    }
  }
  
  const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp;
  const cfStr = Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  const userAgentStr = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  
  const ip = forwardedStr?.split(',')[0] || realIpStr || cfStr || 'unknown';
  
  // For additional security, combine IP with User-Agent (truncated)
  return `${ip}:${userAgentStr?.slice(0, 50) ?? ''}`;
}

// Cleanup function for graceful shutdown
export async function cleanupRateLimiter(): Promise<void> {
  if (sqliteRateLimiter) {
    await sqliteRateLimiter.close();
    sqliteRateLimiter = null;
  }
}

// Export for testing purposes
export { memoryStore };

// Export types for external use
export type { RateLimitConfig, RateLimitResult };