/**
 * Entry Proposal Generation Tool
 * 
 * トレードエントリーポイントの提案を生成する
 * チャート分析結果、パターン、テクニカル指標を基に
 * 具体的なエントリー価格、ストップロス、テイクプロフィットを算出
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { binanceAPI } from '@/lib/binance/api-service';
import { uiEventDispatcher } from '@/lib/utils/ui-event-dispatcher';
import type { PriceData as CandlestickData } from '@/types/market';
import type { 
  EntryProposal, 
  EntryProposalGroup,
  MarketContext,
  RiskParameters,
  EntryConditions,
  EntryReasoning,
  calculatePositionSize,
  calculateRiskReward
} from '@/types/trading';

// Import calculators
import { calculateEntryPoints } from './calculators/entry-calculator';
import { calculateRiskManagement } from './calculators/risk-calculator';
import { analyzeMarketContext } from './analyzers/market-context-analyzer';
import { evaluateEntryConditions } from './analyzers/condition-evaluator';

// Input schema
export const EntryProposalGenerationInputSchema = z.object({
  symbol: z.string().describe('Trading symbol (e.g., BTCUSDT)'),
  interval: z.string().describe('Time interval (e.g., 1h, 4h)'),
  analysisResults: z.object({
    patterns: z.array(z.unknown()).optional(),
    supportResistance: z.array(z.unknown()).optional(),
    trendlines: z.array(z.unknown()).optional(),
    indicators: z.unknown().optional(),
  }).optional().describe('Previous analysis results to base entries on'),
  strategyPreference: z.enum(['scalping', 'dayTrading', 'swingTrading', 'position', 'auto']).default('auto'),
  riskPercentage: z.number().min(0.1).max(5).default(1).describe('Risk per trade as % of account'),
  maxProposals: z.number().min(1).max(10).default(3),
});

export type EntryProposalGenerationInput = z.infer<typeof EntryProposalGenerationInputSchema>;

// Output schema
export const EntryProposalGenerationOutputSchema = z.object({
  success: z.boolean(),
  proposalGroup: z.unknown().optional(), // EntryProposalGroup
  error: z.string().optional(),
});

export type EntryProposalGenerationOutput = z.infer<typeof EntryProposalGenerationOutputSchema>;

export const EntryProposalGenerationTool = createTool({
  id: 'entry-proposal-generation',
  name: 'Entry Proposal Generation',
  description: 'Generates specific trade entry proposals with entry points, stop loss, and take profit levels',
  inputSchema: EntryProposalGenerationInputSchema,
  outputSchema: EntryProposalGenerationOutputSchema,
  
  execute: async ({ context }): Promise<EntryProposalGenerationOutput> => {
    const input = context as EntryProposalGenerationInput;
    const startTime = Date.now();
    
    try {
      logger.info('[EntryProposalGeneration] Starting analysis', {
        symbol: input.symbol,
        interval: input.interval,
        strategy: input.strategyPreference,
        risk: input.riskPercentage,
      });

      // 1. 市場データの取得
      let marketData: CandlestickData[];
      try {
        marketData = await binanceAPI.fetchKlines(
          input.symbol,
          input.interval,
          200 // より多くのデータでコンテキスト分析
        );
      } catch (error) {
        logger.error('[EntryProposalGeneration] Failed to fetch market data', { error });
        return {
          success: false,
          error: '市場データの取得に失敗しました',
        };
      }

      if (!marketData || marketData.length < 50) {
        return {
          success: false,
          error: '十分な市場データがありません',
        };
      }

      // 2. 市場コンテキストの分析
      const marketContext = await analyzeMarketContext(marketData, input.symbol);
      
      // 3. エントリーポイントの計算
      const entryPoints = await calculateEntryPoints({
        marketData,
        analysisResults: input.analysisResults,
        marketContext,
        strategyPreference: input.strategyPreference,
      });

      if (entryPoints.length === 0) {
        return {
          success: false,
          error: '有効なエントリーポイントが見つかりませんでした',
        };
      }

      // 4. 各エントリーポイントに対してリスク管理パラメータを計算
      const proposals: EntryProposal[] = [];
      
      for (const entryPoint of entryPoints.slice(0, input.maxProposals)) {
        // リスク管理パラメータの計算
        const riskParams = await calculateRiskManagement({
          entryPrice: entryPoint.price,
          direction: entryPoint.direction,
          marketData,
          volatility: marketContext.volatility,
          strategy: entryPoint.strategy,
          riskPercentage: input.riskPercentage,
        });

        // エントリー条件の評価
        const conditions = await evaluateEntryConditions({
          entryPoint,
          marketContext,
          currentPrice: marketData[marketData.length - 1].close,
        });

        // 提案の作成
        const proposal: EntryProposal = {
          id: `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol: input.symbol,
          direction: entryPoint.direction,
          strategy: entryPoint.strategy,
          entryPrice: entryPoint.price,
          entryZone: entryPoint.zone,
          riskParameters: riskParams,
          conditions,
          marketContext,
          confidence: entryPoint.confidence,
          reasoning: entryPoint.reasoning,
          relatedPatterns: entryPoint.relatedPatterns,
          relatedDrawings: entryPoint.relatedDrawings,
          createdAt: Date.now(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24時間後
          priority: calculatePriority(entryPoint.confidence, riskParams.riskRewardRatio),
        };

        proposals.push(proposal);
      }

      // 5. 提案グループの作成
      const proposalGroup: EntryProposalGroup = {
        id: `epg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: generateGroupTitle(input.symbol, input.strategyPreference),
        description: generateGroupDescription(proposals, marketContext),
        proposals,
        summary: {
          bestEntry: proposals[0]?.id,
          averageConfidence: proposals.reduce((sum, p) => sum + p.confidence, 0) / proposals.length,
          marketBias: marketContext.trend,
        },
        createdAt: Date.now(),
        status: 'pending',
      };

      const executionTime = Date.now() - startTime;
      
      logger.info('[EntryProposalGeneration] Analysis completed', {
        proposalCount: proposals.length,
        executionTime,
        marketBias: marketContext.trend,
        averageConfidence: proposalGroup.summary.averageConfidence,
      });

      // Dispatch UI event for proposal generation
      uiEventDispatcher.dispatchProposalGenerated(proposalGroup);

      return {
        success: true,
        proposalGroup,
      };

    } catch (error) {
      logger.error('[EntryProposalGeneration] Unexpected error', { error });
      return {
        success: false,
        error: 'エントリー提案の生成中にエラーが発生しました',
      };
    }
  },
});

/**
 * 優先度の計算
 */
