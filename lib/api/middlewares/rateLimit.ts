import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';
import { checkRateLimit, type RateLimitConfig as PersistentRateLimitConfig } from '@/lib/api/rate-limit-persistent';

export interface RateLimitConfig {
  requests: number; // number of requests
  window: number;   // time window in milliseconds
}

/**
 * Rate limiting middleware that enforces request frequency limits.
 * Now with persistent storage support via SQLite/Redis fallback.
 */
export const createRateLimitMiddleware = (config: RateLimitConfig): ApiMiddleware => {
  // Convert to persistent rate limiter config
  const persistentConfig: PersistentRateLimitConfig = {
    windowSec: Math.floor(config.window / 1000),
    maxRequests: config.requests
  };

  return async (ctx, next) => {
    // Use URL as identifier for rate limiting
    const url = new URL(ctx.request.url);
    const identifier = `${url.hostname}:${url.pathname}`;
    
    const result = await checkRateLimit(identifier, persistentConfig);
    
    if (!result.success) {
      logger.warn('[RateLimitMiddleware] Rate limit exceeded', {
        url: ctx.request.url,
        identifier,
        retryAfter: result.retryAfter,
        remainingRequests: result.remainingRequests
      });
      
      // Delay the request instead of rejecting it
      const delay = (result.retryAfter || 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return next();
  };
};

/**
 * Advanced rate limiting middleware with per-host tracking.
 * Maintains separate rate limits for different hosts/APIs with persistence.
 */
export const createAdvancedRateLimitMiddleware = (config: RateLimitConfig): ApiMiddleware => {
  // Convert to persistent rate limiter config
  const persistentConfig: PersistentRateLimitConfig = {
    windowSec: Math.floor(config.window / 1000),
    maxRequests: config.requests
  };

  return async (ctx, next) => {
    const url = new URL(ctx.request.url);
    const host = url.hostname;
    const identifier = `host:${host}`;
    
    const result = await checkRateLimit(identifier, persistentConfig);
    
    if (!result.success) {
      logger.warn('[AdvancedRateLimitMiddleware] Rate limit exceeded', {
        host,
        url: ctx.request.url,
        retryAfter: result.retryAfter,
        remainingRequests: result.remainingRequests
      });
      
      // Delay the request instead of rejecting it
      const delay = (result.retryAfter || 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return next();
  };
};