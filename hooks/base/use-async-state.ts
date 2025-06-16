// hooks/base/use-async-state.ts
// 汎用非同期状態管理フック
// - load(), reset() を提供
// - loading / error / data の3状態を一元管理
//
// [2025-06-11] 初版実装

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any pending operations on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (...args: A): Promise<T | null> => {
    // Cancel previous execution if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this execution
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      
      // Check if component is still mounted and operation wasn't aborted
      if (mountedRef.current && !signal.aborted) {
        setData(result);
        return result;
      }
      return null;
    } catch (e) {
      // Don't update state if component unmounted or operation aborted
      if (!mountedRef.current || signal.aborted) {
        return null;
      }
      
      const msg = e instanceof Error ? e.message : 'Unknown Error';
      setError(msg);
      return null;
    } finally {
      // Only update loading state if still mounted
      if (mountedRef.current && !signal.aborted) {
        setLoading(false);
      }
    }
  }, [asyncFn]);

  const reset = useCallback(() => {
    // Cancel any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { loading, error, data, execute, reset };
} 