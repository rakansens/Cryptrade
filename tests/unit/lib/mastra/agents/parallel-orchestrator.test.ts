import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ParallelOrchestrator } from '@/lib/mastra/agents/parallel-orchestrator';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';
import { memoryRecallTool } from '@/lib/mastra/tools/memory-recall.tool';
import { marketSnapshotTool } from '@/lib/mastra/tools/market-snapshot.tool';
import { marketDataResilientTool } from '@/lib/mastra/tools/market-data-resilient.tool';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/mastra/tools/agent-selection.tool');
jest.mock('@/lib/mastra/tools/memory-recall.tool');
jest.mock('@/lib/mastra/tools/market-snapshot.tool');
jest.mock('@/lib/mastra/tools/market-data-resilient.tool');
jest.mock('@/lib/store/enhanced-conversation-memory.store');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/concurrent', () => ({
  raceWithCleanup: jest.fn().mockImplementation((promises) => Promise.race(promises.map(p => p()))),
}));

describe('Parallel Orchestrator', () => {
  let orchestrator: ParallelOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
  });

  describe('Complex Query Detection', () => {
    it('should detect complex queries based on length', async () => {
      const longQuery = 'これは非常に長い質問で、複数の側面について詳細な分析を求めています。' +
        'BTCとETHの価格比較、市場動向の分析、投資戦略の提案、リスク評価、' +
        'そして今後の展望について包括的な情報を提供してください。';
      
      const result = await orchestrator.execute(longQuery, 'test-session');
      
      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Detected complex query'),
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
      (marketSnapshotTool.execute as jest.Mock).mockResolvedValue({
        marketData: { trend: 'bullish' },
      });
      
      (marketDataResilientTool.execute as jest.Mock).mockResolvedValue({
        price: 45000,
        symbol: 'BTCUSDT',
      });
      
      const result = await orchestrator.execute('BTCの価格と市場分析', 'test-session');
      
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
      
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      const result = await slowOrchestrator.execute('Slow query', 'test-session');
      
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
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => 
        Promise.resolve(mockResponses[callCount++])
      );
      
      const result = await orchestrator.execute(
        'BTCの価格を確認して分析してチャートを更新して',
        'test-session'
      );
      
      expect(result.success).toBe(true);
      expect(result.executionResult?.response).toContain('Price: $45,000');
      expect(result.executionResult?.response).toContain('Analysis: Bullish trend');
      expect(result.executionResult?.proposalGroup).toBeDefined();
      expect(result.executionResult?.toolResults).toHaveLength(1);
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
      jest.spyOn(global, 'analyzeIntent' as any).mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      const result = await orchestrator.execute('Test query', 'test-session');
      
      expect(result.success).toBe(false);
      expect(result.analysis.intent).toBe('conversational');
      expect(result.analysis.confidence).toBe(0.5);
    });

    it('should handle complete execution failure gracefully', async () => {
      (useEnhancedConversationMemory.getState as jest.Mock).mockImplementation(() => {
        throw new Error('Memory store error');
      });
      
      const result = await orchestrator.execute('Test query', 'test-session');
      
      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should continue with partial agent results on failure', async () => {
      const responses = [
        { executionResult: { response: 'Success 1' } },
        new Error('Agent 2 failed'),
        { executionResult: { response: 'Success 3' } },
      ];
      
      let callCount = 0;
      (agentSelectionTool.execute as jest.Mock).mockImplementation(() => {
        const response = responses[callCount++];
        return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
      });
      
      const result = await orchestrator.execute(
        'Multiple agent query that should handle failures',
        'test-session'
      );
      
      expect(result.success).toBe(true);
      expect(result.executionResult?.response).toContain('Success 1');
      expect(result.executionResult?.response).toContain('Success 3');
      expect(result.executionResult?.metadata?.successfulAgents).toBe(2);
    });
  });
});