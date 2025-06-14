/**
 * Chart Store (Legacy Wrapper)
 * 
 * 後方互換性のため、既存のインポートをサポートする薄いラッパー
 * 実際の実装は新しいモジュール化されたコードを使用
 * 
 * @deprecated Use imports from '@/store/chart' instead
 */

// Re-export everything from the new modular structure
export * from './chart';

// Display deprecation warning in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn(
    '[ChartStore] Direct imports from chart.store.ts are deprecated. ' +
    'Please import from @/store/chart instead.'
  );
}