import { logger } from '@/lib/utils/logger';
import { composeWithFetch } from '@/lib/utils/compose';
import type { ApiMiddleware, RequestCtx, ApiClientConfig, ApiResponse, ApiError } from '@/types/api';
import { 
  createTimeoutMiddleware,
  createRateLimitMiddleware,
  createRetryMiddleware,
  createErrorHandlerMiddleware
} from './middlewares';
import type { ApiResponse as ApiResponseType } from '@/lib/api/types';

// Re-export types for backward compatibility
export type { ApiClientConfig, ApiResponse, ApiError } from '@/types/api';

export class ApiClient {
  private config: ApiClientConfig;
  private middlewares: ApiMiddleware[];
  private requestQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void; request: () => Promise<ApiResponse<unknown>> }> = [];
  private isProcessingQueue = false;

  constructor(config: ApiClientConfig, middlewares?: ApiMiddleware[]) {
    this.config = config;
    this.middlewares = middlewares || this.createDefaultMiddlewares(config);
  }

  private createDefaultMiddlewares(config: ApiClientConfig): ApiMiddleware[] {
    const middlewares: ApiMiddleware[] = [];

    // Add middlewares in order of execution
    // Timeout should be first to apply to the entire chain
    middlewares.push(createTimeoutMiddleware({ duration: config.timeout }));
    
    // Rate limiting should happen before retries
    middlewares.push(createRateLimitMiddleware({
      requests: config.rateLimit.requests,
      window: config.rateLimit.window
    }));
    
    // Retry should be before error handling
    middlewares.push(createRetryMiddleware({
      maxAttempts: config.retries,
      delay: config.retryDelay,
      exponentialBackoff: true
    }));
    
    // Error handling should be last before fetch
    middlewares.push(createErrorHandlerMiddleware());

    return middlewares;
  }

  async execute<T>(url: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
    
    const ctx: RequestCtx = {
      request: { 
        ...init, 
        url: fullUrl,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        }
      },
      attempt: 0,
    };

    logger.debug('[ApiClient] Making request', { 
      url: fullUrl, 
      method: init.method || 'GET' 
    });

    try {
      const finalCtx = await composeWithFetch(this.middlewares)(ctx);
      
      if (!finalCtx.response) {
        throw new Error('No response received from middleware chain');
      }

      const response = finalCtx.response;

      // Error handling is now done in middleware
      // This ensures retry logic can catch and handle HTTP errors

      const data = await response.json();
      
      logger.debug('[ApiClient] Request successful', { 
        url: fullUrl, 
        status: response.status 
      });

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

    } catch (error) {
      logger.error('[ApiClient] Request failed', { url: fullUrl }, error);
      throw error;
    }
  }

  async get<T>(url: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const urlWithParams = params ? `${url}?${new URLSearchParams(params)}` : url;
    return this.execute<T>(urlWithParams, { method: 'GET' });
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.execute<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.execute<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.execute<T>(url, { method: 'DELETE' });
  }

  // Queue-based request management for high-frequency scenarios
  async queueRequest<T>(requestFn: () => Promise<ApiResponse<T>>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        resolve: (result: T) => resolve(result),
        reject,
        request: requestFn,
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { resolve, reject, request } = this.requestQueue.shift()!;

      try {
        const response = await request();
        resolve(response.data);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }
}

// Default configurations for different APIs
export const createBinanceClient = (): ApiClient => {
  return new ApiClient({
    baseUrl: '/api/binance',
    timeout: 30000, // Increased from 10s to 30s
    retries: 3,
    retryDelay: 1000,
    rateLimit: {
      requests: 10,
      window: 1000, // 10 requests per second
    },
  });
};

export const createExternalBinanceClient = (): ApiClient => {
  return new ApiClient({
    baseUrl: 'https://api.binance.com/api/v3',
    timeout: 5000,
    retries: 2,
    retryDelay: 500,
    rateLimit: {
      requests: 5,
      window: 1000, // 5 requests per second for external API
    },
  });
};