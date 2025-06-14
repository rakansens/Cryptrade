#!/usr/bin/env tsx

/**
 * 動的応答のテスト
 * 定型文ではなく、毎回異なる応答が生成されることを確認
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3002/api';

const testMessages = [
  'こんにちは！今日の相場はどうですか？',
  'BTCの調子はどう？',
  '最近の市場について教えて',
  '取引のアドバイスをください',
  'イーサリアムについてどう思う？',
];

async function testDynamicResponses() {
  console.log('=== 動的応答テスト ===\n');
  
  const responses: string[] = [];
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`テスト ${i + 1}: "${message}"`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: 'test-dynamic-user',
          sessionId: `test-dynamic-session-${i}`, // 各テストで新しいセッション
        }),
      });
      
      if (!response.ok) {
        console.log(`  ❌ HTTPエラー: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const responseMessage = data.message || '';
      
      console.log(`  応答: "${responseMessage}"`);
      responses.push(responseMessage);
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`  ❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
  }
  
  // 応答の分析
  console.log('\n=== 応答分析 ===');
  
  // 完全に同じ応答があるかチェック
  const uniqueResponses = new Set(responses);
  console.log(`総応答数: ${responses.length}`);
  console.log(`ユニーク応答数: ${uniqueResponses.size}`);
  
  if (uniqueResponses.size === responses.length) {
    console.log('✅ すべての応答が異なります（定型文ではありません）');
  } else {
    console.log('⚠️  重複する応答があります');
  }
  
  // 共通パターンのチェック
  const commonPhrases = [
    'リクエストの処理中にエラーが発生しました',
    'しばらくしてから再度お試しください',
    'BTCについて話しましょう',
    '価格動向や取引のチャンス',
  ];
  
  console.log('\n定型文パターンチェック:');
  commonPhrases.forEach(phrase => {
    const count = responses.filter(r => r.includes(phrase)).length;
    if (count > 0) {
      console.log(`  "${phrase}": ${count}回出現`);
    }
  });
  
  // 応答の多様性スコア
  const diversityScore = (uniqueResponses.size / responses.length) * 100;
  console.log(`\n多様性スコア: ${diversityScore.toFixed(1)}%`);
  
  if (diversityScore === 100) {
    console.log('🎉 完全に動的な応答が生成されています！');
  } else if (diversityScore >= 80) {
    console.log('👍 概ね動的な応答ですが、一部重複があります');
  } else if (diversityScore >= 50) {
    console.log('⚠️  半分以上は動的ですが、定型文の可能性があります');
  } else {
    console.log('❌ 定型文の可能性が高いです');
  }
}

// 実行
testDynamicResponses().catch(console.error);