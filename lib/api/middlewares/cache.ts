import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';
import type { CacheEntry as CacheEntryType } from '@/lib/api/types';

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  keyGenerator: (url: string, init: RequestInit) => string;
  storage?: CacheStorage;
}

interface CacheEntry extends Omit<CacheEntryType<unknown>, 'data'> {
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
  };
}

/**
 * Simple in-memory cache storage implementation.
 */
class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }
}

interface CacheStorage {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Default cache key generator that includes URL and relevant request parameters.
 */
const defaultKeyGenerator = (url: string, init: RequestInit): string => {
  const method = init.method || 'GET';
  const body = init.body ? JSON.stringify(init.body) : '';
  return `${method}:${url}:${body}`;
};

/**
 * Cache middleware that stores successful responses and serves them for subsequent requests.
 * Only caches GET requests by default, but can be configured for other methods.
 */
export const createCacheMiddleware = (config: CacheConfig): ApiMiddleware => {
  const storage = config.storage || new MemoryCacheStorage();

  return async (ctx, next) => {
    const method = ctx.request.method || 'GET';
    
    // Only cache GET requests by default
    if (method !== 'GET') {
      return next();
    }

    const cacheKey = config.keyGenerator(ctx.request.url, ctx.request);

    try {
      // Try to get from cache first
      const cachedEntry = await storage.get(cacheKey);
      if (cachedEntry) {
        logger.debug('[CacheMiddleware] Cache hit', {
          url: ctx.request.url,
          cacheKey,
          age: Date.now() - cachedEntry.timestamp
        });

        // Create a mock response from cached data
        const mockResponse = new Response(JSON.stringify(cachedEntry.response.data), {
          status: cachedEntry.response.status,
          statusText: cachedEntry.response.statusText,
          headers: cachedEntry.response.headers
        });

        return { ...ctx, response: mockResponse };
      }

      // Cache miss - proceed with request
      logger.debug('[CacheMiddleware] Cache miss', {
        url: ctx.request.url,
        cacheKey
      });

      const result = await next();

      // Cache successful responses (2xx status codes)
      if (result.response && result.response.status >= 200 && result.response.status < 300) {
        try {
          // Clone response to read body without consuming it
          const responseClone = result.response.clone();
          const data = await responseClone.json();

          const cacheEntry: CacheEntry = {
            response: {
              status: result.response.status,
              statusText: result.response.statusText,
              headers: Object.fromEntries(result.response.headers.entries()),
              data
            },
            timestamp: Date.now(),
            ttl: config.ttl
          };

          await storage.set(cacheKey, cacheEntry);

          logger.debug('[CacheMiddleware] Response cached', {
            url: ctx.request.url,
            cacheKey,
            status: result.response.status
          });

        } catch (error) {
          logger.warn('[CacheMiddleware] Failed to cache response', {
            url: ctx.request.url,
            cacheKey,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return result;

    } catch (error) {
      logger.error('[CacheMiddleware] Cache operation failed', {
        url: ctx.request.url,
        cacheKey,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      // Continue with request even if cache fails
      return next();
    }
  };
};

/**
 * Creates a cache middleware with sensible defaults for API responses.
 */
export const createDefaultCacheMiddleware = (ttl: number = 5 * 60 * 1000): ApiMiddleware =>
  createCacheMiddleware({
    ttl, // 5 minutes default
    keyGenerator: defaultKeyGenerator
  });