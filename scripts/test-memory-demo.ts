#!/usr/bin/env tsx

/**
 * Memory機能の動作デモスクリプト
 * 
 * 実際のAIエージェントとの対話を通じて、
 * メモリ機能とテレメトリーの動作を確認
 */

// 環境変数を読み込む
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' }); // .envも読み込む（.env.localが優先される）

import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { useConversationMemory, semanticSearch } from '../lib/store/conversation-memory.store';
import { env } from '../config/env';
// Chalk v5はESMのみなので、色付けの代替実装
const colors = {
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};
const chalk = colors;
import { embeddingService } from '../lib/services/semantic-embedding.service';

// テレメトリー情報を表示
function showTelemetryInfo() {
  console.log(chalk.cyan('\n=== テレメトリー設定 ==='));
  console.log(`Sampling Rate: ${env.TELEMETRY_SAMPLING_RATE || 0.001}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Telemetry Mode: ${process.env.NODE_ENV === 'production' ? 'Probabilistic' : 'Always On'}`);
}

// セッション情報を表示
function showSessionInfo(sessionId: string) {
  const memoryStore = useConversationMemory.getState();
  const session = memoryStore.sessions[sessionId];
  
  if (!session) return;
  
  console.log(chalk.cyan('\n=== セッション情報 ==='));
  console.log(`Session ID: ${sessionId}`);
  console.log(`Messages: ${session.messages.length}`);
  console.log(`Started: ${session.startedAt.toLocaleString()}`);
  console.log(`Last Active: ${session.lastActiveAt.toLocaleString()}`);
}

// メッセージ履歴を表示
function showMessageHistory(sessionId: string, limit = 5) {
  const memoryStore = useConversationMemory.getState();
  const messages = memoryStore.getRecentMessages(sessionId, limit);
  
  console.log(chalk.cyan(`\n=== 最新${limit}件のメッセージ ===`));
  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? chalk.blue('User') : chalk.green('Assistant');
    console.log(`${index + 1}. ${role}: ${msg.content.substring(0, 100)}...`);
    if (msg.metadata) {
      console.log(chalk.gray(`   Metadata: ${JSON.stringify(msg.metadata)}`));
    }
  });
}

// メイン実行関数
async function runMemoryDemo() {
  console.log(chalk.yellow('\n🧠 Memory機能デモンストレーション開始\n'));
  
  // テレメトリー情報表示
  showTelemetryInfo();
  
  // メモリストアをクリア
  useConversationMemory.setState({ sessions: {}, currentSessionId: null });
  
  // セッション作成
  const sessionId = 'demo-session-' + Date.now();
  console.log(chalk.green(`\n✅ 新しいセッション作成: ${sessionId}`));
  
  // シナリオ1: 初回の質問
  console.log(chalk.yellow('\n📝 シナリオ1: 初回の質問'));
  console.log(chalk.blue('User: "BTCの現在価格を教えて"'));
  
  const result1 = await executeImprovedOrchestrator('BTCの現在価格を教えて', sessionId);
  
  console.log(chalk.green('\n🤖 Orchestrator分析結果:'));
  console.log(`Intent: ${result1.analysis.intent}`);
  console.log(`Confidence: ${result1.analysis.confidence}`);
  console.log(`Symbol: ${result1.analysis.extractedSymbol}`);
  console.log(`実行時間: ${result1.executionTime}ms`);
  
  // メモリコンテキスト表示
  if (result1.memoryContext) {
    console.log(chalk.magenta('\n📚 メモリコンテキスト:'));
    console.log(result1.memoryContext);
  }
  
  // セッション情報表示
  showSessionInfo(sessionId);
  
  // 2秒待機
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // シナリオ2: フォローアップ質問
  console.log(chalk.yellow('\n📝 シナリオ2: フォローアップ質問（文脈依存）'));
  console.log(chalk.blue('User: "それを詳しく分析して"'));
  
  const result2 = await executeImprovedOrchestrator('それを詳しく分析して', sessionId);
  
  console.log(chalk.green('\n🤖 Orchestrator分析結果:'));
  console.log(`Intent: ${result2.analysis.intent}`);
  console.log(`Confidence: ${result2.analysis.confidence}`);
  console.log(`実行時間: ${result2.executionTime}ms`);
  
  // メッセージ履歴表示
  showMessageHistory(sessionId);
  
  // 2秒待機
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // シナリオ3: 別のトピック
  console.log(chalk.yellow('\n📝 シナリオ3: 別のトピック'));
  console.log(chalk.blue('User: "ETHのチャートにトレンドラインを引いて"'));
  
  const result3 = await executeImprovedOrchestrator('ETHのチャートにトレンドラインを引いて', sessionId);
  
  console.log(chalk.green('\n🤖 Orchestrator分析結果:'));
  console.log(`Intent: ${result3.analysis.intent}`);
  console.log(`Symbol: ${result3.analysis.extractedSymbol}`);
  console.log(`実行時間: ${result3.executionTime}ms`);
  
  // 2秒待機
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // シナリオ4: セマンティック検索デモ
  console.log(chalk.yellow('\n📝 シナリオ4: セマンティック検索'));
  console.log(chalk.cyan('検索クエリ: "価格について聞いたこと"'));
  
  try {
    const searchResults = await semanticSearch('価格について聞いたこと', sessionId, 0.6);
    
    console.log(chalk.green(`\n🔍 検索結果: ${searchResults.length}件`));
    searchResults.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.role}] ${msg.content.substring(0, 80)}...`);
    });
  } catch (error) {
    console.log(chalk.red('セマンティック検索エラー:'), error);
  }
  
  // 最終的なセッション情報
  showSessionInfo(sessionId);
  showMessageHistory(sessionId, 8);
  
  // メトリクス表示
  console.log(chalk.cyan('\n=== パフォーマンスメトリクス ==='));
  console.log(`合計実行時間: ${result1.executionTime + result2.executionTime + result3.executionTime}ms`);
  console.log(`平均実行時間: ${Math.round((result1.executionTime + result2.executionTime + result3.executionTime) / 3)}ms`);
  
  // 埋め込みキャッシュ情報
  console.log(chalk.cyan('\n=== 埋め込みキャッシュ情報 ==='));
  console.log(`キャッシュサイズ: ${(embeddingService as unknown as { embeddingCache?: { size: number } }).embeddingCache?.size || 0}`);
  
  console.log(chalk.yellow('\n✨ デモンストレーション完了！\n'));
}

// エラーハンドリング付き実行
async function main() {
  try {
    await runMemoryDemo();
  } catch (error) {
    console.error(chalk.red('\n❌ エラーが発生しました:'), error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main();
}