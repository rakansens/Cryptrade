// Phase 1.3: orchestrator.agent.ts ユーティリティ関数分離テスト
// 対象: extractMetadataFromQuery 関数

import { describe, test, expect } from '@jest/globals';
import { extractMetadataFromQuery } from '@/lib/mastra/agents/utils/string-helpers';

describe('String Helpers - extractMetadataFromQuery', () => {
  test('🔴 should extract cryptocurrency symbols from query', () => {
    // 仮実装前なので失敗する
    const result = extractMetadataFromQuery('BTCの価格はいくらですか？');
    expect(result.symbols).toContain('BTC');
  });

  test('🔴 should extract multiple symbols from query', () => {
    const result = extractMetadataFromQuery('BTCとETHを比較してください');
    expect(result.symbols).toEqual(expect.arrayContaining(['BTC', 'ETH']));
  });

  test('🔴 should extract price topic', () => {
    const result = extractMetadataFromQuery('価格を教えて');
    expect(result.topics).toContain('price');
  });

  test('🔴 should extract analysis topic', () => {
    const result = extractMetadataFromQuery('市場分析をお願いします');
    expect(result.topics).toContain('analysis');
  });

  test('🔴 should handle empty query', () => {
    const result = extractMetadataFromQuery('');
    expect(result.symbols).toEqual([]);
    expect(result.topics).toEqual([]);
  });

  test('🔴 should be case insensitive for symbols', () => {
    const result = extractMetadataFromQuery('btcとethの状況');
    expect(result.symbols).toEqual(expect.arrayContaining(['BTC', 'ETH']));
  });
});