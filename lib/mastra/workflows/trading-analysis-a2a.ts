import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { tradingAgent } from '../agents/trading.agent';
import { agentNetwork } from '../network/agent-network';

/**
 * Trading Analysis via A2A Communication
 * 
 * 既存のA2A通信を維持しつつ、改善されたエラーハンドリングとデータ共有を実装
 */

// Input/Output schemas
export const TradingAnalysisInput = z.object({
  userQuery: z.string().min(1, 'User query is required'),
  symbol: z.string().optional().default('BTCUSDT'),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
  sessionId: z.string().optional(),
  userIntent: z.string().optional(),
});

export const TradingAnalysisOutput = z.object({
  analysis: z.string(),
  marketData: z.object({
    symbol: z.string(),
    currentPrice: z.number(),
    priceChangePercent24h: z.number(),
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    volatility: z.enum(['low', 'medium', 'high']),
  }).nullable(),
  recommendations: z.array(z.string()),
  riskAssessment: z.object({
    level: z.enum(['low', 'medium', 'high']),
    factors: z.array(z.string()),
  }),
  executionTime: z.number(),
  stepsCompleted: z.array(z.string()),
});

/**
 * Execute trading analysis using improved A2A communication with VNext patterns
 */
export async function executeTradingAnalysisA2A(
  input: z.infer<typeof TradingAnalysisInput>
): Promise<z.infer<typeof TradingAnalysisOutput>> {
  const startTime = Date.now();
  const correlationId = `trading-analysis-${Date.now()}`;

  logger.info('[Trading Analysis A2A] Starting analysis', {
    symbol: input.symbol,
    analysisDepth: input.analysisDepth,
    correlationId,
  });

  // RuntimeContext pattern - データ共有用
  interface RuntimeContextData {
    marketData?: {
      symbol: string;
      currentPrice: number;
      priceChangePercent24h: number;
      trend: 'bullish' | 'bearish' | 'neutral';
      volatility: 'low' | 'medium' | 'high';
    };
    technicalAnalysis?: {
      response?: string;
      analysis?: string;
      recommendations?: string[];
      riskAssessment?: {
        level: 'low' | 'medium' | 'high';
        factors: string[];
      };
    };
  }
  const runtimeContext = new Map<keyof RuntimeContextData, RuntimeContextData[keyof RuntimeContextData]>();

  try {
    // Step 1: マーケットデータ取得 (VNextパターン)
    logger.info('[Trading Analysis A2A] Step 1: Fetching market data', {
      symbol: input.symbol,
      correlationId,
    });

    let marketData = null;
    try {
      // A2A通信でマーケットデータエージェントを呼び出し
      const marketResponse = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'marketDataAgent',
        'fetch_data',
        { symbol: input.symbol },
        correlationId
      );

      if (marketResponse && marketResponse.type !== 'error') {
        marketData = marketResponse.result;
        runtimeContext.set('marketData', marketData);
      }
    } catch (error) {
      logger.warn('[Trading Analysis A2A] Market data fetch failed, continuing', {
        error: String(error),
        correlationId,
      });
      // エラーでも続行（VNextパターン）
    }
    // Step 2: テクニカル分析 (VNextパターン)
    logger.info('[Trading Analysis A2A] Step 2: Technical analysis', {
      symbol: input.symbol,
      analysisDepth: input.analysisDepth,
      correlationId,
      hasMarketData: !!marketData,
    });

    let technicalAnalysis = null;
    try {
      // Trading Agentを直接呼び出し（動的コンテキスト付き）
      const analysisResponse = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'analyze_trading',
        {
          query: input.userQuery,
          symbol: input.symbol,
          analysisDepth: input.analysisDepth,
          sessionId: input.sessionId,
          userIntent: input.userIntent,
          // 動的コンテキスト
          marketVolatility: marketData?.volatility || 'normal',
          userLevel: 'intermediate',
        },
        correlationId
      );

      if (analysisResponse && analysisResponse.type !== 'error') {
        technicalAnalysis = analysisResponse.result;
        runtimeContext.set('technicalAnalysis', technicalAnalysis);
      }
    } catch (error) {
      logger.warn('[Trading Analysis A2A] Technical analysis failed, continuing', {
        error: String(error),
        correlationId,
      });
    }

    // Step 3: 推奨事項生成 (VNextパターン)
    logger.info('[Trading Analysis A2A] Step 3: Generating recommendations', {
      correlationId,
      hasData: !!(marketData || technicalAnalysis),
    });

    // 最終的な分析結果を生成
    const analysisResult = technicalAnalysis || marketData || {};
    
    // デフォルト値を準備
    const defaultOutput: z.infer<typeof TradingAnalysisOutput> = {
      analysis: analysisResult.response || analysisResult.analysis || `Trading analysis for ${input.symbol} completed.`,
      marketData: marketData,
      recommendations: extractRecommendations(analysisResult),
      riskAssessment: assessRisk(marketData, analysisResult),
      executionTime: Date.now() - startTime,
      stepsCompleted: ['market_data', 'technical_analysis', 'recommendations'],
    };

    logger.info('[Trading Analysis A2A] Analysis completed', {
      correlationId,
      executionTime: defaultOutput.executionTime,
      hasMarketData: !!defaultOutput.marketData,
      recommendationsCount: defaultOutput.recommendations.length,
    });

    return defaultOutput;

  } catch (error) {
    logger.error('[Trading Analysis A2A] Analysis failed', {
      correlationId,
      error: String(error),
    });

    // エラー時のフォールバック
    return {
      analysis: `Analysis failed: ${String(error)}`,
      marketData: null,
      recommendations: ['Unable to provide recommendations at this time'],
      riskAssessment: {
        level: 'high',
        factors: ['System error', 'Analysis unavailable'],
      },
      executionTime: Date.now() - startTime,
      stepsCompleted: ['error'],
    };
  }
}

