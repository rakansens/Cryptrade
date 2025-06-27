// Pattern Store型定義 - Store型安全性改善 Phase 2
// 🟢 Green Phase: PatternData型の安全性向上

import type { PatternData } from '@/store/chart/types';

/**
 * 型ガード: PatternDataの検証
 */
export function isValidPatternData(data: unknown): data is PatternData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const pattern = data as Partial<PatternData>;
  
  return (
    typeof pattern.id === 'string' &&
    typeof pattern.type === 'string' &&
    typeof pattern.confidence === 'number' &&
    pattern.confidence >= 0 &&
    pattern.confidence <= 1
  );
}

/**
 * 型ガード: PatternData配列の検証
 */
export function isValidPatternDataArray(data: unknown): data is PatternData[] {
  return Array.isArray(data) && data.every(isValidPatternData);
}

/**
 * PatternData配列を安全にマップする
 */
export function mapPatternDataArray(data: unknown[]): Array<[string, PatternData]> {
  return data
    .filter(isValidPatternData)
    .map(p => [p.id || crypto.randomUUID(), p] as [string, PatternData]);
}

/**
 * PatternData配列を安全に変換する
 */
export function safePatternDataArray(patterns: Map<string, PatternData>): PatternData[] {
  return Array.from(patterns.values()).filter(isValidPatternData);
}