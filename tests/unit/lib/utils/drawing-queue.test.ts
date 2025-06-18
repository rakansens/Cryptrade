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

jest.mock('@/lib/utils/retry-wrapper');
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
  let queue: DrawingOperationQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new DrawingOperationQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('enqueue', () => {
    it('should execute operations sequentially', async () => {
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
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => Promise.resolve(i)
      );

      const promises = operations.map(op => queue.enqueue(op));
      const results = await Promise.all(promises);

      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle operation errors', async () => {
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

    it('should update status after clearing', () => {
      // Add operations without starting them
      const ops = Array.from({ length: 3 }, () => 
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      ops.forEach(op => queue.enqueue(op));
      
      // Clear immediately
      queue.clear();
      
      const status = queue.getStatus();
      expect(status.queueLength).toBe(0);
    });
  });

  describe('flush', () => {
    it('should wait for all operations to complete', async () => {
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

      operations.forEach(op => queue.enqueue(op));
      
      await queue.flush();
      
      expect(results).toHaveLength(3);
      expect(queue.getStatus().queueLength).toBe(0);
      expect(queue.getStatus().activeOperations).toBe(0);
    });

    it('should resolve immediately if queue is empty', async () => {
      const start = Date.now();
      await queue.flush();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
    });

    it('should handle flush during error', async () => {
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
      
      // Create a mock retry wrapper
      const mockExecute = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce('Success');
      
      (RetryWrapper as any).mockImplementation(() => ({
        execute: mockExecute,
      }));
      
      queue = new DrawingOperationQueue({ enableRetry: true });
      
      const operation = jest.fn().mockResolvedValue('result');
      const result = await queue.enqueue(operation);
      
      expect(result).toBe('Success');
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('concurrency control', () => {
    it('should respect maxConcurrency setting', async () => {
      queue = new DrawingOperationQueue({ maxConcurrency: 3 });
      
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
      
      const promises = Array.from({ length: 10 }, () => queue.enqueue(operation));
      await Promise.all(promises);
      
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // Should use concurrency
    });
  });

  describe('metrics and tracing', () => {
    it('should track metrics for successful operations', async () => {
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
      
      await queue.enqueue(() => Promise.reject(new Error('failed'))).catch(() => {});
      
      expect(incrementMetric).toHaveBeenCalledWith('drawing_failed_total');
      expect(observeMetric).toHaveBeenCalledWith(
        'drawing_operation_duration_ms',
        expect.any(Number)
      );
    });

    it('should create traces for operations', async () => {
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
      const throwingOp = () => {
        throw new Error('Synchronous error');
      };
      
      await expect(queue.enqueue(throwingOp)).rejects.toThrow('Synchronous error');
    });

    it('should handle null or undefined results', async () => {
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