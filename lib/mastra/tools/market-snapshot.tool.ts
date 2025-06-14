import { z } from 'zod';
import { createTool } from '@mastra/core';
import { logger } from '@/lib/utils/logger';

/**
 * Market Snapshot Tool - Quick Market Overview for Casual Conversations
 * 
 * 気軽な市場の話題に使える簡単な市場概要ツール
 * - トップゲイナー/ルーザー
 * - 市場全体のムード
 * - 注目の動き
 */

const MarketSnapshotInput = z.object({
  focus: z.enum(['general', 'gainers', 'losers', 'trending']).optional().default('general'),
  limit: z.number().optional().default(3),
});

const MarketSnapshotOutput = z.object({
  marketMood: z.enum(['bullish', 'bearish', 'neutral', 'volatile']),
  topGainers: z.array(z.object({
    symbol: z.string(),
    price: z.number(),
    change24h: z.number(),
  })),
  topLosers: z.array(z.object({
    symbol: z.string(),
    price: z.number(),
    change24h: z.number(),
  })),
  marketHighlight: z.string(),
  totalMarketCap: z.number().optional(),
  btcDominance: z.number().optional(),
});

export const marketSnapshotTool = createTool({
  id: 'market-snapshot',
  name: 'marketSnapshot',
  description: 'Get a quick market overview for casual conversation',
  inputSchema: MarketSnapshotInput,
  outputSchema: MarketSnapshotOutput,
  execute: async ({ focus, limit }) => {
    try {
      logger.info('[MarketSnapshot] Fetching market overview', { focus, limit });
      
      // Binance APIを使用して実際の市場データを取得
      try {
        const { marketDataResilientTool } = await import('./market-data-resilient.tool');
        
        // 主要通貨のデータを取得
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'MATICUSDT', 'XRPUSDT', 'ADAUSDT', 'DOTUSDT'];
        const marketData = await Promise.all(
          symbols.map(async (symbol) => {
            try {
              const result = await marketDataResilientTool.execute({ symbol });
              return {
                symbol: symbol.replace('USDT', ''),
                price: result.currentPrice,
                change24h: result.priceChangePercent24h,
              };
            } catch {
              return null;
            }
          })
        );
        
        const validData = marketData.filter(d => d !== null);
        const sorted = validData.sort((a, b) => b.change24h - a.change24h);
        
        const topGainers = sorted.filter(d => d.change24h > 0).slice(0, limit);
        const topLosers = sorted.filter(d => d.change24h < 0).slice(0, limit);
        
        // 市場ムードを判定
        const avgChange = validData.reduce((sum, d) => sum + d.change24h, 0) / validData.length;
        let marketMood: 'bullish' | 'bearish' | 'neutral' | 'volatile';
        if (avgChange > 3) marketMood = 'bullish';
        else if (avgChange < -3) marketMood = 'bearish';
        else if (Math.max(...validData.map(d => Math.abs(d.change24h))) > 10) marketMood = 'volatile';
        else marketMood = 'neutral';
        
        // マーケットハイライトを生成
        let marketHighlight = '';
        if (topGainers.length > 0) {
          marketHighlight = `${topGainers[0].symbol}が${topGainers[0].change24h.toFixed(1)}%上昇でトップ！`;
        }
        if (marketMood === 'bullish') {
          marketHighlight += ' 市場全体が上昇トレンドです。';
        } else if (marketMood === 'bearish') {
          marketHighlight += ' 市場は慎重な動きを見せています。';
        }
        
        return {
          marketMood,
          topGainers,
          topLosers,
          marketHighlight,
          totalMarketCap: 1.52e12, // TODO: 実際の時価総額を取得
          btcDominance: 48.5, // TODO: 実際のBTCドミナンスを取得
        };
      } catch (error) {
        logger.warn('[MarketSnapshot] Failed to fetch live data, using fallback', { error });
        // フォールバックデータ
        return {
          marketMood: 'neutral' as const,
          topGainers: [],
          topLosers: [],
          marketHighlight: '市場データの取得に一時的な問題が発生しています。',
          totalMarketCap: 0,
          btcDominance: 0,
        };
      }
    } catch (error) {
      logger.error('[MarketSnapshot] Failed to fetch market data', { error });
      throw new Error('市場データの取得に失敗しました');
    }
  },
});

/**
 * Trending Topics Tool - Get trending crypto topics
 * 
 * トレンドの暗号通貨トピックを取得
 */

const TrendingTopicsInput = z.object({
  category: z.enum(['news', 'social', 'technical']).optional().default('social'),
});

const TrendingTopicsOutput = z.object({
  topics: z.array(z.object({
    topic: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    volume: z.number(),
  })),
  summary: z.string(),
});

export const trendingTopicsTool = createTool({
  id: 'trending-topics',
  name: 'trendingTopics',
  description: 'Get trending cryptocurrency topics for conversation',
  inputSchema: TrendingTopicsInput,
  outputSchema: TrendingTopicsOutput,
  execute: async ({ category }) => {
    try {
      logger.info('[TrendingTopics] Fetching trending topics', { category });
      
      // モックデータ
      const mockTopics = {
        topics: [
          { topic: 'Bitcoin ETF承認期待', sentiment: 'positive' as const, volume: 8500 },
          { topic: 'イーサリアムアップグレード', sentiment: 'positive' as const, volume: 6200 },
          { topic: '規制強化の懸念', sentiment: 'negative' as const, volume: 4300 },
        ],
        summary: '今日はBitcoin ETFの話題で持ちきりです！市場は期待感で盛り上がっています。',
      };
      
      return mockTopics;
    } catch (error) {
      logger.error('[TrendingTopics] Failed to fetch topics', { error });
      throw new Error('トレンドトピックの取得に失敗しました');
    }
  },
});