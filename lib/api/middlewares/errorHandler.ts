import type { ApiMiddleware, ApiError } from '@/types/api';
import { logger } from '@/lib/utils/logger';

/**
 * Error handling middleware that converts HTTP error responses to ApiError objects.
 * This middleware should typically be one of the last in the chain, before retries.
 */
export const createErrorHandlerMiddleware = (): ApiMiddleware =>
  async (ctx, next) => {
    const result = await next();
    
    if (result.response && !result.response.ok) {
      const error: ApiError = new Error(`HTTP ${result.response.status}: ${result.response.statusText}`);
      error.status = result.response.status;
      error.statusText = result.response.statusText;
      
      try {
        error.response = await result.response.clone().json();
      } catch {
        try {
          error.response = await result.response.clone().text();
        } catch {
          error.response = null;
        }
      }
      
      logger.debug('[ErrorHandlerMiddleware] HTTP error response', {
        status: result.response.status,
        statusText: result.response.statusText,
        url: ctx.request.url
      });
      
      throw error;
    }
    
    return result;
  };