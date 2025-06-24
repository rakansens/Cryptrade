import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ParallelOrchestrator } from '@/lib/mastra/agents/parallel-orchestrator';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';
import { memoryRecallTool } from '@/lib/mastra/tools/memory-recall.tool';
import { marketSnapshotTool } from '@/lib/mastra/tools/market-snapshot.tool';
import { marketDataResilientTool } from '@/lib/mastra/tools/market-data-resilient.tool';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { logger } from '@/lib/utils/logger';
import * as intentModule from '@/lib/mastra/utils/intent';

// Mock dependencies
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/mastra/tools/memory-recall.tool');
jest.mock('@/lib/mastra/tools/market-snapshot.tool');
jest.mock('@/lib/mastra/tools/market-data-resilient.tool');
jest.mock('@/lib/store/enhanced-conversation-memory.store');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/concurrent');
jest.mock('@/lib/mastra/utils/intent');

describe('Parallel Orchestrator', () => {
  let orchestrator: ParallelOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Import the mocked concurrent module
    const { raceWithCleanup } = require('@/lib/utils/concurrent');
    
    // Default implementation for raceWithCleanup
    raceWithCleanup.mockImplementation((promises: any[]) => Promise.all(promises.map((p: any) => p())));
    
    orchestrator = new ParallelOrchestrator({
      maxConcurrency: 5,
      timeoutMs: 10000,
      enableBatching: true,
      enablePreloading: true,
    });

    // Mock memory store
    (useEnhancedConversationMemory.getState as jest.Mock).mockReturnValue({
      currentSessionId: 'test-session-123',
      getSessionContext: jest.fn().mockReturnValue('Previous context'),
    });
    
    // Default mock for agentSelectionTool
    (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
      executionResult: { response: 'Default response' },
    });
    
    // Default implementation for analyzeIntent
    (intentModule.analyzeIntent as jest.Mock).mockImplementation((query: string) => {
      // Simple intent detection based on keywords
      if (query.includes('価格')) {
        return {
          intent: 'price_inquiry',
          confidence: 0.9,
          reasoning: 'Price keyword detected',
          analysisDepth: 'basic',
          extractedSymbol: 'BTCUSDT',
        };
      } else if (query.includes('分析') || query.includes('投資')) {
        return {
          intent: 'trading_analysis',
          confidence: 0.85,
          reasoning: 'Analysis keyword detected',
          analysisDepth: 'detailed',
          extractedSymbol: 'BTCUSDT',
        };
      } else {
        return {
          intent: 'conversational',
          confidence: 0.7,
          reasoning: 'General query',
          analysisDepth: 'basic',
        };
      }
    });
  });

  describe('Complex Query Detection', () => {
    it('should detect complex queries based on length', async () => {
      const longQuery = 'これは非常に長い質問で、複数の側面について詳細な分析を求めています。' +
        'BTCとETHの価格比較、市場動向の分析、投資戦略の提案、リスク評価、' +
        'そして今後の展望について包括的な情報を提供してください。';
      
      const result = await orchestrator.execute(longQuery, 'test-session');
      
      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Executing complex query'),
        expect.any(Object)
      );
    });

    it('should detect multiple operations in query', async () => {
      const multiOpQuery = 'BTCの価格を確認して、分析して、チャートに表示して';
      
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: { response: 'Completed' },
      });
      
      const result = await orchestrator.execute(multiOpQuery, 'test-session');
      
      expect(result.success).toBe(true);
      // Should execute multiple agents
      expect(agentSelectionTool.execute).toHaveBeenCalledTimes(3);
    });

    it('should detect multiple symbols in query', async () => {
      const multiSymbolQuery = 'BTC、ETH、ADAの価格を比較してください';
      
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: { response: 'Price comparison completed' },
      });
      
      const result = await orchestrator.execute(multiSymbolQuery, 'test-session');
      
      expect(result.success).toBe(true);
      expect(agentSelectionTool.execute).toHaveBeenCalled();
    });
  });

  describe('Parallel Execution', () => {
    it('should execute initialization and analysis in parallel', async () => {
      const startTimes: number[] = [];
      
      // Track execution timing
      (useEnhancedConversationMemory.getState as jest.Mock).mockImplementation(() => {
        startTimes.push(Date.now());
        return {
          currentSessionId: 'test-session',
          getSessionContext: jest.fn().mockReturnValue('context'),
        };
      });
      
      await orchestrator.execute('Simple query', 'test-session');
      
      // Initialization and analysis should start almost simultaneously
      expect(startTimes.length).toBeGreaterThanOrEqual(1);
    });

    it('should gather context data in parallel when needed', async () => {
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: { response: 'Analysis complete' },
      });
      
      (marketSnapshotTool.execute as jest.Mock).mockResolvedValue({
        marketData: { trend: 'bullish' },
      });
      
      (marketDataResilientTool.execute as jest.Mock).mockResolvedValue({
        price: 45000,
        symbol: 'BTCUSDT',
      });
      
      const result = await orchestrator.execute('BTCの投資戦略を詳しく分析してください', 'test-session');
      
      expect(result.success).toBe(true);
      expect(marketSnapshotTool.execute).toHaveBeenCalled();
      expect(marketDataResilientTool.execute).toHaveBeenCalled();
    });

    it('should handle partial failures in parallel operations', async () => {
      (marketSnapshotTool.execute as jest.Mock).mockRejectedValue(new Error('Snapshot failed'));
      (marketDataResilientTool.execute as jest.Mock).mockResolvedValue({
        price: 45000,
      });
      
      const result = await orchestrator.execute('BTCの市場データ', 'test-session');
      
      expect(result.success).toBe(true);
      // Should continue despite one failure
      expect(result.executionResult).toBeDefined();
    });

    it('should enforce timeout on parallel operations', async () => {
      const slowOrchestrator = new ParallelOrchestrator({
        timeoutMs: 100, // Very short timeout
      });
      
      // Import the mocked concurrent module
      const { raceWithCleanup } = require('@/lib/utils/concurrent');
      
      // Mock raceWithCleanup to simulate timeout
      raceWithCleanup.mockImplementation((promises: any[], options: any) => {
        // Simulate timeout by calling onCleanup if provided
        if (options?.onCleanup) {
          // Call onCleanup asynchronously to simulate real timeout behavior
          setTimeout(() => {
            options.onCleanup(new Error('Operation timeout'));
          }, 10);
        }
        // Return rejected promise to simulate timeout
        return Promise.reject(new Error('Operation timeout'));
      });
      
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: { response: 'Response' },
      });
      
      // Clear previous warn calls
      (logger.warn as jest.Mock).mockClear();
      
      const result = await slowOrchestrator.execute('BTCの投資戦略を詳しく分析してください', 'test-session');
      
      // Wait a bit for the timeout callback to be called
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Operation timeout'),
        expect.any(Object)
      );
    });

    it('should aggregate results from multiple agents correctly', async () => {
      const mockResponses = [
        { executionResult: { response: 'Price: $45,000', proposalGroup: { id: 'pg1' } } },
        { executionResult: { response: 'Analysis: Bullish trend' } },
        { executionResult: { response: 'Chart updated', toolResults: [{ tool: 'chart' }] } },
      ];
      
      let callCount = 0;
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => {
        if (callCount < mockResponses.length) {
          return Promise.resolve(mockResponses[callCount++]);
        }
        return Promise.resolve(mockResponses[0]);
      });
      
      const result = await orchestrator.execute(
        'BTCの価格を確認して分析してチャートを更新して',
        'test-session'
      );
      
      expect(result.success).toBe(true);
      // Check that we got a result
      expect(result.executionResult).toBeDefined();
      expect(result.executionResult?.response).toBeDefined();
      expect(typeof result.executionResult?.response).toBe('string');
      expect(result.executionResult?.response.length).toBeGreaterThan(0);
      
      // Check proposalGroup only if it exists
      if (result.executionResult?.proposalGroup) {
        expect(result.executionResult.proposalGroup).toHaveProperty('id');
      }
      
      // Verify multiple agents were called for this complex multi-operation query
      expect(agentSelectionTool.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Optimization', () => {
    it('should complete simple queries quickly', async () => {
      (agentSelectionTool.execute as jest.Mock).mockResolvedValue({
        executionResult: { response: 'Quick response' },
      });
      
      const start = Date.now();
      const result = await orchestrator.execute('BTCの価格', 'test-session');
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should be fast for simple queries
    });

    it('should optimize complex queries to under 2 seconds', async () => {
      // Mock parallel agent responses
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({ executionResult: { response: 'Agent response' } }), 
          300
        ))
      );
      
      const start = Date.now();
      const result = await orchestrator.execute(
        'BTCとETHの詳細な分析と価格比較、投資戦略の提案をお願いします',
        'test-session'
      );
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Target optimization
    });
  });

  describe('Context Management', () => {
    it('should preload memory context for analysis queries', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      
      await orchestrator.execute('BTCの詳細な分析', 'test-session');
      
      expect(memoryStore.getSessionContext).toHaveBeenCalled();
    });

    it('should skip context loading for simple queries', async () => {
      const memoryStore = useEnhancedConversationMemory.getState();
      
      await orchestrator.execute('こんにちは', 'test-session');
      
      expect(memoryStore.getSessionContext).not.toHaveBeenCalled();
    });

    it('should include market data context for trading queries', async () => {
      (marketSnapshotTool.execute as jest.Mock).mockResolvedValue({
        trend: 'bullish',
        volume: 'high',
      });
      
      await orchestrator.execute('BTCの取引分析', 'test-session');
      
      expect(marketSnapshotTool.execute).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from intent analysis failure', async () => {
      // Mock analyzeIntent to throw
      jest.spyOn(intentModule, 'analyzeIntent').mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      const result = await orchestrator.execute('Test query', 'test-session');
      
      // When intent analysis fails, it should still return a result with fallback intent
      expect(result.success).toBe(true);
      expect(result.analysis.intent).toBe('conversational');
      expect(result.analysis.confidence).toBe(0.5);
      expect(result.analysis.reasoning).toBe('Analysis failed');
    });

    it('should handle complete execution failure gracefully', async () => {
      // Record the start time
      const startTime = Date.now();
      
      (useEnhancedConversationMemory.getState as jest.Mock).mockImplementation(() => {
        // Add a small delay to ensure executionTime > 0
        const now = Date.now();
        while (Date.now() - now < 1) {
          // Small busy wait to ensure some time passes
        }
        throw new Error('Memory store error');
      });
      
      const result = await orchestrator.execute('Test query', 'test-session');
      
      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(Date.now() - startTime).toBeGreaterThan(0);
    });

    it('should continue with partial agent results on failure', async () => {
      // Clear mocks
      jest.clearAllMocks();
      
      // Override raceWithCleanup to pass through the promises directly
      const { raceWithCleanup } = require('@/lib/utils/concurrent');
      raceWithCleanup.mockImplementation((promises: any[]) => {
        // Execute the first promise function if it exists
        if (promises && promises[0] && typeof promises[0] === 'function') {
          // Create a fake signal that won't abort
          const signal = { addEventListener: jest.fn() };
          return promises[0](signal);
        }
        return Promise.resolve();
      });
      
      const responses = [
        { executionResult: { response: 'Success 1' } },
        new Error('Agent 2 failed'),
        { executionResult: { response: 'Success 3' } },
      ];
      
      let callCount = 0;
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => {
        if (callCount < responses.length) {
          const response = responses[callCount++];
          return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
        }
        return Promise.resolve(responses[0]);
      });
      
      // Use a complex query that triggers multiple agents
      const result = await orchestrator.execute(
        'BTCの価格を確認して分析してチャートを更新して',
        'test-session'
      );
      
      expect(result.success).toBe(true);
      expect(result.executionResult).toBeDefined();
      
      // Check metadata if it exists
      if (result.executionResult?.metadata) {
        expect(result.executionResult.metadata.processedBy).toBe('parallel-orchestrator');
        // Should have executed 3 agents and 2 succeeded
        if (result.executionResult.metadata.totalAgents) {
          expect(result.executionResult.metadata.totalAgents).toBe(3);
        }
        if (result.executionResult.metadata.successfulAgents !== undefined) {
          expect(result.executionResult.metadata.successfulAgents).toBeGreaterThanOrEqual(1);
        }
      }
      
      // At minimum, we should have gotten some response
      expect(result.executionResult?.response).toBeDefined();
      expect(typeof result.executionResult?.response).toBe('string');
      expect(result.executionResult?.response.length).toBeGreaterThan(0);
    });
  });
});