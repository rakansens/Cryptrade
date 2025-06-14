/**
 * エントリー提案機能の統合テストスクリプト
 * 実際のエージェントシステムを使用して動作確認
 */

import { orchestratorAgent, executeImprovedOrchestrator } from '../lib/mastra/agents/orchestrator.agent';
import { tradingAgent } from '../lib/mastra/agents/trading.agent';
import { agentNetwork } from '../lib/mastra/network/agent-network';
import { registerAllAgents } from '../lib/mastra/network/agent-registry';
import { logger } from '../lib/utils/logger';

// カラー出力用のヘルパー
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEntryProposal() {
  log('\n=== エントリー提案機能の統合テスト ===\n', colors.bright);

  // 1. エージェントの登録
  log('1. エージェントを登録中...', colors.cyan);
  registerAllAgents();
  log('✅ エージェント登録完了', colors.green);

  // 2. Orchestratorによる意図分析とルーティングのテスト
  log('\n2. Orchestratorによる意図分析テスト', colors.cyan);
  
  const testQueries = [
    {
      query: 'BTCUSDTのエントリー提案をしてください',
      expectedIntent: 'proposal_request',
      expectedProposalType: 'entry',
    },
    {
      query: 'エントリーポイントを教えて',
      expectedIntent: 'proposal_request',
      expectedProposalType: 'entry',
    },
    {
      query: 'BTCのトレンドライン提案して',
      expectedIntent: 'proposal_request',
      expectedProposalType: 'trendline',
    },
  ];

  for (const test of testQueries) {
    log(`\n  テスト: "${test.query}"`, colors.yellow);
    
    try {
      const result = await executeImprovedOrchestrator(test.query);
      
      log(`    意図: ${result.analysis.intent} (期待値: ${test.expectedIntent})`, 
        result.analysis.intent === test.expectedIntent ? colors.green : colors.red);
      
      log(`    提案タイプ: ${result.analysis.proposalType} (期待値: ${test.expectedProposalType})`,
        result.analysis.proposalType === test.expectedProposalType ? colors.green : colors.red);
      
      log(`    信頼度: ${result.analysis.confidence}`, colors.blue);
      
      if (result.executionResult) {
        log('    ✅ エージェント実行成功', colors.green);
      }
    } catch (error) {
      log(`    ❌ エラー: ${error}`, colors.red);
    }
  }

  // 3. A2A通信経由でのエントリー提案実行
  log('\n3. A2A通信経由でのエントリー提案実行テスト', colors.cyan);
  
  try {
    const a2aResponse = await agentNetwork.sendMessage(
      'testScript',
      'tradingAnalysisAgent',
      'process_query',
      {
        query: 'BTCUSDTのエントリー提案を生成してください',
        context: {
          extractedSymbol: 'BTCUSDT',
          isProposalMode: true,
          proposalType: 'entry',
          isEntryProposal: true,
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
        },
      }
    );

    if (a2aResponse) {
      log('  ✅ A2A通信成功', colors.green);
      log(`  レスポンスタイプ: ${a2aResponse.type}`, colors.blue);
      
      // proposalGroupの存在確認
      if (a2aResponse.proposalGroup) {
        log('  ✅ ProposalGroupが検出されました', colors.green);
        log(`  提案数: ${a2aResponse.proposalGroup.proposals?.length || 0}`, colors.blue);
      } else {
        log('  ⚠️  ProposalGroupが見つかりません', colors.yellow);
        
        // stepsから探す
        if (a2aResponse.steps) {
          for (const step of a2aResponse.steps) {
            if (step.toolResults) {
              for (const toolResult of step.toolResults) {
                if (toolResult.toolName === 'entryProposalGeneration' && toolResult.result?.proposalGroup) {
                  log('  ✅ toolResultsからProposalGroupを検出', colors.green);
                  log(`  提案数: ${toolResult.result.proposalGroup.proposals?.length || 0}`, colors.blue);
                  break;
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    log(`  ❌ A2A通信エラー: ${error}`, colors.red);
  }

  // 4. 直接ツール実行のテスト
  log('\n4. Trading Agentの直接実行テスト', colors.cyan);
  
  try {
    // Mastraの標準的なgenerate呼び出し（カスタムコンテキストは使えない）
    const directResult = await tradingAgent.generate(
      [
        {
          role: 'user' as const,
          content: 'BTCUSDTのエントリー提案をしてください',
        },
      ],
      {
        maxSteps: 5,
        toolChoice: 'required' as const,
      }
    );

    log('  ✅ Trading Agent実行成功', colors.green);
    
    // ツール使用の確認
    if ('steps' in directResult && directResult.steps) {
      for (const step of directResult.steps) {
        if (step.toolCalls) {
          for (const toolCall of step.toolCalls) {
            log(`  使用ツール: ${toolCall.toolName}`, colors.blue);
          }
        }
      }
    }
  } catch (error) {
    log(`  ❌ Trading Agent実行エラー: ${error}`, colors.red);
  }

  // 5. サマリー
  log('\n=== テスト完了 ===', colors.bright);
  log('\n推奨事項:', colors.yellow);
  log('1. エージェントの動的ツール選択が正しく機能しているか確認');
  log('2. A2A通信のプロンプト生成が適切か確認');
  log('3. proposalGroupの抽出ロジックが正しく動作しているか確認');
  log('4. エラーハンドリングが適切に行われているか確認\n');
}

// テスト実行
testEntryProposal()
  .then(() => {
    log('✅ すべてのテストが完了しました', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    log(`❌ テスト実行中にエラーが発生しました: ${error}`, colors.red);
    console.error(error);
    process.exit(1);
  });