// ヘルパー関数
interface AnalysisResult {
  response?: string;
  analysis?: string;
  recommendations?: string[];
}

function extractRecommendations(analysisResult: AnalysisResult): string[] {
  const recommendations: string[] = [];
  
  // 直接推奨事項が含まれている場合
  if (analysisResult?.recommendations && Array.isArray(analysisResult.recommendations)) {
    return analysisResult.recommendations.slice(0, 5);
  }
  
  // テキストから抽出
  const text = analysisResult?.response || analysisResult?.analysis || '';
  const patterns = [
    /推奨事項[:：]\s*(.+)/g,
    /Recommendation[:：]\s*(.+)/g,
    /[•·]\s*(.+)/g,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        recommendations.push(match[1].trim());
      }
    }
  }
  
  return recommendations.slice(0, 5);
}

interface MarketData {
  volatility?: 'low' | 'medium' | 'high';
  priceChangePercent24h?: number;
}

interface AnalysisResultWithRisk {
  riskAssessment?: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

function assessRisk(
  marketData: MarketData | null,
  analysisResult: AnalysisResultWithRisk
): { level: 'low' | 'medium' | 'high'; factors: string[] } {
  const factors: string[] = [];
  let riskScore = 0;
  
  // 既存のリスク評価がある場合はそれを使用
  if (analysisResult?.riskAssessment) {
    return analysisResult.riskAssessment;
  }
  
  // ボラティリティチェック
  if (marketData?.volatility === 'high') {
    factors.push('High market volatility');
    riskScore += 2;
  }
  
  // 価格変動チェック
  if (Math.abs(marketData?.priceChangePercent24h || 0) > 10) {
    factors.push('Significant price movement (>10%)');
    riskScore += 1;
  }
  
  // リスクレベル判定
  const level = riskScore >= 3 ? 'high' : riskScore >= 1 ? 'medium' : 'low';
  
  return { level, factors };
}

/**
 * Legacy compatibility wrapper
 * 古いrunTradingAnalysis関数との互換性のため
 */
export const runTradingAnalysis = executeTradingAnalysisA2A;