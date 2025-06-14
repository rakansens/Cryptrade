#!/usr/bin/env node

/**
 * UI Control Agent専用テスト
 */

const { registerAllAgents } = require('../lib/mastra/network/agent-registry');
const { agentNetwork } = require('../lib/mastra/network/agent-network');

async function testUIControlAgent() {
  console.log('=== UI Control Agent Test ===\n');

  try {
    // エージェントを登録
    registerAllAgents();
    console.log('✓ Agents registered\n');

    // UI操作のテストケース
    const testCases = [
      '1時間足に変更して',
      'BTCに切り替えて',
      '移動平均を表示して',
      'チャートをフィットして',
    ];

    for (const query of testCases) {
      console.log(`\n[Test] Query: "${query}"`);
      
      const result = await agentNetwork.sendMessage(
        'testClient',
        'uiControlAgent',
        'process_query',
        { query },
        `test-ui-${Date.now()}`
      );

      console.log('Result type:', result?.type);
      
      if (result?.type === 'response') {
        console.log('Response:', result.result);
      } else if (result?.type === 'error') {
        console.log('Error:', result.error);
      }
    }

    // Trading Analysis Agentもテスト
    console.log('\n\n=== Trading Analysis Agent Test ===\n');
    
    const tradingQuery = 'BTCの投資判断を分析して';
    console.log(`[Test] Query: "${tradingQuery}"`);
    
    const tradingResult = await agentNetwork.sendMessage(
      'testClient',
      'tradingAnalysisAgent',
      'process_query',
      { query: tradingQuery },
      `test-trading-${Date.now()}`
    );

    console.log('Result type:', tradingResult?.type);
    if (tradingResult?.type === 'response') {
      console.log('Response preview:', tradingResult.result.substring(0, 200) + '...');
    }

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    process.exit(1);
  }
}

// 実行
testUIControlAgent()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });