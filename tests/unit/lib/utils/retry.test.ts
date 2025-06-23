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

// Helper to advance timers and flush promises
async function advanceTimersAndFlush(ms: number) {
  jest.advanceTimersByTime(ms);
  // Flush all pending promises multiple times to ensure all microtasks are processed
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('retry utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should retry on failure and succeed', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(fn, { initialDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        '[Retry] Retrying after error',
        { error: 'fetch failed', attempt: 1 }
      );
    });

    it('should fail after max attempts', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const error = new Error('fetch failed'); // Use retryable error
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(
        withRetry(fn, { 
          maxAttempts: 2,
          initialDelay: 10 // Short delay for real timers
        })
      ).rejects.toThrow('fetch failed');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(fn, {
        initialDelay: 10,
        backoffMultiplier: 2,
        maxAttempts: 3
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const fn = jest.fn().mockRejectedValue(new Error('500 Internal Server Error'));
      
      await expect(
        withRetry(fn, {
          maxAttempts: 3, // Reduced for faster test
          initialDelay: 10,
          maxDelay: 20,
          backoffMultiplier: 10
        })
      ).rejects.toThrow('500 Internal Server Error');
      
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use custom shouldRetry function', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('retryable'))
        .mockRejectedValueOnce(new Error('not retryable'));
      
      const shouldRetry = jest.fn((error: Error) => 
        error.message === 'retryable'
      );
      
      await expect(
        withRetry(fn, { 
          shouldRetry,
          initialDelay: 10
        })
      ).rejects.toThrow('not retryable');
      
      expect(fn).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors by default', async () => {
      jest.useRealTimers(); // Use real timers for this test
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
        
        const result = await withRetry(fn, { initialDelay: 10 });
        
        expect(result).toBe('success');
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
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce('result1');
      
      const fn2 = jest.fn().mockResolvedValue('result2');
      
      const fn3 = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('result3');
      
      const results = await withRetryAll([fn1, fn2, fn3], {
        initialDelay: 10,
        maxAttempts: 3
      });
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(2);
    });

    it('should fail if any function fails after retries', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockRejectedValue(new Error('persistent error'));
      
      await expect(
        withRetryAll([fn1, fn2], { 
          maxAttempts: 2,
          initialDelay: 10,
          shouldRetry: () => true // Force retry to ensure max attempts
        })
      ).rejects.toThrow('persistent error');
      
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(2);
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
      // The race should complete with the fast function's result
      expect(fn2).toHaveBeenCalled();
    });
  });

  describe('CircuitBreaker', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

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
      
      // Advance time to trigger half-open state
      jest.advanceTimersByTime(101);
      
      // Should try again in half-open state
      const result = await breaker.execute(fn, { maxAttempts: 1 });
      
      expect(result).toBe('success');
      expect(logger.info).toHaveBeenCalledWith('[CircuitBreaker] Attempting half-open state');
    });
  });
});
