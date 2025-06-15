/**
 * Trading Agent with Enhanced Error Handling
 * 
 * Example of using error tracking in agents
 */

import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AgentError } from '@/lib/errors/base-error';
import { trackAgentError, trackException } from '@/lib/errors/error-tracker';
import { logger } from '@/lib/utils/logger';
import { 
  marketDataToolForOpenAI,
  marketDataToolForO1 
} from '@/lib/tools/enhanced-market-data-with-errors';

// Define MarketAnalysisData interface
interface MarketAnalysisData {
  symbol: string;
  klines: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

// エージェント用スキーマ
const tradingAgentSchema = z.object({
  query: z.string(),
  symbol: z.string().optional().default('BTCUSDT'),
  model: z.enum(['gpt-4', 'o1-preview', 'claude-3']).optional().default('gpt-4'),
});

export const tradingAgentWithErrors = new Agent({
  name: 'trading-agent-with-errors',
  model: openai('gpt-4o'),
  instructions: 'You are a trading agent with comprehensive error handling. Analyze market data and provide insights.',
  
  // モデルに応じたツール選択
  tools: {
    marketDataOpenAI: marketDataToolForOpenAI as any,
    marketDataO1: marketDataToolForO1 as any
  } as any,
});

// Error handling wrapper function
export async function executeWithErrorHandling({ query, symbol, model }: { query: string; symbol: string; model: string }) {
    const sessionId = `agent-session-${Date.now()}`;
    
    try {
      logger.info('[TradingAgent] Starting analysis', {
        query,
        symbol,
        model,
        sessionId,
      });

      // マーケットデータ取得
      const toolToUse = model === 'o1-preview' ? marketDataToolForO1 : marketDataToolForOpenAI;
      const marketData = await toolToUse.execute({
        context: {
          symbol,
          interval: '1h',
          limit: 100
        }
      } as any).catch((error: Error) => {
        // ツールエラーの詳細なトラッキング
        const agentError = new AgentError(
          `Market data tool failed: ${error.message}`,
          'trading-agent-with-errors',
          {
            correlationId: sessionId,
            data: {
              tool: 'enhancedMarketData',
              input: { symbol, interval: '1h' },
            },
            context: {
              query,
              model,
            },
            severity: 'ERROR',
            retryable: error instanceof Error && 'retryable' in error ? (error as any).retryable : false,
          }
        );
        
        trackException(agentError);
        throw agentError;
      });

      // 分析実行
      const analysis = await analyzeMarket(marketData as MarketAnalysisData, query);
      
      logger.info('[TradingAgent] Analysis completed', {
        sessionId,
        symbol,
        hasRecommendations: analysis.recommendations.length > 0,
      });

      return {
        success: true,
        analysis,
        metadata: {
          sessionId,
          model,
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error: any) {
      // エージェントレベルのエラーハンドリング
      if (error instanceof AgentError) {
        // 既知のエラーはそのまま再スロー
        throw error;
      }

      // 未知のエラーをトラッキング
      const unexpectedError = new AgentError(
        `Unexpected error in trading agent: ${(error as Error).message}`,
        'trading-agent-with-errors',
        {
          correlationId: sessionId,
          data: {
            query,
            symbol,
            model,
          },
          severity: 'CRITICAL',
        }
      );
      
      trackAgentError(unexpectedError, 'trading-agent-with-errors', {
        sessionId,
        errorType: (error as Error).constructor.name,
        stack: (error as Error).stack,
      });
      
      // フォールバックレスポンス
      return {
        success: false,
        error: {
          message: 'Analysis failed. Please try again.',
          code: unexpectedError.code,
          retryable: true,
        },
        metadata: {
          sessionId,
          timestamp: new Date().toISOString(),
        },
      };
    }
}

// 分析ロジック関数
async function analyzeMarket(marketData: MarketAnalysisData, query: string) {
  try {
    // 価格トレンド分析
    const prices = marketData.klines.map(k => k.close);
    const trend = calculateTrend(prices);
    
    // ボラティリティ計算
    const volatility = calculateVolatility(prices);
    
    // 推奨事項生成
    const recommendations = generateRecommendations(
      trend,
      volatility,
      query
      );
      
      return {
        trend,
        volatility,
        recommendations,
        summary: `Based on the analysis of ${marketData.symbol}, the market shows ${trend} trend with ${volatility} volatility.`,
      };
      
    } catch (error: any) {
      // 分析エラーをトラッキング
      trackException(error as Error, {
        method: 'analyzeMarket',
        agent: 'trading-agent-with-errors',
      });
      
      throw error;
    }
}

// トレンド計算
function calculateTrend(prices: number[]): string {
    if (prices.length < 2) return 'neutral';
    
    const recentPrices = prices.slice(-10);
    const avgRecent = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const avgPrevious = prices.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    
    const change = ((avgRecent - avgPrevious) / avgPrevious) * 100;
    
    if (change > 2) return 'bullish';
    if (change < -2) return 'bearish';
    return 'neutral';
}

// ボラティリティ計算
function calculateVolatility(prices: number[]): string {
    const returns = prices.slice(1).map((price, i) => 
      ((price - prices[i]!) / prices[i]!) * 100
    );
    
    const variance = returns.reduce((sum, ret) => {
      const diff = ret - (returns.reduce((a, b) => a + b, 0) / returns.length);
      return sum + diff * diff;
    }, 0) / returns.length;
    
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 5) return 'high';
    if (stdDev > 2) return 'medium';
    return 'low';
}

// 推奨事項生成
function generateRecommendations(
  trend: string,
  volatility: string,
  query: string
): string[] {
    const recommendations: string[] = [];
    
    if (trend === 'bullish' && volatility === 'low') {
      recommendations.push('Consider long positions with tight stop losses');
      recommendations.push('Look for breakout opportunities');
    } else if (trend === 'bearish' && volatility === 'high') {
      recommendations.push('Avoid new positions until volatility decreases');
      recommendations.push('Consider hedging existing positions');
    } else {
      recommendations.push('Wait for clearer market signals');
      recommendations.push('Use smaller position sizes');
    }
    
    // クエリに基づく特定の推奨事項
    if (query.toLowerCase().includes('entry')) {
      recommendations.push('Set entry points based on support levels');
    }
    
    return recommendations;
}