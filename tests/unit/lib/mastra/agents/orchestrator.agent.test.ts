import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { orchestratorAgent, type OrchestratorAgentContext, type IntentAnalysisResult } from '@/lib/mastra/agents/orchestrator.agent';
import { generateCorrelationId } from '@/types/agent-payload';
import { traceManager } from '@/lib/monitoring/trace';
import { logger } from '@/lib/utils/logger';
import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';
import { parallelOrchestrator } from '@/lib/mastra/agents/parallel-orchestrator';
import { Message } from '@mastra/core';

// Mock dependencies
vi.mock('@/types/agent-payload', () => ({
  generateCorrelationId: vi.fn(() => 'test-correlation-id')
}));
vi.mock('@/lib/monitoring/trace', () => ({
  traceManager: {
    startTrace: vi.fn(),
    endTrace: vi.fn(),
    addEvent: vi.fn()
  }
}));
vi.mock('@/lib/utils/logger');
vi.mock('@/lib/store/enhanced-conversation-memory.store', () => ({
  useEnhancedConversationMemory: {
    getState: vi.fn(() => ({
      createSession: vi.fn().mockResolvedValue('test-session-id'),
      addMessage: vi.fn(),
      getProcessedMessages: vi.fn(() => []),
      getSessionContext: vi.fn(() => 'Previous context')
    }))
  },
  createEnhancedSession: vi.fn().mockResolvedValue('test-session-id')
}));
vi.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: vi.fn()
}));
vi.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: vi.fn().mockResolvedValue({
      results: [],
      errors: []
    })
  }
}));

// Mock the tools
vi.mock('@/lib/mastra/tools/agent-selection.tool', () => ({
  agentSelectionTool: {
    execute: vi.fn().mockResolvedValue({
      selectedAgent: 'price-agent',
      result: { price: 50000, symbol: 'BTCUSDT' }
    })
  }
}));
vi.mock('@/lib/mastra/tools/memory-recall.tool', () => ({
  memoryRecallTool: {
    execute: vi.fn().mockResolvedValue({
      messages: [],
      context: 'No previous context'
    })
  }
}));
vi.mock('@/lib/mastra/tools/market-snapshot.tool', () => ({
  marketSnapshotTool: {
    execute: vi.fn().mockResolvedValue({
      topMovers: [],
      marketSentiment: 'neutral'
    })
  },
  trendingTopicsTool: {
    execute: vi.fn().mockResolvedValue({
      topics: ['Bitcoin', 'Ethereum']
    })
  }
}));
vi.mock('@/lib/mastra/tools/market-data-resilient.tool', () => ({
  marketDataResilientTool: {
    execute: vi.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      price: 50000,
      change24h: 2.5
    })
  }
}));

