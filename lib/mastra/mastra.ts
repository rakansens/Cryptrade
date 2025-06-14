import { executeTradingAnalysisA2A } from './workflows/trading-analysis-a2a';
import mastraEnhanced, { getTelemetryStatus } from './mastra-config';

/**
 * Cryptrade Mastra Instance - TypeScript AI Trading Framework
 * 
 * 統合されたマルチエージェント取引システム
 * - 型安全なエージェント・ツール管理
 * - Agent-to-Agent (A2A)通信ベースの分析処理
 * - 拡張可能なアーキテクチャ
 * - 本番対応のエラーハンドリング
 * - 設定可能なテレメトリーサンプリング
 */

// Re-export the enhanced Mastra instance
export const mastra = mastraEnhanced;

/**
 * トレーディングエージェント取得
 */
export async function getTradingAgent() {
  return mastra.getAgent('tradingAgent');
}

/**
 * トレーディング分析ワークフロー取得
 * @deprecated Use runTradingAnalysis with A2A communication instead
 */
export function getTradingAnalysisWorkflow() {
  return mastra.getWorkflow('tradingAnalysis');
}

/**
 * トレーディング分析実行 (A2A通信ベース)
 * 
 * 古いWorkflowパターンをA2A通信で置き換え
 * Orchestrator → TradingAnalysisAgent のA2A通信を使用
 */
export async function runTradingAnalysis(input: {
  userQuery: string;
  symbol?: string;
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  sessionId?: string;
  userIntent?: string;
}) {
  // A2A通信を使用した新しい実装
  const normalizedInput = {
    userQuery: input.userQuery,
    symbol: input.symbol || 'BTCUSDT',
    analysisDepth: input.analysisDepth || 'detailed' as const,
    sessionId: input.sessionId,
    userIntent: input.userIntent,
  };
  return await executeTradingAnalysisA2A(normalizedInput);
}

/**
 * Mastra統計情報
 */
export function getMastraStats() {
  const agentNames = ['tradingAgent', 'priceInquiryAgent', 'uiControlAgent', 'orchestratorAgent'];
  const tradingAgent = mastra.getAgent('tradingAgent');
  
  return {
    agents: agentNames,
    workflows: ['tradingAnalysis'],
    tools: Object.keys(tradingAgent?.tools || {}),
    uptime: Date.now(),
    telemetry: getTelemetryStatus(),
  };
}

export default mastra;