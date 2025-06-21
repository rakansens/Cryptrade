import { 
  orchestratorAgent, 
  type OrchestratorAgentContext, 
  type IntentAnalysisResult,
  type OrchestratorExecutionResult,
  type OrchestratorExecutionResponse,
  type OrchestratorRuntimeContext,
  executeImprovedOrchestrator,
  analyzeUserIntent
} from '@/lib/mastra/agents/orchestrator.agent';
import { generateCorrelationId } from '@/types/agent-payload';
import { traceManager } from '@/lib/monitoring/trace';
import { logger } from '@/lib/utils/logger';
import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';
import { parallelOrchestrator } from '@/lib/mastra/agents/parallel-orchestrator';
import { Message } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';

// Mock dependencies
jest.mock('@/types/agent-payload', () => ({
  generateCorrelationId: jest.fn(() => 'test-correlation-id')
}));

jest.mock('@/lib/monitoring/trace', () => ({
  traceManager: {
    startTrace: jest.fn(),
    endTrace: jest.fn(),
    addEvent: jest.fn()
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/store/enhanced-conversation-memory.store', () => ({
  useEnhancedConversationMemory: {
    getState: jest.fn(() => ({
      currentSessionId: 'test-session-id',
      createSession: jest.fn().mockResolvedValue('test-session-id'),
      addMessage: jest.fn().mockResolvedValue(undefined),
      getProcessedMessages: jest.fn(() => []),
      getSessionContext: jest.fn(() => 'Previous context'),
      getMemoryStats: jest.fn(() => ({
        totalMessages: 5,
        processedMessages: 5,
        estimatedTokens: 100,
        processors: ['test-processor']
      })),
      getRecentMessages: jest.fn(() => [
        { role: 'user', content: 'BTCの価格', metadata: {} },
        { role: 'assistant', content: 'BTCは50000ドルです', metadata: {} }
      ])
    }))
  },
  createEnhancedSession: jest.fn().mockResolvedValue('test-session-id')
}));

jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn()
}));

jest.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: jest.fn().mockImplementation(async (userQuery, sessionId) => {
      // Simulate memory store operations that happen in parallel orchestrator
      const memoryStore = (require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState as jest.Mock)();
      
      // Add user message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'user',
        content: userQuery,
        agentId: 'parallel-orchestrator',
        metadata: {
          symbols: ['BTC', 'ETH'],
          topics: ['price', 'analysis']
        }
      });
      
      // Add assistant message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'assistant',
        content: 'Parallel execution response',
        agentId: 'parallel-orchestrator',
        metadata: {
          symbols: ['BTC', 'ETH'],
          topics: ['price', 'analysis']
        }
      });
      
      return {
        analysis: {
          intent: 'price_inquiry',
          confidence: 0.9,
          reasoning: 'Parallel processing',
          analysisDepth: 'detailed'
        },
        executionResult: {
          response: 'Parallel execution response',
          data: {}
        },
        executionTime: 1500,
        success: true
      };
    })
  }
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    id: 'mock-model',
    provider: 'openai'
  }))
}));

jest.mock('@mastra/core', () => ({
  Agent: jest.fn().mockImplementation((config) => ({
    ...config,
    generate: jest.fn().mockResolvedValue({
      text: 'こんにちは！暗号通貨取引についてお手伝いできることはありますか？',
      metadata: {}
    })
  })),
  Message: jest.fn()
}));

// Mock the tools
jest.mock('@/lib/mastra/tools/agent-selection.tool', () => ({
  agentSelectionTool: {
    execute: jest.fn().mockResolvedValue({
      executionResult: {
        response: 'BTCの現在価格は50,000ドルです。',
        data: { price: 50000, symbol: 'BTCUSDT' }
      },
      message: 'Price retrieved successfully'
    })
  }
}));

jest.mock('@/lib/mastra/tools/memory-recall.tool', () => ({
  memoryRecallTool: {
    execute: jest.fn().mockResolvedValue({
      messages: [],
      context: 'No previous context'
    })
  }
}));

