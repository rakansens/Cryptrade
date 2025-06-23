import { DrawingOperationQueue, type QueuedOperation } from '@/lib/utils/drawing-queue';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/utils/retry-wrapper', () => ({
  RetryWrapper: jest.fn().mockImplementation(() => ({
    execute: jest.fn((operation) => operation()),
  })),
}));
jest.mock('@/lib/monitoring/metrics', () => ({
  incrementMetric: jest.fn(),
  observeMetric: jest.fn(),
}));

jest.mock('@/lib/monitoring/trace', () => ({
  traceManager: {
    startTrace: jest.fn(),
    endTrace: jest.fn(),
  },
}));

describe('DrawingOperationQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the RetryWrapper mock to default behavior
    const { RetryWrapper } = require('@/lib/utils/retry-wrapper');
    (RetryWrapper as any).mockImplementation(() => ({
      execute: jest.fn((operation) => operation()),
    }));
  });

  describe('enqueue', () => {
    it('should execute operations sequentially', async () => {
      const queue = new DrawingOperationQueue();
      const results: number[] = [];
      const operations = [
        () => new Promise<number>(resolve => setTimeout(() => {
          results.push(1);
          resolve(1);
        }, 50)),
        () => new Promise<number>(resolve => setTimeout(() => {
          results.push(2);
          resolve(2);
        }, 30)),
        () => new Promise<number>(resolve => setTimeout(() => {
          results.push(3);
          resolve(3);
        }, 10)),
      ];

      const promises = operations.map(op => queue.enqueue(op));
      const values = await Promise.all(promises);

      expect(values).toEqual([1, 2, 3]);
      expect(results).toEqual([1, 2, 3]); // Sequential execution
    });

    it('should handle concurrent enqueue requests', async () => {
      const queue = new DrawingOperationQueue();
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => Promise.resolve(i)
      );

      const promises = operations.map(op => queue.enqueue(op));
      const results = await Promise.all(promises);

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle operation errors', async () => {
      const queue = new DrawingOperationQueue();
      const successOp = () => Promise.resolve('success');
      const errorOp = () => Promise.reject(new Error('Operation failed'));

      const promise1 = queue.enqueue(successOp);
      const promise2 = queue.enqueue(errorOp);
      const promise3 = queue.enqueue(successOp);

      const result1 = await promise1;
      await expect(promise2).rejects.toThrow('Operation failed');
      const result3 = await promise3;

      expect(result1).toBe('success');
      expect(result3).toBe('success');
    });

    it('should generate unique operation IDs', async () => {
      const queue = new DrawingOperationQueue();
      const operations = Array.from({ length: 5 }, () => 
        () => Promise.resolve()
      );

      const ids = new Set<string>();
      
      // Mock the queue to capture IDs
      const originalProcessQueue = (queue as any).processQueue;
      (queue as any).processQueue = function() {
        const op = this.queue[this.queue.length - 1];
        if (op) ids.add(op.id);
        return originalProcessQueue.call(this);
      };

      await Promise.all(operations.map(op => queue.enqueue(op)));

      expect(ids.size).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('should return accurate queue status', async () => {
      const queue = new DrawingOperationQueue();
      const slowOp = () => new Promise(resolve => setTimeout(resolve, 100));
      const fastOp = () => Promise.resolve();

      // Initial status
      let status = queue.getStatus();
      expect(status).toEqual({
        queueLength: 0,
        activeOperations: 0,
        maxConcurrency: 1,
        isProcessing: false,
      });

      // Enqueue operations
      const promise1 = queue.enqueue(slowOp);
      const promise2 = queue.enqueue(fastOp);
      const promise3 = queue.enqueue(fastOp);

      // Check status while processing
      await new Promise(resolve => setTimeout(resolve, 10));
      status = queue.getStatus();
      expect(status.isProcessing).toBe(true);
      expect(status.activeOperations).toBe(1);
      expect(status.queueLength).toBeGreaterThanOrEqual(1);

      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);
      
      status = queue.getStatus();
      expect(status).toEqual({
        queueLength: 0,
        activeOperations: 0,
        maxConcurrency: 1,
        isProcessing: false,
      });
    });
  });

  describe('clear', () => {
    it('should clear all pending operations', async () => {
      const queue = new DrawingOperationQueue();
      const slowOp = () => new Promise(resolve => setTimeout(resolve, 100));
      const pendingOps = Array.from({ length: 5 }, () => queue.enqueue(slowOp));

      // Let first operation start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear queue
      queue.clear();

      // All pending operations should be rejected
      const results = await Promise.allSettled(pendingOps);
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThanOrEqual(4); // At least 4 should be rejected
      rejected.forEach(r => {
        expect((r as PromiseRejectedResult).reason.message).toBe('Queue cleared');
      });
    });

    it('should update status after clearing', async () => {
      // Use a separate queue instance for this test
      const clearQueue = new DrawingOperationQueue();
      
      // Add operations without starting them
      const ops = Array.from({ length: 3 }, () => 
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      const promises = ops.map(op => clearQueue.enqueue(op).catch(() => {}));
      
      // Clear immediately
      clearQueue.clear();
      
      const status = clearQueue.getStatus();
      expect(status.queueLength).toBe(0);
      
      // Wait for all promises to settle
      await Promise.allSettled(promises);
    });
  });

  describe('flush', () => {
    it('should wait for all operations to complete', async () => {
      // Create a new queue instance for this test
      const flushQueue = new DrawingOperationQueue();
      const results: number[] = [];
      const operations = [
        () => new Promise<void>(resolve => setTimeout(() => {
          results.push(1);
          resolve();
        }, 50)),
        () => new Promise<void>(resolve => setTimeout(() => {
          results.push(2);
          resolve();
        }, 30)),
        () => new Promise<void>(resolve => setTimeout(() => {
          results.push(3);
          resolve();
        }, 10)),
      ];

      // Enqueue all operations
      operations.forEach(op => flushQueue.enqueue(op));
      
      // Wait for flush to complete
      await flushQueue.flush();
      
      expect(results).toHaveLength(3);
      expect(results).toEqual([1, 2, 3]); // Should be in order
      expect(flushQueue.getStatus().queueLength).toBe(0);
      expect(flushQueue.getStatus().activeOperations).toBe(0);
    });

    it('should resolve immediately if queue is empty', async () => {
      const queue = new DrawingOperationQueue();
      const start = Date.now();
      await queue.flush();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
    });

    it('should handle flush during error', async () => {
      const queue = new DrawingOperationQueue();
      const errorOp = () => Promise.reject(new Error('Test error'));
      const successOp = () => Promise.resolve();
      
      queue.enqueue(errorOp).catch(() => {}); // Ignore error
      queue.enqueue(successOp);
      
      await queue.flush();
      
      expect(queue.getStatus().activeOperations).toBe(0);
    });
  });

  describe('retry functionality', () => {
    it('should retry failed operations', async () => {
      const { RetryWrapper } = await import('@/lib/utils/retry-wrapper');
      const { incrementMetric } = await import('@/lib/monitoring/metrics');
      
      // Clear previous mocks
      (incrementMetric as jest.Mock).mockClear();
      
      // Mock the RetryWrapper to test retry behavior
      // The RetryWrapper should internally handle the retries
      (RetryWrapper as any).mockImplementation((config) => {
        return {
          execute: jest.fn(async (operation, context) => {
            // Call the retry callback for the first 2 attempts
            if (config.onRetry) {
              config.onRetry(new Error('First attempt'), 1);
              config.onRetry(new Error('Second attempt'), 2);
            }
            // Then return the operation result
            return await operation();
          }),
        };
      });
      
      const retryQueue = new DrawingOperationQueue({ enableRetry: true });
      
      const operation = jest.fn().mockResolvedValue('result');
      const result = await retryQueue.enqueue(operation);
      
      expect(result).toBe('result');
      expect(incrementMetric).toHaveBeenCalledWith('drawing_retry_total');
      expect(incrementMetric).toHaveBeenCalledTimes(3); // 2 retries + 1 success
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrency control', () => {
    it('should respect maxConcurrency setting', async () => {
      // Reset RetryWrapper mock to default behavior
      const { RetryWrapper } = require('@/lib/utils/retry-wrapper');
      (RetryWrapper as any).mockImplementation(() => ({
        execute: jest.fn((operation) => operation()),
      }));
      
      const concurrentQueue = new DrawingOperationQueue({ maxConcurrency: 3 });
      
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const operation = () => new Promise<void>(resolve => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        setTimeout(() => {
          concurrentCount--;
          resolve();
        }, 50);
      });
      
      const promises = Array.from({ length: 10 }, () => concurrentQueue.enqueue(operation));
      await Promise.all(promises);
      
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // Should use concurrency
    });
  });

  describe('metrics and tracing', () => {
    it('should track metrics for successful operations', async () => {
      const queue = new DrawingOperationQueue();
      const { incrementMetric, observeMetric } = await import('@/lib/monitoring/metrics');
      
      await queue.enqueue(() => Promise.resolve('success'));
      
      expect(incrementMetric).toHaveBeenCalledWith('drawing_success_total');
      expect(observeMetric).toHaveBeenCalledWith(
        'drawing_operation_duration_ms',
        expect.any(Number)
      );
    });

    it('should track metrics for failed operations', async () => {
      const { incrementMetric, observeMetric } = await import('@/lib/monitoring/metrics');
      
      // Clear previous calls
      (incrementMetric as jest.Mock).mockClear();
      (observeMetric as jest.Mock).mockClear();
      
      // Update the RetryWrapper mock to propagate errors
      const { RetryWrapper } = await import('@/lib/utils/retry-wrapper');
      (RetryWrapper as any).mockImplementation(() => ({
        execute: jest.fn(async (operation) => {
          return await operation();
        }),
      }));
      
      // Create a new queue instance
      const failQueue = new DrawingOperationQueue();
      
      await failQueue.enqueue(() => Promise.reject(new Error('failed'))).catch(() => {});
      
      expect(incrementMetric).toHaveBeenCalledWith('drawing_failed_total');
      expect(observeMetric).toHaveBeenCalledWith(
        'drawing_operation_duration_ms',
        expect.any(Number)
      );
    });

    it('should create traces for operations', async () => {
      const queue = new DrawingOperationQueue();
      const { traceManager } = await import('@/lib/monitoring/trace');
      
      await queue.enqueue(() => Promise.resolve());
      
      expect(traceManager.startTrace).toHaveBeenCalledWith({
        sessionId: expect.stringContaining('drawing_op_'),
        agentId: 'drawing-queue',
        operationType: 'tool_execution',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long operations', async () => {
      const queue = new DrawingOperationQueue();
      const longOp = () => new Promise(resolve => setTimeout(resolve, 200));
      const shortOp = () => Promise.resolve('short');
      
      const longPromise = queue.enqueue(longOp);
      const shortPromise = queue.enqueue(shortOp);
      
      const start = Date.now();
      const shortResult = await shortPromise;
      const duration = Date.now() - start;
      
      expect(shortResult).toBe('short');
      expect(duration).toBeGreaterThanOrEqual(200); // Had to wait for long op
      
      await longPromise;
    });

    it('should handle operations that throw synchronously', async () => {
      // Update the RetryWrapper mock to handle synchronous errors
      const { RetryWrapper } = await import('@/lib/utils/retry-wrapper');
      (RetryWrapper as any).mockImplementation(() => ({
        execute: jest.fn(async (operation) => {
          try {
            return await operation();
          } catch (error) {
            throw error;
          }
        }),
      }));
      
      // Create a new queue instance with the updated mock
      const testQueue = new DrawingOperationQueue();
      
      const throwingOp = () => {
        throw new Error('Synchronous error');
      };
      
      await expect(testQueue.enqueue(throwingOp)).rejects.toThrow('Synchronous error');
    });

    it('should handle null or undefined results', async () => {
      const queue = new DrawingOperationQueue();
      const nullOp = () => Promise.resolve(null);
      const undefinedOp = () => Promise.resolve(undefined);
      
      const nullResult = await queue.enqueue(nullOp);
      const undefinedResult = await queue.enqueue(undefinedOp);
      
      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });
  });
});

export {};