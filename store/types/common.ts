// Store共通型定義 - Store型安全性改善 Phase 2
// 🟢 Green Phase: 共通型定義でas anyキャストを削除

/**
 * エラー状態の共通型定義
 */
export interface ErrorState {
  error?: string;
}

/**
 * 非同期操作状態の共通型定義
 */
export interface AsyncState extends ErrorState {
  isLoading?: boolean;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
}

/**
 * Store状態更新のための部分的な型定義
 */
export type PartialStoreUpdate<T> = Partial<T>;

/**
 * 型ガード: Store状態の検証
 */
export function isValidStoreState<T extends Record<string, unknown>>(
  state: unknown
): state is T {
  return typeof state === 'object' && state !== null;
}

/**
 * 型ガード: エラー状態の検証
 */
export function isErrorState(state: unknown): state is ErrorState {
  return (
    typeof state === 'object' &&
    state !== null &&
    (typeof (state as ErrorState).error === 'string' || 
     typeof (state as ErrorState).error === 'undefined')
  );
}

/**
 * 型ガード: 非同期状態の検証
 */
export function isAsyncState(state: unknown): state is AsyncState {
  if (!isErrorState(state)) return false;
  
  const asyncState = state as AsyncState;
  return (
    (typeof asyncState.isLoading === 'boolean' || typeof asyncState.isLoading === 'undefined') &&
    (typeof asyncState.isSyncing === 'boolean' || typeof asyncState.isSyncing === 'undefined') &&
    (typeof asyncState.lastSyncTime === 'number' || asyncState.lastSyncTime === null || typeof asyncState.lastSyncTime === 'undefined')
  );
}