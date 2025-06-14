/**
 * エントリー提案機能の実クエリテスト
 * 自然言語での様々な表現に対して正しく動作するか確認
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Set the API key directly in process.env before any imports
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

import { executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { entryProposalGenerationTool } from '../lib/mastra/tools/entry-proposal-generation';
import { extractProposalGroup } from '../lib/api/helpers/proposal-extractor';
import { logger } from '../lib/utils/logger';
import { registerAllAgents } from '../lib/mastra/network/agent-registry';
import * as fs from 'fs';

// カラー出力用のヘルパー
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// テスト結果を保存
interface TestResult {
  query: string;
  success: boolean;
  intent: string;
  proposalType?: string;
  hasProposalGroup: boolean;
  proposalCount: number;
  proposalDetails?: {
    id: string;
    title: string;
    description: string;
    proposals: Array<{
      id: string;
      direction?: string;
      entryPrice?: number;
      entryZone?: {
        start?: number;
        end?: number;
      };
      riskParameters?: {
        stopLoss?: number;
        takeProfit?: number[];
        riskRewardRatio?: number;
        positionSize?: string;
      };
      confidence: number;
      priority?: string;
      strategy?: string;
      conditions?: {
        readyToEnter?: boolean;
        score: number;
      };
      marketContext?: {
        trend: string;
        volatility: string;
      };
    }>;
  };
  error?: string;
  executionTime: number;
}

const testResults: TestResult[] = [];

async function testQuery(query: string, expectedType: 'entry' | 'regular' | 'other'): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, colors.cyan);
    log(`🔍 テスト: "${query}"`, colors.bright);
    log(`期待される動作: ${expectedType === 'entry' ? 'エントリー提案' : expectedType === 'regular' ? '通常の提案' : 'その他'}`, colors.blue);
    
    // Orchestratorで意図分析と実行
    const result = await executeImprovedOrchestrator(query);
    const executionTime = Date.now() - startTime;
    
    // 結果の分析
    const { analysis, executionResult } = result;
    log(`\n📊 分析結果:`, colors.yellow);
    log(`  意図: ${analysis.intent} (信頼度: ${analysis.confidence})`, colors.cyan);
    log(`  提案タイプ: ${analysis.proposalType || 'なし'}`, colors.cyan);
    log(`  提案モード: ${analysis.isProposalMode ? 'はい' : 'いいえ'}`, colors.cyan);
    log(`  エントリー提案: ${analysis.isEntryProposal ? 'はい' : 'いいえ'}`, colors.cyan);
    
    // ProposalGroupの抽出
    const proposalGroup = extractProposalGroup(executionResult);
    const hasProposalGroup = !!proposalGroup;
    const proposalCount = proposalGroup?.proposals?.length || 0;
    
    log(`\n📋 実行結果:`, colors.yellow);
    log(`  ProposalGroup検出: ${hasProposalGroup ? '✅' : '❌'}`, hasProposalGroup ? colors.green : colors.red);
    
    if (hasProposalGroup) {
      log(`  提案数: ${proposalCount}個`, colors.blue);
      log(`  グループID: ${proposalGroup.id}`, colors.cyan);
      log(`  タイトル: ${proposalGroup.title}`, colors.cyan);
      log(`  説明: ${proposalGroup.description}`, colors.cyan);
      
      // 各提案の詳細
      if (proposalCount > 0) {
        log(`\n  📈 提案詳細:`, colors.yellow);
        proposalGroup.proposals.forEach((proposal, index: number) => {
          log(`\n  提案 ${index + 1}:`, colors.magenta);
          log(`    ID: ${proposal.id}`, colors.cyan);
          log(`    方向: ${proposal.direction === 'long' ? '🔺 ロング' : '🔻 ショート'}`, colors.cyan);
          log(`    エントリー価格: $${proposal.entryPrice?.toLocaleString() || 'N/A'}`, colors.cyan);
          
          if (proposal.entryZone) {
            log(`    エントリーゾーン: $${proposal.entryZone.start?.toLocaleString()} - $${proposal.entryZone.end?.toLocaleString()}`, colors.cyan);
          }
          
          if (proposal.riskParameters) {
            log(`    ストップロス: $${proposal.riskParameters.stopLoss?.toLocaleString() || 'N/A'}`, colors.red);
            log(`    テイクプロフィット: ${proposal.riskParameters.takeProfit?.map((tp: number) => `$${tp.toLocaleString()}`).join(', ') || 'N/A'}`, colors.green);
            log(`    リスクリワード比: ${proposal.riskParameters.riskRewardRatio || 'N/A'}`, colors.cyan);
            log(`    ポジションサイズ: ${proposal.riskParameters.positionSize || 'N/A'}`, colors.cyan);
          }
          
          log(`    信頼度: ${(proposal.confidence * 100).toFixed(1)}%`, colors.cyan);
          log(`    優先度: ${proposal.priority || 'N/A'}`, colors.cyan);
          log(`    戦略: ${proposal.strategy || 'N/A'}`, colors.cyan);
          
          if (proposal.conditions) {
            log(`    エントリー準備: ${proposal.conditions.readyToEnter ? '✅ 準備完了' : '⏳ 待機中'}`, colors.cyan);
            log(`    条件スコア: ${(proposal.conditions.score * 100).toFixed(1)}%`, colors.cyan);
          }
          
          if (proposal.marketContext) {
            log(`    市場トレンド: ${proposal.marketContext.trend}`, colors.cyan);
            log(`    ボラティリティ: ${proposal.marketContext.volatility}`, colors.cyan);
          }
        });
      }
    }
    
    // 期待値との比較
    const isExpectedResult = 
      (expectedType === 'entry' && analysis.proposalType === 'entry' && hasProposalGroup) ||
      (expectedType === 'regular' && analysis.proposalType !== 'entry' && analysis.isProposalMode) ||
      (expectedType === 'other' && !analysis.isProposalMode);
    
    log(`\n✨ 判定: ${isExpectedResult ? '✅ 期待通り' : '❌ 期待と異なる'}`, isExpectedResult ? colors.green : colors.red);
    log(`実行時間: ${executionTime}ms`, colors.blue);
    
    // 結果を記録
    const testResult: TestResult = {
      query,
      success: isExpectedResult,
      intent: analysis.intent,
      proposalType: analysis.proposalType,
      hasProposalGroup,
      proposalCount,
      proposalDetails: proposalGroup,
      executionTime,
    };
    
    testResults.push(testResult);
    return testResult;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    log(`\n❌ エラー発生: ${error}`, colors.red);
    
    const testResult: TestResult = {
      query,
      success: false,
      intent: 'error',
      hasProposalGroup: false,
      proposalCount: 0,
      error: String(error),
      executionTime,
    };
    
    testResults.push(testResult);
    return testResult;
  }
}

async function runAllTests() {
  log('\n🚀 エントリー提案機能の実クエリテスト開始', colors.bright);
  log('=' .repeat(50), colors.cyan);
  
  // エージェントを登録
  registerAllAgents();
  
  // テストクエリの定義
  const testQueries = [
    // エントリー提案を期待するクエリ
    { query: 'BTCUSDTのエントリー提案をしてください', expected: 'entry' as const },
    { query: 'エントリーポイントを教えて', expected: 'entry' as const },
    { query: 'BTCのエントリー提案', expected: 'entry' as const },
    { query: 'entry proposal for ETHUSDT', expected: 'entry' as const },
    { query: 'どこでエントリーすればいい？', expected: 'entry' as const },
    { query: 'エントリータイミングを提案して', expected: 'entry' as const },
    { query: 'BTCUSDTの買いポイントを教えて', expected: 'entry' as const },
    { query: 'ショートエントリーの提案をお願いします', expected: 'entry' as const },
    
    // 通常の提案を期待するクエリ
    { query: 'トレンドラインを提案して', expected: 'regular' as const },
    { query: 'サポートレジスタンスの候補を教えて', expected: 'regular' as const },
    { query: 'BTCのチャートパターンを分析して', expected: 'regular' as const },
    
    // その他のクエリ
    { query: 'BTCの価格は？', expected: 'other' as const },
    { query: 'こんにちは', expected: 'other' as const },
  ];
  
  // 各クエリをテスト
  for (const { query, expected } of testQueries) {
    await testQuery(query, expected);
    // API制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 結果のサマリー
  log('\n\n📊 テスト結果サマリー', colors.bright);
  log('=' .repeat(50), colors.cyan);
  
  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;
  const successRate = (successCount / totalCount * 100).toFixed(1);
  
  log(`\n総テスト数: ${totalCount}`, colors.blue);
  log(`成功: ${successCount} (${successRate}%)`, colors.green);
  log(`失敗: ${totalCount - successCount}`, colors.red);
  
  // 失敗したテストの詳細
  const failures = testResults.filter(r => !r.success);
  if (failures.length > 0) {
    log('\n\n❌ 失敗したテスト:', colors.red);
    failures.forEach(f => {
      log(`  - "${f.query}"`, colors.yellow);
      log(`    意図: ${f.intent}, 提案タイプ: ${f.proposalType || 'なし'}`, colors.cyan);
      if (f.error) {
        log(`    エラー: ${f.error}`, colors.red);
      }
    });
  }
  
  // エントリー提案の統計
  const entryProposals = testResults.filter(r => r.proposalType === 'entry' && r.hasProposalGroup);
  if (entryProposals.length > 0) {
    log('\n\n📈 エントリー提案の統計:', colors.bright);
    log(`  生成された提案グループ数: ${entryProposals.length}`, colors.blue);
    
    const totalProposals = entryProposals.reduce((sum, r) => sum + r.proposalCount, 0);
    log(`  総提案数: ${totalProposals}`, colors.blue);
    
    const avgProposalsPerGroup = (totalProposals / entryProposals.length).toFixed(1);
    log(`  グループあたり平均提案数: ${avgProposalsPerGroup}`, colors.blue);
    
    const avgExecutionTime = entryProposals.reduce((sum, r) => sum + r.executionTime, 0) / entryProposals.length;
    log(`  平均実行時間: ${avgExecutionTime.toFixed(0)}ms`, colors.blue);
  }
  
  // 結果をファイルに保存
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputPath = path.join(__dirname, `test-results-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(testResults, null, 2));
  log(`\n\n💾 テスト結果を保存: ${outputPath}`, colors.green);
  
  // 問題の特定
  log('\n\n🔧 改善が必要な点:', colors.yellow);
  
  // 意図分析の精度
  const intentMismatches = testResults.filter(r => 
    (r.query.includes('エントリー') || r.query.includes('entry')) && r.proposalType !== 'entry'
  );
  if (intentMismatches.length > 0) {
    log(`\n  ⚠️ 意図分析の改善が必要: ${intentMismatches.length}件`, colors.yellow);
    intentMismatches.forEach(m => {
      log(`    - "${m.query}" → ${m.intent}/${m.proposalType}`, colors.cyan);
    });
  }
  
  // ProposalGroup生成の問題
  const noProposalGroup = testResults.filter(r => 
    r.proposalType === 'entry' && !r.hasProposalGroup
  );
  if (noProposalGroup.length > 0) {
    log(`\n  ⚠️ ProposalGroup生成の問題: ${noProposalGroup.length}件`, colors.yellow);
  }
  
  log('\n\n✅ テスト完了', colors.green);
}

// メイン実行
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('テスト実行エラー:', error);
      process.exit(1);
    });
}

export { testQuery, runAllTests };