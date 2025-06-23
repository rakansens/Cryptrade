import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { logger } from '@/lib/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import type { OrchestratorRuntimeContext } from '@/types/orchestrator.types';

// Mock the enhanced conversation memory store
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
      getRecentMessages: jest.fn(() => [])
    }))
  },
  createEnhancedSession: jest.fn().mockResolvedValue('test-session-id')
}));

// Mock the agent registry
jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn()
}));

// Mock the parallel orchestrator  
jest.mock('@/lib/mastra/agents/parallel-orchestrator', () => ({
  parallelOrchestrator: {
    execute: jest.fn().mockResolvedValue({
      analysis: {
        intent: 'conversational',
        confidence: 0.9,
        reasoning: 'Complex query',
        analysisDepth: 'comprehensive'
      },
      executionResult: {
        response: 'Parallel response'
      },
      executionTime: 100,
      success: true
    })
  }
}));

// Mock the agent selection tool
jest.mock('@/lib/mastra/tools/agent-selection.tool', () => ({
  agentSelectionTool: {
    execute: jest.fn().mockImplementation(async ({ context }) => {
      const agentType = context.agentType;
      const query = context.query;
      
      let response = 'Default response';
      let metadata = { processedBy: [] };
      
      switch (agentType) {
        case 'price_inquiry':
          response = `The current price of ${context.context.extractedSymbol || 'BTC'} is $48,000.`;
          metadata.processedBy = ['trading-agent'];
          break;
        case 'ui_control':
          response = 'Chart operation completed successfully.';
          metadata.processedBy = ['chart-control-agent'];
          break;
        case 'trading_analysis':
          response = 'Technical analysis shows bullish trend.';
          metadata.processedBy = ['analysis-agent'];
          break;
      }
      
      return {
        executionResult: {
          response,
          data: {},
          metadata: {
            ...metadata,
            processedBy: metadata.processedBy
          }
        },
        message: response,
        metadata  // Return metadata at top level too
      };
    })
  }
}));

// Optional metrics collector (no-op in CI/local unless library available)
let metrics: typeof import('@/lib/monitoring/metrics') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  metrics = require('@/lib/monitoring/metrics');
  metrics!.metricsCollector.register('intent_test_total', {
    type: 'counter',
    help: 'Total intent analysis test cases',
    value: 0,
  });
  metrics!.metricsCollector.register('intent_test_success', {
    type: 'counter',
    help: 'Successful intent analysis test cases',
    value: 0,
  });
  metrics!.metricsCollector.register('intent_test_fail', {
    type: 'counter',
    help: 'Failed intent analysis test cases',
    value: 0,
  });
} catch {
  metrics = null;
}

// Threshold & result collector used across tests
const CONFIDENCE_THRESHOLD = 0.7;
const testResults: Array<{ query: string; intent: string; confidence: number }> = [];
const intentSummary = { total: 0, success: 0, fail: 0 };

// Shared default context
const defaultContext: OrchestratorRuntimeContext = {
  userLevel: 'intermediate',
  marketStatus: 'open',
};

// Load environment variables
config({ path: '.env.local' });

