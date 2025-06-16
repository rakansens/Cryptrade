/**
 * Tests for concurrent execution utilities
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  raceWithCleanup,
  Mutex,
  Semaphore,
  createDebouncedAsync,
  makeCancellable,
  withTimeout,
  AsyncBatcher,
  StateUpdateQueue
} from '../concurrent';

describe('Concurrent Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('raceWithCleanup', () => {
    it('should return the result of the first resolved promise', async () => {
      const promise1 = jest.fn((signal: AbortSignal) => 
        new Promise<string>((resolve) => {
          setTimeout(() => {
            if (!signal.aborted) resolve('first');
          }, 100);
        })
      );
      
      const promise2 = jest.fn((signal: AbortSignal) => 
        new Promise<string>((resolve) => {
          setTimeout(() => {
            if (!signal.aborted) resolve('second');
          }, 200);
        })
      );

      const resultPromise = raceWithCleanup([promise1, promise2]);
      
      // Fast forward to first promise resolution
      await jest.advanceTimersByTimeAsync(100);
      
      const result = await resultPromise;
      expect(result).toBe('first');
      expect(promise1).toHaveBeenCalled();
      expect(promise2).toHaveBeenCalled();
    });

    it('should abort losing promises', async () => {
      const abortedSignals: boolean[] = [];
      
      const promise1 = jest.fn((signal: AbortSignal) => 
        new Promise<string>((resolve) => {
          signal.addEventListener('abort', () => {
            abortedSignals.push(true);
          });
          setTimeout(() => {
            if (!signal.aborted) resolve('first');
          }, 50);
        })
      );
      
      const promise2 = jest.fn((signal: AbortSignal) => 
        new Promise<string>((resolve) => {
          signal.addEventListener('abort', () => {
            abortedSignals.push(true);
          });
          setTimeout(() => {
            if (!signal.aborted) resolve('second');
          }, 200);
        })
      );

      const resultPromise = raceWithCleanup([promise1, promise2]);
      
      await jest.advanceTimersByTimeAsync(50);
      await resultPromise;
      
      // The second promise should have been aborted
      expect(abortedSignals).toHaveLength(1);
    });

    it('should handle timeout option', async () => {
      const promise = jest.fn((signal: AbortSignal) => 
        new Promise<string>((resolve) => {
          setTimeout(() => {
            if (!signal.aborted) resolve('result');
          }, 200);
        })
      );

      const resultPromise = raceWithCleanup([promise], { timeout: 100 });
      
      await jest.advanceTimersByTimeAsync(100);
      
      await expect(resultPromise).rejects.toThrow('Operation timed out after 100ms');
    });
  });

  describe('Mutex', () => {
    it('should prevent concurrent access', async () => {
      const mutex = new Mutex();
      const executionOrder: number[] = [];
      
      const task1 = mutex.runExclusive(async () => {
        executionOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 100));
        executionOrder.push(2);
        return 'result1';
      });
      
      const task2 = mutex.runExclusive(async () => {
        executionOrder.push(3);
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(4);
        return 'result2';
      });
      
      // Start both tasks
      const results = Promise.all([task1, task2]);
      
      // Advance time to complete both tasks
      await jest.advanceTimersByTimeAsync(150);
      
      const [result1, result2] = await results;
      
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Semaphore', () => {
    it('should limit concurrent operations', async () => {
      const semaphore = new Semaphore(2);
      const runningTasks = new Set<number>();
      let maxConcurrent = 0;
      
      const createTask = (id: number) => 
        semaphore.runWithLimit(async () => {
          runningTasks.add(id);
          maxConcurrent = Math.max(maxConcurrent, runningTasks.size);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          runningTasks.delete(id);
          return `task${id}`;
        });
      
      // Start 4 tasks with max concurrency of 2
      const tasks = [
        createTask(1),
        createTask(2),
        createTask(3),
        createTask(4)
      ];
      
      // Let first batch start
      await jest.advanceTimersByTimeAsync(0);
      expect(runningTasks.size).toBe(2);
      
      // Complete first batch
      await jest.advanceTimersByTimeAsync(100);
      
      // Let second batch start
      await jest.advanceTimersByTimeAsync(0);
      
      // Complete second batch
      await jest.advanceTimersByTimeAsync(100);
      
      await Promise.all(tasks);
      
      expect(maxConcurrent).toBe(2);
    });
  });

  describe('createDebouncedAsync', () => {
    it('should debounce async function calls', async () => {
      const asyncFn = jest.fn(async (value: string) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return `processed: ${value}`;
      });
      
      const { execute, cancel } = createDebouncedAsync(asyncFn, 100);
      
      // Make multiple calls
      const promise1 = execute('first');
      const promise2 = execute('second');
      const promise3 = execute('third');
      
      // Advance time past debounce delay
      await jest.advanceTimersByTimeAsync(100);
      
      // Advance time for async function to complete
      await jest.advanceTimersByTimeAsync(50);
      
      // Only the last call should have been executed
      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(asyncFn).toHaveBeenCalledWith('third');
      
      const result = await promise3;
      expect(result).toBe('processed: third');
      
      // Earlier promises should have been cancelled
      await expect(promise1).rejects.toThrow('Operation cancelled');
      await expect(promise2).rejects.toThrow('Operation cancelled');
    });

    it('should cancel pending operations', async () => {
      const asyncFn = jest.fn(async () => 'result');
      const { execute, cancel } = createDebouncedAsync(asyncFn, 100);
      
      const promise = execute();
      cancel();
      
      await expect(promise).rejects.toThrow('Operation cancelled');
      expect(asyncFn).not.toHaveBeenCalled();
    });
  });

  describe('withTimeout', () => {
    it('should complete if operation finishes before timeout', async () => {
      const operation = jest.fn(async (signal: AbortSignal) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      });
      
      const resultPromise = withTimeout(operation, 100);
      
      await jest.advanceTimersByTimeAsync(50);
      
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should timeout if operation takes too long', async () => {
      const operation = jest.fn(async (signal: AbortSignal) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'success';
      });
      
      const resultPromise = withTimeout(operation, 100);
      
      await jest.advanceTimersByTimeAsync(100);
      
      await expect(resultPromise).rejects.toThrow('Operation timed out after 100ms');
    });
  });

  describe('StateUpdateQueue', () => {
    it('should process state updates sequentially', async () => {
      const updates: number[] = [];
      const onUpdate = jest.fn(async (state: number) => {
        updates.push(state);
      });
      
      const queue = new StateUpdateQueue(0, onUpdate);
      
      // Enqueue multiple updates
      await queue.enqueue(state => state + 1);
      await queue.enqueue(state => state * 2);
      await queue.enqueue(state => state + 10);
      
      expect(updates).toEqual([1, 2, 12]);
      expect(onUpdate).toHaveBeenCalledTimes(3);
      expect(queue.getState()).toBe(12);
    });

    it('should handle async updaters', async () => {
      const onUpdate = jest.fn();
      const queue = new StateUpdateQueue({ count: 0 }, onUpdate);
      
      await queue.enqueue(async (state) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { count: state.count + 1 };
      });
      
      await jest.advanceTimersByTimeAsync(50);
      
      expect(queue.getState()).toEqual({ count: 1 });
      expect(onUpdate).toHaveBeenCalledWith({ count: 1 });
    });
  });

  describe('AsyncBatcher', () => {
    it('should batch multiple requests', async () => {
      const batchFn = jest.fn(async (items: number[]) => {
        return items.map(item => item * 2);
      });
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 3,
        maxWaitTime: 100
      });
      
      // Add multiple items
      const promises = [
        batcher.add(1),
        batcher.add(2),
        batcher.add(3),
        batcher.add(4)
      ];
      
      // Let the batcher process
      await jest.advanceTimersByTimeAsync(0);
      
      const results = await Promise.all(promises);
      
      expect(results).toEqual([2, 4, 6, 8]);
      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
      expect(batchFn).toHaveBeenCalledWith([4]);
    });

    it('should handle batch errors', async () => {
      const batchFn = jest.fn(async () => {
        throw new Error('Batch failed');
      });
      
      const batcher = new AsyncBatcher(batchFn, {
        maxBatchSize: 2,
        maxWaitTime: 100
      });
      
      const promise1 = batcher.add(1);
      const promise2 = batcher.add(2);
      
      await jest.advanceTimersByTimeAsync(0);
      
      await expect(promise1).rejects.toThrow('Batch failed');
      await expect(promise2).rejects.toThrow('Batch failed');
    });
  });
});