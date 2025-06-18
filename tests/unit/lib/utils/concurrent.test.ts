import { describe, it, expect, beforeEach, afterEach, jest, afterAll } from '@jest/globals';
import {
  raceWithCleanup,
  Mutex,
  Semaphore,
  createDebouncedAsync,
  makeCancellable,
  withTimeout,
  AsyncBatcher,
  StateUpdateQueue
} from '@/lib/utils/concurrent';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('concurrent utilities', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('raceWithCleanup', () => {
    it('should return the first resolved promise and abort others', async () => {
      const abortCounts = { p1: 0, p2: 0, p3: 0 };
      
      const promises = [
        (signal: AbortSignal) => {
          signal.addEventListener('abort', () => abortCounts.p1++);
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              if (!signal.aborted) resolve('first');
            }, 10);
          });
        },
        (signal: AbortSignal) => {
          signal.addEventListener('abort', () => abortCounts.p2++);
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              if (!signal.aborted) resolve('second');
            }, 50);
          });
        },
        (signal: AbortSignal) => {
          signal.addEventListener('abort', () => abortCounts.p3++);
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              if (!signal.aborted) resolve('third');
            }, 100);
          });
        }
      ];

      const result = await raceWithCleanup(promises);
      expect(result).toBe('first');
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(abortCounts.p2).toBe(1);
      expect(abortCounts.p3).toBe(1);
    });

    it('should handle timeout option', async () => {
      const promises = [
        (signal: AbortSignal) => new Promise<string>((resolve) => {
          setTimeout(() => resolve('slow'), 200);
        })
      ];

      await expect(
        raceWithCleanup(promises, { timeout: 50 })
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should call onCleanup on error', async () => {
      const onCleanup = jest.fn();
      const error = new Error('Test error');
      
      const promises = [
        () => Promise.reject(error)
      ];

      await expect(
        raceWithCleanup(promises, { onCleanup })
      ).rejects.toThrow('Test error');
      
      expect(onCleanup).toHaveBeenCalledWith(error);
    });

    it('should handle AbortError without propagating', async () => {
      const promises = [
        (signal: AbortSignal) => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';
          return Promise.reject(abortError);
        },
        (signal: AbortSignal) => new Promise<string>((resolve) => {
          setTimeout(() => resolve('success'), 50);
        })
      ];

      const result = await raceWithCleanup(promises);
      expect(result).toBe('success');
    });

    it('should handle empty promise array', async () => {
      const result = await raceWithCleanup([]);
      expect(result).toBeUndefined();
    });
  });

  describe('Mutex', () => {
    it('should ensure exclusive access', async () => {
      const mutex = new Mutex();
      const order: number[] = [];

      const task1 = mutex.runExclusive(async () => {
        order.push(1);
        await new Promise(resolve => setTimeout(resolve, 50));
        order.push(2);
        return 'task1';
      });

      const task2 = mutex.runExclusive(async () => {
        order.push(3);
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(4);
        return 'task2';
      });

      const results = await Promise.all([task1, task2]);
      
      expect(results).toEqual(['task1', 'task2']);
      expect(order).toEqual([1, 2, 3, 4]);
    });

    it('should handle errors in exclusive function', async () => {
      const mutex = new Mutex();
      
      await expect(
        mutex.runExclusive(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Should still be able to acquire after error
      const result = await mutex.runExclusive(async () => 'success');
      expect(result).toBe('success');
    });

    it('should queue multiple requests', async () => {
      const mutex = new Mutex();
      const results: string[] = [];

      const tasks = Array.from({ length: 5 }, (_, i) => 
        mutex.runExclusive(async () => {
          results.push(`start-${i}`);
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(`end-${i}`);
          return i;
        })
      );

      await Promise.all(tasks);

      // Check that tasks didn't interleave
      for (let i = 0; i < 5; i++) {
        const startIdx = results.indexOf(`start-${i}`);
        const endIdx = results.indexOf(`end-${i}`);
        expect(endIdx).toBe(startIdx + 1);
      }
    });
  });

  describe('Semaphore', () => {
    it('should limit concurrent operations', async () => {
      const semaphore = new Semaphore(2);
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async (id: number) => {
        await semaphore.runWithLimit(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          concurrent--;
          return id;
        });
      };

      await Promise.all([task(1), task(2), task(3), task(4)]);
      
      expect(maxConcurrent).toBe(2);
      expect(concurrent).toBe(0);
    });

    it('should handle zero concurrency', async () => {
      const semaphore = new Semaphore(0);
      
      const promise = semaphore.runWithLimit(async () => 'result');
      
      // Should be stuck waiting
      let resolved = false;
      promise.then(() => { resolved = true; });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resolved).toBe(false);
    });

    it('should handle errors without affecting the semaphore', async () => {
      const semaphore = new Semaphore(1);
      
      await expect(
        semaphore.runWithLimit(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Should still work after error
      const result = await semaphore.runWithLimit(async () => 'success');
      expect(result).toBe('success');
    });
  });

  describe('createDebouncedAsync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const { execute } = createDebouncedAsync(fn, 100);

      const promise1 = execute('arg1');
      const promise2 = execute('arg2');
      const promise3 = execute('arg3');

      // Only the last call should execute
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks
      
      await expect(promise1).rejects.toThrow('Operation cancelled');
      await expect(promise2).rejects.toThrow('Operation cancelled');
      await expect(promise3).resolves.toBe('result');
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should cancel previous timeouts', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const { execute, cancel } = createDebouncedAsync(fn, 100);

      const promise = execute('arg');
      cancel();

      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks
      
      await expect(promise).rejects.toThrow('Operation cancelled');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should handle async function errors', async () => {
      const error = new Error('Async error');
      const fn = jest.fn().mockRejectedValue(error);
      const { execute } = createDebouncedAsync(fn, 100);

      const promise = execute('arg');
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks
      
      await expect(promise).rejects.toThrow('Async error');
    });

    it('should handle abort during execution', async () => {
      let resolveFunc: (value: string) => void;
      let callCount = 0;
      const fn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise<string>(resolve => { resolveFunc = resolve; });
        }
        return Promise.resolve('result2');
      });
      const { execute } = createDebouncedAsync(fn, 100);

      const promise1 = execute('arg1');
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks
      
      // The first function should have been called
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Start another execution while first is still running
      const promise2 = execute('arg2');
      
      // First promise should be cancelled
      await expect(promise1).rejects.toThrow('Operation cancelled');
      
      // Advance time for second execution
      jest.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks
      
      // Second execution should complete with its own result
      await expect(promise2).resolves.toBe('result2');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('arg2');
    });
  });

  describe('makeCancellable', () => {
    it('should create cancellable promise', async () => {
      let aborted = false;
      const { promise, cancel } = makeCancellable(async (signal) => {
        signal.addEventListener('abort', () => { aborted = true; });
        await new Promise(resolve => setTimeout(resolve, 100));
        if (signal.aborted) throw new Error('Aborted');
        return 'success';
      });

      cancel();
      
      await expect(promise).rejects.toThrow();
      expect(aborted).toBe(true);
    });

    it('should handle AbortError', async () => {
      const { promise, cancel } = makeCancellable(async (signal) => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        throw error;
      });

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should complete normally without cancellation', async () => {
      const { promise } = makeCancellable(async (signal) => {
        return 'success';
      });

      await expect(promise).resolves.toBe('success');
    });
  });

  describe('withTimeout', () => {
    it('should complete within timeout', async () => {
      const result = await withTimeout(
        async (signal) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        },
        100
      );
      
      expect(result).toBe('success');
    });

    it('should timeout if operation takes too long', async () => {
      await expect(
        withTimeout(
          async (signal) => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return 'success';
          },
          50
        )
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should cleanup on timeout', async () => {
      let cleaned = false;
      
      await expect(
        withTimeout(
          async (signal) => {
            signal.addEventListener('abort', () => { cleaned = true; });
            await new Promise(resolve => setTimeout(resolve, 200));
            return 'success';
          },
          50
        )
      ).rejects.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cleaned).toBe(true);
    });
  });

  describe('AsyncBatcher', () => {
    it('should batch operations', async () => {
      const batchFn = jest.fn().mockImplementation((items: number[]) => 
        Promise.resolve(items.map(i => i * 2))
      );
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 3,
        maxWaitTime: 50
      });

      const results = await Promise.all([
        batcher.add(1),
        batcher.add(2),
        batcher.add(3),
        batcher.add(4),
        batcher.add(5)
      ]);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
      expect(batchFn).toHaveBeenCalledWith([4, 5]);
    });

    it('should handle batch errors', async () => {
      const error = new Error('Batch error');
      const batchFn = jest.fn().mockRejectedValue(error);
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 2,
        maxWaitTime: 50
      });

      await expect(batcher.add(1)).rejects.toThrow('Batch error');
      await expect(batcher.add(2)).rejects.toThrow('Batch error');
    });

    it('should process empty batch', async () => {
      const batchFn = jest.fn().mockResolvedValue([]);
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 5,
        maxWaitTime: 50
      });

      // Add nothing and wait
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(batchFn).not.toHaveBeenCalled();
    });

    it('should handle mismatched result count', async () => {
      const batchFn = jest.fn().mockResolvedValue([1]); // Return only one result
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 3,
        maxWaitTime: 50
      });

      const results = await Promise.all([
        batcher.add(1),
        batcher.add(2)
      ]);

      expect(results[0]).toBe(1);
      expect(results[1]).toBeUndefined();
    });
  });

  describe('StateUpdateQueue', () => {
    it('should process updates sequentially', async () => {
      const updates: number[] = [];
      const onUpdate = jest.fn().mockImplementation((state) => {
        updates.push(state);
      });
      
      const queue = new StateUpdateQueue(0, onUpdate);

      await Promise.all([
        queue.enqueue(state => state + 1),
        queue.enqueue(state => state + 2),
        queue.enqueue(state => state + 3)
      ]);

      expect(updates).toEqual([1, 3, 6]);
      expect(queue.getState()).toBe(6);
    });

    it('should handle async updaters', async () => {
      const onUpdate = jest.fn();
      const queue = new StateUpdateQueue({ count: 0 }, onUpdate);

      await queue.enqueue(async (state) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { count: state.count + 1 };
      });

      expect(queue.getState()).toEqual({ count: 1 });
    });

    it('should handle update errors', async () => {
      const onUpdate = jest.fn();
      const queue = new StateUpdateQueue(0, onUpdate);

      await queue.enqueue(() => {
        throw new Error('Update error');
      });

      // Should not update state on error
      expect(queue.getState()).toBe(0);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('should handle onUpdate errors', async () => {
      const onUpdate = jest.fn().mockRejectedValue(new Error('onUpdate error'));
      const queue = new StateUpdateQueue(0, onUpdate);

      await queue.enqueue(state => state + 1);

      // State should update even if onUpdate fails
      expect(queue.getState()).toBe(1);
    });

    it('should maintain order with concurrent enqueues', async () => {
      const updates: string[] = [];
      const onUpdate = jest.fn().mockImplementation((state) => {
        updates.push(state);
      });
      
      const queue = new StateUpdateQueue('', onUpdate);

      // Enqueue updates with varying delays
      const promises = [
        queue.enqueue(async (state) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return state + 'A';
        }),
        queue.enqueue(async (state) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return state + 'B';
        }),
        queue.enqueue(state => state + 'C')
      ];

      await Promise.all(promises);

      expect(updates).toEqual(['A', 'AB', 'ABC']);
      expect(queue.getState()).toBe('ABC');
    });
  });
});