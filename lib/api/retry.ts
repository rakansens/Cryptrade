// Retry mechanism with exponential backoff for API calls

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    // Binance specific error codes
    '-1003', // TOO_MANY_REQUESTS
    '-1021', // TIMESTAMP_OUT_OF_SYNC (can retry with adjusted timestamp)
  ]
};

export class RetryableError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'RetryableError';
  }
}

function isRetryableError(error: Error, config: RetryConfig): boolean {
  // Network errors
  if (error.message.includes('fetch failed') || 
      error.message.includes('network') ||
      error.message.includes('timeout')) {
    return true;
  }

  // Specific error codes/messages
  return config.retryableErrors.some(retryableError => 
    error.message.includes(retryableError)
  );
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt or non-retryable errors
      if (attempt === finalConfig.maxAttempts || !isRetryableError(lastError, finalConfig)) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, finalConfig);
      console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  throw lastError!;
}

// Specific retry wrapper for Binance API calls
export async function withBinanceRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'BinanceAPI'
): Promise<T> {
  return withRetry(operation, {
    maxAttempts: 3,
    baseDelay: 2000, // Binance rate limits are strict, wait longer
    retryableErrors: [
      ...DEFAULT_RETRY_CONFIG.retryableErrors,
      'Rate limit exceeded',
      '429', // HTTP 429 Too Many Requests
      '502', // Bad Gateway
      '503', // Service Unavailable
      '504', // Gateway Timeout
    ]
  });
}

// Circuit breaker pattern for repeated failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - too many recent failures');
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(`[CircuitBreaker] OPEN - ${this.failures} failures detected`);
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breaker for Binance API
export const binanceCircuitBreaker = new CircuitBreaker(5, 60000);

// Export types
export type { RetryConfig };