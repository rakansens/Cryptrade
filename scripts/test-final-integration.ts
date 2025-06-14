#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * 最終統合テスト
 * 全ての改善点が正しく動作するか確認
 */

async function testFinalIntegration() {
  logger.info('=== Final Integration Test ===');
  
  const testCases = [
    // 1. 会話処理（Orchestrator直接）
    { query: 'こんにちは！', expectedProcessedBy: 'orchestrator-direct', category: '会話' },
    { query: 'ありがとう', expectedProcessedBy: 'orchestrator-direct', category: '会話' },
    
    // 2. UI操作（正しく判定されるべき）
    { query: 'BTCのチャートに切り替えて', expectedProcessedBy: 'uiControlAgent', category: 'UI操作' },
    
    // 3. 価格照会（専門エージェント）
    { query: 'BTCの価格は？', expectedProcessedBy: 'priceInquiryAgent', category: '価格照会' },
    
    // 4. 分析（将来性は分析として判定されるべき）
    { query: 'ビットコインの将来性についてどう思う？', expectedProcessedBy: 'tradingAnalysisAgent', category: '分析' },
    
    // 5. 提案
    { query: 'トレンドラインを描いて', expectedProcessedBy: 'tradingAnalysisAgent', category: '提案' },
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      logger.info(`\nTesting: "${testCase.query}"`);
      
      const result = await executeImprovedOrchestrator(
        testCase.query,
        'final-test-' + Date.now(),
        { userLevel: 'intermediate', marketStatus: 'open' }
      );
      
      const actualProcessedBy = result.executionResult?.metadata?.processedBy || 'unknown';
      const isCorrect = actualProcessedBy === testCase.expectedProcessedBy;
      
      results.push({
        query: testCase.query,
        category: testCase.category,
        intent: result.analysis.intent,
        confidence: result.analysis.confidence,
        expectedProcessedBy: testCase.expectedProcessedBy,
        actualProcessedBy,
        correct: isCorrect,
        hasResponse: !!result.executionResult?.response,
      });
      
      logger.info('Result:', {
        intent: result.analysis.intent,
        processedBy: actualProcessedBy,
        correct: isCorrect ? '✅' : '❌',
        hasResponse: !!result.executionResult?.response,
      });
      
      if (result.executionResult?.response) {
        logger.info('Response preview:', result.executionResult.response.substring(0, 100) + '...');
      }
      
    } catch (error) {
      logger.error(`Failed: ${testCase.query}`, error);
      results.push({
        query: testCase.query,
        category: testCase.category,
        error: true,
      });
    }
  }
  
  // サマリー
  logger.info('\n=== Test Summary ===');
  const successCount = results.filter(r => r.correct).length;
  logger.info(`Total: ${results.length}`);
  logger.info(`Success: ${successCount} (${Math.round(successCount / results.length * 100)}%)`);
  
  // カテゴリ別結果
  const categories = [...new Set(results.map(r => r.category))];
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categorySuccess = categoryResults.filter(r => r.correct).length;
    logger.info(`${category}: ${categorySuccess}/${categoryResults.length}`);
  });
  
  // 問題のあるケース
  const failures = results.filter(r => !r.correct && !r.error);
  if (failures.length > 0) {
    logger.info('\n=== Failed Cases ===');
    failures.forEach(f => {
      logger.info(`"${f.query}": Expected ${f.expectedProcessedBy}, Got ${f.actualProcessedBy}`);
    });
  }
}

// 実行
testFinalIntegration().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});