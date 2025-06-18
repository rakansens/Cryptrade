import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { agentNetwork } from '@/lib/mastra/network/message-router';
import { priceInquiryAgent } from '@/lib/mastra/agents/price-inquiry.agent';
import { tradingAnalysisAgent } from '@/lib/mastra/agents/trading-analysis.agent';
import { uiControlAgent } from '@/lib/mastra/agents/ui-control.agent';
import { logger } from '@/lib/utils/logger';

// Mock external dependencies
jest.mock('@/lib/services/market-data.service');
jest.mock('@/lib/services/database/chat.service');
jest.mock('@/lib/utils/logger');

describe('Enhanced Conversation Flow Integration Tests', () => {
  let sessionId: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize memory store
    useEnhancedConversationMemory.setState({
      sessions: {},
      currentSessionId: null,
      defaultProcessors: [],
      isDbEnabled: false, // Disable DB for testing
      isSyncing: false,
    });
    
    // Create test session
    sessionId = await useEnhancedConversationMemory.getState().createSession();
    
    // Register agents in network
    agentNetwork.registerAgent('priceInquiryAgent', priceInquiryAgent as any, ['price'], 'Price inquiry');
    agentNetwork.registerAgent('tradingAnalysisAgent', tradingAnalysisAgent as any, ['analysis'], 'Trading analysis');
    agentNetwork.registerAgent('uiControlAgent', uiControlAgent as any, ['ui'], 'UI control');
  });

  afterEach(() => {
    // Clean up
    agentNetwork.unregisterAgent('priceInquiryAgent');
    agentNetwork.unregisterAgent('tradingAnalysisAgent');
    agentNetwork.unregisterAgent('uiControlAgent');
  });

  describe('Simple Conversation Flow', () => {
    it('should handle greeting → price inquiry → analysis flow', async () => {
      // Step 1: Greeting
      const greeting = await executeImprovedOrchestrator('こんにちは！', sessionId);
      expect(greeting.success).toBe(true);
      expect(greeting.analysis.intent).toBe('greeting');
      expect(greeting.executionResult?.response).toContain('こんにちは');
      
      // Step 2: Price inquiry
      const priceQuery = await executeImprovedOrchestrator('BTCの価格を教えて', sessionId);
      expect(priceQuery.success).toBe(true);
      expect(priceQuery.analysis.intent).toBe('price_inquiry');
      expect(priceQuery.executionResult?.response).toMatch(/\$[\d,]+/);
      
      // Step 3: Follow-up analysis
      const analysis = await executeImprovedOrchestrator('それについて詳しく分析して', sessionId);
      expect(analysis.success).toBe(true);
      expect(analysis.analysis.intent).toBe('trading_analysis');
      expect(analysis.analysis.extractedSymbol).toBe('BTCUSDT'); // Should remember from context
      expect(analysis.executionResult?.response).toContain('分析');
    });

    it('should maintain context across multiple queries', async () => {
      // Initial context setting
      await executeImprovedOrchestrator('ETHの価格は？', sessionId);
      
      // Context-dependent queries
      const queries = [
        'それは高い？',
        'いつ買うべき？',
        'チャートを見せて',
      ];
      
      for (const query of queries) {
        const response = await executeImprovedOrchestrator(query, sessionId);
        expect(response.success).toBe(true);
        
        // Should maintain ETH context
        if (response.analysis.extractedSymbol) {
          expect(response.analysis.extractedSymbol).toBe('ETHUSDT');
        }
      }
      
      // Verify conversation memory
      const memoryStats = useEnhancedConversationMemory.getState().getMemoryStats(sessionId);
      expect(memoryStats.totalMessages).toBeGreaterThanOrEqual(8); // 4 queries + 4 responses
    });
  });

  describe('Complex Multi-Agent Flow', () => {
    it('should coordinate multiple agents for complex requests', async () => {
      const complexQuery = 'BTCとETHの価格を比較して、どちらが良い投資か分析してください';
      
      const start = Date.now();
      const response = await executeImprovedOrchestrator(complexQuery, sessionId);
      const duration = Date.now() - start;
      
      expect(response.success).toBe(true);
      expect(response.executionResult?.response).toContain('BTC');
      expect(response.executionResult?.response).toContain('ETH');
      expect(response.executionResult?.response).toMatch(/分析|比較/);
      
      // Should use parallel processing for efficiency
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle proposal generation flow', async () => {
      // Set up context
      await executeImprovedOrchestrator('BTCの詳細な分析をお願いします', sessionId);
      
      // Request proposals
      const proposalResponse = await executeImprovedOrchestrator(
        'エントリーポイントを提案してください',
        sessionId
      );
      
      expect(proposalResponse.success).toBe(true);
      expect(proposalResponse.analysis.intent).toBe('proposal_request');
      expect(proposalResponse.analysis.isProposalMode).toBe(true);
      expect(proposalResponse.executionResult?.proposalGroup).toBeDefined();
      
      // Verify proposal group structure
      if (proposalResponse.executionResult?.proposalGroup) {
        const group = proposalResponse.executionResult.proposalGroup;
        expect(group.id).toBeDefined();
        expect(Array.isArray(group.proposals)).toBe(true);
      }
    });
  });

  describe('Error Recovery Flow', () => {
    it('should recover from agent failures gracefully', async () => {
      // Mock agent failure
      jest.spyOn(priceInquiryAgent, 'generate' as any).mockRejectedValueOnce(
        new Error('API timeout')
      );
      
      const response = await executeImprovedOrchestrator('BTCの価格は？', sessionId);
      
      expect(response.success).toBe(true);
      expect(response.executionResult?.response).toBeDefined();
      expect(response.executionResult?.metadata?.processedBy).toContain('fallback');
    });

    it('should handle network issues between agents', async () => {
      // Simulate network partition
      agentNetwork.unregisterAgent('tradingAnalysisAgent');
      
      const response = await executeImprovedOrchestrator('BTCの詳細分析', sessionId);
      
      expect(response.success).toBe(true);
      // Should fallback to orchestrator handling
      expect(response.executionResult).toBeDefined();
    });
  });

  describe('Memory and Context Management', () => {
    it('should summarize long conversations', async () => {
      // Conduct a long conversation
      const queries = [
        'BTCの価格は？',
        'なぜ上がっているの？',
        'ETHはどう？',
        'どちらがおすすめ？',
        'リスクは何？',
        'いつ買うべき？',
        '売るタイミングは？',
        'ポートフォリオの割合は？',
      ];
      
      for (const query of queries) {
        await executeImprovedOrchestrator(query, sessionId);
      }
      
      // Trigger summarization
      await useEnhancedConversationMemory.getState().summarizeSession(sessionId);
      
      const session = useEnhancedConversationMemory.getState().sessions[sessionId];
      expect(session.summary).toBeDefined();
      expect(session.summary).toContain('BTC');
      expect(session.summary).toContain('ETH');
      
      // New queries should have access to summary
      const newResponse = await executeImprovedOrchestrator(
        '前の話の続きですが',
        sessionId
      );
      
      expect(newResponse.memoryContext).toContain('Session Summary:');
    });

    it('should handle token limits appropriately', async () => {
      // Create session with small token limit
      const limitedSessionId = await useEnhancedConversationMemory.getState().createSession(
        undefined,
        undefined
      );
      
      // Add many messages
      for (let i = 0; i < 50; i++) {
        await executeImprovedOrchestrator(
          `This is message number ${i} with some additional content to consume tokens`,
          limitedSessionId
        );
      }
      
      const stats = useEnhancedConversationMemory.getState().getMemoryStats(limitedSessionId);
      expect(stats.estimatedTokens).toBeLessThanOrEqual(127000); // Should not exceed limit
      
      // Should still work with limited context
      const response = await executeImprovedOrchestrator('まとめて', limitedSessionId);
      expect(response.success).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle day trader workflow', async () => {
      // Morning check
      const morningCheck = await executeImprovedOrchestrator(
        'おはよう！今日の市場はどう？',
        sessionId
      );
      expect(morningCheck.success).toBe(true);
      
      // Price monitoring
      const btcPrice = await executeImprovedOrchestrator('BTCの価格', sessionId);
      expect(btcPrice.success).toBe(true);
      
      // Technical analysis
      const analysis = await executeImprovedOrchestrator(
        'BTCのテクニカル分析をして',
        sessionId
      );
      expect(analysis.success).toBe(true);
      
      // Entry point
      const entry = await executeImprovedOrchestrator(
        'エントリーポイントを提案して',
        sessionId
      );
      expect(entry.success).toBe(true);
      expect(entry.analysis.isProposalMode).toBe(true);
      
      // Risk assessment
      const risk = await executeImprovedOrchestrator(
        'リスクはどのくらい？',
        sessionId
      );
      expect(risk.success).toBe(true);
      
      // Verify conversation flow maintained context
      const context = useEnhancedConversationMemory.getState().getSessionContext(sessionId);
      expect(context).toContain('BTC');
    });

    it('should handle portfolio management conversation', async () => {
      const portfolioQueries = [
        'ポートフォリオを多様化したい',
        'BTCを30%持っています',
        'ETHも追加すべき？',
        'ADAはどう思う？',
        'リスク分散の観点から提案して',
      ];
      
      const responses = [];
      for (const query of portfolioQueries) {
        const response = await executeImprovedOrchestrator(query, sessionId);
        responses.push(response);
        expect(response.success).toBe(true);
      }
      
      // Should maintain portfolio context throughout
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.executionResult?.response).toContain('BTC');
      expect(lastResponse.executionResult?.response).toContain('30%');
      expect(lastResponse.executionResult?.response).toMatch(/分散|リスク/);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle rapid-fire queries efficiently', async () => {
      const queries = Array(10).fill('BTCの価格は？');
      const startTime = Date.now();
      
      const responses = await Promise.all(
        queries.map((q, i) => 
          executeImprovedOrchestrator(q, `perf-session-${i}`)
        )
      );
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / queries.length;
      
      expect(responses.every(r => r.success)).toBe(true);
      expect(avgTime).toBeLessThan(1000); // Average < 1 second per query
    });

    it('should scale with conversation length', async () => {
      const timings: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await executeImprovedOrchestrator(`Query number ${i}`, sessionId);
        timings.push(Date.now() - start);
      }
      
      // Response time should not degrade significantly
      const firstHalf = timings.slice(0, 10).reduce((a, b) => a + b) / 10;
      const secondHalf = timings.slice(10, 20).reduce((a, b) => a + b) / 10;
      
      // Second half should not be more than 50% slower
      expect(secondHalf).toBeLessThan(firstHalf * 1.5);
    });
  });
});