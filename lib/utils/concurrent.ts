/**
 * Concurrent Execution Utilities
 * 
 * Provides safe concurrent execution patterns with proper cleanup
 * - AbortController-based cancellation
 * - Race with cleanup for losing promises
 * - Mutex/Semaphore patterns for preventing concurrent updates
 * - Timeout with cancellation
 */

import { logger } from '@/lib/utils/logger';

/**
 * Promise.race with proper cleanup for losing promises
 * Uses AbortController to cancel ongoing operations
 */
export async function raceWithCleanup<T>(
  promises: Array<(signal: AbortSignal) => Promise<T>>,
  options?: {
    timeout?: number;
    onCleanup?: (error: Error) => void;
  }
): Promise<T> {
  const controllers: AbortController[] = [];
  const wrappedPromises: Promise<T>[] = [];

  try {
    // Create AbortController for each promise
    for (const promiseFn of promises) {
      const controller = new AbortController();
      controllers.push(controller);
      
      const promise = promiseFn(controller.signal).catch((error) => {
        // If aborted, don't propagate the error
        if (error.name === 'AbortError') {
          return new Promise<T>(() => {}); // Never resolves
        }
        throw error;
      });
      
      wrappedPromises.push(promise);
    }

    // Add timeout if specified
    if (options?.timeout) {
      const timeoutController = new AbortController();
      controllers.push(timeoutController);
      
      const timeoutPromise = new Promise<T>((_, reject) => {
        const timeoutId = setTimeout(() => {
          const error = new Error(`Operation timed out after ${options.timeout}ms`);
          error.name = 'TimeoutError';
          reject(error);
        }, options.timeout);
        
        timeoutController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });
      
      wrappedPromises.push(timeoutPromise);
    }

    // Race all promises
    const result = await Promise.race(wrappedPromises);

    // Cleanup: abort all other operations
    for (const controller of controllers) {
      controller.abort();
    }

    return result;

  } catch (error) {
    // Cleanup on error
    for (const controller of controllers) {
      controller.abort();
    }
    
    if (options?.onCleanup) {
      options.onCleanup(error as Error);
    }
    
    throw error;
  }
}

/**
 * Mutex implementation for preventing concurrent updates
 */
export class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve(() => this.release());
      } else {
        this.queue.push(() => {
          this.locked = true;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Semaphore implementation for limiting concurrent operations
 */
export class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve(() => this.release());
      } else {
        this.queue.push(() => {
          this.current++;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  async runWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Debounced async function execution
 * Cancels previous execution when called again
 */
export function createDebouncedAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  delay: number
): {
  execute: (...args: TArgs) => Promise<TResult>;
  cancel: () => void;
} {
  let timeoutId: NodeJS.Timeout | null = null;
  let currentController: AbortController | null = null;

  const execute = async (...args: TArgs): Promise<TResult> => {
    // Cancel previous execution
    if (currentController) {
      currentController.abort();
    }
    
    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Create new controller
    currentController = new AbortController();
    const signal = currentController.signal;

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          // Check if cancelled
          if (signal.aborted) {
            reject(new Error('Operation cancelled'));
            return;
          }

          const result = await fn(...args);
          
          // Check again after async operation
          if (signal.aborted) {
            reject(new Error('Operation cancelled'));
            return;
          }

          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  };

  return { execute, cancel };
}

/**
 * Create a cancellable async operation
 */
export function makeCancellable<T>(
  promise: (signal: AbortSignal) => Promise<T>
): {
  promise: Promise<T>;
  cancel: () => void;
} {
  const controller = new AbortController();

  const wrappedPromise = promise(controller.signal).catch((error) => {
    if (error.name === 'AbortError') {
      logger.debug('[Concurrent] Operation cancelled');
    }
    throw error;
  });

  return {
    promise: wrappedPromise,
    cancel: () => controller.abort()
  };
}

/**
 * Execute async function with timeout and cancellation
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeout: number
): Promise<T> {
  return raceWithCleanup([
    fn,
    (signal) => new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
      
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      });
    })
  ]);
}

/**
 * Batch async operations with rate limiting
 */
export class AsyncBatcher<TItem, TResult> {
  private queue: Array<{
    item: TItem;
    resolve: (result: TResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;
  private mutex = new Mutex();

  constructor(
    private readonly batchFn: (items: TItem[]) => Promise<TResult[]>,
    private readonly options: {
      maxBatchSize: number;
      maxWaitTime: number;
      concurrency?: number;
    }
  ) {}

  async add(item: TItem): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      this.scheduleProcess();
    });
  }

  private scheduleProcess(): void {
    if (!this.processing) {
      this.processing = true;
      setTimeout(() => this.process(), 0);
    }
  }

  private async process(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.options.maxBatchSize);
        
        try {
          const results = await this.batchFn(batch.map(b => b.item));
          
          // Resolve all promises in the batch
          batch.forEach((item, index) => {
            item.resolve(results[index] as TResult);
          });
        } catch (error) {
          // Reject all promises in the batch
          batch.forEach(item => {
            item.reject(error as Error);
          });
        }
      }
      
      this.processing = false;
    });
  }
}

/**
 * State update queue to prevent race conditions
 */
export class StateUpdateQueue<T> {
  private queue: Array<(currentState: T) => T | Promise<T>> = [];
  private processing = false;
  private currentState: T;
  private mutex = new Mutex();

  constructor(
    initialState: T,
    private readonly onUpdate: (newState: T) => void | Promise<void>
  ) {
    this.currentState = initialState;
  }

  async enqueue(updater: (currentState: T) => T | Promise<T>): Promise<void> {
    return this.mutex.runExclusive(async () => {
      this.queue.push(updater);
      if (!this.processing) {
        await this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const updater = this.queue.shift()!;
      
      try {
        const newState = await updater(this.currentState);
        this.currentState = newState;
        await this.onUpdate(newState);
      } catch (error) {
        logger.error('[StateUpdateQueue] Update failed', { error });
      }
    }
    
    this.processing = false;
  }

  getState(): T {
    return this.currentState;
  }
}