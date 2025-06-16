/**
 * Retry Utility
 * 
 * API呼び出しのリトライ機能を提供
 * - 指数バックオフ
 * - カスタムリトライ条件
 * - エラーフィルタリング
 */

import { logger } from '@/lib/utils/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // ミリ秒
  maxDelay?: number; // ミリ秒
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error: Error) => {
    // ネットワークエラーやタイムアウトはリトライ
    if (error.message.includes('fetch failed') || 
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED')) {
      return true;
    }
    
    // 5xx エラーはリトライ
    if (error.message.includes('500') || 
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      return true;
    }
    
    // 429 (Rate Limit) はリトライ
    if (error.message.includes('429')) {
      return true;
    }
    
    return false;
  },
  onRetry: (error: Error, attempt: number) => {
    logger.warn('[Retry] Retrying after error', { 
      error: error.message, 
      attempt 
    });
  }
};

/**
 * リトライ付きで関数を実行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // 最後の試行、またはリトライすべきでないエラーの場合は即座に投げる
      if (attempt === opts.maxAttempts || !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }
      
      // リトライコールバック
      opts.onRetry(lastError, attempt);
      
      // バックオフ遅延
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * 複数の関数を並行してリトライ実行
 */
export async function withRetryAll<T>(
  fns: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T[]> {
  return Promise.all(fns.map(fn => withRetry(fn, options)));
}

/**
 * 複数の関数を並行実行し、最初に成功したものを返す
 * 失敗したプロミスは適切にクリーンアップされる
 */
export async function withRetryRace<T>(
  fns: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T> {
  const { raceWithCleanup } = await import('./concurrent');
  
  return raceWithCleanup(
    fns.map(fn => async (signal: AbortSignal) => {
      // AbortSignalをチェックしながらリトライを実行
      const retryWithAbort = async (): Promise<T> => {
        if (signal.aborted) {
          throw new Error('Operation aborted');
        }
        return withRetry(fn, options);
      };
      
      return retryWithAbort();
    }),
    {
      onCleanup: (error) => {
        logger.warn('[Retry] Race cleanup due to error', { error: error.message });
      }
    }
  );
}

/**
 * サーキットブレーカー付きリトライ
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1分
  ) {}
  
  async execute<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    // サーキットが開いている場合
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        logger.info('[CircuitBreaker] Attempting half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await withRetry(fn, options);
      
      // 成功したらリセット
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        logger.info('[CircuitBreaker] Circuit closed');
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        logger.error('[CircuitBreaker] Circuit opened', { 
          failures: this.failures 
        });
      }
      
      throw error;
    }
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * スリープ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}