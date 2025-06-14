// 新規: 汎用非同期状態管理フック
'use client'

/**
 * useAsyncFn
 * ----------------------------------
 * 任意の非同期関数をラップして
 *  loading / error / result の状態を提供する共通フック。
 *  重複していたローディング & エラーハンドリングコードを削減するために追加。
 */
import { useCallback, useState, useEffect } from 'react'

export interface AsyncFnState<TResult> {
  loading: boolean
  error: string | null
  result: TResult | null
}

export interface UseAsyncFnReturn<TArgs extends unknown[], TResult> extends AsyncFnState<TResult> {
  execute: (...args: TArgs) => Promise<TResult | void>
  reset: () => void
}

export function useAsyncFn<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  options?: {
    /** true の場合 mount 時に即実行 */
    immediate?: boolean
    /** execute の依存配列 */
    deps?: React.DependencyList
  }
): UseAsyncFnReturn<TArgs, TResult> {
  const { immediate = false, deps = [] } = options || {}

  const [state, setState] = useState<AsyncFnState<TResult>>({
    loading: false,
    error: null,
    result: null
  })

  const execute = useCallback(async (...args: TArgs): Promise<TResult | void> => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await asyncFn(...args)
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ loading: false, error: message, result: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, asyncFn])

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null })
  }, [])

  // オプション: マウント時に即実行
  useEffect(() => {
    if (immediate) {
      // 引数なしで実行（TArgsが空配列の場合のみ有効）
      execute(...([] as unknown as TArgs))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, execute, reset }
} 