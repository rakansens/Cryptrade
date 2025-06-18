import { withRetry, withRetryAll, withRetryRace, CircuitBreaker } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/concurrent', () => ({
  raceWithCleanup: jest.fn((fns, options) => {
    // Simple implementation for testing
    return Promise.race(fns.map(fn => fn(new AbortController().signal)));
  })
}));

describe('retry utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should retry on failure and succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce('success');
      
      const promise = withRetry(fn);
      
      // Fast-forward first retry delay
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        '[Retry] Retrying after error',
        { error: 'fetch failed', attempt: 1 }
      );
    });

    it('should fail after max attempts', async () => {
      const error = new Error('persistent error');
      const fn = jest.fn().mockRejectedValue(error);
      
      const promise = withRetry(fn, { maxAttempts: 2 });
      
      // Fast-forward through retries
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      
      await expect(promise).rejects.toThrow('persistent error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('error 1'))
        .mockRejectedValueOnce(new Error('error 2'))
        .mockResolvedValueOnce('success');
      
      const promise = withRetry(fn, {
        initialDelay: 100,
        backoffMultiplier: 2
      });
      
      // First retry after 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Second retry after 200ms (100 * 2)
      await jest.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);
      
      await expect(promise).resolves.toBe('success');
    });

    it('should respect maxDelay', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('error'));
      
      const promise = withRetry(fn, {
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 2000,
        backoffMultiplier: 10
      });
      
      // Despite high multiplier, delay should be capped at maxDelay
      await jest.advanceTimersByTimeAsync(1000); // First retry
      await jest.advanceTimersByTimeAsync(2000); // Second retry (capped)
      await jest.advanceTimersByTimeAsync(2000); // Third retry (capped)
      await jest.advanceTimersByTimeAsync(2000); // Fourth retry (capped)
      
      await expect(promise).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('retryable'))
        .mockRejectedValueOnce(new Error('not retryable'));
      
      const shouldRetry = jest.fn((error: Error) => 
        error.message === 'retryable'
      );
      
      await expect(withRetry(fn, { shouldRetry }))
        .rejects.toThrow('not retryable');
      
      expect(fn).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors by default', async () => {
      const errors = [
        new Error('fetch failed'),
        new Error('timeout'),
        new Error('ECONNREFUSED'),
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('504 Gateway Timeout'),
        new Error('429 Too Many Requests')
      ];
      
      for (const error of errors) {
        const fn = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce('success');
        
        const promise = withRetry(fn);
        await jest.advanceTimersByTimeAsync(1000);
        
        await expect(promise).resolves.toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
        
        jest.clearAllMocks();
      }
    });

    it('should not retry on non-retryable errors by default', async () => {
      const errors = [
        new Error('400 Bad Request'),
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('404 Not Found')
      ];
      
      for (const error of errors) {
        const fn = jest.fn().mockRejectedValue(error);
        
        await expect(withRetry(fn)).rejects.toThrow(error.message);
        expect(fn).toHaveBeenCalledTimes(1);
        
        jest.clearAllMocks();
      }
    });
  });

  describe('withRetryAll', () => {
    it('should execute all functions with retry', async () => {
      const fn1 = jest.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce('result1');
      
      const fn2 = jest.fn().mockResolvedValue('result2');
      
      const fn3 = jest.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce('result3');
      
      const promise = withRetryAll([fn1, fn2, fn3]);
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const results = await promise;
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(2);
    });

    it('should fail if any function fails after retries', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockRejectedValue(new Error('persistent error'));
      
      const promise = withRetryAll([fn1, fn2], { maxAttempts: 2 });
      
      await jest.advanceTimersByTimeAsync(3000);
      
      await expect(promise).rejects.toThrow('persistent error');
    });
  });

  describe('withRetryRace', () => {
    it('should return first successful result', async () => {
      const fn1 = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow'), 2000))
      );
      
      const fn2 = jest.fn().mockResolvedValue('fast');
      
      const result = await withRetryRace([fn1, fn2]);
      
      expect(result).toBe('fast');
      expect(fn2).toHaveBeenCalled();
    });

    it('should handle AbortSignal in race', async () => {
      const fn1 = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow error')), 2000))
      );
      
      const fn2 = jest.fn().mockResolvedValue('success');
      
      const result = await withRetryRace([fn1, fn2]);
      
      expect(result).toBe('success');
      expect(logger.warn).toHaveBeenCalledWith(
        '[Retry] Race cleanup due to error',
        expect.any(Object)
      );
    });
  });

  describe('CircuitBreaker', () => {
    it('should execute function when circuit is closed', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should open circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const fn = jest.fn().mockRejectedValue(new Error('error'));
      
      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn, { maxAttempts: 1 });
        } catch (e) {
          // Expected
        }
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        '[CircuitBreaker] Circuit opened',
        { failures: 3 }
      );
      
      // Circuit should be open now
      await expect(breaker.execute(fn))
        .rejects.toThrow('Circuit breaker is open');
      
      // Function should not be called when circuit is open
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should transition to half-open after timeout', async () => {
      const breaker = new CircuitBreaker(1, 100);
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce('success');
      
      // Open the circuit
      try {
        await breaker.execute(fn, { maxAttempts: 1 });
      } catch (e) {
        // Expected
      }
      
      // Wait for timeout
      jest.advanceTimersByTime(101);
      
      // Should try again in half-open state
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(logger.info).toHaveBeenCalledWith('[CircuitBreaker] Attempting half-open state');
    });
  });
});
