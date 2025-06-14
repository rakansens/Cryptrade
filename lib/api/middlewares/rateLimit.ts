import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export interface RateLimitConfig {
  requests: number; // number of requests
  window: number;   // time window in milliseconds
}

/**
 * Rate limiting middleware that enforces request frequency limits.
 * Uses a simple token bucket algorithm to distribute requests evenly.
 */
export const createRateLimitMiddleware = (config: RateLimitConfig): ApiMiddleware => {
  let lastRequestTime = 0;
  const minInterval = config.window / config.requests;

  return async (ctx, next) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      
      logger.debug('[RateLimitMiddleware] Rate limiting request', {
        url: ctx.request.url,
        delay,
        timeSinceLastRequest,
        minInterval
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    lastRequestTime = Date.now();
    return next();
  };
};

/**
 * Advanced rate limiting middleware with per-host tracking.
 * Maintains separate rate limits for different hosts/APIs.
 */
export const createAdvancedRateLimitMiddleware = (config: RateLimitConfig): ApiMiddleware => {
  const hostTrackers = new Map<string, number>();

  return async (ctx, next) => {
    const url = new URL(ctx.request.url);
    const host = url.hostname;
    const now = Date.now();
    const lastRequestTime = hostTrackers.get(host) || 0;
    const minInterval = config.window / config.requests;
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      
      logger.debug('[AdvancedRateLimitMiddleware] Rate limiting request', {
        host,
        url: ctx.request.url,
        delay,
        timeSinceLastRequest,
        minInterval
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    hostTrackers.set(host, Date.now());
    return next();
  };
};