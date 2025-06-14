/**
 * Updated: Chart Store (Legacy Wrapper) - ESLintルール無効化（互換性ファイルのため）
 * 
 * 後方互換性のため、既存のインポートをサポートする薄いラッパー
 * 実際の実装は新しいモジュール化されたコードを使用
 * 
 * @deprecated Use imports from '@/store/chart' instead
 */

/* eslint-disable no-restricted-syntax */

// Re-export everything from the new modular structure
export * from './chart';
import { isDevelopment } from '@/config/env';

// Display deprecation warning in development
if (typeof window !== 'undefined' && isDevelopment()) {
  console.warn(
    '[ChartStore] Direct imports from chart.store.ts are deprecated. ' +
    'Please import from @/store/chart instead.'
  );
}