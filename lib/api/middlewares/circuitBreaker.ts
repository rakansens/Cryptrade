import type { ApiMiddleware } from '@/types/api';
import { logger } from '@/lib/utils/logger';

export interface CircuitBreakerConfig {
  threshold: number;     // Number of failures before opening circuit
  timeout: number;       // Request timeout in milliseconds
  resetTimeout: number;  // Time to wait before trying to close circuit
}

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

/**
 * Circuit breaker implementation for preventing cascading failures.
 */
class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${this.nextAttemptTime - Date.now()}ms`);
      }
      
      // Move to half-open state
      this.state = CircuitState.HALF_OPEN;
      logger.info('[CircuitBreaker] Transitioning to HALF_OPEN state');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    logger.debug('[CircuitBreaker] Operation successful, circuit CLOSED');
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      
      logger.warn('[CircuitBreaker] Circuit OPEN due to failures', {
        failureCount: this.failureCount,
        threshold: this.config.threshold,
        nextAttemptTime: this.nextAttemptTime
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    logger.info('[CircuitBreaker] Circuit breaker reset');
  }
}

/**
 * Circuit breaker middleware that implements the circuit breaker pattern.
 * Prevents requests to failing services and allows them to recover.
 */
export const createCircuitBreakerMiddleware = (config: CircuitBreakerConfig): ApiMiddleware => {
  const circuitBreakers = new Map<string, CircuitBreaker>();

  return async (ctx, next) => {
    const url = new URL(ctx.request.url);
    const host = url.hostname;
    
    // Get or create circuit breaker for this host
    let circuitBreaker = circuitBreakers.get(host);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config);
      circuitBreakers.set(host, circuitBreaker);
    }

    try {
      return await circuitBreaker.execute(async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Circuit breaker timeout')), config.timeout)
        );

        return Promise.race([next(), timeoutPromise]);
      });

    } catch (error) {
      const metrics = circuitBreaker.getMetrics();
      
      logger.warn('[CircuitBreakerMiddleware] Request failed', {
        host,
        url: ctx.request.url,
        state: metrics.state,
        failureCount: metrics.failureCount,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  };
};

/**
 * Creates a circuit breaker middleware with sensible defaults.
 */
export const createDefaultCircuitBreakerMiddleware = (): ApiMiddleware =>
  createCircuitBreakerMiddleware({
    threshold: 5,        // Open after 5 failures
    timeout: 10000,      // 10 second timeout
    resetTimeout: 60000  // Try again after 1 minute
  });