/**
 * Trading Agent with Enhanced Error Handling
 * 
 * Example of using error tracking in agents
 */

import { createAgent } from '@mastra/core';
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

export const tradingAgentWithErrors = createAgent({
  name: 'trading-agent-with-errors',
  description: 'Trading agent with comprehensive error handling',
  inputSchema: tradingAgentSchema,
  
  // モデルに応じたツール選択
  tools: ({ model }) => {
    switch (model) {
      case 'o1-preview':
        return [marketDataToolForO1];
      default:
        return [marketDataToolForOpenAI];
    }
  },
  
  // エラーハンドリング付き実行
  async execute({ query, symbol, model }) {
    const sessionId = `agent-session-${Date.now()}`;
    
    try {
      logger.info('[TradingAgent] Starting analysis', {
        query,
        symbol,
        model,
        sessionId,
      });

      // マーケットデータ取得
      const marketData = await this.tools.enhancedMarketData({
        symbol,
        interval: '1h',
      }).catch(error => {
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
            retryable: error.retryable || false,
          }
        );
        
        trackException(agentError);
        throw agentError;
      });

      // 分析実行
      const analysis = await this.analyzeMarket(marketData, query);
      
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

    } catch (error) {
      // エージェントレベルのエラーハンドリング
      if (error instanceof AgentError) {
        // 既知のエラーはそのまま再スロー
        throw error;
      }

      // 未知のエラーをトラッキング
      const unexpectedError = new AgentError(
        `Unexpected error in trading agent: ${error.message}`,
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
        errorType: error.constructor.name,
        stack: error.stack,
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
  },

  // 分析ロジック
  async analyzeMarket(marketData: MarketAnalysisData, query: string) {
    try {
      // 価格トレンド分析
      const prices = marketData.klines.map(k => k.close);
      const trend = this.calculateTrend(prices);
      
      // ボラティリティ計算
      const volatility = this.calculateVolatility(prices);
      
      // 推奨事項生成
      const recommendations = this.generateRecommendations(
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
      
    } catch (error) {
      // 分析エラーをトラッキング
      trackException(error, {
        method: 'analyzeMarket',
        agent: 'trading-agent-with-errors',
      });
      
      throw error;
    }
  },

  // トレンド計算
  calculateTrend(prices: number[]): string {
    if (prices.length < 2) return 'neutral';
    
    const recentPrices = prices.slice(-10);
    const avgRecent = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const avgPrevious = prices.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    
    const change = ((avgRecent - avgPrevious) / avgPrevious) * 100;
    
    if (change > 2) return 'bullish';
    if (change < -2) return 'bearish';
    return 'neutral';
  },

  // ボラティリティ計算
  calculateVolatility(prices: number[]): string {
    const returns = prices.slice(1).map((price, i) => 
      ((price - prices[i]) / prices[i]) * 100
    );
    
    const variance = returns.reduce((sum, ret) => {
      const diff = ret - (returns.reduce((a, b) => a + b, 0) / returns.length);
      return sum + diff * diff;
    }, 0) / returns.length;
    
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 5) return 'high';
    if (stdDev > 2) return 'medium';
    return 'low';
  },

  // 推奨事項生成
  generateRecommendations(
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
  },
});