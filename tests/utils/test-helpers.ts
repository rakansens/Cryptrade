/**
 * Test utility helpers for performance optimization
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';

/**
 * Fast wait function that reduces delays in test environment
 * @param ms - milliseconds to wait (will be reduced in test env)
 */
export async function fastWait(ms: number): Promise<void> {
  // In test environment, reduce delays significantly
  const reducedDelay = process.env.NODE_ENV === 'test' 
    ? Math.min(ms / 10, 10) 
    : ms;
  
  return new Promise(resolve => setTimeout(resolve, reducedDelay));
}

/**
 * Mock metrics collector for faster tests
 */
export const mockMetricsCollector = {
  increment: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  reset: jest.fn(),
  toJSON: jest.fn(() => ({
    drawing_success_total: { value: 0 },
    drawing_failed_total: { value: 0 },
    drawing_retry_total: { value: 0 },
  })),
};

/**
 * Fast retry configuration for tests
 */
export const testRetryConfig = {
  maxAttempts: 2, // Reduce from 3
  initialDelay: 10, // Reduce from 100ms
  maxDelay: 50, // Reduce from 1000ms
  backoffMultiplier: 1.5, // Reduce from 2
};

/**
 * Create a mock operation that resolves after a reduced delay
 */
export function createMockOperation<T>(
  result: T | Error,
  delay: number = 0
): jest.Mock<() => Promise<T>> {
  return jest.fn<() => Promise<T>>().mockImplementation(async () => {
    if (delay > 0) {
      await fastWait(delay);
    }
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
}

/**
 * Run tests with fake timers for better performance
 */
export function runWithFakeTimers(fn: () => void | Promise<void>) {
  return async () => {
    jest.useFakeTimers();
    try {
      const result = fn();
      if (result instanceof Promise) {
        // Fast-forward timers while waiting
        while (jest.getTimerCount() > 0) {
          jest.advanceTimersByTime(10);
          await Promise.resolve();
        }
        await result;
      }
    } finally {
      jest.useRealTimers();
    }
  };
}

/**
 * Mock logger for tests
 */
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/**
 * Setup common test mocks
 */
export function setupCommonMocks() {
  // Mock console to reduce noise
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  
  // Return cleanup function
  return () => {
    jest.restoreAllMocks();
  };
}

/**
 * Resource leak detector for tests
 */
export class ResourceLeakDetector {
  private openHandles = new Set<any>();
  private timers = new Set<NodeJS.Timer>();
  private originalSetTimeout: typeof setTimeout;
  private originalSetInterval: typeof setInterval;
  private originalClearTimeout: typeof clearTimeout;
  private originalClearInterval: typeof clearInterval;

  constructor() {
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;
  }

  /**
   * Start tracking resources
   */
  start(): void {
    // Intercept timer creation
    global.setTimeout = ((callback: any, delay?: number, ...args: any[]) => {
      const timer = this.originalSetTimeout(callback, delay, ...args);
      this.timers.add(timer);
      return timer;
    }) as any;

    global.setInterval = ((callback: any, delay?: number, ...args: any[]) => {
      const timer = this.originalSetInterval(callback, delay, ...args);
      this.timers.add(timer);
      return timer;
    }) as any;

    global.clearTimeout = ((timer: NodeJS.Timer) => {
      this.timers.delete(timer);
      return this.originalClearTimeout(timer);
    }) as any;

    global.clearInterval = ((timer: NodeJS.Timer) => {
      this.timers.delete(timer);
      return this.originalClearInterval(timer);
    }) as any;
  }

  /**
   * Stop tracking and return leaks
   */
  stop(): { timers: number; handles: any[] } {
    // Restore original functions
    global.setTimeout = this.originalSetTimeout;
    global.setInterval = this.originalSetInterval;
    global.clearTimeout = this.originalClearTimeout;
    global.clearInterval = this.originalClearInterval;

    return {
      timers: this.timers.size,
      handles: Array.from(this.openHandles),
    };
  }

  /**
   * Clear all tracked resources
   */
  cleanup(): void {
    // Clear all tracked timers
    for (const timer of this.timers) {
      this.originalClearTimeout(timer);
      this.originalClearInterval(timer);
    }
    this.timers.clear();
    this.openHandles.clear();
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private snapshots: Array<{ label: string; usage: NodeJS.MemoryUsage; timestamp: number }> = [];

  /**
   * Take a memory snapshot
   */
  snapshot(label: string): void {
    this.snapshots.push({
      label,
      usage: process.memoryUsage(),
      timestamp: Date.now(),
    });
  }

  /**
   * Get memory report
   */
  getReport(): { 
    totalGrowth: number;
    snapshots: Array<{ label: string; heapUsedMB: number; timestamp: number }>;
  } {
    const mapped = this.snapshots.map(s => ({
      label: s.label,
      heapUsedMB: Math.round(s.usage.heapUsed / 1024 / 1024),
      timestamp: s.timestamp,
    }));

    const totalGrowth = mapped.length >= 2
      ? mapped[mapped.length - 1].heapUsedMB - mapped[0].heapUsedMB
      : 0;

    return { totalGrowth, snapshots: mapped };
  }

  /**
   * Clear snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}

/**
 * Test performance profiler
 */
export class TestProfiler {
  private marks = new Map<string, number>();
  private measures: Array<{ name: string; duration: number }> = [];

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();
    
    if (start !== undefined && end !== undefined) {
      this.measures.push({
        name,
        duration: end - start,
      });
    }
  }

  /**
   * Get slowest operations
   */
  getSlowest(count: number = 5): Array<{ name: string; duration: number }> {
    return [...this.measures]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.marks.clear();
    this.measures = [];
  }
}

/**
 * Wait for all pending operations
 */
export async function waitForPendingOperations(timeout = 100): Promise<void> {
  // Wait for microtasks
  await new Promise(resolve => process.nextTick(resolve));
  // Wait for immediate callbacks
  await new Promise(resolve => setImmediate(resolve));
  // Wait for macrotasks
  await new Promise(resolve => setTimeout(resolve, 0));
  // Final wait with timeout
  await new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Create a test with automatic resource cleanup
 */
export function testWithCleanup(
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number
): void {
  test(name, async () => {
    const leakDetector = new ResourceLeakDetector();
    const memoryTracker = new MemoryTracker();
    
    leakDetector.start();
    memoryTracker.snapshot('start');
    
    try {
      await fn();
    } finally {
      memoryTracker.snapshot('end');
      const leaks = leakDetector.stop();
      const memoryReport = memoryTracker.getReport();
      
      // Report issues
      if (leaks.timers > 0) {
        console.warn(`⚠️ Test "${name}" left ${leaks.timers} timer(s) active`);
      }
      
      if (memoryReport.totalGrowth > 50) {
        console.warn(`⚠️ Test "${name}" memory grew by ${memoryReport.totalGrowth}MB`);
      }
      
      // Cleanup
      leakDetector.cleanup();
    }
  }, timeout);
}