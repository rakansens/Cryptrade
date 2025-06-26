// Phase 1.3: orchestrator.agent.ts ユーティリティ関数分離テスト
// 対象: generateFallbackResponse 関数

import { describe, test, expect } from '@jest/globals';
import { generateFallbackResponse } from '@/lib/mastra/agents/utils/response-generators';

describe('Response Generators - generateFallbackResponse', () => {
  test('🔴 should generate fallback response for price_inquiry intent', async () => {
    const result = await generateFallbackResponse('price_inquiry', 'BTCの価格', 'BTCUSDT');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('metadata');
    expect((result as any).metadata.processedBy).toBe('fallback');
  });

  test('🔴 should generate fallback response for trading_analysis intent', async () => {
    const result = await generateFallbackResponse('trading_analysis', '市場分析', 'BTCUSDT');
    expect(result).toHaveProperty('response');
    expect((result as any).metadata.intent).toBe('trading_analysis');
  });

  test('🔴 should generate fallback response for ui_control intent', async () => {
    const result = await generateFallbackResponse('ui_control', 'チャートを表示', 'BTCUSDT');
    expect(result).toHaveProperty('response');
    expect(typeof (result as any).response).toBe('string');
  });

  test('🔴 should handle unknown intent', async () => {
    const result = await generateFallbackResponse('unknown_intent', 'テスト', undefined);
    expect(result).toHaveProperty('response');
    expect((result as any).response).toBeTruthy();
  });

  test('🔴 should include extractedSymbol in metadata when provided', async () => {
    const result = await generateFallbackResponse('price_inquiry', 'ETHの価格', 'ETHUSDT');
    expect((result as any).metadata.extractedSymbol).toBe('ETHUSDT');
  });
});