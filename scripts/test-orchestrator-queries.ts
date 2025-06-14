#!/usr/bin/env node
import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// .env.localを読み込む
config({ path: '.env.local' });

/**
 * Orchestrator会話統合の実際のクエリテスト
 * 入力と出力の結果を詳細にまとめる
 */

interface TestResult {
  query: string;
  category: string;
  intent: string;
  confidence: number;
  response: string;
  processedBy: string;
  executionTime: number;
}

async function testQueries() {
  const results: TestResult[] = [];
  
  // テストクエリのカテゴリ別セット
  const testQueries = [
    // 挨拶・雑談系
    { query: 'こんにちは！', category: '挨拶' },
    { query: 'おはようございます！今日も頑張りましょう', category: '挨拶' },
    { query: 'ありがとう、助かりました', category: '感謝' },
    { query: '疲れたなあ...', category: '感情表現' },
    
    // 市場雑談系
    { query: '最近の市場はどう？', category: '市場雑談' },
    { query: '暗号通貨って面白いよね', category: '市場雑談' },
    { query: 'ビットコインの将来性についてどう思う？', category: '市場雑談' },
    
    // 価格照会系（専門エージェント）
    { query: 'BTCの価格を教えて', category: '価格照会' },
    { query: 'イーサリアムの現在価格は？', category: '価格照会' },
    
    // 分析要求系（専門エージェント）
    { query: 'BTCの技術分析をして', category: '技術分析' },
    { query: 'エントリーポイントを提案して', category: 'エントリー提案' },
    
    // UI操作系（専門エージェント）
    { query: 'BTCのチャートに切り替えて', category: 'UI操作' },
    { query: 'トレンドラインを描いて', category: 'UI操作' },
  ];
  
  console.log('\n=== Orchestrator会話統合テスト結果 ===\n');
  
  for (const { query, category } of testQueries) {
    try {
      const startTime = Date.now();
      const result = await executeImprovedOrchestrator(
        query,
        `test-${Date.now()}`,
        { userLevel: 'intermediate', marketStatus: 'open' }
      );
      const executionTime = Date.now() - startTime;
      
      let response = 'エラー';
      let processedBy = 'unknown';
      
      if (result.executionResult) {
        response = result.executionResult.response || 
                  result.executionResult.executionResult?.response || 
                  result.executionResult.message || 
                  'レスポンスなし';
        
        processedBy = result.executionResult.metadata?.processedBy || 
                     (result.executionResult.executionResult?.metadata?.processedBy) || 
                     'unknown';
      }
      
      const testResult: TestResult = {
        query,
        category,
        intent: result.analysis.intent,
        confidence: result.analysis.confidence,
        response: response.substring(0, 100) + (response.length > 100 ? '...' : ''),
        processedBy,
        executionTime,
      };
      
      results.push(testResult);
      
      // コンソール出力
      console.log(`【${category}】 "${query}"`);
      console.log(`  意図: ${result.analysis.intent} (信頼度: ${result.analysis.confidence})`);
      console.log(`  処理: ${processedBy}`);
      console.log(`  応答: ${testResult.response}`);
      console.log(`  時間: ${executionTime}ms`);
      console.log('');
      
    } catch (error) {
      console.error(`エラー: ${query}`, error);
      results.push({
        query,
        category,
        intent: 'error',
        confidence: 0,
        response: 'エラーが発生しました',
        processedBy: 'error',
        executionTime: 0,
      });
    }
  }
  
  // サマリーテーブル出力
  console.log('\n=== 処理結果サマリー ===\n');
  console.log('| カテゴリ | クエリ | 意図 | 処理場所 | 実行時間 |');
  console.log('|---------|--------|------|----------|---------|');
  
  results.forEach(r => {
    const processedByLabel = r.processedBy === 'orchestrator-direct' ? 'Orchestrator直接' : 
                            r.processedBy === 'unknown' ? '専門エージェント' : r.processedBy;
    console.log(`| ${r.category} | ${r.query.substring(0, 20)} | ${r.intent} | ${processedByLabel} | ${r.executionTime}ms |`);
  });
  
  // 統計情報
  const orchestratorDirect = results.filter(r => r.processedBy === 'orchestrator-direct').length;
  const delegated = results.filter(r => r.processedBy !== 'orchestrator-direct' && r.processedBy !== 'error').length;
  const errors = results.filter(r => r.processedBy === 'error').length;
  
  console.log('\n=== 統計情報 ===');
  console.log(`Orchestrator直接処理: ${orchestratorDirect}件`);
  console.log(`専門エージェント委譲: ${delegated}件`);
  console.log(`エラー: ${errors}件`);
  console.log(`合計: ${results.length}件`);
  
  // 平均実行時間
  const avgTime = results.filter(r => r.executionTime > 0).reduce((sum, r) => sum + r.executionTime, 0) / results.filter(r => r.executionTime > 0).length;
  console.log(`平均実行時間: ${Math.round(avgTime)}ms`);
  
  // JSONファイルに保存
  const fs = require('fs');
  const outputPath = './test-results-orchestrator-queries.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n詳細な結果を${outputPath}に保存しました。`);
}

// 実行
testQueries().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});