#!/usr/bin/env node

/**
 * A2Aシステムの統合テスト
 * エージェント間通信と価格取得の動作確認
 */

const { registerAllAgents } = require('../lib/mastra/network/agent-registry');
const { agentNetwork } = require('../lib/mastra/network/agent-network');
const { logger } = require('../lib/utils/logger');

async function testA2ASystem() {
  console.log('=== A2A System Integration Test ===\n');

  try {
    // 1. エージェントを登録
    console.log('[1] Registering agents...');
    registerAllAgents();
    console.log('✓ Agents registered successfully\n');

    // 2. ネットワーク統計を確認
    console.log('[2] Network statistics:');
    const stats = agentNetwork.getNetworkStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('');

    // 3. 価格照会をテスト
    console.log('[3] Testing price inquiry via A2A...');
    const priceQuery = 'BTCの価格を教えて';
    console.log(`Query: "${priceQuery}"`);
    
    const priceResult = await agentNetwork.sendMessage(
      'testClient',
      'priceInquiryAgent',
      'process_query',
      { query: priceQuery },
      `test-${Date.now()}`
    );

    console.log('\nPrice inquiry result:');
    console.log('- Type:', priceResult?.type);
    console.log('- Result:', priceResult?.result);
    console.log('- Error:', priceResult?.error);
    
    // 4. エージェント自動選択をテスト
    console.log('\n[4] Testing automatic agent selection...');
    const selectedAgent = await agentNetwork.selectAgent(priceQuery);
    console.log('Selected agent:', selectedAgent);
    
    // 5. ルーティング機能をテスト
    console.log('\n[5] Testing message routing...');
    const routedResult = await agentNetwork.routeMessage(
      'testClient',
      priceQuery,
      { source: 'test-script' }
    );
    
    console.log('Routed result:');
    console.log('- Type:', routedResult?.type);
    console.log('- Source:', routedResult?.source);
    console.log('- Result:', routedResult?.result);

    // 6. 別の通貨でテスト
    console.log('\n[6] Testing with different currency (ETH)...');
    const ethQuery = 'ETHの価格は？';
    const ethResult = await agentNetwork.sendMessage(
      'testClient',
      'priceInquiryAgent',
      'process_query',
      { query: ethQuery },
      `test-eth-${Date.now()}`
    );
    
    console.log('ETH price result:', ethResult?.result);

    // 7. ヘルスチェック
    console.log('\n[7] Running health check...');
    const healthResults = await agentNetwork.healthCheck();
    console.log('Health check results:', JSON.stringify(healthResults, null, 2));

    console.log('\n=== Test completed successfully ===');

  } catch (error) {
    console.error('\n[ERROR] Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  testA2ASystem()
    .then(() => {
      console.log('\n✓ All tests passed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testA2ASystem };