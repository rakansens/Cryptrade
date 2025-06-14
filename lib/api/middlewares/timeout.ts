import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export interface TimeoutConfig {
  duration: number; // milliseconds
}

/**
 * Timeout middleware that aborts requests after a specified duration.
 * Throws an AbortError if the request takes longer than the timeout.
 */
export const createTimeoutMiddleware = (config: TimeoutConfig): ApiMiddleware =>
  async (ctx, next) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`Request timeout after ${config.duration}ms`);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, config.duration);
    });

    try {
      const result = await Promise.race([next(), timeoutPromise]);
      return result;

    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        logger.warn('[TimeoutMiddleware] Request timed out', {
          url: ctx.request.url,
          timeout: config.duration,
          attempt: ctx.attempt
        });

        const timeoutError = new Error(`Request timeout after ${config.duration}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  };