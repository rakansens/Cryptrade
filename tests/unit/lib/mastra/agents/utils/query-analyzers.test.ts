// Phase 1.3: orchestrator.agent.ts ユーティリティ関数分離テスト
// 対象: detectComplexQuery 関数

import { describe, test, expect } from '@jest/globals';
import { detectComplexQuery } from '@/lib/mastra/agents/utils/query-analyzers';

describe('Query Analyzers - detectComplexQuery', () => {
  test('🔴 should return false for simple price inquiry', () => {
    const result = detectComplexQuery('BTCの価格');
    expect(result).toBe(false);
  });

  test('🔴 should return true for long queries', () => {
    const longQuery = 'この非常に長いクエリは100文字を超えており、複雑なクエリとして検出されるべきです。追加のテキストを含めて100文字を確実に超えるようにします。';
    const result = detectComplexQuery(longQuery);
    expect(result).toBe(true);
  });

  test('🔴 should return true for multiple operations', () => {
    const result = detectComplexQuery('BTCを分析してETHも分析して');
    expect(result).toBe(true);
  });

  test('🔴 should return true for multiple symbols', () => {
    const result = detectComplexQuery('BTCとETHとADAを比較');
    expect(result).toBe(true);
  });

  test('🔴 should return true for complex keywords', () => {
    const result = detectComplexQuery('詳細な分析をお願いします');
    expect(result).toBe(true);
  });

  test('🔴 should return true for multiple info types', () => {
    const result = detectComplexQuery('価格と分析を教えて');
    expect(result).toBe(true);
  });

  test('🔴 should return false for simple greeting', () => {
    const result = detectComplexQuery('こんにちは');
    expect(result).toBe(false);
  });
});