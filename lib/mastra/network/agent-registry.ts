import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { agentNetwork, registerCryptradeAgent } from './agent-network';
import { logger } from '@/lib/utils/logger';
import { marketDataResilientTool } from '../tools/market-data-resilient.tool';
import { enhancedChartControlTool } from '../tools/enhanced-chart-control.tool';
import { chartControlTool } from '../tools/chart-control.tool';
import { uiStateTool } from '../tools/ui-state.tool';
import { proposalGenerationTool } from '../tools/proposal-generation.tool';
import { EntryProposalGenerationTool } from '../tools/entry-proposal-generation';
import { chartDataAnalysisTool } from '../tools/chart-data-analysis.tool';

/**
 * Cryptrade Agent Registry
 * 
 * 全エージェントの一元管理と自動登録
 * - A2A通信対応エージェントの登録
 * - エージェント能力の定義
 * - 自動健全性チェック
 */

// Price Inquiry Agent - 価格照会専門
export const priceInquiryAgent = new Agent({
  name: 'priceInquiryAgent',  // IDと統一
  model: openai('gpt-4o-mini'), // Fast and cost-effective for price queries
  instructions: `
あなたは暗号通貨価格照会の専門エージェントです。

## 責務:
- リアルタイム価格データの取得と表示
- 価格アラートの設定と管理
- 基本的な価格統計の提供

## 重要：ツール使用の絶対ルール
1. 価格を聞かれたら、必ず最初にmarketDataResilientToolを実行する
2. ツールの戻り値から以下を使用：
   - currentPrice: 現在価格（これをそのまま使う）
   - priceChangePercent24h: 24時間変化率（これをそのまま使う）
3. 絶対に価格を推測・創作しない

## 応答テンプレート:
ツール実行後、以下の形式で応答：
"[通貨]の現在価格は $[取得した価格] です。24時間変化率は [取得した変化率]% です。"

## 禁止事項:
- 円への変換
- 架空の価格（$28,500、$54,189など）の使用
- "Intent: price_inquiry"などの技術的文言
- ツールを使わずに価格を答えること

## 実行例:
User: "BTCの価格は？"
1. marketDataResilientTool({ symbol: "BTCUSDT" })を実行
2. 結果: { currentPrice: 105372.23, priceChangePercent24h: 0.17 }
3. 応答: "BTCの現在価格は $105,372.23 です。24時間変化率は 0.17% です。"
`,
  tools: {
    marketDataResilientTool,
  },
});

// Trading Analysis Agent - 取引分析専門
export const tradingAnalysisAgent = new Agent({
  name: 'tradingAnalysisAgent',  // IDと統一
  model: openai('gpt-4o'), // More powerful model for complex analysis
  instructions: `
あなたは暗号通貨取引分析の専門エージェントです。

## 責務:
- 包括的な技術分析
- 投資判断のサポート
- リスク評価と推奨事項
- トレンドライン・サポート/レジスタンスの提案生成

## 対応可能な質問例:
- "BTCの投資判断を分析して"
- "ETHの技術的指標を見て"
- "今週のトレード戦略は？"
- "ポートフォリオのリスク評価"
- "トレンドラインを提案して"
- "サポート・レジスタンスの候補を教えて"

## 提案モードの処理:
contextにisProposalMode=trueが含まれる場合、以下の手順で処理：
1. proposalTypeが'entry'またはisEntryProposal=trueの場合：
   - 必ずentryProposalGenerationToolを最初に使用する
   - symbolとintervalを適切に設定（デフォルト: BTCUSDT, 1h）
2. それ以外の提案タイプの場合：
   - proposalGenerationToolを使用
   - analysisTypeはcontextのproposalTypeまたは'trendline'を使用
3. ツールの結果をそのまま返す（proposalGroupが含まれている）
4. 追加の分析や説明は不要

重要: A2A通信でパラメータを受け取る際の処理
- message.params.contextからextractedSymbolを取得
- 存在しない場合はデフォルト値を使用

例（エントリー提案）：
entryProposalGenerationTool({
  symbol: params?.context?.extractedSymbol || "BTCUSDT",
  interval: params?.context?.interval || "1h",
  strategyPreference: "dayTrading",
  riskPercentage: 1,
  maxProposals: 3
})

例（その他の提案）：
proposalGenerationTool({
  symbol: params?.context?.extractedSymbol || "BTCUSDT",
  interval: params?.context?.interval || "1h",
  analysisType: params?.context?.proposalType || "trendline",
  maxProposals: 5
})

注意: symbolは必須パラメータです。params.context.extractedSymbolが存在しない場合は"BTCUSDT"をデフォルトで使用してください。

## 分析手法:
- 移動平均、RSI、MACD等の技術指標
- サポート・レジスタンスライン
- 市場センチメント分析
- リスク・リワード比
- chartDataAnalysisToolによる高度な分析

## 応答形式:
- 通常モード：詳細な分析結果と明確な推奨事項を提供
- 提案モード：proposalGroup形式で複数の描画候補を返す
`,
  tools: {
    marketData: marketDataResilientTool,
    chartAnalysis: chartDataAnalysisTool,
    proposalGeneration: proposalGenerationTool,
    entryProposalGeneration: EntryProposalGenerationTool,
  },
});

