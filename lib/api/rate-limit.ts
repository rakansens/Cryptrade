import { env } from '@/config/env';
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
    
    return {
      success: current <= config.maxRequests,
      remainingRequests,
      resetTime,
      retryAfter: current > config.maxRequests ? resetTime - now : undefined,
    };
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
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
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
    
    return {
      success: current <= config.maxRequests,
      remainingRequests,
      resetTime,
      retryAfter: current > config.maxRequests ? resetTime - now : undefined,
    };
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
  
  return {
    success: entry.count <= config.maxRequests,
    remainingRequests,
    resetTime,
    retryAfter: entry.count > config.maxRequests ? resetTime - now : undefined,
  };
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
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    try {
      return await vercelKVRateLimit(key, config);
    } catch (error) {
      console.warn('[RateLimit] Vercel KV failed:', error);
    }
  }
  
  // Try Upstash Redis second (if available)
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
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
  const forwarded = request.headers?.get?.('x-forwarded-for') || request.headers?.['x-forwarded-for'];
  const realIp = request.headers?.get?.('x-real-ip') || request.headers?.['x-real-ip'];
  const cfConnectingIp = request.headers?.get?.('cf-connecting-ip') || request.headers?.['cf-connecting-ip'];
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  
  // For additional security, combine IP with User-Agent (truncated)
  const userAgent = request.headers?.get?.('user-agent') || request.headers?.['user-agent'] || '';
  return `${ip}:${userAgent.slice(0, 50)}`;
}

// Export types for external use
export type { RateLimitConfig, RateLimitResult };