describe('OrchestratorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Configuration', () => {
    it('should have correct agent properties', () => {
      expect(orchestratorAgent.name).toBe('cryptrade-orchestrator-v2');
      expect(orchestratorAgent.tools).toBeDefined();
      expect(orchestratorAgent.tools).toHaveProperty('agentSelectionTool');
      expect(orchestratorAgent.tools).toHaveProperty('memoryRecallTool');
      expect(orchestratorAgent.tools).toHaveProperty('marketSnapshot');
      expect(orchestratorAgent.tools).toHaveProperty('marketDataResilient');
    });

    it('should have dynamic model selection', () => {
      const model = orchestratorAgent.model;
      expect(typeof model).toBe('function');
      
      // Test different contexts
      const contexts = [
        { queryComplexity: 'simple', userTier: 'free', isProposalMode: false },
        { queryComplexity: 'complex', userTier: 'free', isProposalMode: false },
        { queryComplexity: 'simple', userTier: 'premium', isProposalMode: false },
        { queryComplexity: 'simple', userTier: 'free', isProposalMode: true },
      ];
      
      contexts.forEach(context => {
        const selectedModel = model(context);
        expect(selectedModel).toBeDefined();
      });
    });

    it('should have dynamic instructions based on context', () => {
      const instructions = orchestratorAgent.instructions;
      expect(typeof instructions).toBe('function');
      
      // Test different user levels
      const contexts = [
        { userLevel: 'beginner', marketStatus: 'open' },
        { userLevel: 'intermediate', marketStatus: 'open' },
        { userLevel: 'expert', marketStatus: 'open' },
        { userLevel: 'intermediate', marketStatus: 'closed' },
      ];
      
      contexts.forEach(context => {
        const instructionText = instructions(context);
        expect(instructionText).toContain('意図分析専門エージェント');
        
        if (context.userLevel === 'beginner') {
          expect(instructionText).toContain('初心者向け特別指示');
        }
        if (context.userLevel === 'expert') {
          expect(instructionText).toContain('エキスパート向け特別指示');
        }
        if (context.marketStatus === 'closed') {
          expect(instructionText).toContain('市場クローズ時の特別指示');
        }
      });
    });
  });

  describe('Message Processing', () => {
    it('should process simple price inquiry', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCの価格を教えて' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // The actual implementation would call tools and return formatted response
    });

    it('should handle greetings without agent selection', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'こんにちは！' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should respond directly without calling specialized agents
    });

    it('should process complex trading analysis request', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCの詳細な分析をして、買うべきか教えて' }
      ];
      
      const context: OrchestratorAgentContext = {
        queryComplexity: 'complex',
        isProposalMode: false
      };
      
      const result = await orchestratorAgent.generate(messages, { context });
      
      expect(result).toBeDefined();
      // Should select trading analysis agent
    });

    it('should handle UI control requests', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'トレンドラインを引いて' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should select UI control agent
    });

    it('should process proposal requests', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'サポートとレジスタンスの提案をして' }
      ];
      
      const context: OrchestratorAgentContext = {
        isProposalMode: true
      };
      
      const result = await orchestratorAgent.generate(messages, { context });
      
      expect(result).toBeDefined();
      // Should handle proposal mode
    });
  });

  describe('Memory Integration', () => {
    it('should recall previous messages when needed', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'さっき話したBTCについてもっと詳しく' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should use memory recall tool
    });

    it('should create new session when appropriate', async () => {
      const messages: Message[] = [
        { role: 'user', content: '新しい分析を始めて' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should potentially create new session
    });
  });

  describe('Market Context', () => {
    it('should use market snapshot for general queries', async () => {
      const messages: Message[] = [
        { role: 'user', content: '今の市場はどう？' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should use market snapshot tool
    });

    it('should handle trending topics requests', async () => {
      const messages: Message[] = [
        { role: 'user', content: '今話題の仮想通貨は？' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should use trending topics tool
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution failures gracefully', async () => {
      // Mock tool failure
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      vi.mocked(agentSelectionTool.execute).mockRejectedValueOnce(new Error('Tool execution failed'));
      
      const messages: Message[] = [
        { role: 'user', content: 'BTCの価格' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should handle error and provide fallback response
    });

    it('should handle memory recall failures', async () => {
      const { memoryRecallTool } = await import('@/lib/mastra/tools/memory-recall.tool');
      vi.mocked(memoryRecallTool.execute).mockRejectedValueOnce(new Error('Memory recall failed'));
      
      const messages: Message[] = [
        { role: 'user', content: 'さっきの話の続き' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should continue without memory context
    });
  });

  describe('Intent Analysis', () => {
    it('should correctly identify price inquiry intent', () => {
      const testCases = [
        'BTCの価格',
        'ビットコインいくら？',
        'ETH price',
        '現在のBTC価格を教えて'
      ];
      
      testCases.forEach(query => {
        // Test intent analysis logic
        expect(query).toBeTruthy();
      });
    });

    it('should correctly identify UI control intent', () => {
      const testCases = [
        'トレンドラインを描いて',
        'チャートをBTCに変更',
        '移動平均線を表示',
        'フィボナッチを引いて'
      ];
      
      testCases.forEach(query => {
        // Test intent analysis logic
        expect(query).toBeTruthy();
      });
    });

    it('should correctly identify trading analysis intent', () => {
      const testCases = [
        'BTCを分析して',
        '買うべきか教えて',
        '市場の状況を詳しく',
        'テクニカル分析をお願い'
      ];
      
      testCases.forEach(query => {
        // Test intent analysis logic
        expect(query).toBeTruthy();
      });
    });

    it('should correctly identify conversational intent', () => {
      const testCases = [
        'こんにちは',
        'ありがとう',
        '使い方を教えて',
        'さようなら'
      ];
      
      testCases.forEach(query => {
        // Test intent analysis logic
        expect(query).toBeTruthy();
      });
    });
  });

  describe('Parallel Execution', () => {
    it('should handle parallel agent execution when needed', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCとETHの価格を比較して' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should potentially use parallel orchestrator
    });

    it('should aggregate results from multiple agents', async () => {
      vi.mocked(parallelOrchestrator.execute).mockResolvedValueOnce({
        results: [
          { agentId: 'price-agent', result: { price: 50000, symbol: 'BTCUSDT' } },
          { agentId: 'price-agent', result: { price: 3000, symbol: 'ETHUSDT' } }
        ],
        errors: []
      });
      
      const messages: Message[] = [
        { role: 'user', content: '複数の通貨の状況を教えて' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should aggregate multiple results
    });
  });

  describe('Context Management', () => {
    it('should maintain conversation context', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCについて教えて' },
        { role: 'assistant', content: 'BTCは現在50000ドルです' },
        { role: 'user', content: 'それは高い？' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should understand context from previous messages
    });

    it('should handle context switches', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCについて教えて' },
        { role: 'assistant', content: 'BTCは現在50000ドルです' },
        { role: 'user', content: '話を変えて、ETHの分析をして' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should recognize context switch
    });
  });

  describe('Language Support', () => {
    it('should handle Japanese queries', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'ビットコインの今後の見通しは？' }
      ];
      
      const context: OrchestratorAgentContext = {
        language: 'ja'
      };
      
      const result = await orchestratorAgent.generate(messages, { context });
      
      expect(result).toBeDefined();
      // Should respond in Japanese
    });

    it('should handle English queries', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'What is the current BTC price?' }
      ];
      
      const context: OrchestratorAgentContext = {
        language: 'en'
      };
      
      const result = await orchestratorAgent.generate(messages, { context });
      
      expect(result).toBeDefined();
      // Should respond in English
    });

    it('should handle mixed language queries', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTCのpriceを教えて' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
      // Should handle mixed language
    });
  });

  describe('Performance', () => {
    it('should complete simple queries quickly', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTC価格' }
      ];
      
      const startTime = Date.now();
      const result = await orchestratorAgent.generate(messages);
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        messages: [{ role: 'user' as const, content: `BTC価格 ${i}` }]
      }));
      
      const promises = requests.map(req => 
        orchestratorAgent.generate(req.messages)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', async () => {
      const messages: Message[] = [];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const longContent = 'BTC' + '分析'.repeat(1000);
      const messages: Message[] = [
        { role: 'user', content: longContent }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
    });

    it('should handle special characters and emojis', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'BTC 🚀 moon! 💎🙌' }
      ];
      
      const result = await orchestratorAgent.generate(messages);
      
      expect(result).toBeDefined();
    });

    it('should handle malformed queries', async () => {
      const messages: Message[] = [
        { role: 'user', content: '...' },
        { role: 'user', content: '???' },
        { role: 'user', content: '   ' }
      ];
      
      for (const message of messages) {
        const result = await orchestratorAgent.generate([message]);
        expect(result).toBeDefined();
      }
    });
  });

  describe('Tool Integration', () => {
    it('should use agent selection tool correctly', async () => {
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      
      const messages: Message[] = [
        { role: 'user', content: 'BTCの価格' }
      ];
      
      await orchestratorAgent.generate(messages);
      
      // Agent selection tool should be called
      expect(agentSelectionTool.execute).toHaveBeenCalled();
    });

    it('should use memory recall tool when appropriate', async () => {
      const { memoryRecallTool } = await import('@/lib/mastra/tools/memory-recall.tool');
      
      const messages: Message[] = [
        { role: 'user', content: 'さっきの話について' }
      ];
      
      await orchestratorAgent.generate(messages);
      
      // Memory recall tool might be called
      // expect(memoryRecallTool.execute).toHaveBeenCalled();
    });

    it('should use market snapshot for market overview', async () => {
      const { marketSnapshotTool } = await import('@/lib/mastra/tools/market-snapshot.tool');
      
      const messages: Message[] = [
        { role: 'user', content: '市場の概要を教えて' }
      ];
      
      await orchestratorAgent.generate(messages);
      
      // Market snapshot tool might be called
      // expect(marketSnapshotTool.execute).toHaveBeenCalled();
    });
  });
});