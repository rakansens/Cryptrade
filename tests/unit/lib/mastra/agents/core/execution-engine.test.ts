// Phase 2 TDD: 🟢 Green フェーズ - ExecutionEngine実装テスト
// 実行フロー制御ロジックの分離テスト

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionEngine } from '../../../../../../lib/mastra/agents/core/execution-engine';

// 実装に合わせた型定義
interface RuntimeContext {
  sessionId?: string;
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  marketStatus?: 'open' | 'closed';
  queryComplexity?: 'simple' | 'complex';
  isProposalMode?: boolean;
}

describe('ExecutionEngine - Phase 2 TDD', () => {
  let executionEngine: ExecutionEngine;
  
  beforeEach(() => {
    executionEngine = new ExecutionEngine();
    jest.clearAllMocks();
  });

  describe('基本実行フロー', () => {
    it('should handle simple conversational queries', async () => {
      const context: RuntimeContext = {
        sessionId: 'test-session-001',
        userLevel: 'intermediate',
        queryComplexity: 'simple'
      };

      const result = await executionEngine.execute('こんにちは', context);

      expect(result.text).toBeDefined();
      expect(result.analysis?.intent).toBe('general_inquiry');
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });

    it('should handle price inquiry queries', async () => {
      const context: RuntimeContext = {
        sessionId: 'test-session-002',
        userLevel: 'intermediate'
      };

      const result = await executionEngine.execute('BTCの価格はいくら？', context);

      expect(result.text).toBeDefined();
      expect(result.analysis?.intent).toBe('price_inquiry');
      expect(result.analysis?.extractedSymbol).toBe('BTCUSDT');
    });

    it('should handle complex queries with parallel processing', async () => {
      const context: RuntimeContext = {
        sessionId: 'test-session-003',
        userLevel: 'expert',
        queryComplexity: 'complex',
      };

      const result = await executionEngine.execute('BTCとETHの価格を分析して、今後の投資戦略を提案してください', context);

      expect(result.text).toBeDefined();
      expect(result.analysis?.intent).toBe('complex_analysis');
      expect(result.analysis?.analysisDepth).toBe('detailed');
    });
  });

  describe('エラーハンドリング', () => {
    it('should handle normal execution without errors', async () => {
      const context: RuntimeContext = {
        sessionId: 'test-session-004',
        userLevel: 'expert'
      };

      const result = await executionEngine.execute('BTCの詳細分析をお願いします', context);

      expect(result.text).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });
  });

  describe('ユーザーレベル適応', () => {
    it('should adjust analysis depth for beginner users', async () => {
      const context: RuntimeContext = {
        userLevel: 'beginner',
      };

      const result = await executionEngine.execute('投資のアドバイスをください', context);

      expect(result.analysis?.analysisDepth).toBe('basic');
    });

    it('should provide detailed analysis for expert users', async () => {
      const context: RuntimeContext = {
        userLevel: 'expert',
      };

      const result = await executionEngine.execute('市場価格分析をお願いします', context);

      expect(result.analysis?.analysisDepth).toBe('detailed');
    });
  });

  describe('パフォーマンス', () => {
    it('should complete execution within reasonable time', async () => {
      const context: RuntimeContext = {
        sessionId: 'test-session-007',
      };

      const startTime = Date.now();
      const result = await executionEngine.execute('パフォーマンステスト', context);
      const executionTime = Date.now() - startTime;

      expect(result.text).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // 5秒以内
      expect(result.metadata?.executionTime).toBeGreaterThan(0);
    });
  });
});