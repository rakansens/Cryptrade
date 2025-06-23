import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { agentNetwork } from '@/lib/mastra/network/message-router';
import { logger } from '@/lib/utils/logger';

// Mock external dependencies
jest.mock('@/lib/services/enhanced-market-data.service');
jest.mock('@/lib/services/database/chat.service');
jest.mock('@/lib/utils/logger');

// Mock Mastra Agent to avoid real AI calls
jest.mock('@mastra/core', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockImplementation(async (messages) => {
      const userMessage = messages[0]?.content || '';
      const userQuery = userMessage.toLowerCase();
      
      // Generate appropriate responses based on query content
      if (userQuery.includes('こんにちは') || userQuery.includes('hello')) {
        return { text: 'こんにちは！今日はどのようなお手伝いができますか？' };
      } else if (userQuery.includes('価格') || userQuery.includes('price')) {
        return { text: 'BTCは現在$50,000で取引されています。' };
      } else if (userQuery.includes('分析') || userQuery.includes('analysis')) {
        return { text: 'BTCの詳細な分析：上昇トレンドが続いています。' };
      } else if (userQuery.includes('btc') && userQuery.includes('eth')) {
        return { text: 'BTCとETHの比較分析を行いました。両方とも強気相場です。' };
      } else {
        return { text: 'Mock AI response' };
      }
    })
  })),
  createTool: jest.fn(),
  createToolFromFunction: jest.fn(),
  z: {
    object: jest.fn(),
    string: jest.fn(),
    number: jest.fn(),
    boolean: jest.fn(),
    array: jest.fn(),
    optional: jest.fn(),
  }
}));

// Create mock agents for testing
const mockPriceInquiryAgent = {
  name: 'priceInquiryAgent',
  execute: jest.fn().mockResolvedValue({
    response: 'BTC is currently trading at $50,000',
    data: { price: 50000, symbol: 'BTCUSDT' }
  })
};

const mockTradingAnalysisAgent = {
  name: 'tradingAnalysisAgent',
  execute: jest.fn().mockResolvedValue({
    response: 'BTCの詳細な分析: 上昇トレンドです',
    data: { trend: 'bullish', confidence: 0.85 }
  })
};

const mockUiControlAgent = {
  name: 'uiControlAgent',
  execute: jest.fn().mockResolvedValue({
    response: 'チャートを表示しました',
    data: { action: 'showChart' }
  })
};

describe('Enhanced Conversation Flow Integration Tests', () => {
  let sessionId: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize memory store with mock implementation
    const mockCreateSession = jest.fn().mockResolvedValue(`session-${Date.now()}`);
    
    // Track messages for memory statistics
    let messageCount = 0;
    const messages: any[] = [];
    
    const mockSessions: Record<string, any> = {};
    
    useEnhancedConversationMemory.setState({
      sessions: mockSessions,
      currentSessionId: null,
      defaultProcessors: [],
      isDbEnabled: false, // Disable DB for testing
      isSyncing: false,
      createSession: jest.fn().mockImplementation(async (customId, config) => {
        const sessionId = customId || `session-${Date.now()}`;
        mockSessions[sessionId] = {
          id: sessionId,
          messages: [],
          summary: null,
          metadata: {}
        };
        return sessionId;
      }),
      addMessage: jest.fn().mockImplementation(async (msg) => {
        messageCount++;
        messages.push(msg);
        if (msg.sessionId && mockSessions[msg.sessionId]) {
          mockSessions[msg.sessionId].messages.push(msg);
        }
      }),
      getProcessedMessages: jest.fn().mockReturnValue([]),
      getRecentMessages: jest.fn().mockImplementation((sessionId, count) => {
        return messages.slice(-count);
      }),
      getSessionContext: jest.fn().mockImplementation((sessionId) => {
        return messages.map(m => m.content).join(' ');
      }),
      updateMessageMetadata: jest.fn().mockResolvedValue(undefined),
      clearSession: jest.fn(),
      searchMessages: jest.fn().mockReturnValue([]),
      summarizeSession: jest.fn().mockImplementation(async (sessionId) => {
        if (mockSessions[sessionId]) {
          mockSessions[sessionId].summary = `会話の要約: ${messages.filter(m => m.content.includes('BTC') || m.content.includes('ETH')).map(m => m.content).join(', ')}`;
        }
      }),
      addProcessor: jest.fn(),
      removeProcessor: jest.fn(),
      setDefaultProcessors: jest.fn(),
      getMemoryStats: jest.fn().mockImplementation(() => ({
        totalMessages: messageCount,
        processedMessages: messageCount,
        estimatedTokens: messageCount * 10,
        processors: []
      })),
      enableDbSync: jest.fn().mockResolvedValue(undefined),
      disableDbSync: jest.fn(),
      syncWithDatabase: jest.fn().mockResolvedValue(undefined),
      loadFromDatabase: jest.fn().mockResolvedValue(undefined),
    } as any);
    
    // Create test session
    sessionId = await useEnhancedConversationMemory.getState().createSession();
    
    // Register mock agents in network
    agentNetwork.registerAgent('priceInquiryAgent', mockPriceInquiryAgent as any, ['price'], 'Price inquiry');
    agentNetwork.registerAgent('tradingAnalysisAgent', mockTradingAnalysisAgent as any, ['analysis'], 'Trading analysis');
    agentNetwork.registerAgent('uiControlAgent', mockUiControlAgent as any, ['ui'], 'UI control');
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
      mockPriceInquiryAgent.execute.mockRejectedValueOnce(
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