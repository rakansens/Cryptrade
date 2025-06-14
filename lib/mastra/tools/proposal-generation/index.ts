/**
 * Proposal Generation Tool
 * 
 * チャート分析を行い、トレンドライン、サポート/レジスタンス、
 * フィボナッチ、パターンなどの描画提案を生成する
 * 
 * リファクタリング版：モジュール化により保守性と拡張性を向上
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { binanceAPI } from '@/lib/binance/api-service';
import type { PriceData as CandlestickData } from '@/types/market';

// Types and schemas
import { 
  ProposalGenerationInputSchema,
  ProposalGenerationOutputSchema,
  type ProposalGenerationInput,
  type ProposalGenerationOutput,
  type GeneratorParams,
  type ProposalGroup
} from './types';

// Generators
import { TrendlineGenerator } from './generators/trendline-generator';
import { SupportResistanceGenerator } from './generators/support-resistance-generator';
import { FibonacciGenerator } from './generators/fibonacci-generator';
import { PatternGenerator } from './generators/pattern-generator';

// Analyzers
import { analyzeMarketCondition, analyzeMultipleTimeframes } from './analyzers/market-analyzer';

// Constants
import { ANALYSIS_PARAMS, MESSAGE_TEMPLATES } from './utils/constants';

export const ProposalGenerationTool = createTool({
  id: 'proposal-generation',
  name: 'Proposal Generation',
  description: 'Analyzes charts and generates drawing proposals for trend lines, support/resistance, fibonacci levels, and patterns',
  inputSchema: ProposalGenerationInputSchema,
  outputSchema: ProposalGenerationOutputSchema,
  
  execute: async ({ context }): Promise<ProposalGenerationOutput> => {
    const input = context as ProposalGenerationInput;
    const startTime = Date.now();
    
    try {
      logger.info('[ProposalGeneration] Starting analysis', {
        symbol: input.symbol,
        interval: input.interval,
        analysisType: input.analysisType,
        maxProposals: input.maxProposals,
      });

      // 1. Binanceサービスからデータ取得
      let marketData: CandlestickData[];

      try {
        if (input.sinceTimestamp) {
          const endTime = Math.floor(Date.now() / 1000);
          marketData = await binanceAPI.fetchKlines(
            input.symbol,
            input.interval,
            ANALYSIS_PARAMS.MAX_KLINES,
            input.sinceTimestamp,
            endTime
          );
        } else {
          marketData = await binanceAPI.fetchKlines(
            input.symbol,
            input.interval,
            ANALYSIS_PARAMS.DEFAULT_KLINES
          );
        }
      } catch (error) {
        logger.error('[ProposalGeneration] Failed to fetch market data', { error });
        return {
          success: false,
          error: MESSAGE_TEMPLATES.ERROR.NO_DATA,
        };
      }

      if (!marketData || marketData.length < 50) {
        return {
          success: false,
          error: MESSAGE_TEMPLATES.ERROR.NO_DATA,
        };
      }

      // 2. 市場分析
      const marketCondition = analyzeMarketCondition(marketData);
      
      // 3. マルチタイムフレーム分析（オプション）
      const multiTimeframeAnalysis = await analyzeMultipleTimeframes(
        marketData,
        input.interval,
        async (interval) => {
          try {
            return await binanceAPI.fetchKlines(
              input.symbol,
              interval,
              100
            );
          } catch {
            return [];
          }
        }
      );

      // 4. ジェネレーターの準備
      const generators = [
        new TrendlineGenerator(),
        new SupportResistanceGenerator(),
        new FibonacciGenerator(),
        new PatternGenerator(),
      ];

      // 5. 分析タイプに応じたジェネレーターの選択
      const selectedGenerators = input.analysisType === 'all'
        ? generators
        : generators.filter(g => g.analysisType === input.analysisType);

      if (selectedGenerators.length === 0) {
        return {
          success: false,
          error: MESSAGE_TEMPLATES.ERROR.INVALID_PARAMS,
        };
      }

      // 6. 提案生成パラメータの準備
      const generatorParams: GeneratorParams = {
        symbol: input.symbol,
        interval: input.interval,
        maxProposals: input.maxProposals || 5,
        excludeIds: input.excludeIds,
        marketCondition,
        multiTimeframeAnalysis,
      };

      // 7. 各ジェネレーターで提案を生成
      const allProposals = await Promise.all(
        selectedGenerators.map(generator => 
          generator.generate(marketData, generatorParams)
            .catch(error => {
              logger.error(`[ProposalGeneration] ${generator.name} failed`, { 
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                generatorName: generator.name,
                analysisType: generator.analysisType,
              });
              return [];
            })
        )
      );

      // 8. 全提案を統合
      const proposals = allProposals.flat();

      // 9. 除外IDのフィルタリング
      const filteredProposals = input.excludeIds
        ? proposals.filter(p => !input.excludeIds!.includes(p.id))
        : proposals;

      // 10. 信頼度でソートし、上位を選択
      const topProposals = filteredProposals
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, input.maxProposals || 5);

      // 11. 提案グループの作成
      const proposalGroup: ProposalGroup = {
        id: `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: generateGroupTitle(input.analysisType, input.symbol),
        description: generateGroupDescription(
          topProposals.length,
          marketCondition,
          input.interval
        ),
        status: 'pending',
        createdAt: Date.now(),
        proposals: topProposals,
      };

      const executionTime = Date.now() - startTime;
      
      logger.info('[ProposalGeneration] Analysis completed', {
        proposalCount: topProposals.length,
        executionTime,
        marketCondition: marketCondition.type,
        averageConfidence: topProposals.reduce((sum, p) => sum + p.confidence, 0) / topProposals.length,
      });

      return {
        success: true,
        proposalGroup,
      };

    } catch (error) {
      logger.error('[ProposalGeneration] Unexpected error', { error });
      return {
        success: false,
        error: MESSAGE_TEMPLATES.ERROR.GENERATION_FAILED,
      };
    }
  },
});

/**
 * グループタイトルの生成
 */
function generateGroupTitle(analysisType: string, symbol: string): string {
  const typeMap: Record<string, string> = {
    trendline: 'トレンドライン',
    'support-resistance': 'サポート/レジスタンス',
    fibonacci: 'フィボナッチ',
    pattern: 'パターン',
    all: '総合',
  };

  return `${symbol} ${typeMap[analysisType] || analysisType}分析`;
}

/**
 * グループ説明の生成
 */
function generateGroupDescription(
  proposalCount: number,
  marketCondition: { type?: string },
  interval: string
): string {
  const conditionMap: Record<string, string> = {
    trending: 'トレンド相場',
    ranging: 'レンジ相場',
    volatile: 'ボラティリティの高い相場',
  };

  const condition = conditionMap[marketCondition.type] || '通常の相場';
  let description = `${interval}チャートの分析により、${proposalCount}個の描画提案を生成しました。`;
  description += `現在の市場は${condition}と判定されています。`;

  if (marketCondition.direction) {
    description += `${marketCondition.direction === 'bullish' ? '上昇' : '下降'}傾向が見られます。`;
  }

  return description;
}

// Re-export types for external use
export type { ProposalGenerationInput, ProposalGenerationOutput, ProposalGroup };
export { ProposalGenerationInputSchema, ProposalGenerationOutputSchema };