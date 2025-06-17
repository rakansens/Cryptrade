/**
 * 非同期処理用の汎用型定義
 */

/**
 * 非同期状態管理型
 * @template T - データの型
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastFetch?: number;
}

/**
 * 非同期操作の結果型
 * @template T - 成功時のデータ型
 * @template E - エラー時の型
 */
export type AsyncResult<T, E = Error> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

/**
 * 非同期アクション型
 */
export interface AsyncAction<T> {
  execute: () => Promise<T>;
  cancel?: () => void;
  retry?: () => Promise<T>;
}

/**
 * 非同期操作のオプション
 */
export interface AsyncOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onCancel?: () => void;
}