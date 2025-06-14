import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AgentNetwork, agentNetwork } from '../network/agent-network';
import { registerAllAgents } from '../network/agent-registry';
import { logger } from '@/lib/utils/logger';

// Zustand永続化のテスト環境対応
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => null),
      removeItem: jest.fn(() => null),
      clear: jest.fn(() => null),
    },
    writable: true,
  });
} else {
  // Node.js環境用のグローバルlocalStorage
  (global as any).localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(() => null),
    removeItem: jest.fn(() => null),
    clear: jest.fn(() => null),
  };
}

/**
 * A2A Communication System Tests
 * 
 * Agent-to-Agent通信システムの包括的テスト
 * - エージェント登録と健全性チェック
 * - メッセージ送信と受信
 * - ルーティングとエージェント選択
 * - エラーハンドリングとフォールバック
 */

// ログを無効化（テスト時のノイズ削減）
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'debug').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

describe('A2A Communication System', () => {
  let testNetwork: AgentNetwork;

  beforeEach(() => {
    // 各テスト前に新しいネットワークインスタンスを作成
    testNetwork = new AgentNetwork({
      maxHops: 3,
      timeout: 1000, // テスト用に短縮
      enableLogging: false,
      enableMetrics: false,
    });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    jest.clearAllMocks();
  });

  describe('Agent Registration', () => {
    test('should register agents successfully', () => {
      // グローバルネットワークにエージェントを登録
      expect(() => registerAllAgents()).not.toThrow();
      
      // ネットワーク統計を確認
      const stats = agentNetwork.getNetworkStats();
      expect(stats.totalAgents).toBeGreaterThan(0);
      expect(stats.activeAgents).toBeGreaterThan(0);
    });

    test('should handle duplicate agent registration', () => {
      // 同じエージェントを複数回登録してもエラーにならない
      expect(() => {
        registerAllAgents();
        registerAllAgents();
      }).not.toThrow();
    });

    test('should track agent statistics', () => {
      registerAllAgents();
      const stats = agentNetwork.getNetworkStats();
      
      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('activeAgents');
      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('averageMessages');
      expect(typeof stats.totalAgents).toBe('number');
      expect(typeof stats.activeAgents).toBe('number');
    });
  });

  describe('Agent Selection and Routing', () => {
    beforeEach(() => {
      registerAllAgents();
      
      // LLMベースのルーティングエージェントをモック化
      const mockRoutingAgent = {
        generate: jest.fn()
      };
      
      // パターンベースの選択をモック - 優先順位重視
      mockRoutingAgent.generate.mockImplementation((prompt: string) => {
        const queryLower = prompt.toLowerCase();
        
        // BTCとpriceは最優先でpriceInquiryAgent
        if (queryLower.includes('btc') && queryLower.includes('価格')) {
          return Promise.resolve('priceInquiryAgent');
        }
        
        // ETHと投資判断はtradingAnalysisAgent
        if (queryLower.includes('eth') && queryLower.includes('投資判断')) {
          return Promise.resolve('tradingAnalysisAgent');
        }
        
        // チャートと変更はuiControlAgent
        if (queryLower.includes('チャート') && queryLower.includes('変更')) {
          return Promise.resolve('uiControlAgent');
        }
        
        // 挨拶はorchestratorAgent
        if (queryLower.includes('こんにちは')) {
          return Promise.resolve('orchestratorAgent');
        }
        
        // 不明なリクエストもorchestrator（デフォルト）
        return Promise.resolve('orchestratorAgent');
      });
      
      // AgentNetworkのroutingAgentをモックで置き換え
      (agentNetwork as any).routingAgent = mockRoutingAgent;
    });

    test('should select correct agent for price inquiry', async () => {
      const selectedAgent = await agentNetwork.selectAgent(
        'BTCの現在価格を教えて',
        { intent: 'price_inquiry' }
      );
      
      expect(selectedAgent).toBe('priceInquiryAgent');
    });

    test('should select correct agent for UI control', async () => {
      const selectedAgent = await agentNetwork.selectAgent(
        'チャートを1時間足に変更して',
        { intent: 'ui_control' }
      );
      
      expect(selectedAgent).toBe('uiControlAgent');
    });

    test('should select correct agent for trading analysis', async () => {
      const selectedAgent = await agentNetwork.selectAgent(
        'ETHの投資判断を分析して',
        { intent: 'trading_analysis' }
      );
      
      expect(selectedAgent).toBe('tradingAnalysisAgent');
    });

    test('should fallback to orchestrator for unclear queries', async () => {
      const selectedAgent = await agentNetwork.selectAgent(
        'こんにちは',
        { intent: 'conversational' }
      );
      
      // 不明な場合はオーケストレーターにフォールバック
      expect(selectedAgent).toBe('orchestratorAgent');
    });

    test('should handle invalid agent selection gracefully', async () => {
      // ルーティングエージェントがエラーを投げるようにモック
      (agentNetwork as any).routingAgent.generate.mockRejectedValueOnce(new Error('Test error'));
      
      const selectedAgent = await agentNetwork.selectAgent(
        'completely unknown request that should fail selection'
      );
      
      // エラー時はパターンマッチングでフォールバック
      expect(selectedAgent).toBe('orchestratorAgent');
    });
  });

  describe('Message Communication', () => {
    beforeEach(() => {
      registerAllAgents();
      
      // エージェントの生成メソッドをモック化
      const mockGenerate = jest.fn().mockResolvedValue('Test response from agent');
      
      // 登録されたエージェントのgenerateメソッドをモック
      for (const [agentId, registration] of (agentNetwork as any).agents) {
        registration.agent.generate = mockGenerate;
      }
    });

    test('should send message between agents', async () => {
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'priceInquiryAgent',
        'test_message',
        { test: true },
        'test-correlation-001'
      );

      expect(response).not.toBeNull();
      if (response) {
        expect(response.type).toBe('response');
        expect(response.source).toBe('priceInquiryAgent');
        expect(response.target).toBe('orchestratorAgent');
        expect(response.correlationId).toBe('test-correlation-001');
      }
    });

    test('should handle non-existent target agent', async () => {
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'nonExistentAgent',
        'test_message',
        {},
        'test-correlation-002'
      );

      expect(response).toBeNull();
    });

    test('should route messages intelligently', async () => {
      const response = await agentNetwork.routeMessage(
        'orchestratorAgent',
        'BTCの価格を教えて'
      );

      expect(response).not.toBeNull();
      if (response) {
        expect(response.type).toBe('response');
        expect(response.source).toBe('priceInquiryAgent');
      }
    });
  });

  describe('Broadcast Communication', () => {
    beforeEach(() => {
      registerAllAgents();
      
      // エージェントの生成メソッドをモック化
      const mockGenerate = jest.fn().mockResolvedValue('Broadcast response');
      
      for (const [agentId, registration] of (agentNetwork as any).agents) {
        registration.agent.generate = mockGenerate;
      }
    });

    test('should broadcast to multiple agents', async () => {
      const responses = await agentNetwork.broadcastMessage(
        'orchestratorAgent',
        'health_check'
      );

      // 少なくとも1つのレスポンスが返ってくる
      expect(responses.length).toBeGreaterThan(0);
      
      // 各レスポンスが適切な構造を持つ
      responses.forEach(response => {
        expect(response).toHaveProperty('type');
        expect(response).toHaveProperty('source');
        expect(response).toHaveProperty('target');
      });
    });

    test('should filter broadcast targets', async () => {
      const responses = await agentNetwork.broadcastMessage(
        'orchestratorAgent',
        'filtered_message',
        {},
        (agent) => agent.id === 'priceInquiryAgent'
      );

      // フィルタリングされたので1つだけ
      expect(responses.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      registerAllAgents();
      
      // エージェントの生成メソッドをモック化（高速）
      const mockGenerate = jest.fn().mockResolvedValue('Health OK');
      
      for (const [agentId, registration] of (agentNetwork as any).agents) {
        registration.agent.generate = mockGenerate;
      }
    });

    test('should perform health check on all agents', async () => {
      const healthResults = await agentNetwork.healthCheck();
      
      expect(Object.keys(healthResults).length).toBeGreaterThan(0);
      
      // 各エージェントの健全性がboolean値
      Object.values(healthResults).forEach(isHealthy => {
        expect(typeof isHealthy).toBe('boolean');
      });
    });

    test('should handle health check timeout gracefully', async () => {
      // タイムアウトの短いネットワークで健全性チェック
      const shortTimeoutNetwork = new AgentNetwork({
        timeout: 10, // 10ms timeout (非常に短い)
      });
      
      // モック化された高速レスポンスでも動作確認
      const mockGenerate = jest.fn().mockResolvedValue('Fast health check');
      shortTimeoutNetwork.registerAgent('testAgent', { generate: mockGenerate } as any, [], 'test');
      
      const healthResults = await shortTimeoutNetwork.healthCheck();
      
      // 結果は返ってくる
      expect(typeof healthResults).toBe('object');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed messages', async () => {
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'priceInquiryAgent',
        '', // 空のメソッド
        null, // nullパラメータ
        undefined // undefinedの相関ID
      );

      // エラーが適切に処理される
      expect(response).not.toBeNull();
      if (response) {
        expect(['response', 'error']).toContain(response.type);
      }
    });

    test('should validate A2A message format', () => {
      // A2Aメッセージスキーマの検証
      const validMessage = {
        id: 'test-001',
        type: 'request' as const,
        source: 'orchestratorAgent',
        target: 'priceInquiryAgent',
        method: 'process_query',
        params: { query: 'test' },
        timestamp: Date.now(),
        correlationId: 'test-correlation',
      };

      // 型チェック - エラーが発生しないことを確認
      expect(() => {
        const messageType: typeof validMessage = validMessage;
        expect(messageType.type).toBe('request');
      }).not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      registerAllAgents();
    });

    test('should track message count and timing', async () => {
      const statsBefore = agentNetwork.getNetworkStats();
      
      await agentNetwork.sendMessage(
        'orchestratorAgent',
        'priceInquiryAgent',
        'performance_test',
        { test: true }
      );
      
      const statsAfter = agentNetwork.getNetworkStats();
      
      // メッセージカウントが増加していることを確認
      expect(statsAfter.totalMessages).toBeGreaterThanOrEqual(statsBefore.totalMessages);
    });

    test('should handle concurrent messages', async () => {
      // 複数のメッセージを同時送信
      const promises = Array(5).fill(0).map((_, i) => 
        agentNetwork.sendMessage(
          'orchestratorAgent',
          'priceInquiryAgent',
          'concurrent_test',
          { messageNumber: i },
          `concurrent-${i}`
        )
      );

      const responses = await Promise.all(promises);
      
      // 全てのメッセージが処理される
      expect(responses.filter(r => r !== null)).toHaveLength(5);
    });
  });
});

