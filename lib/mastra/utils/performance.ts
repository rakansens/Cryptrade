import { logger } from '@/lib/utils/logger';
import { incrementMetric, recordHistogram } from '@/lib/monitoring/metrics';

/**
 * Performance Measurement Decorator
 * 
 * メソッドの実行時間を自動的に計測するデコレータ
 * - 実行時間の計測
 * - メトリクスの記録
 * - ログ出力
 * - エラーハンドリング
 */

interface PerformanceOptions {
  name?: string;
  logLevel?: 'debug' | 'info' | 'warn';
  includeArgs?: boolean;
  includeResult?: boolean;
  metric?: string;
}

/**
 * パフォーマンス計測デコレータ
 * 
 * @example
 * class MyService {
 *   @measurePerformance({ name: 'fetchData', metric: 'fetch_duration_ms' })
 *   async fetchData(id: string) {
 *     // ... implementation
 *   }
 * }
 */
export function measurePerformance(options: PerformanceOptions = {}): MethodDecorator {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const methodName = options.name || String(propertyKey);
    const className = target.constructor.name;
    const fullName = `${className}.${methodName}`;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      const context: Record<string, unknown> = {
        method: fullName,
        timestamp: new Date().toISOString(),
      };

      if (options.includeArgs) {
        context.args = args;
      }

      try {
        // Execute the original method
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Record success metrics
        if (options.metric) {
          recordHistogram(options.metric, duration);
        }
        recordHistogram('method_execution_duration_ms', duration, {
          method: fullName,
          status: 'success',
        });

        // Log performance
        const logData = {
          ...context,
          duration,
          status: 'success',
        };

        if (options.includeResult) {
          logData.result = result;
        }

        const logMethod = logger[options.logLevel || 'debug'];
        logMethod(`[Performance] ${fullName} completed`, logData);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Record error metrics
        if (options.metric) {
          recordHistogram(options.metric, duration);
        }
        recordHistogram('method_execution_duration_ms', duration, {
          method: fullName,
          status: 'error',
        });
        incrementMetric('method_execution_errors_total', { method: fullName });

        // Log error
        logger.error(`[Performance] ${fullName} failed`, {
          ...context,
          duration,
          status: 'error',
          error: String(error),
        });

        // Re-throw the error
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 簡易版パフォーマンス計測（関数用）
 * 
 * @example
 * const processData = measureFunction(async (data: unknown) => {
 *   // ... processing
 * }, 'processData');
 */
export function measureFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  name: string,
  options: PerformanceOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    const context: Record<string, unknown> = {
      function: name,
      timestamp: new Date().toISOString(),
    };

    if (options.includeArgs) {
      context.args = args;
    }

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      // Record metrics
      if (options.metric) {
        recordHistogram(options.metric, duration);
      }
      recordHistogram('function_execution_duration_ms', duration, {
        function: name,
        status: 'success',
      });

      // Log performance
      const logData = {
        ...context,
        duration,
        status: 'success',
      };

      if (options.includeResult) {
        logData.result = result;
      }

      const logMethod = logger[options.logLevel || 'debug'];
      logMethod(`[Performance] ${name} completed`, logData);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      if (options.metric) {
        recordHistogram(options.metric, duration);
      }
      recordHistogram('function_execution_duration_ms', duration, {
        function: name,
        status: 'error',
      });
      incrementMetric('function_execution_errors_total', { function: name });

      // Log error
      logger.error(`[Performance] ${name} failed`, {
        ...context,
        duration,
        status: 'error',
        error: String(error),
      });

      throw error;
    }
  }) as T;
}

/**
 * パフォーマンスタイマークラス
 * 
 * @example
 * const timer = new PerformanceTimer('myOperation');
 * // ... do work
 * timer.end(); // Logs and records metrics
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;
  private marks: Map<string, number> = new Map();

  constructor(
    private name: string,
    private options: PerformanceOptions = {}
  ) {
    this.startTime = Date.now();
    logger.debug(`[PerformanceTimer] Started: ${name}`);
  }

  /**
   * 中間マークを記録
   */
  mark(label: string): void {
    const elapsed = Date.now() - this.startTime;
    this.marks.set(label, elapsed);
    logger.debug(`[PerformanceTimer] Mark: ${this.name}.${label}`, { elapsed });
  }

  /**
   * タイマーを終了して結果を記録
   */
  end(additionalContext?: Record<string, unknown>): number {
    if (this.endTime) {
      logger.warn(`[PerformanceTimer] Timer already ended: ${this.name}`);
      return this.endTime - this.startTime;
    }

    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    // Record metrics
    if (this.options.metric) {
      recordHistogram(this.options.metric, duration);
    }
    recordHistogram('timer_duration_ms', duration, { timer: this.name });

    // Prepare marks data
    const marksData: Record<string, number> = {};
    this.marks.forEach((elapsed, label) => {
      marksData[label] = elapsed;
    });

    // Log result
    const logData = {
      timer: this.name,
      duration,
      marks: marksData,
      ...additionalContext,
    };

    const logMethod = logger[this.options.logLevel || 'info'];
    logMethod(`[PerformanceTimer] Completed: ${this.name}`, logData);

    return duration;
  }

  /**
   * 経過時間を取得（タイマーを終了せずに）
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * 複数の非同期操作の並列実行時間を計測
 * 
 * @example
 * const results = await measureParallel({
 *   user: fetchUser(id),
 *   posts: fetchPosts(id),
 *   comments: fetchComments(id),
 * });
 */
export async function measureParallel<T extends Record<string, Promise<unknown>>>(
  operations: T,
  name = 'parallel_operations'
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const timer = new PerformanceTimer(name);
  const results: Record<string, unknown> = {};

  // Create individual timers for each operation
  const promises = Object.entries(operations).map(async ([key, promise]) => {
    const opTimer = new PerformanceTimer(`${name}.${key}`);
    try {
      const result = await promise;
      opTimer.end({ status: 'success' });
      results[key] = result;
    } catch (error) {
      opTimer.end({ status: 'error', error: String(error) });
      results[key] = { error };
      throw error;
    }
  });

  // Wait for all operations
  await Promise.allSettled(promises);
  timer.end({ operationCount: Object.keys(operations).length });

  return results as { [K in keyof T]: Awaited<T[K]> };
}

// Export for testing
export { measurePerformance as default };