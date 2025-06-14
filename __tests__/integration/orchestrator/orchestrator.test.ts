import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../../../lib/mastra/agents/orchestrator.agent';
import { logger } from '../../../lib/utils/logger';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

describe('Orchestrator Agent Integration Tests', () => {
  const testSessionId = `test-${Date.now()}`;
  const defaultContext = { userLevel: 'intermediate', marketStatus: 'open' };

  beforeAll(() => {
    // Suppress logs during tests unless debugging
    if (process.env.DEBUG !== 'true') {
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
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe(expectedIntent);
        expect(result.analysis.confidence).toBeGreaterThan(0.7);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult.response).toBeDefined();
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
        expect(result.analysis.confidence).toBeGreaterThan(0.7);
        expect(result.executionResult).toBeDefined();
      });
    });

    describe('Price Inquiries', () => {
      const priceQueries = [
        { query: 'BTCの価格を教えて', symbol: 'BTC' },
        { query: 'イーサリアムの現在価格は？', symbol: 'ETH' },
        { query: 'ビットコインはいくら？', symbol: 'BTC' },
      ];

      test.each(priceQueries)('should handle price inquiry: "$query"', async ({ query, symbol }) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('price_inquiry');
        expect(result.analysis.confidence).toBeGreaterThan(0.7);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult.metadata?.processedBy).toContain('trading');
      });
    });

    describe('Technical Analysis', () => {
      const analysisQueries = [
        'BTCの技術分析をして',
        'エントリーポイントを提案して',
        'サポートとレジスタンスラインを分析して',
      ];

      test.each(analysisQueries)('should handle analysis request: "%s"', async (query) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(['analysis', 'entry_proposal']).toContain(result.analysis.intent);
        expect(result.analysis.confidence).toBeGreaterThan(0.7);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult.metadata?.processedBy).toContain('trading');
      });
    });

    describe('UI Operations', () => {
      const uiQueries = [
        { query: 'BTCのチャートに切り替えて', expectedAction: 'switch_chart' },
        { query: 'トレンドラインを描いて', expectedAction: 'draw_line' },
        { query: '15分足に変更して', expectedAction: 'change_timeframe' },
      ];

      test.each(uiQueries)('should handle UI operation: "$query"', async ({ query, expectedAction }) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('ui_control');
        expect(result.analysis.confidence).toBeGreaterThan(0.7);
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult.metadata?.processedBy).toContain('chart');
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
      
      expect(beginnerResult.executionResult.response).toBeDefined();
      expect(expertResult.executionResult.response).toBeDefined();
      // Responses should be different based on user level
      expect(beginnerResult.executionResult.response).not.toBe(expertResult.executionResult.response);
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
      expect(query2.executionResult.response).toContain('BTC');
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

  test.each(testCases)(
    'should correctly identify "$query" as $expectedIntent (not $notIntent)', 
    async ({ query, expectedIntent, notIntent }) => {
      const result = await executeImprovedOrchestrator(
        query,
        `intent-test-${Date.now()}`,
        { userLevel: 'intermediate', marketStatus: 'open' }
      );
      
      expect(result.analysis.intent).toBe(expectedIntent);
      expect(result.analysis.intent).not.toBe(notIntent);
      expect(result.analysis.confidence).toBeGreaterThan(0.7);
    }
  );
});

// Export test results if needed
afterAll(() => {
  if (process.env.SAVE_TEST_RESULTS === 'true') {
    const resultsDir = path.join(__dirname, '../../../test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = path.join(resultsDir, `orchestrator-test-${timestamp}.json`);
    
    // Save test metadata
    fs.writeFileSync(filename, JSON.stringify({
      timestamp: new Date().toISOString(),
      testFile: 'orchestrator.test.ts',
      environment: process.env.NODE_ENV,
    }, null, 2));
  }
});