import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { agentNetwork } from '../network/agent-network';
import { executeImprovedOrchestrator } from '../agents/orchestrator.agent';
import { marketDataResilientTool } from '../tools/market-data-resilient.tool';

/**
 * エージェントシステムのパフォーマンステスト
 * TDD: まず失敗するテストを書いてから実装を改善
 */

describe('Agent Performance Optimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('A2A Communication Optimization', () => {
    it('should timeout within 10 seconds for A2A communication', async () => {
      const startTime = Date.now();
      
      try {
        // タイムアウトするシナリオをシミュレート
        await agentNetwork.sendMessage('nonExistentAgent', 'test', {
          query: 'test query',
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        // 現在は30秒だが、10秒以内であるべき
        expect(duration).toBeLessThan(11000); // 10秒 + バッファ
      }
    }, 15000);

    it('should reuse agent instances instead of re-registering', async () => {
      const registerSpy = jest.spyOn(agentNetwork, 'registerAgent');
      
      // 同じセッションで複数回実行
      const sessionId = 'test-session-' + Date.now();
      await executeImprovedOrchestrator('BTCの価格は？', sessionId, {});
      await executeImprovedOrchestrator('ETHの価格は？', sessionId, {});
      
      // エージェントの再登録が最小限であることを確認
      expect(registerSpy).toHaveBeenCalledTimes(4); // 初回のみ4エージェント登録
    });
  });

  describe('Cache Optimization', () => {
    it('should cache market data for at least 30 seconds', async () => {
      const fetchSpy = jest.spyOn(marketDataResilientTool, 'execute');
      
      // 初回呼び出し
      await marketDataResilientTool.execute({ symbol: 'BTCUSDT' });
      const firstCallCount = fetchSpy.mock.calls.length;
      
      // 即座に再呼び出し（キャッシュヒットするはず）
      await marketDataResilientTool.execute({ symbol: 'BTCUSDT' });
      expect(fetchSpy).toHaveBeenCalledTimes(firstCallCount); // キャッシュから返される
      
      // 25秒後（まだキャッシュ有効なはず）
      await new Promise(resolve => setTimeout(resolve, 25000));
      await marketDataResilientTool.execute({ symbol: 'BTCUSDT' });
      expect(fetchSpy).toHaveBeenCalledTimes(firstCallCount); // まだキャッシュから
    }, 35000);

    it('should share data between tools using SharedDataStore', async () => {
      // SharedDataStoreの実装をテスト（まだ存在しない）
      const SharedDataStore = require('../utils/shared-data-store').SharedDataStore;
      const store = new SharedDataStore();
      
      // データを保存
      store.set('BTCUSDT_price', { price: 50000, timestamp: Date.now() });
      
      // 別のツールから同じデータを取得
      const cachedData = store.get('BTCUSDT_price', 30000); // 30秒TTL
      expect(cachedData).toBeDefined();
      expect(cachedData.price).toBe(50000);
    });
  });

  describe('Memory Management', () => {
    it('should archive old messages after 50 messages', async () => {
      const { useEnhancedConversationMemory } = require('../../store/enhanced-conversation-memory.store');
      const store = useEnhancedConversationMemory.getState();
      
      const sessionId = 'test-memory-' + Date.now();
      
      // 60メッセージを追加
      for (let i = 0; i < 60; i++) {
        await store.addMessage({
          sessionId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
      
      // メモリ内は最新50件のみ
      const messages = store.getMessages(sessionId);
      expect(messages.length).toBe(50);
      
      // 古いメッセージはアーカイブされているはず
      const archivedMessages = await store.getArchivedMessages(sessionId);
      expect(archivedMessages.length).toBe(10);
    });

    it('should use WeakMap for temporary data to prevent memory leaks', () => {
      const UIEventDispatcher = require('../../utils/ui-event-dispatcher').UIEventDispatcher;
      const dispatcher = UIEventDispatcher.getInstance();
      
      // WeakMapを使用していることを確認
      expect(dispatcher._temporaryData).toBeInstanceOf(WeakMap);
    });
  });

  describe('Model Selection Optimization', () => {
    it('should select appropriate model based on task complexity', async () => {
      const ModelSelector = require('../utils/model-selector').ModelSelector;
      
      // 簡単なタスク → 速いモデル
      const simpleModel = ModelSelector.selectByComplexity('price_inquiry', 'free');
      expect(simpleModel).toBe('gpt-3.5-turbo');
      
      // 複雑なタスク → 高性能モデル
      const complexModel = ModelSelector.selectByComplexity('trading_analysis', 'premium');
      expect(complexModel).toBe('gpt-4o');
      
      // プレミアムユーザー → より良いモデル
      const premiumSimpleModel = ModelSelector.selectByComplexity('price_inquiry', 'premium');
      expect(premiumSimpleModel).toBe('gpt-4o-mini');
    });
  });

  describe('Error Handling Consistency', () => {
    it('should use unified AgentError class for all agent errors', async () => {
      const AgentError = require('../utils/agent-error').AgentError;
      
      try {
        await executeImprovedOrchestrator('', 'test-session', {});
      } catch (error) {
        expect(error).toBeInstanceOf(AgentError);
        expect(error.code).toBeDefined();
        expect(error.agent).toBeDefined();
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should measure and report agent execution time', async () => {
      const metrics = require('../../monitoring/metrics').metrics;
      const recordSpy = jest.spyOn(metrics, 'recordAgentExecution');
      
      await executeImprovedOrchestrator('BTCの価格は？', 'test-metrics', {});
      
      // メトリクスが記録されていることを確認
      expect(recordSpy).toHaveBeenCalled();
      expect(recordSpy).toHaveBeenCalledWith(
        expect.any(String), // agent name
        expect.any(Number)  // duration in ms
      );
    });

    it('should track cache hit rates', () => {
      const metrics = require('../../monitoring/metrics').metrics;
      const cacheMetrics = metrics.getCacheMetrics();
      
      expect(cacheMetrics).toHaveProperty('hitRate');
      expect(cacheMetrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheMetrics.hitRate).toBeLessThanOrEqual(1);
    });
  });
});

describe('Code Structure Improvements', () => {
  it('should have separated Orchestrator modules', () => {
    // ファイルが存在することを確認
    expect(() => require('../agents/orchestrator.handlers')).not.toThrow();
    expect(() => require('../agents/orchestrator.utils')).not.toThrow();
    expect(() => require('../agents/orchestrator.types')).not.toThrow();
  });

  it('should have no duplicate type definitions', () => {
    // 型定義の重複チェック
    const types = require('../agents/orchestrator.types');
    const utilTypes = require('../utils/intent');
    
    // IntentAnalysisResultは1箇所でのみ定義されるべき
    expect(types.IntentAnalysisResult).toBeDefined();
    expect(utilTypes.IntentAnalysisResult).toBeUndefined();
  });
});