describe('Orchestrator Agent Integration Tests', () => {
  const testSessionId = `test-${Date.now()}`;

  beforeAll(() => {
    // Suppress logs during tests unless debugging
    if (process.env['DEBUG'] !== 'true') {
      jest.spyOn(logger, 'info').mockImplementation();
      jest.spyOn(logger, 'debug').mockImplementation();
    }
  });

  describe('Query Classification and Routing', () => {
    describe('Greetings and Small Talk', () => {
      const greetingQueries = [
        { query: 'こんにちは！', expectedIntent: 'greeting' },
        { query: 'おはようございます！今日も頑張りましょう', expectedIntent: 'greeting' },
        { query: 'ありがとう、助かりました', expectedIntent: 'small_talk' },
        { query: '疲れたなあ...', expectedIntent: 'small_talk' },
      ];

      test.each(greetingQueries)('should handle "$query" as $expectedIntent', async ({ query, expectedIntent }) => {
        // Temporarily enable console output
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        
        console.log(`\n=== BEFORE CALLING ORCHESTRATOR ===`);
        console.log(`Query: "${query}"`);
        console.log(`Expected intent: ${expectedIntent}`);
        
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        // Always log debug output for failing tests
        console.log(`\n=== AFTER CALLING ORCHESTRATOR ===`);
        console.log(`Expected: ${expectedIntent}, Got: ${result.analysis.intent}`);
        console.log(`Confidence: ${result.analysis.confidence}`);
        console.log(`Reasoning: ${result.analysis.reasoning}`);
        console.log(`Full analysis:`, JSON.stringify(result.analysis, null, 2));
        console.log(`Success: ${result.success}`);
        console.log(`Execution time: ${result.executionTime}ms`);
        console.log(`Has execution result: ${!!result.executionResult}`);
        
        expect(result.analysis.intent).toBe(expectedIntent);
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult!.response).toBeDefined();
      });
    });

    describe('Market Chat', () => {
      const marketChatQueries = [
        '最近の市場はどう？',
        '暗号通貨って面白いよね',
        'ビットコインの将来性についてどう思う？',
      ];

      test.each(marketChatQueries)('should handle market chat: "%s"', async (query) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('market_chat');
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        expect(result.executionResult).toBeDefined();
      });
    });

    describe('Price Inquiries', () => {
      const priceQueries = [
        { query: 'BTCの価格を教えて', symbol: 'BTC' },
        { query: 'イーサリアムの現在価格は？', symbol: 'ETH' },
        { query: 'ビットコインはいくら？', symbol: 'BTC' },
        { query: 'ETH quote please', symbol: 'ETH' },
        { query: 'XRPの相場は？', symbol: 'XRP' },
        { query: 'BTC prc?', symbol: 'BTC' },
      ];

      test.each(priceQueries)('should handle price inquiry: "$query"', async ({ query }) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('price_inquiry');
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult!.metadata?.['processedBy']).toContain('trading');
      });
    });

    describe('Technical Analysis', () => {
      const analysisQueries = [
        'BTCの技術分析をして',
        'エントリーポイントを提案して',
        'サポートとレジスタンスラインを分析して',
        'BTCのTAお願い',
        'ETHのFAを見せて',
        'エントリーとexitの見解は？',
      ];

      test.each(analysisQueries)('should handle analysis request: "%s"', async (query) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(['analysis', 'entry_proposal']).toContain(result.analysis.intent);
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult!.metadata?.['processedBy']).toContain('trading');
      });
    });

    describe('UI Operations', () => {
      const uiQueries = [
        { query: 'BTCのチャートに切り替えて', expectedAction: 'switch_chart' },
        { query: 'トレンドラインを描いて', expectedAction: 'draw_line' },
        { query: '15分足に変更して', expectedAction: 'change_timeframe' },
        { query: 'MAを表示して', expectedAction: 'show_indicator' },
        { query: 'チャートswして', expectedAction: 'switch_chart' },
        { query: 'tfを1hにchg', expectedAction: 'change_timeframe' },
      ];

      test.each(uiQueries)('should handle UI operation: "$query"', async ({ query }) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('ui_control');
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult!.metadata?.['processedBy']).toContain('chart');
      });
    });
  });

  describe('Context-Aware Processing', () => {
    test('should adapt responses based on user level', async () => {
      const query = 'RSIの使い方を教えて';
      
      // Test with beginner user
      const beginnerResult = await executeImprovedOrchestrator(
        query, 
        testSessionId, 
        { userLevel: 'beginner', marketStatus: 'open' }
      );
      
      // Test with expert user
      const expertResult = await executeImprovedOrchestrator(
        query, 
        testSessionId, 
        { userLevel: 'expert', marketStatus: 'open' }
      );
      
      expect(beginnerResult.executionResult!.response).toBeDefined();
      expect(expertResult.executionResult!.response).toBeDefined();
      // Responses should be different based on user level
      expect(beginnerResult.executionResult!.response).not.toBe(expertResult.executionResult!.response);
    });
  });

  describe('Performance Metrics', () => {
    test('should complete queries within acceptable time', async () => {
      const queries = [
        'こんにちは',
        'BTCの価格は？',
        'チャートを表示して',
      ];
      
      for (const query of queries) {
        const startTime = Date.now();
        await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        const executionTime = Date.now() - startTime;
        
        // Should complete within 5 seconds
        expect(executionTime).toBeLessThan(5000);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle empty queries gracefully', async () => {
      const result = await executeImprovedOrchestrator('', testSessionId, defaultContext);
      
      expect(result.analysis).toBeDefined();
      expect(result.executionResult).toBeDefined();
    });

    test('should handle undefined context gracefully', async () => {
      const result = await executeImprovedOrchestrator('BTCの価格', testSessionId, undefined as any);
      
      expect(result.analysis).toBeDefined();
      expect(result.executionResult).toBeDefined();
    });
  });

  describe('Conversation Continuity', () => {
    test('should maintain context across multiple queries', async () => {
      const sessionId = `conversation-${Date.now()}`;
      
      // First query about BTC
      const query1 = await executeImprovedOrchestrator(
        'BTCについて教えて',
        sessionId,
        defaultContext
      );
      
      // Follow-up query without mentioning BTC
      const query2 = await executeImprovedOrchestrator(
        'その価格はいくら？',
        sessionId,
        defaultContext
      );
      
      expect(query1.executionResult).toBeDefined();
      expect(query2.executionResult).toBeDefined();
      // Second query should understand context from first
      expect(query2.executionResult!.response).toContain('BTC');
    });
  });
});

