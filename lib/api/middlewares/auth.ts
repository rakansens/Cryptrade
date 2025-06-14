import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export interface AuthConfig {
  headerName: string;
  tokenProvider: () => string | Promise<string>;
  refreshTokenOnUnauthorized?: boolean;
}

/**
 * Authentication middleware that adds authorization headers to requests.
 * Supports both static tokens and dynamic token providers.
 */
export const createAuthMiddleware = (config: AuthConfig): ApiMiddleware =>
  async (ctx, next) => {
    try {
      // Get token from provider
      const token = await config.tokenProvider();
      
      if (!token) {
        logger.warn('[AuthMiddleware] No token available', {
          url: ctx.request.url
        });
        return next();
      }

      // Add authorization header
      const headers = new Headers(ctx.request.headers);
      headers.set(config.headerName, token);

      const newCtx = {
        ...ctx,
        request: {
          ...ctx.request,
          headers
        }
      };

      return next();

    } catch (error) {
      logger.error('[AuthMiddleware] Failed to get auth token', {
        url: ctx.request.url,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, error);

      // Continue without auth header in case of error
      return next();
    }
  };

/**
 * Creates an auth middleware for Bearer token authentication.
 */
export const createBearerAuthMiddleware = (tokenProvider: () => string | Promise<string>): ApiMiddleware =>
  createAuthMiddleware({
    headerName: 'Authorization',
    tokenProvider: async () => {
      const token = await tokenProvider();
      return token ? `Bearer ${token}` : '';
    }
  });

/**
 * Creates an auth middleware for API key authentication.
 */
export const createApiKeyAuthMiddleware = (
  apiKeyProvider: () => string | Promise<string>,
  headerName: string = 'X-API-Key'
): ApiMiddleware =>
  createAuthMiddleware({
    headerName,
    tokenProvider: apiKeyProvider
  });