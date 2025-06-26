// Phase 1.3: orchestrator.agent.ts ユーティリティ関数分離テスト
// 対象: handleConversation 関数

import { describe, test, expect } from '@jest/globals';
import { handleConversation } from '@/lib/mastra/agents/utils/conversation-handlers';

describe('Conversation Handlers - handleConversation', () => {
  test('🔴 should handle conversation with valid result', async () => {
    const mockResult = {
      object: 'test',
      response: 'テスト応答',
      metadata: { agent: 'test-agent' }
    };
    
    const result = await handleConversation(mockResult, 'test-session');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('metadata');
  });

  test('🔴 should handle conversation with streaming result', async () => {
    const mockStreamResult = {
      object: 'stream',
      response: '配信テスト',
      metadata: { streaming: true }
    };
    
    const result = await handleConversation(mockStreamResult, 'stream-session');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('response');
  });

  test('🔴 should extract and clean response text', async () => {
    const mockResult = {
      object: 'text',
      response: 'BTCの価格は$50,000です',
      metadata: { agent: 'price-agent' }
    };
    
    const result = await handleConversation(mockResult, 'price-session');
    expect(typeof (result as any).response).toBe('string');
    expect((result as any).response).toBeTruthy();
  });

  test('🔴 should handle error result gracefully', async () => {
    const mockErrorResult = {
      object: 'error',
      response: null,
      metadata: { error: 'テストエラー' }
    };
    
    const result = await handleConversation(mockErrorResult, 'error-session');
    expect(result).toBeDefined();
  });

  test('🔴 should preserve conversation context', async () => {
    const mockResult = {
      object: 'conversation',
      response: '前回の話の続きです',
      metadata: { context: 'preserved' }
    };
    
    const result = await handleConversation(mockResult, 'context-session');
    expect((result as any).metadata).toBeDefined();
    expect((result as any).metadata.sessionId).toBe('context-session');
  });
});