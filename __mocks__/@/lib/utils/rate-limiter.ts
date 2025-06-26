import { jest } from '@jest/globals';

// Mock RateLimiter class
export class RateLimiter {
  private static instance: RateLimiter | null = null;
  private counts = new Map<string, { count: number; lastReset: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-cleanup every 10 minutes to prevent memory leaks
    if (typeof window === 'undefined') { // Server-side only
      this.cleanupInterval = setInterval(() => {
        this.cleanup(600000); // 10 minutes
      }, 600000);
    }
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  static resetInstance(): void {
    if (RateLimiter.instance) {
      RateLimiter.instance.destroy();
      RateLimiter.instance = null;
    }
  }

  /**
   * Check if action is allowed within rate limit
   * @param {string} key - Unique identifier for the action
   * @param {number} maxCount - Maximum allowed actions
   * @param {number} windowMs - Time window in milliseconds
   * @returns {boolean} true if allowed, false if rate limited
   */
  isAllowed(key: string, maxCount: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.counts.get(key);

    if (!entry || now - entry.lastReset > windowMs) {
      // Reset window
      this.counts.set(key, { count: 1, lastReset: now });
      return true;
    }

    if (entry.count >= maxCount) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    return this.counts.get(key)?.count || 0;
  }

  /**
   * Reset count for a key
   */
  reset(key: string): void {
    this.counts.delete(key);
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup(windowMs: number): void {
    const now = Date.now();
    for (const [key, entry] of this.counts.entries()) {
      if (now - entry.lastReset > windowMs) {
        this.counts.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter and cleanup intervals
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.counts.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate-limited logger wrapper
 */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
  [key: string]: unknown;
}

export function createRateLimitedLogger(logger: Logger) {
  return {
    ...logger,
    rateLimit: (key: string, maxCount: number, windowMs: number, level: 'info' | 'warn' | 'error', message: string, ...args: unknown[]) => {
      if (rateLimiter.isAllowed(key, maxCount, windowMs)) {
        const count = rateLimiter.getCount(key);
        if (count === maxCount) {
          // Last allowed message - add rate limit notice
          logger[level](`${message} (rate limiting further messages)`, ...args);
        } else {
          logger[level](message, ...args);
        }
      }
    }
  };
}

export default RateLimiter;