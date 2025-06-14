#!/usr/bin/env tsx

/**
 * Memory API統合テスト
 * 
 * API経由でのメモリ機能の動作確認
 */

// Chalk v5はESMのみなので、色付けの代替実装
const colors = {
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: {
    cyan: (text: string) => `\x1b[1m\x1b[36m${text}\x1b[0m`,
    green: (text: string) => `\x1b[1m\x1b[32m${text}\x1b[0m`,
  }
};
const chalk = colors;
// const fetch = require('node-fetch'); // fetch is now a global in Node.js 18+

const BASE_URL = process.env['API_URL'] || 'http://localhost:3000';

// APIリクエストヘルパー
interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function apiRequest(path: string, options: ApiRequestOptions = {}) {
  const url = `${BASE_URL}${path}`;
  console.log(chalk.gray(`→ ${options.method || 'GET'} ${url}`));
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
  }
  
  return data;
}

// メイン実行関数
async function testMemoryAPI() {
  console.log(chalk.yellow('\n🔌 Memory API 統合テスト開始\n'));
  
  try {
    // 1. ストリーミングチャットで会話開始
    console.log(chalk.cyan('\n=== Test 1: ストリーミングチャット ==='));
    
    const message1 = 'BTCの価格を教えて';
    console.log(chalk.blue(`User: "${message1}"`));
    
    const response1 = await fetch(`${BASE_URL}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message1,
        agentId: 'tradingAgent',
        sessionId: 'api-test-session',
      }),
    });
    
    // ストリーミングレスポンスを読み取り
    let streamedContent = '';
    const reader = response1.body?.getReader();
    const decoder = new TextDecoder();
    
    if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamedContent += decoder.decode(value, { stream: true });
        }
    }
    
    console.log(chalk.green(`Assistant: ${streamedContent.substring(0, 100)}...`));
    
    // 2. フォローアップ質問
    console.log(chalk.cyan('\n=== Test 2: フォローアップ質問 ==='));
    
    const message2 = 'さらに詳しく分析して';
    console.log(chalk.blue(`User: "${message2}"`));
    
    const response2 = await fetch(`${BASE_URL}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message2,
        agentId: 'tradingAgent',
        sessionId: 'api-test-session',
      }),
    });
    
    const reader2 = response2.body?.getReader();
    let streamedContent2 = '';
    
    if (reader2) {
        while (true) {
          const { done, value } = await reader2.read();
          if (done) break;
          streamedContent2 += decoder.decode(value, { stream: true });
        }
    }
    
    console.log(chalk.green(`Assistant: ${streamedContent2.substring(0, 100)}...`));
    
    // 3. テレメトリー情報取得
    console.log(chalk.cyan('\n=== Test 3: テレメトリー情報 ==='));
    
    const telemetryInfo = await apiRequest('/api/monitoring/telemetry');
    console.log(chalk.magenta('Telemetry Config:'), telemetryInfo);
    
    // 4. Circuit Breaker状態確認
    console.log(chalk.cyan('\n=== Test 4: Circuit Breaker状態 ==='));
    
    const cbStatus = await apiRequest('/api/monitoring/circuit-breaker');
    console.log(chalk.magenta('Circuit Breaker Status:'), cbStatus);
    
    // 5. SSE接続テスト
    console.log(chalk.cyan('\n=== Test 5: SSE接続テスト ==='));
    
    const sseResponse = await fetch(`${BASE_URL}/api/ai/stream`);
    const eventReader = sseResponse.body?.getReader();
    
    console.log('SSE接続確立...');
    
    if (eventReader) {
      // 最初のイベントだけ読み取り
      const { value: sseValue } = await eventReader.read();
      const sseData = decoder.decode(sseValue);
      console.log(chalk.green('SSE Event:'), sseData.substring(0, 100));
      
      eventReader.cancel(); // 接続を閉じる
    }
    
    console.log(chalk.yellow('\n✅ すべてのAPIテスト完了！'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ テスト失敗:'), error);
    process.exit(1);
  }
}

// パフォーマンステスト
async function performanceTest() {
  console.log(chalk.yellow('\n⚡ パフォーマンステスト\n'));
  
  const queries = [
    'BTCの価格は？',
    'ETHの分析をして',
    'SOLのチャートを表示',
    'ADAについて教えて',
    'DOGEの投資判断は？',
  ];
  
  const times: number[] = [];
  
  for (const query of queries) {
    const start = Date.now();
    
    try {
      await fetch(`${BASE_URL}/api/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          agentId: 'tradingAgent',
          sessionId: 'perf-test',
        }),
      });
      
      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(chalk.gray(`"${query}" - ${elapsed}ms`));
      
    } catch (error) {
      console.error(chalk.red(`Failed: ${query}`));
    }
  }
  
  // 統計情報
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(chalk.cyan('\n=== パフォーマンス統計 ==='));
  console.log(`平均レスポンス時間: ${Math.round(avg)}ms`);
  console.log(`最速: ${min}ms`);
  console.log(`最遅: ${max}ms`);
}

// メイン実行
async function main() {
  console.log(chalk.bold.cyan('\n🚀 Cryptrade Memory & Telemetry API Test Suite\n'));
  
  // APIが起動しているか確認
  try {
    await fetch(BASE_URL);
  } catch (error) {
    console.error(chalk.red('❌ APIサーバーが起動していません'));
    console.log(chalk.yellow('npm run dev でサーバーを起動してください'));
    process.exit(1);
  }
  
  await testMemoryAPI();
  await performanceTest();
  
  console.log(chalk.bold.green('\n✨ すべてのテスト完了！\n'));
}

if (require.main === module) {
  main();
}