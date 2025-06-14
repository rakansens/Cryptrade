import { 
  retryWithCircuitBreaker, 
  CircuitBreaker, 
  CircuitState,
  withRetryAndCircuitBreaker,
  MonitoredCircuitBreaker
} from '../retry-with-circuit-breaker';

describe('Retry with Circuit Breaker', () => {
  jest.setTimeout(20000); // Increase timeout for retry tests

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryWithCircuitBreaker', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryWithCircuitBreaker(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');

      const result = await retryWithCircuitBreaker(operation, {
        retry: {
          maxAttempts: 3,
          initialDelay: 100,
          shouldRetry: () => true,
        }
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Persistent error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        retryWithCircuitBreaker(operation, {
          retry: {
            maxAttempts: 3,
            initialDelay: 100,
            shouldRetry: () => true,
          }
        })
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry predicate', async () => {
      const clientError = new Error('Client error');
      (clientError as any).status = 400;
      
      const operation = jest.fn().mockRejectedValue(clientError);

      await expect(
        retryWithCircuitBreaker(operation, {
          retry: {
            maxAttempts: 3,
            shouldRetry: (error) => error.status >= 500,
          }
        })
      ).rejects.toThrow('Client error');

      expect(operation).toHaveBeenCalledTimes(1); // No retry for client error
    });

    it('should apply exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      
      await retryWithCircuitBreaker(operation, {
        retry: {
          maxAttempts: 3,
          initialDelay: 100,
          backoffMultiplier: 2,
          shouldRetry: () => true,
        }
      });

      const duration = Date.now() - startTime;
      // Should take at least 100ms (first delay) + 200ms (second delay) = 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThan(400); // But not too long
    });

    it('should respect timeout', async () => {
      const operation = jest.fn().mockImplementation(
        (signal?: AbortSignal) => new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve('success'), 1000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('The operation was aborted'));
          });
        })
      );

      await expect(
        retryWithCircuitBreaker(operation, {
          timeout: 100,
          retry: { maxAttempts: 1 }
        })
      ).rejects.toThrow('The operation was aborted');
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.shouldAllowRequest()).toBe(true);
    });

    it('should open circuit after failure threshold', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      const error = new Error('Server error');
      (error as any).status = 500;

      // Record failures
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.OPEN);
      expect(cb.shouldAllowRequest()).toBe(false);
    });

    it('should not count filtered errors', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        errorFilter: (error) => error.status >= 500,
      });

      const clientError = new Error('Client error');
      (clientError as any).status = 400;
      
      const serverError = new Error('Server error');
      (serverError as any).status = 500;

      // Client errors should not count
      cb.recordFailure(clientError);
      cb.recordFailure(clientError);
      expect(cb.getState()).toBe(CircuitState.CLOSED);

      // Server errors should count
      cb.recordFailure(serverError);
      cb.recordFailure(serverError);
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const cb = new CircuitBreaker({ 
        failureThreshold: 1,
        resetTimeout: 100 
      });
      
      const error = new Error('Server error');
      (error as any).status = 500;

      // Open the circuit
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.OPEN);
      expect(cb.shouldAllowRequest()).toBe(false);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should transition to HALF_OPEN
      expect(cb.shouldAllowRequest()).toBe(true);
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful half-open attempts', () => {
      const cb = new CircuitBreaker({ 
        failureThreshold: 1,
        halfOpenAttempts: 2 
      });
      
      const error = new Error('Server error');
      (error as any).status = 500;

      // Force to HALF_OPEN state
      cb.recordFailure(error);
      cb['state'] = CircuitState.HALF_OPEN; // Direct state manipulation for testing

      // Record successful attempts
      cb.recordSuccess();
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
      
      cb.recordSuccess();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure during HALF_OPEN', () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const error = new Error('Server error');
      (error as any).status = 500;

      // Force to HALF_OPEN state
      cb['state'] = CircuitState.HALF_OPEN;

      // Failure during HALF_OPEN should reopen
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it('should reset circuit breaker', () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const error = new Error('Server error');
      (error as any).status = 500;

      // Open the circuit
      cb.recordFailure(error);
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Reset
      cb.reset();
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.shouldAllowRequest()).toBe(true);
    });
  });

  describe('withRetryAndCircuitBreaker', () => {
    it('should wrap function with retry and circuit breaker', async () => {
      const originalFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary'))
        .mockResolvedValue('success');

      const wrappedFn = withRetryAndCircuitBreaker(originalFn, {
        retry: {
          maxAttempts: 2,
          initialDelay: 50,
          shouldRetry: () => true,
        }
      });

      const result = await wrappedFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('should share circuit breaker across calls', async () => {
      const sharedCb = new CircuitBreaker({ failureThreshold: 2 });
      const error = new Error('Server error');
      (error as any).status = 500;

      const failingFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withRetryAndCircuitBreaker(failingFn, {
        retry: { maxAttempts: 1 }
      }, sharedCb);

      // First call - should fail
      await expect(wrappedFn()).rejects.toThrow();
      
      // Second call - should fail and open circuit
      await expect(wrappedFn()).rejects.toThrow();
      
      expect(sharedCb.getState()).toBe(CircuitState.OPEN);

      // Third call - should fail immediately due to open circuit
      await expect(wrappedFn()).rejects.toThrow('Circuit breaker is OPEN');
      expect(failingFn).toHaveBeenCalledTimes(2); // Not called on third attempt
    });
  });

  describe('MonitoredCircuitBreaker', () => {
    it('should track metrics', () => {
      const cb = new MonitoredCircuitBreaker({ failureThreshold: 3 });
      const error = new Error('Server error');
      (error as any).status = 500;

      // Initial metrics
      let metrics = cb.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);

      // Record some activity
      cb.recordSuccess();
      cb.recordSuccess();
      cb.recordFailure(error);

      metrics = cb.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
    });
  });
});