// Integration test for intent analysis accuracy
describe('Intent Analysis Accuracy', () => {
  const testCases = [
    // UI operations that might be confused with price inquiries
    { query: 'BTCを表示', expectedIntent: 'ui_control', notIntent: 'price_inquiry' },
    { query: 'ビットコインのチャートを見せて', expectedIntent: 'ui_control', notIntent: 'price_inquiry' },
    { query: 'ETHに切り替えて', expectedIntent: 'ui_control', notIntent: 'price_inquiry' },
    
    // Price inquiries that might be confused with UI operations
    { query: 'BTCの価格はいくら？', expectedIntent: 'price_inquiry', notIntent: 'ui_control' },
    { query: 'ビットコインの値段を教えて', expectedIntent: 'price_inquiry', notIntent: 'ui_control' },
    
    // Analysis requests
    { query: 'BTCの分析をして', expectedIntent: 'analysis', notIntent: 'price_inquiry' },
    { query: 'テクニカル分析をお願い', expectedIntent: 'analysis', notIntent: 'ui_control' },
  ];

  intentSummary.total = testCases.length;

  test.each(testCases)(
    'should correctly identify "$query" as $expectedIntent (not $notIntent)',
    async ({ query, expectedIntent, notIntent }) => {
      let passed = false;
      const result = await executeImprovedOrchestrator(
        query,
        `intent-test-${Date.now()}`,
        defaultContext
      );

      try {
        expect(result.analysis.intent).toBe(expectedIntent);
        expect(result.analysis.intent).not.toBe(notIntent);
        expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
        passed = true;
      } finally {
        if (passed) {
          intentSummary.success++;
          metrics?.metricsCollector?.increment('intent_test_success');
        } else {
          intentSummary.fail++;
          metrics?.metricsCollector?.increment('intent_test_fail');
        }
        metrics?.metricsCollector?.increment('intent_test_total');
      }

      testResults.push({ query, intent: result.analysis.intent, confidence: result.analysis.confidence });
    }
  );
});

describe('Ambiguous and Multilingual Queries', () => {
  const testSessionId = `test-ambiguous-${Date.now()}`;
  const queries = [
    { query: 'BTC価格チャート', expectedIntent: 'price_inquiry' },
    { query: 'チャートのビットコイン価格', expectedIntent: 'price_inquiry' },
    { query: '価格チャートを表示', expectedIntent: 'ui_control' },
    { query: 'What is the price of Bitcoin?', expectedIntent: 'price_inquiry' },
    { query: '¿Cuál es el precio de Bitcoin?', expectedIntent: 'price_inquiry' },
    { query: '比特币价格是多少？', expectedIntent: 'price_inquiry' },
  ];

  test.each(queries)('should handle "$query" correctly', async ({ query, expectedIntent }) => {
    const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);

    expect(result.analysis.intent).toBe(expectedIntent);
    expect(result.analysis.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD);
    expect(result.executionResult).toBeDefined();

    testResults.push({ query, intent: result.analysis.intent, confidence: result.analysis.confidence });
  });
});

// Export test results if needed
afterAll(() => {
  const summary = {
    total: intentSummary.total,
    success: intentSummary.success,
    fail: intentSummary.fail,
  };

  console.log('[Intent Analysis Summary]', summary);

  const reportsDir = path.join(__dirname, '../../../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(reportsDir, 'intent-analysis-summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), ...summary }, null, 2)
  );

  metrics?.metricsCollector?.increment('intent_test_success', summary.success);
  metrics?.metricsCollector?.increment('intent_test_fail', summary.fail);

  if (process.env['SAVE_TEST_RESULTS'] === 'true') {
    const resultsDir = path.join(__dirname, '../../../test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = path.join(resultsDir, `orchestrator-test-${timestamp}.json`);
    
    // Save test metadata and results
    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          testFile: 'orchestrator.test.ts',
          environment: process.env.NODE_ENV,
          results: testResults,
        },
        null,
        2
      )
    );
  }
});