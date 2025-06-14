import { logger } from '@/lib/utils/logger';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based rate limiting
 */
export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: Record<string, RateLimitConfig>) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if operation is allowed for given key
   */
  async checkLimit(operation: string, key: string): Promise<boolean> {
    const config = this.config[operation];
    if (!config) {
      logger.warn('[RateLimiter] No config for operation', { operation });
      return true; // Allow if no limit configured
    }

    const limitKey = `${operation}:${key}`;
    const now = Date.now();
    const entry = this.limits.get(limitKey);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      this.limits.set(limitKey, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (entry.count >= config.maxRequests) {
      logger.warn('[RateLimiter] Rate limit exceeded', {
        operation,
        key,
        count: entry.count,
        resetTime: new Date(entry.resetTime).toISOString(),
      });
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Get time until rate limit resets
   */
  getResetTime(operation: string, key: string): number | null {
    const limitKey = `${operation}:${key}`;
    const entry = this.limits.get(limitKey);
    
    if (!entry) return null;
    
    const now = Date.now();
    return entry.resetTime > now ? entry.resetTime - now : null;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[RateLimiter] Cleaned up expired entries', { count: cleaned });
    }
  }

  /**
   * Destroy rate limiter and clean up
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Default rate limits for chat operations
export const chatRateLimits: Record<string, RateLimitConfig> = {
  createSession: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
  addMessage: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  bulkOperations: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
};

// Create singleton instance
export const chatRateLimiter = new RateLimiter(chatRateLimits);

// Export rate limiters for compatibility
export const chatRateLimiters = {
  sessionCreation: chatRateLimiter,
  messageCreation: chatRateLimiter,
  bulkOperations: chatRateLimiter,
};

// Export enforcement function
export async function enforceRateLimit(limiter: RateLimiter, key: string, operation?: string): Promise<void> {
  const op = operation || 'default';
  const allowed = await limiter.checkLimit(op, key);
  
  if (!allowed) {
    const resetTime = limiter.getResetTime(op, key);
    throw new Error(`Rate limit exceeded. Try again in ${resetTime ? Math.ceil(resetTime / 1000) : 60} seconds`);
  }
}