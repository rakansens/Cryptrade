import { NextRequest } from 'next/server';
import { env } from '@/config/env';

// Edge Runtime compatible rate limiting using KV storage only

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
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  return xRealIp || cfConnectingIp || 'unknown';
}

/**
 * Edge-compatible rate limiter using Vercel KV or Upstash Redis
 */
class EdgeRateLimiter {
  private kvClient: any = null;
  private initialized = false;
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Get environment variables using compatible method
      const kvUrl = env.KV_REST_API_URL;
      const kvToken = env.KV_REST_API_TOKEN;
      const upstashUrl = env.UPSTASH_REDIS_REST_URL;
      const upstashToken = env.UPSTASH_REDIS_REST_TOKEN;
      
      // Check for Vercel KV
      if (kvUrl && kvToken) {
        const { kv } = await import('@vercel/kv');
        this.kvClient = kv;
        this.initialized = true;
        console.log('[RateLimit] Using Vercel KV for rate limiting');
        return;
      }
      
      // Check for Upstash Redis
      if (upstashUrl && upstashToken) {
        const { Redis } = await import('@upstash/redis');
        this.kvClient = new Redis({
          url: upstashUrl,
          token: upstashToken,
        });
        this.initialized = true;
        console.log('[RateLimit] Using Upstash Redis for rate limiting');
        return;
      }
      
      console.warn('[RateLimit] No KV storage available, using in-memory fallback');
    } catch (error) {
      console.error('[RateLimit] KV initialization failed:', error);
    }
  }
  
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.initialized) {
      await this.init();
    }
    
    const now = Math.floor(Date.now() / 1000);
    const bucket = `rate_limit:${key}:${Math.floor(now / config.windowSec)}`;
    const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
    
    // If no KV available, allow all requests (fail open)
    if (!this.kvClient) {
      return {
        success: true,
        remainingRequests: config.maxRequests,
        resetTime,
      };
    }
    
    try {
      // Get current count
      const count = await this.kvClient.get(bucket) || 0;
      
      if (count >= config.maxRequests) {
        return {
          success: false,
          remainingRequests: 0,
          resetTime,
          retryAfter: resetTime - now,
        };
      }
      
      // Increment count with TTL
      const newCount = await this.kvClient.incr(bucket);
      if (newCount === 1) {
        // Set expiry on first request
        await this.kvClient.expire(bucket, config.windowSec);
      }
      
      return {
        success: true,
        remainingRequests: Math.max(0, config.maxRequests - newCount),
        resetTime,
      };
    } catch (error) {
      console.error('[RateLimit] KV operation failed:', error);
      // Fail open on error
      return {
        success: true,
        remainingRequests: config.maxRequests,
        resetTime,
      };
    }
  }
}

// Singleton instance
const rateLimiter = new EdgeRateLimiter();

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return rateLimiter.checkLimit(identifier, config);
}

/**
 * In-memory rate limiter fallback for Edge Runtime
 */
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
if (typeof globalThis !== 'undefined' && typeof globalThis.setInterval === 'function') {
  globalThis.setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of memoryStore.entries()) {
      if (now >= entry.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

/**
 * In-memory rate limit check (fallback)
 */
export function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const bucket = `${identifier}:${Math.floor(now / config.windowSec)}`;
  const resetTime = (Math.floor(now / config.windowSec) + 1) * config.windowSec;
  
  const entry = memoryStore.get(bucket);
  
  if (!entry || now >= entry.resetTime) {
    // Create new entry
    memoryStore.set(bucket, { count: 1, resetTime });
    return {
      success: true,
      remainingRequests: config.maxRequests - 1,
      resetTime,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remainingRequests: 0,
      resetTime,
      retryAfter: resetTime - now,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    success: true,
    remainingRequests: config.maxRequests - entry.count,
    resetTime,
  };
}