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
        const jsonData = await result.response.clone().json();
        error.response = {
          data: jsonData,
          status: result.response.status,
          statusText: result.response.statusText,
          headers: result.response.headers
        };
      } catch {
        try {
          const text = await result.response.clone().text();
          error.response = {
            data: text,
            status: result.response.status,
            statusText: result.response.statusText,
            headers: result.response.headers
          };
        } catch {
          delete error.response;
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