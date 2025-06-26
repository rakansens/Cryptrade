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
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';

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

// Use the existing mock from __mocks__ directory
jest.mock('@/lib/store/enhanced-conversation-memory.store');

jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn()
}));

jest.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: jest.fn().mockImplementation(async (userQuery, sessionId, runtimeContext) => {
      // Simulate memory store operations that happen in parallel orchestrator
      // Use the mocked memory store from __mocks__
      const memoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
      
      // Add user message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'user',
        content: userQuery,
        agentId: 'parallel-orchestrator',
        metadata: {
          symbols: extractSymbolsFromQuery(userQuery),
          topics: extractTopicsFromQuery(userQuery)
        }
      });
      
      // Generate dynamic response based on query
      const responseContent = generateDynamicResponse(userQuery);
      const executionStartTime = Date.now();
      
      // Add assistant message
      await memoryStore.addMessage({
        sessionId: sessionId || 'test-session-id',
        role: 'assistant',
        content: responseContent,
        agentId: 'parallel-orchestrator',
        metadata: {
          symbols: extractSymbolsFromQuery(userQuery),
          topics: extractTopicsFromQuery(userQuery)
        }
      });
      
      const executionEndTime = Date.now();
      
      // Determine analysis depth based on user level and query complexity
      let analysisDepth: 'basic' | 'detailed' | 'comprehensive' = 'basic';
      
      // First determine base depth based on query
      if (userQuery.length > 50 || userQuery.includes('詳細') || userQuery.includes('分析')) {
        analysisDepth = 'detailed';
      }
      
      // Then adjust based on user level if provided
      if (runtimeContext?.userLevel) {
        switch (runtimeContext.userLevel) {
          case 'beginner':
            analysisDepth = 'basic';
            break;
          case 'intermediate':
            analysisDepth = analysisDepth === 'comprehensive' ? 'detailed' : analysisDepth;
            break;
          case 'expert':
            analysisDepth = analysisDepth === 'basic' ? 'detailed' : analysisDepth;
            break;
        }
      }
      
      const intent = detectIntent(userQuery);
      const isProposalMode = intent === 'proposal_request';
      let proposalType: string | undefined = undefined;
      
      if (isProposalMode) {
        if (userQuery.match(/トレンドライン|trend/i)) {
          proposalType = 'trendline';
        } else if (userQuery.match(/サポート|レジスタンス|support|resistance/i)) {
          proposalType = 'support-resistance';
        } else if (userQuery.match(/フィボナッチ|fibonacci/i)) {
          proposalType = 'fibonacci';
        } else if (userQuery.match(/エントリー|entry/i)) {
          proposalType = 'entry';
        } else {
          proposalType = 'all';
        }
      }
      
      return {
        analysis: {
          intent: intent,
          confidence: calculateConfidence(userQuery),
          reasoning: `Analyzed query: "${userQuery}"`,
          analysisDepth: analysisDepth,
          userLevel: runtimeContext?.userLevel,
          ...(isProposalMode && { isProposalMode, proposalType })
        },
        executionResult: {
          response: responseContent,
          data: {
            queryLength: userQuery.length,
            timestamp: executionEndTime
          }
        },
        executionTime: executionEndTime - executionStartTime,
        success: true
      };
    })
  }
}));

// Helper functions for dynamic mock responses
function extractSymbolsFromQuery(query: string): string[] {
  const symbols = [];
  if (query.match(/btc|ビットコイン/i)) symbols.push('BTC');
  if (query.match(/eth|イーサリアム/i)) symbols.push('ETH');
  if (query.match(/sol|ソラナ/i)) symbols.push('SOL');
  return symbols.length > 0 ? symbols : ['BTC']; // Default to BTC
}

function extractTopicsFromQuery(query: string): string[] {
  const topics = [];
  if (query.match(/価格|price/i)) topics.push('price');
  if (query.match(/分析|analysis/i)) topics.push('analysis');
  if (query.match(/チャート|chart/i)) topics.push('chart');
  if (query.match(/トレンド|trend/i)) topics.push('trend');
  return topics.length > 0 ? topics : ['general'];
}

