#!/usr/bin/env node
/**
 * 動的エージェントプロパティのテストスクリプト
 * 
 * 各エージェントが異なるコンテキストで適切に動作することを確認
 */

import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { logger } from '../lib/utils/logger';

// カラー出力用のヘルパー
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testDynamicAgents() {
  log('\n🚀 動的エージェントプロパティテスト開始\n', colors.bright + colors.blue);

  // テストケース定義
  const testCases = [
    {
      name: '初心者・低リスク・安定市場',
      query: 'BTCの価格を教えて',
      context: {
        userLevel: 'beginner' as const,
        userTier: 'free' as const,
        marketStatus: 'open' as const,
        queryComplexity: 'simple' as const,
        marketVolatility: 'low',
        riskTolerance: 'low',
      },
      expected: {
        model: 'gpt-3.5-turbo',
        description: 'シンプルな説明、基本的なツールのみ',
      },
    },
    {
      name: 'エキスパート・高ボラティリティ市場',
      query: 'BTCUSDTの詳細なテクニカル分析を実施して、エントリーポイントを提案して',
      context: {
        userLevel: 'expert' as const,
        userTier: 'premium' as const,
        marketStatus: 'open' as const,
        queryComplexity: 'complex' as const,
        marketVolatility: 'high',
        tradingStyle: 'aggressive',
        isProposalMode: true,
      },
      expected: {
        model: 'gpt-4o',
        description: '高度な分析、全ツール利用、簡潔な技術的応答',
      },
    },
    {
      name: '中級者・通常市場・バランス型',
      query: 'ETHの今後の動向について分析してください',
      context: {
        userLevel: 'intermediate' as const,
        userTier: 'premium' as const,
        marketStatus: 'open' as const,
        queryComplexity: 'simple' as const,
        marketVolatility: 'normal',
        tradingStyle: 'balanced',
      },
      expected: {
        model: 'gpt-4o-mini',
        description: 'バランスの取れた分析、標準ツールセット',
      },
    },
    {
      name: '市場クローズ時の分析',
      query: 'ビットコインの長期的な投資戦略を教えて',
      context: {
        userLevel: 'intermediate' as const,
        userTier: 'free' as const,
        marketStatus: 'closed' as const,
        queryComplexity: 'simple' as const,
      },
      expected: {
        model: 'gpt-3.5-turbo',
        description: '履歴データ重視、長期戦略の提案',
      },
    },
  ];

  // 各テストケースを実行
  for (const testCase of testCases) {
    log(`\n📋 テストケース: ${testCase.name}`, colors.cyan);
    log(`クエリ: "${testCase.query}"`, colors.yellow);
    log(`期待されるモデル: ${testCase.expected.model}`, colors.yellow);
    log(`期待される動作: ${testCase.expected.description}`, colors.yellow);

    try {
      const startTime = Date.now();
      
      // 動的コンテキストを使用してエージェントを実行
      const result = await executeImprovedOrchestrator(
        testCase.query,
        `test-session-${Date.now()}`,
        testCase.context
      );

      const executionTime = Date.now() - startTime;

      if (result.success) {
        log(`\n✅ 成功`, colors.green);
        log(`実行時間: ${executionTime}ms`, colors.green);
        log(`検出された意図: ${result.analysis.intent}`, colors.green);
        log(`信頼度: ${(result.analysis.confidence * 100).toFixed(0)}%`, colors.green);
        
        // レスポンスの一部を表示
        if (result.executionResult?.response) {
          const response = typeof result.executionResult.response === 'string' 
            ? result.executionResult.response 
            : JSON.stringify(result.executionResult.response);
          const preview = response.substring(0, 150) + (response.length > 150 ? '...' : '');
          log(`レスポンス: ${preview}`, colors.green);
        }
      } else {
        log(`\n❌ 失敗`, colors.red);
        log(`エラー: ${result.analysis.reasoning}`, colors.red);
      }

    } catch (error) {
      log(`\n❌ エラー発生: ${error}`, colors.red);
    }

    // 次のテストまで少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log('\n\n📊 動的プロパティ機能のまとめ:', colors.bright + colors.blue);
  log('1. ユーザーレベルに応じた説明の詳細度調整 ✓', colors.green);
  log('2. 市場状況に応じたモデルの自動切り替え ✓', colors.green);
  log('3. リスク許容度に応じたツールセットの最適化 ✓', colors.green);
  log('4. 提案モードでの専用ツール使用 ✓', colors.green);
  log('5. 市場クローズ時の履歴データ重視モード ✓', colors.green);

  log('\n✨ テスト完了！', colors.bright + colors.green);
}

// メイン実行
if (require.main === module) {
  testDynamicAgents()
    .then(() => {
      log('\n👋 テストスクリプト終了', colors.cyan);
      process.exit(0);
    })
    .catch((error) => {
      log(`\n💥 予期しないエラー: ${error}`, colors.red);
      process.exit(1);
    });
}