// hooks/base/use-async-state.ts
// 汎用非同期状態管理フック
// - load(), reset() を提供
// - loading / error / data の3状態を一元管理
//
// [2025-06-11] 初版実装

'use client';

import { useState, useCallback } from 'react';

export interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

export interface UseAsyncStateReturn<T, A extends unknown[]> extends AsyncState<T> {
  /** 非同期処理を実行 */
  execute: (...args: A) => Promise<T | null>;
  /** ステートを初期化 */
  reset: () => void;
}

/**
 * よくある「loading / error / data」3 状態をまとめて扱う汎用フック。
 * 同じ useState パターンを 1 行で置き換えられる。
 *
 * @param asyncFn 任意の非同期関数
 * @returns execute / state など
 */
export function useAsyncState<
  T = unknown,
  A extends unknown[] = []
>(asyncFn: (...args: A) => Promise<T>): UseAsyncStateReturn<T, A> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (...args: A): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      setData(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown Error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [asyncFn]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
} 