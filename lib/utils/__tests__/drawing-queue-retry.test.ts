/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DrawingOperationQueue } from '../drawing-queue';
import { metricsCollector } from '@/lib/monitoring/metrics';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DrawingOperationQueue with Retry', () => {
  let queue: DrawingOperationQueue;
  
  beforeEach(() => {
    jest.clearAllMocks();
    metricsCollector.reset();
    queue = new DrawingOperationQueue({ enableRetry: true });
  });

  it('should increment drawing_success_total on successful operation', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success');
    
    const result = await queue.enqueue(mockOperation);
    
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
    
    // Wait a bit for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metrics = metricsCollector.toJSON();
    expect(metrics.drawing_success_total.value).toBe(1);
    expect(metrics.drawing_failed_total.value).toBe(0);
    expect(metrics.drawing_retry_total.value).toBe(0);
  });

  it('should retry failed operation and increment counters', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('success after retry');
    
    const result = await queue.enqueue(mockOperation);
    
    expect(result).toBe('success after retry');
    expect(mockOperation).toHaveBeenCalledTimes(2);
    
    // Wait for async metrics update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metrics = metricsCollector.toJSON();
    expect(metrics.drawing_success_total.value).toBe(1);
    expect(metrics.drawing_failed_total.value).toBe(0);
    expect(metrics.drawing_retry_total.value).toBe(1); // One retry
  }, 10000);

  it('should increment drawing_failed_total after all retries fail', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValue(new Error('Persistent failure'));
    
    await expect(queue.enqueue(mockOperation))
      .rejects.toThrow('Persistent failure');
    
    expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    
    // Wait for async metrics update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metrics = metricsCollector.toJSON();
    expect(metrics.drawing_success_total.value).toBe(0);
    expect(metrics.drawing_failed_total.value).toBe(1);
    expect(metrics.drawing_retry_total.value).toBe(2); // Two retries
  }, 10000);

  it('should handle multiple operations with mixed results', async () => {
    const operations = [
      jest.fn().mockResolvedValue('success1'),
      jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success2'),
      jest.fn().mockRejectedValue(new Error('Always fails')),
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
    
    // Wait for async metrics update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const metrics = metricsCollector.toJSON();
    expect(metrics.drawing_success_total.value).toBe(2);
    expect(metrics.drawing_failed_total.value).toBe(1);
    expect(metrics.drawing_retry_total.value).toBe(3); // 1 retry for op2, 2 for op3
  }, 15000);
});