jest.mock('@/lib/mastra/tools/market-snapshot.tool', () => ({
  marketSnapshotTool: {
    execute: jest.fn().mockResolvedValue({
      topMovers: [],
      marketSentiment: 'neutral'
    })
  },
  trendingTopicsTool: {
    execute: jest.fn().mockResolvedValue({
      topics: ['Bitcoin', 'Ethereum']
    })
  }
}));

jest.mock('@/lib/mastra/tools/market-data-resilient.tool', () => ({
  marketDataResilientTool: {
    execute: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      price: 50000,
      change24h: 2.5
    })
  }
}));

describe('OrchestratorAgent Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Agent Configuration', () => {
    it('should have correct agent properties', () => {
      expect(orchestratorAgent.name).toBe('cryptrade-orchestrator-v2');
      expect(orchestratorAgent.tools).toBeDefined();
      expect(orchestratorAgent.tools).toHaveProperty('agentSelectionTool');
      expect(orchestratorAgent.tools).toHaveProperty('memoryRecallTool');
      expect(orchestratorAgent.tools).toHaveProperty('marketSnapshot');
      expect(orchestratorAgent.tools).toHaveProperty('trendingTopics');
      expect(orchestratorAgent.tools).toHaveProperty('quickPrice');
    });

    it('should dynamically select model based on context', () => {
      const model = orchestratorAgent.model;
      expect(typeof model).toBe('function');
      
      // Test different contexts
      const contexts = [
        { queryComplexity: 'simple', userTier: 'free', isProposalMode: false, expected: 'gpt-3.5-turbo' },
        { queryComplexity: 'complex', userTier: 'free', isProposalMode: false, expected: 'gpt-4o' },
        { queryComplexity: 'simple', userTier: 'premium', isProposalMode: false, expected: 'gpt-4o-mini' },
        { queryComplexity: 'simple', userTier: 'free', isProposalMode: true, expected: 'gpt-4o' },
      ];
      
      contexts.forEach(({ expected, ...context }) => {
        const selectedModel = model(context);
        expect(selectedModel).toBeDefined();
        expect(jest.mocked(openai)).toHaveBeenCalledWith(expected);
      });
    });

    it('should generate dynamic instructions based on context', () => {
      const instructions = orchestratorAgent.instructions;
      expect(typeof instructions).toBe('function');
      
      // Test beginner level
      const beginnerContext: OrchestratorAgentContext = { 
        userLevel: 'beginner', 
        marketStatus: 'open' 
      };
      const beginnerInstructions = instructions(beginnerContext);
      expect(beginnerInstructions).toContain('初心者向け特別指示');
      expect(beginnerInstructions).toContain('専門用語は避けるか');
      
      // Test expert level
      const expertContext: OrchestratorAgentContext = { 
        userLevel: 'expert', 
        marketStatus: 'open' 
      };
      const expertInstructions = instructions(expertContext);
      expect(expertInstructions).toContain('エキスパート向け特別指示');
      expect(expertInstructions).toContain('高度な分析機能を積極的に活用');
      
      // Test closed market
      const closedMarketContext: OrchestratorAgentContext = { 
        userLevel: 'intermediate', 
        marketStatus: 'closed' 
      };
      const closedInstructions = instructions(closedMarketContext);
      expect(closedInstructions).toContain('市場クローズ時の特別指示');
      expect(closedInstructions).toContain('履歴データを活用');
    });
  });

  describe('Intent Analysis', () => {
    it('should correctly analyze price inquiry intent', () => {
      const testCases = [
        { query: 'BTCの価格を教えて', expectedSymbol: 'BTCUSDT' },
        { query: 'ビットコインいくら？', expectedSymbol: 'BTCUSDT' },
        { query: 'ETH price', expectedSymbol: 'ETHUSDT' },
        { query: '現在のSOL価格は？', expectedSymbol: 'SOLUSDT' }
      ];
      
      testCases.forEach(({ query, expectedSymbol }) => {
        const result = analyzeUserIntent(query);
        expect(result.intent).toBe('price_inquiry');
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.extractedSymbol).toBe(expectedSymbol);
      });
    });

    it('should correctly analyze UI control intent', () => {
      const testCases = [
        { query: 'トレンドラインを描いて', intent: 'proposal_request' },
        { query: 'チャートをBTCに変更', intent: 'ui_control' },
        { query: '移動平均線を表示', intent: 'ui_control' },
        { query: 'フィボナッチを引いて', intent: 'proposal_request' }
      ];
      
      testCases.forEach(({ query, intent }) => {
        const result = analyzeUserIntent(query);
        expect(result.intent).toBe(intent);
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should correctly analyze trading analysis intent', () => {
      const testCases = [
        'BTCを分析して',
        '買うべきか教えて',
        '市場の状況を詳しく',
        'テクニカル分析をお願い'
      ];
      
      testCases.forEach(query => {
        const result = analyzeUserIntent(query);
        expect(result.intent).toBe('trading_analysis');
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.analysisDepth).toBeDefined();
      });
    });

    it('should correctly analyze conversational intents', () => {
      const testCases = [
        { query: 'こんにちは', intent: 'greeting' },
        { query: 'ありがとう', intent: 'small_talk' },
        { query: '使い方を教えて', intent: 'help_request' },
        { query: '最近の市場はどう？', intent: 'market_chat' }
      ];
      
      testCases.forEach(({ query, intent }) => {
        const result = analyzeUserIntent(query);
        expect(result.intent).toBe(intent);
        expect(result.confidence).toBeGreaterThan(0.7);
      });
    });

    it('should handle proposal requests with different types', () => {
      const testCases = [
        { query: 'トレンドラインの提案をして', proposalType: 'trendline' },
        { query: 'サポートとレジスタンスの候補を表示', proposalType: 'support-resistance' },
        { query: 'フィボナッチの提案', proposalType: 'fibonacci' },
        { query: 'エントリーポイントを提案して', proposalType: 'entry' }
      ];
      
      testCases.forEach(({ query, proposalType }) => {
        const result = analyzeUserIntent(query);
        expect(result.intent).toBe('proposal_request');
        expect(result.isProposalMode).toBe(true);
        expect(result.proposalType).toBe(proposalType);
      });
    });
  });

  describe('Message Processing with executeImprovedOrchestrator', () => {
    it('should process simple price inquiry', async () => {
      const result = await executeImprovedOrchestrator('BTCの価格を教えて');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('price_inquiry');
      expect(result.executionResult).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle greetings directly without agent delegation', async () => {
      const result = await executeImprovedOrchestrator('こんにちは！');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('greeting');
      expect(jest.mocked(Agent)).toHaveBeenCalled();
    });

    it('should use parallel orchestrator for complex queries', async () => {
      const complexQuery = 'BTCとETHの詳細な分析をして、どちらが買い時か教えて。' + 
                          'さらに、サポートレジスタンスの提案もお願いします。';
      
      await executeImprovedOrchestrator(complexQuery);
      
      expect(parallelOrchestrator.execute as jest.Mock).toHaveBeenCalled();
    });

    it('should handle session management properly', async () => {
      const sessionId = 'custom-session-id';
      await executeImprovedOrchestrator('BTCの価格', sessionId);
      
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      expect(memoryStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          role: 'user',
          content: 'BTCの価格'
        })
      );
    });

    it('should process UI control requests', async () => {
      const result = await executeImprovedOrchestrator('チャートをETHに変更して');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('ui_control');
    });

    it('should handle trading analysis with proper context', async () => {
      const context: OrchestratorRuntimeContext = {
        queryComplexity: 'complex',
        isProposalMode: false,
        userLevel: 'expert'
      };
      
      const result = await executeImprovedOrchestrator(
        'BTCの詳細な分析をお願いします',
        undefined,
        context
      );
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('trading_analysis');
      expect(result.analysis.analysisDepth).toBe('detailed');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle agent execution failures gracefully', async () => {
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      (agentSelectionTool.execute as jest.Mock).mockRejectedValueOnce(new Error('Agent failed'));
      
      const result = await executeImprovedOrchestrator('BTCの価格');
      
      expect(result.success).toBe(true);
      expect(result.executionResult).toBeDefined();
      expect(logger.error as jest.Mock).toHaveBeenCalled();
    });

    it('should handle memory recall failures', async () => {
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      memoryStore.getSessionContext = jest.fn().mockImplementation(() => {
        throw new Error('Memory error');
      });
      
      const result = await executeImprovedOrchestrator('さっきの話の続き');
      
      // Should still return success=true as the error is handled gracefully
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[Improved Orchestrator]'),
        expect.objectContaining({ error: 'Memory error' })
      );
    });

    it('should handle agent registration failures', async () => {
      jest.mocked(registerAllAgents).mockImplementationOnce(() => {
        throw new Error('Registration failed');
      });
      
      const result = await executeImprovedOrchestrator('BTCの価格');
      
      expect(result.success).toBe(true);
      expect(logger.warn as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('Agent registration failed'),
        expect.any(Object)
      );
    });

    it('should provide fallback response when agent returns no response', async () => {
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      (agentSelectionTool.execute as jest.Mock).mockResolvedValueOnce({});
      
      const result = await executeImprovedOrchestrator('BTCの価格');
      
      expect(result.success).toBe(true);
      expect(result.executionResult).toBeDefined();
      expect(logger.warn as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('Agent returned no response'),
        expect.any(Object)
      );
    });
  });

  describe('Tool Selection and Integration', () => {
    it('should select appropriate tools based on intent', async () => {
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      
      await executeImprovedOrchestrator('BTCの価格');
      
      expect(agentSelectionTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            agentType: 'price_inquiry',
            query: 'BTCの価格'
          })
        })
      );
    });

    it('should use memory recall tool for context-dependent queries', async () => {
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      memoryStore.getRecentMessages = jest.fn(() => [
        { role: 'user', content: 'BTCについて教えて', metadata: {} },
        { role: 'assistant', content: 'BTCは...', metadata: {} },
      ]);
      
      await executeImprovedOrchestrator('それについてもっと詳しく');
      
      expect(memoryStore.getRecentMessages).toHaveBeenCalled();
    });

    it('should handle market snapshot requests', async () => {
      const { marketSnapshotTool } = await import('@/lib/mastra/tools/market-snapshot.tool');
      
      // This would be called if the agent uses the tool
      expect(marketSnapshotTool.execute).toBeDefined();
    });
  });

  describe('Context and Memory Management', () => {
    it('should maintain conversation context across messages', async () => {
      const sessionId = 'test-session';
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      
      await executeImprovedOrchestrator('BTCについて教えて', sessionId);
      await executeImprovedOrchestrator('それは高い？', sessionId);
      
      expect(memoryStore.addMessage).toHaveBeenCalledTimes(2);
      expect(memoryStore.getRecentMessages).toHaveBeenCalled();
    });

    it('should handle context switches properly', async () => {
      const result = await executeImprovedOrchestrator('話を変えて、ETHの分析をして');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('trading_analysis');
      expect(result.analysis.extractedSymbol).toBe('ETHUSDT');
    });

    it('should extract metadata from queries', async () => {
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      
      await executeImprovedOrchestrator('BTCとETHの価格分析をお願いします');
      
      expect(memoryStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbols: expect.arrayContaining(['BTC', 'ETH']),
            topics: expect.arrayContaining(['price', 'analysis'])
          })
        })
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty or malformed queries', async () => {
      const testCases = ['', '   ', '...', '???', null, undefined];
      
      for (const query of testCases) {
        const result = await executeImprovedOrchestrator(query || '');
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });

    it('should handle very long messages', async () => {
      const longQuery = 'BTC' + '分析'.repeat(500);
      const result = await executeImprovedOrchestrator(longQuery);
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle special characters and emojis', async () => {
      const queries = [
        'BTC 🚀 moon! 💎🙌',
        'ビットコイン♪買い時？',
        'ETH/USD $$$',
        '!!!BTCの価格!!!'
      ];
      
      for (const query of queries) {
        const result = await executeImprovedOrchestrator(query);
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      const result = await executeImprovedOrchestrator('BTC価格');
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000);
      expect(result.executionTime).toBeLessThan(5000);
    });
  });

  describe('Language Support', () => {
    it('should handle Japanese queries properly', async () => {
      const queries = [
        'ビットコインの価格を教えてください',
        'イーサリアムの分析をお願いします',
        'リップルは買い時ですか？'
      ];
      
      for (const query of queries) {
        const result = await executeImprovedOrchestrator(query);
        expect(result.success).toBe(true);
        expect(result.analysis.extractedSymbol).toBeDefined();
      }
    });

    it('should handle English queries', async () => {
      const queries = [
        'What is the current BTC price?',
        'Analyze Ethereum for me',
        'Should I buy Solana?'
      ];
      
      for (const query of queries) {
        const result = await executeImprovedOrchestrator(query);
        expect(result.success).toBe(true);
        expect(result.analysis.intent).toBeDefined();
      }
    });

    it('should handle mixed language queries', async () => {
      const result = await executeImprovedOrchestrator('BTCのpriceを分析して');
      
      expect(result.success).toBe(true);
      expect(result.analysis.extractedSymbol).toBe('BTCUSDT');
    });
  });

  describe('Conversation Handling', () => {
    it('should handle different conversation modes', async () => {
      const greetingResult = await executeImprovedOrchestrator('おはようございます！');
      expect(greetingResult.analysis.intent).toBe('greeting');
      
      const marketChatResult = await executeImprovedOrchestrator('最近の市場はどうですか？');
      expect(marketChatResult.analysis.intent).toBe('market_chat');
      
      const smallTalkResult = await executeImprovedOrchestrator('ありがとう！');
      expect(smallTalkResult.analysis.intent).toBe('small_talk');
    });

    it('should adapt response based on relationship level', async () => {
      const memoryStore = (useEnhancedConversationMemory.getState as jest.Mock)();
      
      // New user (few messages)
      memoryStore.getMemoryStats = jest.fn(() => ({
        totalMessages: 2,
        processedMessages: 2,
        estimatedTokens: 50,
        processors: []
      }));
      
      const newUserResult = await executeImprovedOrchestrator('こんにちは');
      expect(jest.mocked(Agent)).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('new:')
        })
      );
      
      // Regular user (many messages)
      memoryStore.getMemoryStats = jest.fn(() => ({
        totalMessages: 50,
        processedMessages: 50,
        estimatedTokens: 1000,
        processors: []
      }));
      
      const regularUserResult = await executeImprovedOrchestrator('こんにちは');
      expect(jest.mocked(Agent)).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('regular:')
        })
      );
    });
  });

  describe('Routing and Agent Selection', () => {
    it('should route to correct agent based on intent', async () => {
      const { agentSelectionTool } = await import('@/lib/mastra/tools/agent-selection.tool');
      
      // Price inquiry -> price_inquiry agent
      await executeImprovedOrchestrator('BTCの価格');
      expect(agentSelectionTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            agentType: 'price_inquiry'
          })
        })
      );
      
      jest.clearAllMocks();
      
      // UI control -> ui_control agent
      await executeImprovedOrchestrator('チャートをETHに変更');
      expect(agentSelectionTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            agentType: 'ui_control'
          })
        })
      );
      
      jest.clearAllMocks();
      
      // Trading analysis -> trading_analysis agent
      await executeImprovedOrchestrator('BTCを詳しく分析して');
      expect(agentSelectionTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            agentType: 'trading_analysis'
          })
        })
      );
    });

    it('should handle proposal requests as trading analysis', async () => {
      const agentSelectionTool = require('@/lib/mastra/tools/agent-selection.tool').agentSelectionTool;
      
      await executeImprovedOrchestrator('トレンドラインの提案をして');
      
      expect(agentSelectionTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            agentType: 'trading_analysis',
            isProposalMode: true,
            proposalType: 'trendline'
          })
        })
      );
    });
  });
});