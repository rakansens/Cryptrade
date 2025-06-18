import {
  measurePerformance,
  measureFunction,
  PerformanceTimer,
  measureParallel,
  PerformanceOptions
} from '@/lib/mastra/utils/performance';
import { logger } from '@/lib/utils/logger';
import { incrementMetric, observeMetric } from '@/lib/monitoring/metrics';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('@/lib/monitoring/metrics', () => ({
  incrementMetric: jest.fn(),
  observeMetric: jest.fn()
}));

// Mock timers
const realDateNow = Date.now;

describe('performance utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date.now
    Date.now = realDateNow;
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  describe('measurePerformance decorator', () => {
    it('should measure method execution time', async () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      class TestClass {
        @measurePerformance({ name: 'testMethod' })
        async testMethod(value: string) {
          nowValue += 100; // Simulate 100ms execution
          return `result: ${value}`;
        }
      }

      const instance = new TestClass();
      const result = await instance.testMethod('test');

      expect(result).toBe('result: test');
      expect(observeMetric).toHaveBeenCalledWith('method_execution_duration_ms', 100);
      expect(logger.debug).toHaveBeenCalledWith(
        '[Performance] TestClass.testMethod completed',
        expect.objectContaining({
          method: 'TestClass.testMethod',
          duration: 100,
          status: 'success'
        })
      );
    });

    it('should measure method with custom metric', async () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      class TestClass {
        @measurePerformance({ metric: 'custom_metric_ms' })
        async testMethod() {
          nowValue += 50;
          return 'done';
        }
      }

      const instance = new TestClass();
      await instance.testMethod();

      expect(observeMetric).toHaveBeenCalledWith('custom_metric_ms', 50);
      expect(observeMetric).toHaveBeenCalledWith('method_execution_duration_ms', 50);
    });

    it('should include args when specified', async () => {
      class TestClass {
        @measurePerformance({ includeArgs: true })
        async testMethod(arg1: string, arg2: number) {
          return { arg1, arg2 };
        }
      }

      const instance = new TestClass();
      await instance.testMethod('test', 123);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          args: ['test', 123]
        })
      );
    });

    it('should include result when specified', async () => {
      class TestClass {
        @measurePerformance({ includeResult: true })
        async testMethod() {
          return { data: 'test result' };
        }
      }

      const instance = new TestClass();
      const result = await instance.testMethod();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          result: { data: 'test result' }
        })
      );
    });

    it('should handle errors and record error metrics', async () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      class TestClass {
        @measurePerformance()
        async testMethod() {
          nowValue += 75;
          throw new Error('Test error');
        }
      }

      const instance = new TestClass();
      
      await expect(instance.testMethod()).rejects.toThrow('Test error');

      expect(observeMetric).toHaveBeenCalledWith('method_execution_duration_ms', 75);
      expect(incrementMetric).toHaveBeenCalledWith('method_execution_errors_total');
      expect(logger.error).toHaveBeenCalledWith(
        '[Performance] TestClass.testMethod failed',
        expect.objectContaining({
          duration: 75,
          status: 'error',
          error: 'Error: Test error'
        })
      );
    });

    it('should use custom log level', async () => {
      class TestClass {
        @measurePerformance({ logLevel: 'info' })
        async testMethod() {
          return 'done';
        }
      }

      const instance = new TestClass();
      await instance.testMethod();

      expect(logger.info).toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('measureFunction', () => {
    it('should measure function execution time', async () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      const testFunction = async (value: string) => {
        nowValue += 200;
        return `processed: ${value}`;
      };

      const measured = measureFunction(testFunction, 'testFunction');
      const result = await measured('input');

      expect(result).toBe('processed: input');
      expect(observeMetric).toHaveBeenCalledWith('function_execution_duration_ms', 200);
      expect(logger.debug).toHaveBeenCalledWith(
        '[Performance] testFunction completed',
        expect.objectContaining({
          function: 'testFunction',
          duration: 200,
          status: 'success'
        })
      );
    });

    it('should handle sync functions', async () => {
      const testFunction = (a: number, b: number) => a + b;
      const measured = measureFunction(testFunction, 'add');
      
      const result = await measured(5, 3);
      
      expect(result).toBe(8);
      expect(observeMetric).toHaveBeenCalledWith('function_execution_duration_ms', expect.any(Number));
    });

    it('should handle function errors', async () => {
      const testFunction = async () => {
        throw new Error('Function error');
      };

      const measured = measureFunction(testFunction, 'errorFunction');
      
      await expect(measured()).rejects.toThrow('Function error');
      
      expect(incrementMetric).toHaveBeenCalledWith('function_execution_errors_total');
      expect(logger.error).toHaveBeenCalledWith(
        '[Performance] errorFunction failed',
        expect.objectContaining({
          status: 'error',
          error: 'Error: Function error'
        })
      );
    });

    it('should respect options', async () => {
      const testFunction = async (data: unknown) => ({ processed: data });
      const measured = measureFunction(testFunction, 'processor', {
        includeArgs: true,
        includeResult: true,
        metric: 'processor_ms'
      });

      const result = await measured({ input: 'test' });

      expect(observeMetric).toHaveBeenCalledWith('processor_ms', expect.any(Number));
      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          args: [{ input: 'test' }],
          result: { processed: { input: 'test' } }
        })
      );
    });
  });

  describe('PerformanceTimer', () => {
    it('should track elapsed time', () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      const timer = new PerformanceTimer('test-timer');
      
      expect(logger.debug).toHaveBeenCalledWith('[PerformanceTimer] Started: test-timer');

      nowValue += 500;
      const elapsed = timer.getElapsed();
      
      expect(elapsed).toBe(500);
    });

    it('should record marks', () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      const timer = new PerformanceTimer('test-timer');
      
      nowValue += 100;
      timer.mark('step1');
      
      nowValue += 200;
      timer.mark('step2');

      expect(logger.debug).toHaveBeenCalledWith(
        '[PerformanceTimer] Mark: test-timer.step1',
        { elapsed: 100 }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        '[PerformanceTimer] Mark: test-timer.step2',
        { elapsed: 300 }
      );
    });

    it('should end timer and record metrics', () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      const timer = new PerformanceTimer('test-timer', { metric: 'timer_test_ms' });
      
      nowValue += 100;
      timer.mark('checkpoint');
      
      nowValue += 400;
      const duration = timer.end({ additionalData: 'test' });

      expect(duration).toBe(500);
      expect(observeMetric).toHaveBeenCalledWith('timer_test_ms', 500);
      expect(observeMetric).toHaveBeenCalledWith('timer_duration_ms', 500);
      
      expect(logger.info).toHaveBeenCalledWith(
        '[PerformanceTimer] Completed: test-timer',
        expect.objectContaining({
          timer: 'test-timer',
          duration: 500,
          marks: { checkpoint: 100 },
          additionalData: 'test'
        })
      );
    });

    it('should prevent ending timer twice', () => {
      const timer = new PerformanceTimer('test-timer');
      
      timer.end();
      jest.clearAllMocks();
      
      const duration = timer.end();
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[PerformanceTimer] Timer already ended: test-timer'
      );
      expect(observeMetric).not.toHaveBeenCalled();
    });

    it('should respect log level option', () => {
      const timer = new PerformanceTimer('test-timer', { logLevel: 'debug' });
      timer.end();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Completed'),
        expect.any(Object)
      );
    });
  });

  describe('measureParallel', () => {
    it('should measure parallel operations', async () => {
      let nowValue = 1000;
      Date.now = jest.fn(() => nowValue);

      const operations = {
        fast: new Promise(resolve => {
          setTimeout(() => resolve('fast result'), 50);
        }),
        slow: new Promise(resolve => {
          setTimeout(() => resolve('slow result'), 100);
        })
      };

      // Mock setTimeout behavior
      jest.useFakeTimers();
      
      const resultPromise = measureParallel(operations, 'parallel-test');
      
      // Fast operation completes
      nowValue += 50;
      jest.advanceTimersByTime(50);
      
      // Slow operation completes
      nowValue += 50;
      jest.advanceTimersByTime(50);
      
      const results = await resultPromise;

      expect(results).toEqual({
        fast: 'fast result',
        slow: 'slow result'
      });

      // Check individual operation timers
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel-test.fast'),
        expect.objectContaining({ status: 'success' })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel-test.slow'),
        expect.objectContaining({ status: 'success' })
      );

      // Check main timer
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel-test'),
        expect.objectContaining({ operationCount: 2 })
      );

      jest.useRealTimers();
    });

    it('should handle operation failures', async () => {
      const operations = {
        success: Promise.resolve('success'),
        failure: Promise.reject(new Error('Operation failed'))
      };

      const results = await measureParallel(operations, 'mixed-test');

      expect(results.success).toBe('success');
      expect(results.failure).toEqual({ error: expect.any(Object) });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('mixed-test.failure'),
        expect.objectContaining({ 
          status: 'error',
          error: 'Error: Operation failed'
        })
      );
    });

    it('should complete even if all operations fail', async () => {
      const operations = {
        fail1: Promise.reject(new Error('Error 1')),
        fail2: Promise.reject(new Error('Error 2'))
      };

      const results = await measureParallel(operations);

      expect(results.fail1).toEqual({ error: expect.any(Object) });
      expect(results.fail2).toEqual({ error: expect.any(Object) });
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel_operations'),
        expect.objectContaining({ operationCount: 2 })
      );
    });

    it('should handle empty operations', async () => {
      const results = await measureParallel({});
      
      expect(results).toEqual({});
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('parallel_operations'),
        expect.objectContaining({ operationCount: 0 })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very long durations', async () => {
      let nowValue = Date.now();
      Date.now = jest.fn(() => nowValue);

      const timer = new PerformanceTimer('long-timer');
      
      // Simulate 1 hour
      nowValue += 3600000;
      
      const duration = timer.end();
      
      expect(duration).toBe(3600000);
      expect(observeMetric).toHaveBeenCalledWith('timer_duration_ms', 3600000);
    });

    it('should handle Date.now precision', async () => {
      // Test that fractional milliseconds don't cause issues
      const originalDateNow = Date.now;
      Date.now = jest.fn()
        .mockReturnValueOnce(1000.1)
        .mockReturnValueOnce(1000.9);

      const timer = new PerformanceTimer('precision-test');
      const duration = timer.end();
      
      // Should round to nearest integer
      expect(Math.round(duration)).toBe(1);
      
      Date.now = originalDateNow;
    });
  });
});