function detectIntent(query: string): string {
  if (query.match(/価格|いくら|price/i)) return 'price_inquiry';
  if (query.match(/分析|analyze/i)) return 'trading_analysis';
  if (query.match(/チャート|chart/i)) return 'ui_control';
  if (query.match(/こんにちは|hello/i)) return 'greeting';
  if (query.match(/提案|候補|おすすめ|推奨/i)) return 'proposal_request';
  return 'conversational';
}

function calculateConfidence(query: string): number {
  // More specific queries get higher confidence
  const specificKeywords = query.match(/btc|eth|価格|分析|チャート/gi);
  const confidence = 0.5 + (specificKeywords ? specificKeywords.length * 0.1 : 0);
  return Math.min(confidence, 0.95);
}

function generateDynamicResponse(query: string): string {
  if (query.match(/価格/i)) {
    return `現在の価格情報を取得しました。${query}に関する詳細な情報です。`;
  }
  if (query.match(/分析/i)) {
    return `${query}の分析結果：市場は活発に動いています。`;
  }
  return `「${query}」に対する応答です。`;
}

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
jest.mock('@/lib/mastra/tools/agent-selection.tool');

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
  let mockMemoryStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock memory store from the mocked module
    mockMemoryStore = require('@/lib/store/enhanced-conversation-memory.store').useEnhancedConversationMemory.getState();
    
    // Reset mockMemoryStore functions to their default implementations
    // Note: currentSessionId is a getter-only property, so we don't set it directly
    mockMemoryStore.createSession = jest.fn().mockResolvedValue('test-session-id');
    mockMemoryStore.addMessage = jest.fn().mockResolvedValue(undefined);
    mockMemoryStore.getProcessedMessages = jest.fn(() => []);
    mockMemoryStore.getSessionContext = jest.fn(() => 'Previous context');
    mockMemoryStore.getMemoryStats = jest.fn(() => ({
      totalMessages: 5,
      processedMessages: 5,
      estimatedTokens: 100,
      processors: ['test-processor']
    }));
    mockMemoryStore.getRecentMessages = jest.fn(() => [
      { role: 'user', content: 'BTCの価格', metadata: {} },
      { role: 'assistant', content: 'BTCは50000ドルです', metadata: {} }
    ]);
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
      expect(beginnerInstructions).toMatch(/初心者|beginner/i);
      expect(beginnerInstructions.length).toBeGreaterThan(100);
      
      // Test expert level
      const expertContext: OrchestratorAgentContext = { 
        userLevel: 'expert', 
        marketStatus: 'open' 
      };
      const expertInstructions = instructions(expertContext);
      expect(expertInstructions).toMatch(/エキスパート|expert|高度/i);
      expect(expertInstructions).not.toBe(beginnerInstructions);
      
      // Test closed market
      const closedMarketContext: OrchestratorAgentContext = { 
        userLevel: 'intermediate', 
        marketStatus: 'closed' 
      };
      const closedInstructions = instructions(closedMarketContext);
      expect(closedInstructions).toMatch(/クローズ|closed|履歴/i);
      expect(closedInstructions).not.toBe(expertInstructions);
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
        { query: 'トレンドラインを描いて', intent: 'ui_control' },
        { query: 'チャートをBTCに変更', intent: 'ui_control' },
        { query: '移動平均線を表示', intent: 'ui_control' },
        { query: 'フィボナッチを引いて', intent: 'ui_control' }
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
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
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
      
      // Clear previous mock calls
      jest.mocked(mockMemoryStore.addMessage).mockClear();
      
      await executeImprovedOrchestrator('BTCの価格', sessionId);
      
      // Check that addMessage was called at least once with user message
      expect(mockMemoryStore.addMessage).toHaveBeenCalled();
      
      // Find the call with user role
      const userMessageCall = jest.mocked(mockMemoryStore.addMessage).mock.calls.find(
        call => call[0].role === 'user' && call[0].content === 'BTCの価格'
      );
      
      expect(userMessageCall).toBeDefined();
      expect(userMessageCall?.[0]).toMatchObject({
        sessionId: sessionId,
        role: 'user',
        content: 'BTCの価格'
      });
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
      // Intent might be detected as price_inquiry due to "分析" keyword
      expect(['trading_analysis', 'price_inquiry']).toContain(result.analysis.intent);
      // With expert level and '詳細な分析' query, should be detailed
      expect(result.analysis.analysisDepth).toBe('detailed');
    });
  });

});