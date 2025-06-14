#!/usr/bin/env node

/**
 * パフォーマンス要件の現状確認スクリプト
 * TDDの最初のステップ：現在の実装状態を確認
 */

console.log('=== Agent Performance Requirements Check ===\n');

// 1. A2A通信タイムアウト
console.log('1. A2A Communication Timeout:');
try {
  const agentNetworkPath = '../lib/mastra/network/agent-network.ts';
  const content = require('fs').readFileSync(require.resolve(agentNetworkPath), 'utf-8');
  const timeoutMatch = content.match(/timeout:\s*(\d+)/);
  const currentTimeout = timeoutMatch ? parseInt(timeoutMatch[1]) : null;
  console.log(`   Current: ${currentTimeout}ms`);
  console.log(`   Target: 10000ms or less`);
  console.log(`   Status: ${currentTimeout && currentTimeout <= 10000 ? '✅ PASS' : '❌ FAIL'}\n`);
} catch (e) {
  console.log('   Error checking timeout\n');
}

// 2. キャッシュTTL
console.log('2. Market Data Cache TTL:');
try {
  const toolPath = '../lib/mastra/tools/market-data-resilient.tool.ts';
  const content = require('fs').readFileSync(require.resolve(toolPath), 'utf-8');
  const ttlMatch = content.match(/ttl:\s*(\d+)/);
  const currentTTL = ttlMatch ? parseInt(ttlMatch[1]) : null;
  console.log(`   Current: ${currentTTL}ms`);
  console.log(`   Target: 30000ms or more`);
  console.log(`   Status: ${currentTTL && currentTTL >= 30000 ? '✅ PASS' : '❌ FAIL'}\n`);
} catch (e) {
  console.log('   Error checking TTL\n');
}

// 3. メモリ管理
console.log('3. Memory Management:');
try {
  const storePath = '../lib/store/enhanced-conversation-memory.store.ts';
  const content = require('fs').readFileSync(require.resolve(storePath), 'utf-8');
  
  // MAX_MESSAGES チェック
  const maxMessagesMatch = content.match(/MAX_MESSAGES[^=]*=\s*(\d+)/);
  const maxMessages = maxMessagesMatch ? parseInt(maxMessagesMatch[1]) : 100;
  console.log(`   Max messages in memory: ${maxMessages}`);
  console.log(`   Target: 50 or less`);
  console.log(`   Status: ${maxMessages <= 50 ? '✅ PASS' : '❌ FAIL'}`);
  
  // アーカイブ機能チェック
  const hasArchive = content.includes('archiveOldMessages') || content.includes('archive');
  console.log(`   Archive function: ${hasArchive ? '✅ EXISTS' : '❌ MISSING'}\n`);
} catch (e) {
  console.log('   Error checking memory management\n');
}

// 4. 動的モデル選択
console.log('4. Dynamic Model Selection:');
try {
  require('../lib/mastra/utils/model-selector');
  console.log('   Status: ✅ EXISTS\n');
} catch (e) {
  console.log('   Status: ❌ MISSING\n');
}

// 5. 共有データストア
console.log('5. Shared Data Store:');
try {
  require('../lib/mastra/utils/shared-data-store');
  console.log('   Status: ✅ EXISTS\n');
} catch (e) {
  console.log('   Status: ❌ MISSING\n');
}

// 6. 統一エラーハンドリング
console.log('6. Unified Error Handling (AgentError):');
try {
  require('../lib/mastra/utils/agent-error');
  console.log('   Status: ✅ EXISTS\n');
} catch (e) {
  console.log('   Status: ❌ MISSING\n');
}

// 7. パフォーマンス計測
console.log('7. Performance Measurement:');
try {
  require('../lib/mastra/utils/performance');
  console.log('   Status: ✅ EXISTS\n');
} catch (e) {
  console.log('   Status: ❌ MISSING\n');
}

// 8. Orchestrator分割
console.log('8. Orchestrator Module Split:');
const modules = ['handlers', 'utils', 'types'];
let allExist = true;
modules.forEach(module => {
  try {
    require(`../lib/mastra/agents/orchestrator.${module}`);
    console.log(`   orchestrator.${module}: ✅ EXISTS`);
  } catch (e) {
    console.log(`   orchestrator.${module}: ❌ MISSING`);
    allExist = false;
  }
});
console.log(`   Overall Status: ${allExist ? '✅ PASS' : '❌ FAIL'}\n`);

// サマリー
console.log('=== Summary ===');
console.log('Items to implement:');
console.log('1. Reduce A2A timeout from 30s to 10s');
console.log('2. Increase cache TTL from 5s to 30s');
console.log('3. Implement message archiving');
console.log('4. Create ModelSelector utility');
console.log('5. Create SharedDataStore');
console.log('6. Create AgentError class');
console.log('7. Add performance measurement');
console.log('8. Split Orchestrator into modules');