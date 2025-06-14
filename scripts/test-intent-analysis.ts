#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * 意図判定の精度テスト
 * 特に誤判定が多いケースをテスト
 */

async function testIntentAnalysis() {
  logger.info('=== Intent Analysis Test ===');
  
  const testCases = [
    // UI操作系（誤判定されやすい）
    { query: 'BTCのチャートに切り替えて', expectedIntent: 'ui_control', category: 'UI操作' },
    { query: 'ETHに変更して', expectedIntent: 'ui_control', category: 'UI操作' },
    { query: 'チャートをBTCにして', expectedIntent: 'ui_control', category: 'UI操作' },
    { query: 'BTCを表示して', expectedIntent: 'ui_control', category: 'UI操作' },
    
    // 価格照会系（正しく判定されるはず）
    { query: 'BTCの価格は？', expectedIntent: 'price_inquiry', category: '価格照会' },
    { query: 'BTCいくら？', expectedIntent: 'price_inquiry', category: '価格照会' },
    
    // 分析系（将来性などは分析であるべき）
    { query: 'ビットコインの将来性についてどう思う？', expectedIntent: 'trading_analysis', category: '分析' },
    { query: 'BTCの見通しは？', expectedIntent: 'trading_analysis', category: '分析' },
    { query: 'ETHは買い時？', expectedIntent: 'trading_analysis', category: '分析' },
    
    // 提案系
    { query: 'トレンドラインを描いて', expectedIntent: 'proposal_request', category: '提案' },
    { query: 'サポートラインを引いて', expectedIntent: 'proposal_request', category: '提案' },
  ];
  
  let correctCount = 0;
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await executeImprovedOrchestrator(
        testCase.query,
        'test-intent-' + Date.now(),
        { userLevel: 'intermediate', marketStatus: 'open' }
      );
      
      const isCorrect = result.analysis.intent === testCase.expectedIntent;
      if (isCorrect) correctCount++;
      
      results.push({
        query: testCase.query,
        expected: testCase.expectedIntent,
        actual: result.analysis.intent,
        confidence: result.analysis.confidence,
        correct: isCorrect,
        category: testCase.category,
      });
      
      logger.info(`[${testCase.category}] "${testCase.query}"`, {
        expected: testCase.expectedIntent,
        actual: result.analysis.intent,
        correct: isCorrect ? '✅' : '❌',
      });
      
    } catch (error) {
      logger.error(`Failed to test: ${testCase.query}`, error);
    }
  }
  
  // サマリー
  logger.info('\n=== Summary ===');
  logger.info(`Total: ${testCases.length}`);
  logger.info(`Correct: ${correctCount} (${Math.round(correctCount / testCases.length * 100)}%)`);
  
  // カテゴリ別の精度
  const categories = [...new Set(results.map(r => r.category))];
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categoryCorrect = categoryResults.filter(r => r.correct).length;
    logger.info(`${category}: ${categoryCorrect}/${categoryResults.length} (${Math.round(categoryCorrect / categoryResults.length * 100)}%)`);
  });
  
  // 誤判定の詳細
  const incorrect = results.filter(r => !r.correct);
  if (incorrect.length > 0) {
    logger.info('\n=== Incorrect Classifications ===');
    incorrect.forEach(r => {
      logger.info(`"${r.query}" - Expected: ${r.expected}, Got: ${r.actual}`);
    });
  }
}

// 実行
testIntentAnalysis().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});