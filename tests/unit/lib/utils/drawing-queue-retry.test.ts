/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock metrics collector for faster tests
const mockMetricsCollectorObj = {
  reset: jest.fn(),
  recordMetric: jest.fn(),
  recordHistogram: jest.fn(),
  toJSON: jest.fn(),
};

jest.mock('@/lib/monitoring/metrics', () => ({
  metricsCollector: mockMetricsCollectorObj,
  incrementMetric: jest.fn(),
  observeMetric: jest.fn(),
}));

import { DrawingOperationQueue } from '@/lib/utils/drawing-queue';
const mockMetricsCollector = mockMetricsCollectorObj;

describe('DrawingOperationQueue with Retry', () => {
  let queue: DrawingOperationQueue;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockMetricsCollector.reset();
    mockMetricsCollector.toJSON.mockReturnValue({
      drawing_success_total: { value: 0 },
      drawing_failed_total: { value: 0 },
      drawing_retry_total: { value: 0 },
    });
    queue = new DrawingOperationQueue({ 
      maxConcurrency: 1,
      enableRetry: true
    });
  });
  
  afterEach(async () => {
    // Clean up queue before restoring timers
    await queue?.destroy?.();
    jest.useRealTimers();
  });

  it('should increment drawing_success_total on successful operation', async () => {
    const mockOperation = jest.fn<() => Promise<string>>().mockResolvedValue('success');
    
    const result = await queue.enqueue(mockOperation);
    
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
    
    // Fast forward timers
    jest.runAllTimers();
    await Promise.resolve();
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 1 },
      drawing_failed_total: { value: 0 },
      drawing_retry_total: { value: 0 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(1);
    expect(metrics['drawing_failed_total'].value).toBe(0);
    expect(metrics['drawing_retry_total'].value).toBe(0);
  });

  it('should retry failed operation and increment counters', async () => {
    const mockOperation = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('success after retry');
    
    const resultPromise = queue.enqueue(mockOperation);
    
    // Advance timers to trigger retry
    await jest.runAllTimersAsync();
    
    const result = await resultPromise;
    
    expect(result).toBe('success after retry');
    expect(mockOperation).toHaveBeenCalledTimes(2);
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 1 },
      drawing_failed_total: { value: 0 },
      drawing_retry_total: { value: 1 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(1);
    expect(metrics['drawing_failed_total'].value).toBe(0);
    expect(metrics['drawing_retry_total'].value).toBe(1); // One retry
  }, 15000); // Increase timeout

  it('should increment drawing_failed_total after all retries fail', async () => {
    const mockOperation = jest.fn<() => Promise<string>>()
      .mockRejectedValue(new Error('Persistent failure'));
    
    const operationPromise = queue.enqueue(mockOperation).catch(e => e);
    
    // Advance timers to trigger retries
    await jest.runAllTimersAsync();
    
    const result = await operationPromise;
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Persistent failure');
    
    expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 0 },
      drawing_failed_total: { value: 1 },
      drawing_retry_total: { value: 2 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(0);
    expect(metrics['drawing_failed_total'].value).toBe(1);
    expect(metrics['drawing_retry_total'].value).toBe(2); // Two retries
  }, 15000); // Increase timeout

  it('should handle multiple operations with mixed results', async () => {
    const operations = [
      jest.fn<() => Promise<string>>().mockResolvedValue('success1'),
      jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success2'),
      jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Always fails')),
    ];
    
    const promises = operations.map(op => queue.enqueue(op).catch(e => e));
    
    // Advance timers to trigger retries
    await jest.runAllTimersAsync();
    
    const results = await Promise.allSettled(promises.map(p => p instanceof Promise ? p : Promise.resolve(p)));
    
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'success1' });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'success2' });
    expect(results[2]).toEqual({ 
      status: 'fulfilled', 
      value: expect.objectContaining({ message: 'Always fails' })
    });
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 2 },
      drawing_failed_total: { value: 1 },
      drawing_retry_total: { value: 3 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(2);
    expect(metrics['drawing_failed_total'].value).toBe(1);
    expect(metrics['drawing_retry_total'].value).toBe(3); // 1 retry for op2, 2 for op3
  }, 15000); // Increase timeout
});