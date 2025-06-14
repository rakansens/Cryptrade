#!/usr/bin/env tsx

/**
 * A2A通信システム ライブテストスクリプト
 * 
 * 実際のアプリ環境でエージェント選択とA2A通信をテストします
 */

import { agentNetwork, registerCryptradeAgent } from '../lib/mastra/network/agent-network';
import { registerAllAgents } from '../lib/mastra/network/agent-registry';
import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// テストケース定義
const TEST_CASES = [
  {
    name: '価格照会テスト',
    query: 'BTCの現在価格を教えて',
    expectedAgent: 'priceInquiryAgent',
    description: '価格関連のクエリが正しくPrice Inquiry Agentにルーティングされるか'
  },
  {
    name: 'UI操作テスト',
    query: 'チャートを1時間足に変更して',
    expectedAgent: 'uiControlAgent',
    description: 'UI操作のクエリが正しくUI Control Agentにルーティングされるか'
  },
  {
    name: '取引分析テスト', 
    query: 'ETHの投資判断を分析して',
    expectedAgent: 'tradingAnalysisAgent',
    description: '分析関連のクエリが正しくTrading Analysis Agentにルーティングされるか'
  },
  {
    name: '一般会話テスト',
    query: 'こんにちは、使い方を教えて',
    expectedAgent: 'orchestratorAgent',
    description: '一般的なクエリがOrchestratorにルーティングされるか'
  },
  {
    name: '複雑な分析テスト',
    query: 'BTC/USDTの技術分析をして、今後1週間のトレンド予測とリスク評価をお願いします',
    expectedAgent: 'tradingAnalysisAgent',
    description: '複雑な分析要求が適切にルーティングされるか'
  }
];

async function runLiveTest() {
  console.log('🚀 A2A通信システム ライブテスト開始\n');
  
  try {
    // Step 1: エージェント登録
    console.log('📝 エージェント登録中...');
    registerAllAgents();
    
    const networkStats = agentNetwork.getNetworkStats();
    console.log(`✅ ${networkStats.totalAgents}個のエージェントを登録完了\n`);
    
    // Step 2: 健全性チェック
    console.log('🏥 エージェント健全性チェック中...');
    const healthResults = await agentNetwork.healthCheck();
    const healthyCount = Object.values(healthResults).filter(Boolean).length;
    const totalCount = Object.keys(healthResults).length;
    
    console.log(`✅ ${healthyCount}/${totalCount} エージェントが正常\n`);
    
    if (healthyCount === 0) {
      console.log('❌ すべてのエージェントが応答していません。テストを中止します。');
      return;
    }
    
    // Step 3: エージェント選択テスト
    console.log('🎯 エージェント選択テスト開始...\n');
    
    for (const testCase of TEST_CASES) {
      console.log(`\n--- ${testCase.name} ---`);
      console.log(`Query: "${testCase.query}"`);
      console.log(`Expected: ${testCase.expectedAgent}`);
      
      try {
        // エージェント選択テスト
        const selectedAgent = await agentNetwork.selectAgent(testCase.query);
        const isCorrect = selectedAgent === testCase.expectedAgent;
        
        console.log(`Selected: ${selectedAgent || 'null'}`);
        console.log(`Result: ${isCorrect ? '✅ 正解' : '❌ 不正解'}`);
        
        if (!isCorrect) {
          console.log(`⚠️  期待: ${testCase.expectedAgent}, 実際: ${selectedAgent}`);
        }
        
        // A2A通信テスト
        if (selectedAgent) {
          console.log('\n📡 A2A通信テスト...');
          const a2aResponse = await agentNetwork.sendMessage(
            'test-orchestrator',
            selectedAgent,
            'test_query',
            { query: testCase.query, testMode: true },
            `live-test-${Date.now()}`
          );
          
          if (a2aResponse && a2aResponse.type === 'response') {
            console.log('✅ A2A通信成功');
            console.log(`📨 Response type: ${a2aResponse.type}`);
            console.log(`🕐 Execution time: ${Date.now() - a2aResponse.timestamp}ms`);
          } else if (a2aResponse && a2aResponse.type === 'error') {
            console.log('❌ A2A通信エラー');
            console.log(`Error: ${a2aResponse.error?.message}`);
          } else {
            console.log('⚠️  A2A通信失敗（レスポンスなし）');
          }
        }
        
      } catch (error) {
        console.log(`❌ テストエラー: ${String(error)}`);
      }
      
      console.log(''); // 区切り線
    }
    
    // Step 4: 統合テスト（Orchestrator経由）
    console.log('\n🏗 統合テスト（Orchestrator経由）...\n');
    
    for (const testCase of TEST_CASES.slice(0, 2)) { // 最初の2つのみテスト
      console.log(`\n--- Orchestrator統合: ${testCase.name} ---`);
      console.log(`Query: "${testCase.query}"`);
      
      try {
        const result = await executeImprovedOrchestrator(
          testCase.query,
          `live-test-session-${Date.now()}`
        );
        
        console.log(`✅ Orchestrator実行成功`);
        console.log(`Intent: ${result.analysis.intent}`);
        console.log(`Confidence: ${result.analysis.confidence}`);
        console.log(`Execution time: ${result.executionTime}ms`);
        console.log(`Success: ${result.success ? '✅' : '❌'}`);
        
        if (result.executionResult) {
          console.log('📊 実行結果あり');
        }
        
      } catch (error) {
        console.log(`❌ Orchestrator統合テストエラー: ${String(error)}`);
      }
    }
    
    // Step 5: パフォーマンス統計
    console.log('\n📊 最終統計情報...');
    const finalStats = agentNetwork.getNetworkStats();
    console.log(`Total Agents: ${finalStats.totalAgents}`);
    console.log(`Active Agents: ${finalStats.activeAgents}`);
    console.log(`Total Messages: ${finalStats.totalMessages}`);
    console.log(`Average Messages: ${finalStats.averageMessages.toFixed(2)}`);
    
    console.log('\n🎉 ライブテスト完了！');
    
  } catch (error) {
    console.error('❌ ライブテスト失敗:', error);
  }
}

// メイン実行
if (require.main === module) {
  runLiveTest().catch(console.error);
}

export { runLiveTest };