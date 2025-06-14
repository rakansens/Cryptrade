#!/usr/bin/env node

/**
 * AI機能の包括的テスト
 * - 複数トレンドライン描画
 * - 時間足変更
 * - 銘柄変更
 * - 複合操作
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/ai/chat';

async function testAICapability(query, description) {
  console.log(`\n🧪 Test: ${description}`);
  console.log(`📝 Query: "${query}"`);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        includeOperations: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('\n📊 Response:');
    console.log(`✅ Success: ${data.success}`);
    console.log(`💬 Response: ${data.response}`);
    
    if (data.operations && data.operations.length > 0) {
      console.log(`\n🔧 Operations (${data.operations.length}):`);
      data.operations.forEach((op, index) => {
        console.log(`  ${index + 1}. Type: ${op.type}, Action: ${op.action}`);
        if (op.parameters) {
          console.log(`     Parameters:`, JSON.stringify(op.parameters, null, 2));
        }
        if (op.clientEvent) {
          console.log(`     Event: ${op.clientEvent.event}`);
          if (op.clientEvent.data.points) {
            console.log(`     Points: ${op.clientEvent.data.points.length}`);
          }
        }
      });
    }
    
    if (data.metadata) {
      console.log(`\n📈 Metadata:`);
      console.log(`  Intent: ${data.metadata.intent}`);
      console.log(`  Confidence: ${data.metadata.confidence}`);
      console.log(`  Chart Data Used: ${data.metadata.chartDataUsed}`);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting AI Capabilities Test Suite');
  console.log('=====================================\n');
  
  // Test 1: 複数トレンドライン
  await testAICapability(
    '5本のトレンドラインを引いて',
    '複数トレンドライン描画'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: 時間足変更
  await testAICapability(
    '4時間足に変更して',
    '時間足変更'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: 銘柄変更
  await testAICapability(
    'ETHに変更',
    '銘柄変更'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: 複合操作
  await testAICapability(
    'BTCの1時間足でサポートラインとレジスタンスラインを表示',
    '複合操作（銘柄+時間足+描画）'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 5: 高度な分析
  await testAICapability(
    '現在のチャートを分析して最適なトレンドラインを3本引いて',
    '高度な分析と複数描画'
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 6: インジケーター操作
  await testAICapability(
    '移動平均線とRSIを表示して',
    'インジケーター制御'
  );
  
  console.log('\n\n✅ All tests completed!');
}

// Run tests
runAllTests().catch(console.error);