/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RetryWrapper } from '../retry-wrapper';

// Mock metrics
jest.mock('@/lib/monitoring/metrics', () => ({
  incrementMetric: jest.fn(),
}));

describe('RetryWrapper', () => {
  let retryWrapper: RetryWrapper;
  
  beforeEach(() => {
    jest.clearAllMocks();
    retryWrapper = new RetryWrapper({
      maxAttempts: 3,
      initialDelay: 100,
      factor: 2,
    });
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await retryWrapper.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed on second attempt', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      const wrapper = new RetryWrapper({
        maxAttempts: 3,
        initialDelay: 50,
        onRetry,
      });
      
      const result = await wrapper.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'First failure' }),
        1
      );
    });

    it('should fail after all retries exhausted', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new Error('Persistent failure'));
      
      await expect(retryWrapper.execute(mockOperation))
        .rejects.toThrow('Persistent failure');
      
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = ((fn: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0); // Execute immediately for test
      }) as any;
      
      try {
        await retryWrapper.execute(mockOperation);
        
        expect(delays).toEqual([100, 200]); // 100ms, then 200ms (100 * 2^1)
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should respect maxDelay', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new Error('Always fails'));
      
      const wrapper = new RetryWrapper({
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 2000,
        factor: 10, // Would exceed maxDelay quickly
      });
      
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = ((fn: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      }) as any;
      
      try {
        await wrapper.execute(mockOperation).catch(() => {});
        
        // All delays should be capped at maxDelay
        expect(delays.every(d => d <= 2000)).toBe(true);
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  });

  describe('wrap', () => {
    it('should create a retryable function', async () => {
      const originalFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail once'))
        .mockResolvedValueOnce('success');
      
      const wrappedFn = retryWrapper.wrap(originalFn, 'test-operation');
      
      const result = await wrappedFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});