function calculatePriority(confidence: number, riskReward: number): 'high' | 'medium' | 'low' {
  const score = confidence * 0.6 + Math.min(riskReward / 3, 1) * 0.4;
  
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * グループタイトルの生成
 */
function generateGroupTitle(symbol: string, strategy: string): string {
  const strategyMap: Record<string, string> = {
    scalping: 'スキャルピング',
    dayTrading: 'デイトレード',
    swingTrading: 'スイングトレード',
    position: 'ポジショントレード',
    auto: '最適',
  };

  return `${symbol} ${strategyMap[strategy] || strategy}エントリー提案`;
}

/**
 * グループ説明の生成
 */
function generateGroupDescription(
  proposals: EntryProposal[],
  marketContext: MarketContext
): string {
  const longCount = proposals.filter(p => p.direction === 'long').length;
  const shortCount = proposals.filter(p => p.direction === 'short').length;
  
  let description = `${proposals.length}個のエントリー提案を生成しました。`;
  
  if (longCount > 0 && shortCount > 0) {
    description += `（ロング: ${longCount}個、ショート: ${shortCount}個）`;
  } else if (longCount > 0) {
    description += `（全てロングポジション）`;
  } else if (shortCount > 0) {
    description += `（全てショートポジション）`;
  }

  const volatilityMap = {
    low: '低ボラティリティ',
    normal: '通常のボラティリティ',
    high: '高ボラティリティ',
  };

  description += ` 現在の市場は${volatilityMap[marketContext.volatility]}で、`;
  
  const trendMap = {
    bullish: '上昇トレンド',
    bearish: '下降トレンド',
    neutral: 'レンジ相場',
  };

  description += `${trendMap[marketContext.trend]}を示しています。`;

  return description;
}

// Re-export for external use
export { EntryProposalGenerationTool as entryProposalGenerationTool };