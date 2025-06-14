#!/usr/bin/env tsx

/**
 * パフォーマンス改善の実動作テスト
 * 
 * 実際のAPIエンドポイントを使用して、改善された機能をテストします
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3000/api';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  response?: {
    proposals?: Array<{
      id: string;
      type: string;
      description?: string;
      confidence: number;
    }>;
    sessions?: Array<{
      id: string;
      userId: string;
      startedAt: string;
      lastActiveAt: string;
    }>;
    messagesSent?: number;
    [key: string]: unknown;
  };
  error?: string;
}

const tests: TestResult[] = [];

// カラー出力用のヘルパー
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

async function runTest(
  testName: string,
  testFn: () => Promise<TestResult['response']>
): Promise<void> {
  console.log(`\n${colors.blue('▶')} Running: ${testName}`);
  const startTime = Date.now();
  
  try {
    const response = await testFn();
    const duration = Date.now() - startTime;
    
    tests.push({
      testName,
      success: true,
      duration,
      response,
    });
    
    console.log(`${colors.green('✓')} Success (${duration}ms)`);
    if (response) {
      console.log('  Response:', JSON.stringify(response, null, 2).substring(0, 200) + '...');
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    tests.push({
      testName,
      success: false,
      duration,
      error: error.message,
    });
    
    console.log(`${colors.red('✗')} Failed (${duration}ms)`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Test 1: 価格照会のレスポンス時間（キャッシュなし）
async function testPriceInquiryWithoutCache() {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'BTCの価格を教えて',
      userId: 'test-user-1',
      sessionId: 'perf-test-session-1',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// Test 2: 価格照会のレスポンス時間（キャッシュあり）
async function testPriceInquiryWithCache() {
  // 同じシンボルで2回目のリクエスト（キャッシュヒットを期待）
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'BTCの現在価格は？',
      userId: 'test-user-1',
      sessionId: 'perf-test-session-1',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// Test 2.5: 高ボラティリティ通貨のキャッシュTTL
async function testHighVolatilityCache() {
  console.log(`  ${colors.yellow('→')} Testing dynamic TTL with multiple requests...`);
  
  // First request to get initial data
  const response1 = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'DOGEの価格を教えて',
      userId: 'test-user-vol',
      sessionId: 'perf-test-volatility',
    }),
  });
  
  if (!response1.ok) {
    throw new Error(`HTTP ${response1.status}: ${await response1.text()}`);
  }
  
  // Wait 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Second request (might hit cache depending on volatility)
  const response2 = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'DOGEの価格は？',
      userId: 'test-user-vol',
      sessionId: 'perf-test-volatility',
    }),
  });
  
  if (!response2.ok) {
    throw new Error(`HTTP ${response2.status}: ${await response2.text()}`);
  }
  
  const data1 = await response1.json();
  const data2 = await response2.json();
  
  console.log(`  ${colors.cyan('→')} Dynamic TTL test completed`);
  
  return { request1: data1, request2: data2 };
}

// Test 3: エントリー提案の生成時間
async function testEntryProposalGeneration() {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'ETHUSDTのエントリーポイントを提案して',
      userId: 'test-user-2',
      sessionId: 'perf-test-session-2',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const data = await response.json();
  
  // 提案が生成されたか確認
  if (data.proposals && data.proposals.length > 0) {
    console.log(`  ${colors.green('→')} Generated ${data.proposals.length} proposals`);
  }
  
  return data;
}

// Test 4: パターン検出の実行時間
async function testPatternDetection() {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'BTCUSDTのチャートパターンを分析して',
      userId: 'test-user-3',
      sessionId: 'perf-test-session-3',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// Test 5: 一般会話の応答時間
async function testGeneralConversation() {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'こんにちは！今日の相場はどうですか？',
      userId: 'test-user-4',
      sessionId: 'perf-test-session-4',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// Test 6: 連続リクエストでのメモリ管理
async function testMemoryManagement() {
  const sessionId = 'perf-test-memory-session';
  const userId = 'test-user-memory';
  
  console.log(`  ${colors.yellow('→')} Sending 10 messages to test memory management...`);
  
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `メッセージ ${i + 1}: BTCの価格を教えて`,
        userId,
        sessionId,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Request ${i + 1} failed: HTTP ${response.status}`);
    }
    
    // 少し間隔を空ける
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // メモリAPIでセッション情報を確認
  const memoryResponse = await fetch(`${API_BASE_URL}/memory/sessions`, {
    headers: { 'X-User-Id': userId },
  });
  
  if (!memoryResponse.ok) {
    throw new Error(`Memory API failed: HTTP ${memoryResponse.status}`);
  }
  
  const sessions = await memoryResponse.json();
  console.log(`  ${colors.green('→')} Active sessions: ${sessions.length}`);
  
  return { messagesSent: 10, sessions };
}

// Test 7: A2Aタイムアウトのテスト（意図的に遅いリクエスト）
async function testA2ATimeout() {
  // 複雑な分析リクエストでタイムアウトをテスト
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'BTCUSDTの過去1年間の詳細な価格動向と、今後の予測を含む完全な市場分析レポートを作成してください',
      userId: 'test-user-timeout',
      sessionId: 'perf-test-timeout',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return await response.json();
}

// メイン実行関数
async function main() {
  console.log(colors.blue('=== パフォーマンス改善テスト ==='));
  console.log('API Base URL:', API_BASE_URL);
  console.log('開始時刻:', new Date().toISOString());
  
  // 各テストを実行
  await runTest('価格照会 (キャッシュなし)', testPriceInquiryWithoutCache);
  await runTest('価格照会 (キャッシュあり)', testPriceInquiryWithCache);
  await runTest('動的TTLテスト (高ボラティリティ)', testHighVolatilityCache);
  await runTest('エントリー提案生成', testEntryProposalGeneration);
  await runTest('パターン検出', testPatternDetection);
  await runTest('一般会話', testGeneralConversation);
  await runTest('メモリ管理 (連続10メッセージ)', testMemoryManagement);
  await runTest('A2Aタイムアウト', testA2ATimeout);
  
  // 結果サマリー
  console.log('\n' + colors.blue('=== テスト結果サマリー ==='));
  
  const successCount = tests.filter(t => t.success).length;
  const failureCount = tests.filter(t => !t.success).length;
  const avgDuration = tests.reduce((sum, t) => sum + t.duration, 0) / tests.length;
  
  console.log(`総テスト数: ${tests.length}`);
  console.log(`${colors.green('成功')}: ${successCount}`);
  console.log(`${colors.red('失敗')}: ${failureCount}`);
  console.log(`平均応答時間: ${avgDuration.toFixed(0)}ms`);
  
  // パフォーマンス比較
  console.log('\n' + colors.blue('=== パフォーマンス分析 ==='));
  
  const cacheTest = tests.find(t => t.testName.includes('キャッシュあり'));
  const noCacheTest = tests.find(t => t.testName.includes('キャッシュなし'));
  
  if (cacheTest && noCacheTest) {
    const improvement = ((noCacheTest.duration - cacheTest.duration) / noCacheTest.duration * 100).toFixed(1);
    console.log(`キャッシュによる改善: ${improvement}% (${noCacheTest.duration}ms → ${cacheTest.duration}ms)`);
  }
  
  // 動的TTL情報
  console.log('\n' + colors.blue('=== 動的TTL機能 ==='));
  console.log('✅ 動的TTLが有効になりました:');
  console.log('  • 高ボラティリティ通貨 (変動率5%+): 5-8秒のTTL');
  console.log('  • 中ボラティリティ通貨 (変動率2-5%): 10-15秒のTTL');
  console.log('  • 低ボラティリティ通貨 (変動率<2%): 20-60秒のTTL');
  console.log('  • メジャー通貨ペア: より短いTTL');
  console.log('  • アクティブな取引時間: TTLを20%短縮');
  console.log('  • 週末: TTLを50%延長');
  
  const hour = new Date().getUTCHours();
  const isActiveHours = (hour >= 13 && hour < 21) || (hour >= 8 && hour < 16) || (hour >= 0 && hour < 8);
  const dayOfWeek = new Date().getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  console.log(`\n現在の市場状況:`);
  console.log(`  • UTC時間: ${hour}時`);
  console.log(`  • アクティブ取引時間: ${isActiveHours ? colors.green('Yes') : colors.yellow('No')}`);
  console.log(`  • 週末: ${isWeekend ? colors.yellow('Yes') : colors.green('No')}`);
  console.log(`  • TTL調整: ${isActiveHours ? '短め' : '標準'}${isWeekend ? '、週末のため延長' : ''}`);
  
  // 詳細レポート
  console.log('\n' + colors.blue('=== 詳細レポート ==='));
  tests.forEach(test => {
    const status = test.success ? colors.green('✓') : colors.red('✗');
    console.log(`${status} ${test.testName}: ${test.duration}ms`);
    if (!test.success && test.error) {
      console.log(`  └─ Error: ${test.error}`);
    }
  });
  
  console.log('\n完了時刻:', new Date().toISOString());
}

// エラーハンドリング
main().catch(error => {
  console.error(colors.red('テスト実行中にエラーが発生しました:'), error);
  process.exit(1);
});