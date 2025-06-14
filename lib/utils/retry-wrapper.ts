import { logger } from '@/lib/utils/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryWrapper {
  private readonly defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 8000,
    factor: 2,
    onRetry: () => {},
  };

  constructor(private options: RetryOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  async execute<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const { maxAttempts, initialDelay, maxDelay, factor, onRetry } = this.options as Required<RetryOptions>;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('[RetryWrapper] Attempting operation', { 
          operationName, 
          attempt, 
          maxAttempts 
        });
        
        const result = await operation();
        
        if (attempt > 1) {
          logger.info('[RetryWrapper] Operation succeeded after retry', { 
            operationName, 
            attempt 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('[RetryWrapper] Operation failed', { 
          operationName, 
          attempt, 
          maxAttempts,
          error: lastError.message 
        });
        
        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelay * Math.pow(factor, attempt - 1),
            maxDelay
          );
          
          onRetry(lastError, attempt);
          
          logger.info('[RetryWrapper] Retrying after delay', { 
            operationName, 
            delay, 
            nextAttempt: attempt + 1 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('[RetryWrapper] All retry attempts failed', { 
      operationName, 
      attempts: maxAttempts 
    });
    
    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * Create a retryable version of a function
   */
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    operationName?: string
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(() => fn(...args), operationName);
    }) as T;
  }
}