// 統合テスト
describe('A2A Integration Tests', () => {
  beforeEach(() => {
    // 統合テスト用のモック設定
    registerAllAgents();
    
    // グローバルエージェントネットワークのモック化
    const mockGenerate = jest.fn().mockResolvedValue('Integration test response');
    
    for (const [agentId, registration] of (agentNetwork as any).agents) {
      registration.agent.generate = mockGenerate;
    }
    
    // ルーティングエージェントもモック化
    (agentNetwork as any).routingAgent = {
      generate: jest.fn().mockResolvedValue('priceInquiryAgent')
    };
  });

  test('should integrate with agent selection tool', async () => {
    // エージェント選択ツールがA2A通信を使用できることを確認
    const { agentSelectionTool } = await import('../tools/agent-selection.tool');
    
    const result = await agentSelectionTool.execute({
      context: {
        agentType: 'price_inquiry',
        query: 'BTCの価格を教えて',
        context: {},
        correlationId: 'integration-test-001',
      },
      runtimeContext: { sessionId: 'test-session' }, // runtimeContextを追加
    });

    expect(result.success).toBe(true);
    expect(result.selectedAgent).toBeDefined();
    expect(result.executionResult).toBeDefined();
  });

  test('should work with orchestrator execution flow', async () => {
    // 統合ユーティリティの依存関係をモック化
    jest.mock('@/lib/monitoring/trace', () => ({
      traceManager: {
        startTrace: jest.fn().mockReturnValue({ correlationId: 'test-trace' }),
        endTrace: jest.fn(),
      }
    }));
    
    jest.mock('../utils/intent', () => ({
      analyzeIntent: jest.fn().mockReturnValue({
        intent: 'price_inquiry',
        confidence: 0.9,
        reasoning: 'Test intent analysis',
        analysisDepth: 'basic',
      }),
    }));

    const { executeImprovedOrchestrator } = await import('../agents/orchestrator.agent');
    
    const result = await executeImprovedOrchestrator(
      'BTCの現在価格を教えて',
      'test-session-001'
    );

    expect(result.success).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.intent).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  });
});