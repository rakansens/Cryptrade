import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';
import type { RetryCondition } from '@/lib/api/types';

export interface RetryConfig {
  maxAttempts: number;
  delay: number; // base delay in milliseconds
  exponentialBackoff: boolean;
  retryCondition?: RetryCondition;
}

/**
 * Default retry condition: retry on 5xx errors, 429 (rate limit), and network errors.
 * Don't retry on 4xx client errors (except 429).
 */
const defaultRetryCondition: RetryCondition = (error, attempt) => {
  // Network errors (no response)
  if (!error.status && error.name !== 'TimeoutError') {
    return true;
  }

  // Server errors (5xx) and rate limiting (429)
  if (error.status >= 500 || error.status === 429) {
    return true;
  }

  // Don't retry client errors (4xx except 429)
  return false;
};

/**
 * Retry middleware that automatically retries failed requests based on configurable conditions.
 * Supports exponential backoff and custom retry conditions.
 */
export const createRetryMiddleware = (config: RetryConfig): ApiMiddleware => {
  return async (ctx, next) => {
    const retryCondition = config.retryCondition || defaultRetryCondition;
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Update attempt number in context
        ctx.attempt = attempt;
        const result = await next();
        return result;

      } catch (error) {
        lastError = error;

        // Don't retry if this is the last attempt
        if (attempt >= config.maxAttempts) {
          logger.error('[RetryMiddleware] Max retries exceeded', {
            url: ctx.request.url,
            attempt,
            maxAttempts: config.maxAttempts,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
          break;
        }

        // Check if we should retry this error
        if (!retryCondition(error, attempt)) {
          logger.debug('[RetryMiddleware] Error not retryable', {
            url: ctx.request.url,
            attempt,
            errorStatus: error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : undefined,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
          break;
        }

        // Calculate delay with optional exponential backoff
        const delay = config.exponentialBackoff
          ? config.delay * Math.pow(2, attempt - 1)
          : config.delay;

        logger.warn('[RetryMiddleware] Request failed, retrying', {
          url: ctx.request.url,
          attempt,
          maxAttempts: config.maxAttempts,
          delay,
          errorStatus: error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : undefined,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    throw lastError;
  };
};

/**
 * Creates a retry middleware with sensible defaults for API requests.
 */
export const createDefaultRetryMiddleware = (): ApiMiddleware =>
  createRetryMiddleware({
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
  });

/**
 * Creates a retry middleware specifically configured for rate-limited APIs.
 */
export const createRateLimitRetryMiddleware = (): ApiMiddleware =>
  createRetryMiddleware({
    maxAttempts: 5,
    delay: 2000,
    exponentialBackoff: true,
    retryCondition: (error, attempt) => {
      // Always retry rate limits (429)
      if (error.status === 429) {
        return true;
      }
      // Use default condition for other errors
      return defaultRetryCondition(error, attempt);
    },
  });