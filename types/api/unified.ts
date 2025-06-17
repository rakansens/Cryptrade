/**
 * 統一されたAPI型定義
 * このファイルはプロジェクト全体で使用される共通のAPI型を定義します
 */

/**
 * 汎用的なAPIレスポンス型
 * @template T - レスポンスデータの型
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: number;
}

/**
 * APIエラー型
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * ページネーション付きAPIレスポンス型
 * @template T - データ項目の型
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

/**
 * ページネーションメタデータ
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * 非同期APIレスポンス型（Promise用）
 * @template T - レスポンスデータの型
 */
export type AsyncApiResponse<T> = Promise<ApiResponse<T>>;

/**
 * APIリクエストオプション
 */
export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

/**
 * API結果型（エラーハンドリング用）
 * @template T - 成功時のデータ型
 * @template E - エラー時の型
 */
export type ApiResult<T, E = ApiError> = 
  | { success: true; data: T }
  | { success: false; error: E };