import { logger } from './logger';

/**
 * Circuit Breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',   // Normal operation
  OPEN = 'OPEN',       // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Circuit Breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenAttempts?: number;
  errorFilter?: (error: unknown) => boolean;
}

/**
 * Combined configuration
 */
export interface RetryWithCircuitBreakerConfig {
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  timeout?: number;
}

/**
 * Default configurations
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    // Retry on network errors and 5xx status codes
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    if (error.status && error.status >= 500) return true;
    return false;
  }
};

const DEFAULT_CIRCUIT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenAttempts: 3,
  errorFilter: (error: unknown) => {
    // Count only significant errors for circuit breaker
    if (error.status && error.status >= 500) return true;
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    return false;
  }
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Check if request should be allowed
   */
  shouldAllowRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        logger.info('[CircuitBreaker] Transitioning to HALF_OPEN state');
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return this.halfOpenAttempts < this.config.halfOpenAttempts;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenAttempts) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        logger.info('[CircuitBreaker] Circuit closed after successful recovery');
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error: unknown): void {
    if (!this.config.errorFilter(error)) {
      // Don't count this error towards circuit breaker
      return;
    }

    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      logger.warn('[CircuitBreaker] Circuit opened again after failure in HALF_OPEN state');
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        logger.warn('[CircuitBreaker] Circuit opened after reaching failure threshold', {
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold
        });
      }
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenAttempts: this.halfOpenAttempts,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
}

/**
 * Retry with exponential backoff and circuit breaker
 */
export async function retryWithCircuitBreaker<T>(
  operation: (signal?: AbortSignal) => Promise<T>,
  config: RetryWithCircuitBreakerConfig = {},
  circuitBreaker?: CircuitBreaker
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
  const cb = circuitBreaker || new CircuitBreaker(config.circuitBreaker);

  let lastError: unknown;
  let delay = retryConfig.initialDelay;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    // Check circuit breaker
    if (!cb.shouldAllowRequest()) {
      const error = new Error('Circuit breaker is OPEN') as Error & { code: string };
      error.code = 'CIRCUIT_OPEN';
      throw error;
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = config.timeout 
        ? setTimeout(() => controller.abort(), config.timeout)
        : null;

      try {
        const result = await operation(controller.signal);
        cb.recordSuccess();
        
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error;
      cb.recordFailure(error);

      logger.warn(`[Retry] Attempt ${attempt}/${retryConfig.maxAttempts} failed`, {
        error: error.message,
        willRetry: attempt < retryConfig.maxAttempts && retryConfig.shouldRetry(error)
      });

      // Check if we should retry
      if (attempt >= retryConfig.maxAttempts || !retryConfig.shouldRetry(error)) {
        throw error;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Create a wrapped function with retry and circuit breaker
 */
export function withRetryAndCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(

  fn: T,
  config: RetryWithCircuitBreakerConfig = {},
  sharedCircuitBreaker?: CircuitBreaker
): T {
  const cb = sharedCircuitBreaker || new CircuitBreaker(config.circuitBreaker);

  return (async (...args: Parameters<T>) => {
    return retryWithCircuitBreaker(
      (signal) => fn(...args, { signal }),
      config,
      cb
    );
  }) as T;
}

/**
 * Metrics for monitoring
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
}

/**
 * Enhanced Circuit Breaker with metrics
 */
export class MonitoredCircuitBreaker extends CircuitBreaker {
  private successCount: number = 0;

  recordSuccess(): void {
    super.recordSuccess();
    this.successCount++;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.getState(),
      failureCount: (this as { failureCount: number }).failureCount,
      successCount: this.successCount,
      lastFailureTime: (this as { lastFailureTime: number }).lastFailureTime || null
    };
  }
}