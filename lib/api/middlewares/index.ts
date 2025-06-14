// Export all middleware implementations
export { createTimeoutMiddleware, type TimeoutConfig } from './timeout';
export { 
  createRateLimitMiddleware, 
  createAdvancedRateLimitMiddleware, 
  type RateLimitConfig 
} from './rateLimit';
export { 
  createRetryMiddleware, 
  createDefaultRetryMiddleware, 
  createRateLimitRetryMiddleware, 
  type RetryConfig 
} from './retry';
export { createErrorHandlerMiddleware } from './errorHandler';

// Additional middleware examples for future extension
export { createAuthMiddleware, type AuthConfig } from './auth';
export { createCacheMiddleware, type CacheConfig } from './cache';
export { createCircuitBreakerMiddleware, type CircuitBreakerConfig } from './circuitBreaker';