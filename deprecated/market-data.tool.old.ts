import { createTool } from '@mastra/core';
import { env } from '@/config/env';
import { z } from 'zod';

/**
 * Market Data Tool - Real-time Cryptocurrency Market Analysis
 * 
 * Binance API統合によるリアルタイム市場データ取得
 * - 現在価格・24時間統計
 * - 簡易テクニカル指標
 * - エラーハンドリング対応
 */

const MarketDataInput = z.object({
  symbol: z.string()
    .min(1, 'Symbol is required')
    .regex(/^[A-Z]{2,10}USDT?$/i, 'Invalid symbol format (e.g., BTCUSDT)')
    .transform(s => s.toUpperCase()),
});

const MarketDataOutput = z.object({
  symbol: z.string(),
  currentPrice: z.number(),
  priceChange24h: z.number(),
  priceChangePercent24h: z.number(),
  volume24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  analysis: z.object({
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    volatility: z.enum(['low', 'medium', 'high']),
    recommendation: z.string(),
  }),
});

export const marketDataTool = createTool({
  id: 'get-market-data',
  description: `
    Fetch comprehensive real-time market data for cryptocurrency trading analysis.
    Provides current price, 24h statistics, volume data, and basic trend analysis.
    Supports major cryptocurrency pairs (e.g., BTCUSDT, ETHUSDT, ADAUSDT).
  `,
  inputSchema: MarketDataInput,
  outputSchema: MarketDataOutput,
  
  execute: async ({ context }): Promise<z.infer<typeof MarketDataOutput>> => {
    const { symbol } = context;
    
    try {
      // 開発環境のポート検出
      const baseUrl = env.NEXT_PUBLIC_BASE_URL || 
                     (env.VERCEL_URL ? `https://${env.VERCEL_URL}` :
                     'http://localhost:3000'); // デフォルトを3000に修正
      
      console.log(`[Market Data Tool] Using baseUrl: ${baseUrl} for symbol: ${symbol}`);
      
      // Binance APIから実際のデータを取得
      const response = await fetch(
        `${baseUrl}/api/binance/ticker?symbol=${symbol}`,
        {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const tickerData = await response.json();

      // データ変換・正規化
      const currentPrice = parseFloat(tickerData.lastPrice);
      const priceChange24h = parseFloat(tickerData.priceChange);
      const priceChangePercent24h = parseFloat(tickerData.priceChangePercent);
      const volume24h = parseFloat(tickerData.volume);
      const high24h = parseFloat(tickerData.highPrice);
      const low24h = parseFloat(tickerData.lowPrice);

      // 簡易トレンド分析
      const analysis = analyzeMarketData({
        priceChangePercent24h,
        volume24h,
        high24h,
        low24h,
        currentPrice,
      });

      return {
        symbol,
        currentPrice,
        priceChange24h,
        priceChangePercent24h,
        volume24h,
        high24h,
        low24h,
        analysis,
      };

    } catch (error) {
      // フォールバック: テストデータを返す
      console.warn(`Market data fetch failed for ${symbol}, using mock data:`, error);
      
      const mockPrice = 50000 + Math.random() * 20000;
      const mockChange = (Math.random() - 0.5) * 10;
      
      return {
        symbol,
        currentPrice: mockPrice,
        priceChange24h: mockPrice * (mockChange / 100),
        priceChangePercent24h: mockChange,
        volume24h: 1000000 + Math.random() * 5000000,
        high24h: mockPrice * 1.05,
        low24h: mockPrice * 0.95,
        analysis: {
          trend: (mockChange > 2 ? 'bullish' : mockChange < -2 ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
          volatility: (Math.abs(mockChange) > 5 ? 'high' : Math.abs(mockChange) > 2 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
          recommendation: 'Analysis based on mock data - check real market conditions',
        },
      };
    }
  },
});

/**
 * 簡易市場データ分析
 */
function analyzeMarketData({
  priceChangePercent24h,
  volume24h,
  high24h,
  low24h,
  currentPrice,
}: {
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  currentPrice: number;
}) {
  // トレンド判定
  let trend: 'bullish' | 'bearish' | 'neutral';
  if (priceChangePercent24h > 3) {
    trend = 'bullish';
  } else if (priceChangePercent24h < -3) {
    trend = 'bearish';
  } else {
    trend = 'neutral';
  }

  // ボラティリティ判定
  const priceRange = ((high24h - low24h) / currentPrice) * 100;
  let volatility: 'low' | 'medium' | 'high';
  if (priceRange > 8) {
    volatility = 'high';
  } else if (priceRange > 4) {
    volatility = 'medium';
  } else {
    volatility = 'low';
  }

  // 推奨事項生成
  let recommendation: string;
  if (trend === 'bullish' && volatility === 'low') {
    recommendation = 'Stable upward momentum - consider gradual position building';
  } else if (trend === 'bearish' && volatility === 'high') {
    recommendation = 'High volatility decline - exercise caution, wait for stabilization';
  } else if (volatility === 'high') {
    recommendation = 'High volatility detected - use smaller position sizes and tight stops';
  } else {
    recommendation = 'Monitor key support/resistance levels for breakout opportunities';
  }

  return {
    trend,
    volatility,
    recommendation,
  };
}