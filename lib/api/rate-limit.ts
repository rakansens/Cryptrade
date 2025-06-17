import { edgeEnv } from '@/config/env-edge';
import { NextRequest } from 'next/server';
// Production-ready rate limiting with persistent storage
// Supports both Vercel KV and Upstash Redis

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
    console.warn('[RateLimit] Vercel KV unavailable, falling back to memory');
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
    console.warn('[RateLimit] Upstash Redis unavailable, falling back to memory');
    throw error;
  }
}

/**
 * Memory-based fallback (for development/testing)
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

// Export for testing purposes
export { memoryStore };

/**
 * Main rate limiting function with automatic fallback
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
  
  // Fallback to memory-based rate limiting
  console.warn('[RateLimit] Using memory fallback (not suitable for production)');
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

// Export types for external use
export type { RateLimitConfig, RateLimitResult };