import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export interface TimeoutConfig {
  duration: number; // milliseconds
}

/**
 * Timeout middleware that aborts requests after a specified duration.
 * Properly cleans up the timeout when the request completes.
 */
export const createTimeoutMiddleware = (config: TimeoutConfig): ApiMiddleware =>
  async (ctx, next) => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Request timeout after ${config.duration}ms`);
        timeoutError.name = 'TimeoutError';
        controller.abort();
        reject(timeoutError);
      }, config.duration);

      // Clean up timeout if aborted
      controller.signal.addEventListener('abort', () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      });
    });

    try {
      // Note: AbortSignal could be passed to context if needed in future
      // const enhancedCtx = { ...ctx, signal: controller.signal };

      const result = await Promise.race([next(), timeoutPromise]);
      
      // Clean up timeout on success
      controller.abort();
      
      return result;

    } catch (error) {
      // Clean up timeout on error
      controller.abort();
      
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