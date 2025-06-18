import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  orchestratorAgent,
  executeImprovedOrchestrator,
  analyzeUserIntent,
  type IntentAnalysisResult,
  type OrchestratorExecutionResponse,
} from '@/lib/mastra/agents/orchestrator.agent';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';
import { memoryRecallTool } from '@/lib/mastra/tools/memory-recall.tool';
import { marketSnapshotTool } from '@/lib/mastra/tools/market-snapshot.tool';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/mastra/tools/memory-recall.tool');
jest.mock('@/lib/mastra/tools/market-snapshot.tool');
jest.mock('@/lib/store/enhanced-conversation-memory.store');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/monitoring/trace', () => ({
  traceManager: {
    startTrace: jest.fn(),
    endTrace: jest.fn(),
  },
}));
jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn(),
}));
jest.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: jest.fn().mockResolvedValue({
      analysis: {
        intent: 'trading_analysis',
        confidence: 0.9,
        reasoning: 'Complex query requiring parallel processing',
        analysisDepth: 'comprehensive',
      },
      executionResult: {
        response: 'Parallel processing completed',
      },
      executionTime: 1500,
      success: true,
    }),
  },
}));

describe('Orchestrator Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock memory store
    (useEnhancedConversationMemory.getState as jest.Mock).mockReturnValue({
      currentSessionId: 'test-session-123',
      addMessage: jest.fn().mockResolvedValue(undefined),
      getSessionContext: jest.fn().mockReturnValue('Previous context'),
      getMemoryStats: jest.fn().mockReturnValue({
        totalMessages: 10,
        processedMessages: 8,
        estimatedTokens: 500,
        processors: ['TokenLimiter', 'ToolCallFilter'],
      }),
      getRecentMessages: jest.fn().mockReturnValue([]),
    });
  });

  describe('Intent Analysis', () => {
    it('should analyze simple price inquiry correctly', () => {
      const result = analyzeUserIntent('BTCの価格は？');
      
      expect(result.intent).toBe('price_inquiry');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedSymbol).toBe('BTCUSDT');
      expect(result.analysisDepth).toBe('basic');
    });

    it('should analyze UI control intent with drawing commands', () => {
      const result = analyzeUserIntent('BTCのチャートにトレンドラインを引いて');
      
      expect(result.intent).toBe('ui_control');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedSymbol).toBe('BTCUSDT');
    });

    it('should analyze trading analysis requests', () => {
      const result = analyzeUserIntent('ETHの詳細な分析をお願いします');
      
      expect(result.intent).toBe('trading_analysis');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedSymbol).toBe('ETHUSDT');
      expect(result.analysisDepth).toBe('detailed');
    });

    it('should handle proposal requests correctly', () => {
      const result = analyzeUserIntent('BTCのエントリーポイントを提案して');
      
      expect(result.intent).toBe('proposal_request');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.isProposalMode).toBe(true);
      expect(result.proposalType).toBe('entry');
    });

    it('should handle conversational queries', () => {
      const result = analyzeUserIntent('こんにちは、調子はどう？');
      
      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.conversationMode).toBeDefined();
    });
  });

  describe('Orchestrator Execution', () => {
    it('should execute simple price inquiry successfully', async () => {
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: {
          response: 'BTCの現在価格は $45,000 です。',
          toolResults: [{ toolName: 'marketDataTool', result: { price: 45000 } }],
        },
      });

      const result = await executeImprovedOrchestrator('BTCの価格は？', 'test-session');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('price_inquiry');
      expect(result.executionResult?.response).toContain('45,000');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle complex queries with parallel processing', async () => {
      const complexQuery = 'BTCとETHの価格を比較して、どちらが投資に適しているか詳細な分析を提供してください。また、チャートにトレンドラインも表示してください。';
      
      const result = await executeImprovedOrchestrator(complexQuery, 'test-session');
      
      expect(result.success).toBe(true);
      expect(result.executionResult?.response).toContain('Parallel processing completed');
      expect(result.executionTime).toBeLessThan(2000); // Should be optimized
    });

    it('should handle conversational queries directly', async () => {
      const result = await executeImprovedOrchestrator('こんにちは！', 'test-session');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('greeting');
      expect(result.executionResult).toBeDefined();
      // Should not call agent selection for greetings
      expect(agentSelectionTool.execute).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully with fallback', async () => {
      (agentSelectionTool.execute as jest.Mock).mockRejectedValue(new Error('Agent error'));
      
      const result = await executeImprovedOrchestrator('BTCの分析をして', 'test-session');
      
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('trading_analysis');
      expect(result.executionResult?.response).toBeDefined();
      expect(result.executionResult?.metadata?.processedBy).toContain('fallback');
    });

    it('should use context from memory for better intent detection', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      (memoryStore.getRecentMessages as jest.Mock).mockReturnValue([
        { content: 'BTCの価格は？', role: 'user' },
        { content: 'BTCは$45,000です', role: 'assistant' },
      ]);
      
      const result = await executeImprovedOrchestrator('それについてもっと詳しく', 'test-session');
      
      expect(result.analysis.intent).toBe('price_inquiry');
      expect(result.analysis.extractedSymbol).toBe('BTCUSDT');
      expect(result.analysis.reasoning).toContain('コンテキスト調整済み');
    });
  });

  describe('Dynamic Configuration', () => {
    it('should select appropriate model based on context', () => {
      const context = {
        queryComplexity: 'complex',
        userTier: 'premium',
        isProposalMode: true,
      };
      
      const model = orchestratorAgent.model(context);
      expect(model).toBeDefined();
      // Model selection logic should pick higher performance model
    });

    it('should generate context-aware instructions', () => {
      const context = {
        userLevel: 'beginner',
        marketStatus: 'closed',
        language: 'ja',
      };
      
      const instructions = orchestratorAgent.instructions(context);
      expect(instructions).toContain('初心者向け特別指示');
      expect(instructions).toContain('市場クローズ時の特別指示');
    });
  });

  describe('Memory Integration', () => {
    it('should add messages to memory store', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      
      await executeImprovedOrchestrator('BTCの価格は？', 'test-session');
      
      expect(memoryStore.addMessage).toHaveBeenCalledTimes(2); // User + Assistant
      expect(memoryStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'BTCの価格は？',
        })
      );
    });

    it('should extract metadata for memory storage', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      
      await executeImprovedOrchestrator('BTCとETHの価格を分析して', 'test-session');
      
      expect(memoryStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            symbols: expect.arrayContaining(['BTC', 'ETH']),
            topics: expect.arrayContaining(['price', 'analysis']),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle complete orchestrator failure', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      (memoryStore.addMessage as jest.Mock).mockRejectedValue(new Error('Memory error'));
      
      const result = await executeImprovedOrchestrator('test query', 'test-session');
      
      expect(result.success).toBe(false);
      expect(result.analysis.intent).toBe('conversational');
      expect(result.analysis.confidence).toBe(0.5);
    });

    it('should generate appropriate fallback responses', async () => {
      (agentSelectionTool.execute as jest.Mock).mockRejectedValue(new Error('Tool error'));
      
      const priceResult = await executeImprovedOrchestrator('BTCの価格は？', 'test-session');
      expect(priceResult.executionResult?.response).toContain('価格データの取得に問題');
      
      const analysisResult = await executeImprovedOrchestrator('BTCを分析して', 'test-session');
      expect(analysisResult.executionResult?.response).toContain('分析システム');
      
      const uiResult = await executeImprovedOrchestrator('チャートを表示', 'test-session');
      expect(uiResult.executionResult?.response).toContain('UI操作');
    });
  });
});