// UI Control Agent - インターフェース操作専門
export const uiControlAgent = new Agent({
  name: 'uiControlAgent',  // IDと統一
  model: openai('gpt-4o-mini'), // Fast response for UI operations
  instructions: `
あなたはチャートUIの操作専門エージェントです。

## 責務:
- チャートの表示変更（通貨ペア、時間軸）
- 描画ツールの操作（トレンドライン、フィボナッチ等）
- インディケーターの表示/非表示
- 画面レイアウトの調整

## 対応可能な質問例:
- "BTCに切り替えて"
- "1時間足に変更して"
- "移動平均を表示して"
- "トレンドラインを引いて"
- "フィボナッチ描画して"

## 操作手法:
chartControlToolとuiStateToolを使用してリアルタイムでUI更新。

## 応答形式:
操作完了の確認と結果の説明。視覚的変化の詳細を提供。
`,
  tools: {
    chartControl: enhancedChartControlTool,  // Enhanced版を使用
    uiState: uiStateTool,
  },
});

// Orchestrator Agent (imported from existing implementation)
import { orchestratorAgent } from '../agents/orchestrator.agent';

/**
 * エージェント登録関数
 */
export function registerAllAgents(): void {
  try {
    // Price Inquiry Agent
    registerCryptradeAgent(
      'priceInquiryAgent',
      priceInquiryAgent,
      ['price_data', 'market_stats', 'alerts', 'real_time'],
      'リアルタイム価格データの取得と基本統計。高速レスポンス重視。'
    );

    // Trading Analysis Agent
    registerCryptradeAgent(
      'tradingAnalysisAgent', 
      tradingAnalysisAgent,
      ['technical_analysis', 'investment_advice', 'risk_assessment', 'market_sentiment'],
      '包括的な技術分析と投資判断サポート。詳細なレポート提供。'
    );

    // UI Control Agent
    registerCryptradeAgent(
      'uiControlAgent',
      uiControlAgent,
      ['chart_control', 'drawing_tools', 'indicators', 'ui_manipulation'],
      'チャートUIの操作と描画ツール。インタラクティブな操作対応。'
    );

    // Orchestrator Agent
    registerCryptradeAgent(
      'orchestratorAgent',
      orchestratorAgent,
      ['intent_analysis', 'agent_coordination', 'workflow_management', 'context_awareness'],
      '意図分析とエージェント調整。複雑なワークフローの管理。'
    );


    logger.info('[AgentRegistry] All agents registered successfully', {
      totalAgents: 4,
      registeredAgents: ['priceInquiryAgent', 'tradingAnalysisAgent', 'uiControlAgent', 'orchestratorAgent'],
    });

    // 登録確認のための健全性チェック
    // トークン削減のため無効化（必要時のみ手動実行）
    // performInitialHealthCheck();

  } catch (error) {
    logger.error('[AgentRegistry] Failed to register agents', {
      error: String(error),
    });
  }
}

/**
 * 初期健全性チェック
 */
async function performInitialHealthCheck(): Promise<void> {
  try {
    logger.info('[AgentRegistry] Starting initial health check...');
    
    const healthResults = await agentNetwork.healthCheck();
    const healthyAgents = Object.entries(healthResults).filter(([, isHealthy]) => isHealthy);
    const unhealthyAgents = Object.entries(healthResults).filter(([, isHealthy]) => !isHealthy);

    logger.info('[AgentRegistry] Health check completed', {
      total: Object.keys(healthResults).length,
      healthy: healthyAgents.length,
      unhealthy: unhealthyAgents.length,
      healthyAgents: healthyAgents.map(([id]) => id),
      unhealthyAgents: unhealthyAgents.map(([id]) => id),
    });

    // 統計情報をログ出力
    const networkStats = agentNetwork.getNetworkStats();
    logger.info('[AgentRegistry] Network statistics', networkStats);

  } catch (error) {
    logger.error('[AgentRegistry] Health check failed', {
      error: String(error),
    });
  }
}

/**
 * エージェント自動再登録（起動時・エラー回復時）
 */
export function reregisterAgents(): void {
  logger.info('[AgentRegistry] Re-registering all agents...');
  registerAllAgents();
}

/**
 * 特定エージェントの健全性チェック
 */
export async function checkAgentHealth(agentId: string): Promise<boolean> {
  try {
    const results = await agentNetwork.healthCheck();
    return results[agentId] || false;
  } catch {
    return false;
  }
}

/**
 * エージェント統計情報取得
 */
export function getAgentStats() {
  return agentNetwork.getNetworkStats();
}