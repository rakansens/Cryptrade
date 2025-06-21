/**
 * Store test helpers
 * テスト間でZustandストアの状態をリセットするユーティリティ
 */

import { resetAllStores } from '@/tests/setup/reset-stores';

/**
 * 特定のストアをリセットする共通関数
 * @param store - リセット対象のZustandストア
 * @param storeName - デバッグ用のストア名
 */
export function resetStore(store: any, storeName?: string): void {
  if (!store) {
    console.warn(`Store ${storeName || 'unknown'} is undefined`);
    return;
  }

  // Store has reset method
  if (typeof store.reset === 'function') {
    store.reset();
    return;
  }

  // Store's state has reset method
  if (store.getState && typeof store.getState === 'function') {
    const state = store.getState();
    if (state && state.reset && typeof state.reset === 'function') {
      state.reset();
      return;
    }
  }

  // Try to reset to initial state
  if (store.setState && store.getInitialState) {
    const initialState = store.getInitialState();
    if (initialState) {
      store.setState(initialState);
      return;
    }
  }

  console.warn(`Could not reset store ${storeName || 'unknown'}`);
}

/**
 * すべてのストアをリセットする（テストのbeforeEachで使用）
 */
export function resetAllStoresForTest(): void {
  jest.clearAllMocks();
  resetAllStores();
}

/**
 * 複数のストアを一度にリセット
 * @param stores - リセット対象のストアと名前のペアの配列
 */
export function resetMultipleStores(stores: Array<[any, string]>): void {
  stores.forEach(([store, name]) => {
    resetStore(store, name);
  });
}