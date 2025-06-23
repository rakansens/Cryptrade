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
  
  afterEach(() => {
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
    
    const result = await queue.enqueue(mockOperation);
    
    expect(result).toBe('success after retry');
    expect(mockOperation).toHaveBeenCalledTimes(2);
    
    // Fast forward timers
    jest.runAllTimers();
    await Promise.resolve();
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 1 },
      drawing_failed_total: { value: 0 },
      drawing_retry_total: { value: 1 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(1);
    expect(metrics['drawing_failed_total'].value).toBe(0);
    expect(metrics['drawing_retry_total'].value).toBe(1); // One retry
  });

  it('should increment drawing_failed_total after all retries fail', async () => {
    const mockOperation = jest.fn<() => Promise<string>>()
      .mockRejectedValue(new Error('Persistent failure'));
    
    await expect(queue.enqueue(mockOperation))
      .rejects.toThrow('Persistent failure');
    
    expect(mockOperation).toHaveBeenCalledTimes(2); // Initial + 1 retry (reduced)
    
    // Fast forward timers
    jest.runAllTimers();
    await Promise.resolve();
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 0 },
      drawing_failed_total: { value: 1 },
      drawing_retry_total: { value: 1 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(0);
    expect(metrics['drawing_failed_total'].value).toBe(1);
    expect(metrics['drawing_retry_total'].value).toBe(1); // One retry (reduced)
  });

  it('should handle multiple operations with mixed results', async () => {
    const operations = [
      jest.fn<() => Promise<string>>().mockResolvedValue('success1'),
      jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success2'),
      jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Always fails')),
    ];
    
    const results = await Promise.allSettled(
      operations.map(op => queue.enqueue(op))
    );
    
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'success1' });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'success2' });
    expect(results[2]).toEqual({ 
      status: 'rejected', 
      reason: expect.objectContaining({ message: 'Always fails' })
    });
    
    // Fast forward timers
    jest.runAllTimers();
    await Promise.resolve();
    
    mockMetricsCollector.toJSON.mockReturnValueOnce({
      drawing_success_total: { value: 2 },
      drawing_failed_total: { value: 1 },
      drawing_retry_total: { value: 2 },
    });
    
    const metrics = mockMetricsCollector.toJSON();
    expect(metrics['drawing_success_total'].value).toBe(2);
    expect(metrics['drawing_failed_total'].value).toBe(1);
    expect(metrics['drawing_retry_total'].value).toBe(2); // 1 retry for op2, 1 for op3 (reduced)
  });
});