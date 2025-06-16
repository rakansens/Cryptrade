import { logger } from '@/lib/utils/logger';

/**
 * リトライ設定オプション
 */
export interface RetryOptions {
  /** 最大試行回数 (デフォルト: 3) */
  maxAttempts?: number;
  /** 初回遅延時間 (ms, デフォルト: 1000) */
  initialDelay?: number;
  /** 最大遅延時間 (ms, デフォルト: 8000) */
  maxDelay?: number;
  /** バックオフ係数 (デフォルト: 2) */
  factor?: number;
  /** リトライ時のコールバック */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * リトライ機能を提供するラッパークラス
 * 指数バックオフを使用して失敗した操作を再試行します
 * 
 * @example
 * ```typescript
 * const retryWrapper = new RetryWrapper({
 *   maxAttempts: 3,
 *   initialDelay: 100,
 *   factor: 2
 * });
 * const result = await retryWrapper.execute(() => fetchData());
 * ```
 */
export class RetryWrapper {
  private readonly defaultOptions: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 8000,
    factor: 2,
    onRetry: () => {},
  };

  constructor(private options: RetryOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * 操作を実行し、必要に応じてリトライします
   * 
   * @param {() => Promise<T>} operation - 実行する非同期操作
   * @param {string} [operationName] - 操作名（ログ用）
   * @returns {Promise<T>} 操作の結果
   * @throws {Error} すべてのリトライが失敗した場合の最後のエラー
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const { maxAttempts, initialDelay, maxDelay, factor, onRetry } = this.options as Required<RetryOptions>;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info('[RetryWrapper] Attempting operation', { 
          operationName, 
          attempt, 
          maxAttempts 
        });
        
        const result = await operation();
        
        if (attempt > 1) {
          logger.info('[RetryWrapper] Operation succeeded after retry', { 
            operationName, 
            attempt 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn('[RetryWrapper] Operation failed', { 
          operationName, 
          attempt, 
          maxAttempts,
          error: lastError.message 
        });
        
        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelay * Math.pow(factor, attempt - 1),
            maxDelay
          );
          
          onRetry(lastError, attempt);
          
          logger.info('[RetryWrapper] Retrying after delay', { 
            operationName, 
            delay, 
            nextAttempt: attempt + 1 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('[RetryWrapper] All retry attempts failed', { 
      operationName, 
      attempts: maxAttempts 
    });
    
    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * 関数をリトライ可能なバージョンにラップします
   * 
   * @param {T} fn - ラップする非同期関数
   * @param {string} [operationName] - 操作名（ログ用）
   * @returns {T} リトライ機能付きの同じシグネチャの関数
   * 
   * @example
   * ```typescript
   * const retryableFetch = retryWrapper.wrap(fetchApi, 'api-fetch');
   * const data = await retryableFetch('/api/data');
   * ```
   */
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    operationName?: string
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(() => fn(...args), operationName);
    }) as T;
  }
}