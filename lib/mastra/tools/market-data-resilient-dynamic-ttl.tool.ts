import { createTool } from '@mastra/core';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

/**
 * 動的TTLの実装案
 * 
 * 市場の状況やユーザーのニーズに応じてキャッシュTTLを動的に調整
 */

// ボラティリティに基づくTTL計算
export function calculateDynamicTTL(symbol: string, volatility: number): number {
  const BASE_TTL = 5000; // 5秒（最小値）
  const MAX_TTL = 30000; // 30秒（最大値）
  
  // 高ボラティリティ通貨は短いTTL
  const VOLATILITY_THRESHOLDS = {
    high: 5.0,    // 5%以上の変動
    medium: 2.0,  // 2-5%の変動
    low: 0.5,     // 0.5%未満の変動
  };
  
  // メジャー通貨は更新頻度が高いので短めのTTL
  const MAJOR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  const isMajorPair = MAJOR_PAIRS.includes(symbol);
  
  let ttl: number;
  
  if (volatility >= VOLATILITY_THRESHOLDS.high) {
    ttl = BASE_TTL; // 5秒
  } else if (volatility >= VOLATILITY_THRESHOLDS.medium) {
    ttl = isMajorPair ? 10000 : 15000; // 10-15秒
  } else {
    ttl = isMajorPair ? 20000 : MAX_TTL; // 20-30秒
  }
  
  logger.debug('[DynamicTTL] Calculated TTL', {
    symbol,
    volatility,
    ttl,
    category: volatility >= VOLATILITY_THRESHOLDS.high ? 'high' : 
               volatility >= VOLATILITY_THRESHOLDS.medium ? 'medium' : 'low',
  });
  
  return ttl;
}

// ユーザータイプに基づくTTL調整
export function adjustTTLForUserType(baseTTL: number, userType: string): number {
  const adjustments: Record<string, number> = {
    'high-frequency-trader': 0.3,  // 30%のTTL（より新鮮なデータ）
    'day-trader': 0.5,             // 50%のTTL
    'swing-trader': 1.0,           // 100%のTTL（デフォルト）
    'long-term-investor': 2.0,     // 200%のTTL（あまり新鮮さは不要）
  };
  
  const adjustment = adjustments[userType] || 1.0;
  return Math.min(Math.max(baseTTL * adjustment, 5000), 60000); // 5秒〜60秒の範囲
}

// 時間帯に基づくTTL調整（市場の活発さを考慮）
export function adjustTTLForMarketHours(baseTTL: number): number {
  const hour = new Date().getUTCHours();
  
  // アジア市場活発時間（UTC 0-8）
  const isAsianHours = hour >= 0 && hour < 8;
  // 欧州市場活発時間（UTC 8-16）
  const isEuropeanHours = hour >= 8 && hour < 16;
  // 米国市場活発時間（UTC 13-21）
  const isUSHours = hour >= 13 && hour < 21;
  
  // 複数市場が重なる時間は短いTTL
  if ((isEuropeanHours && isUSHours) || (isAsianHours && hour >= 6)) {
    return baseTTL * 0.7; // 30%短縮
  }
  
  // 週末は長めのTTL
  const dayOfWeek = new Date().getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return baseTTL * 1.5; // 50%延長
  }
  
  return baseTTL;
}

// 実装例：動的TTLを使用した価格取得
export const marketDataDynamicTTLExample = createTool({
  id: 'get-market-data-dynamic-ttl',
  name: 'marketDataDynamicTTL',
  description: 'Get market data with dynamic TTL based on volatility and user context',
  inputSchema: z.object({
    symbol: z.string(),
    userType: z.string().optional().default('swing-trader'),
  }),
  execute: async ({ context }) => {
    const { symbol, userType } = context;
    
    // 実際の実装では、前回の価格データから変動率を計算
    const mockVolatility = Math.random() * 10; // 0-10%のランダムな変動率
    
    // 動的TTLを計算
    let ttl = calculateDynamicTTL(symbol, mockVolatility);
    ttl = adjustTTLForUserType(ttl, userType);
    ttl = adjustTTLForMarketHours(ttl);
    
    logger.info('[MarketDataDynamicTTL] Using dynamic TTL', {
      symbol,
      userType,
      volatility: mockVolatility,
      finalTTL: ttl,
      ttlSeconds: (ttl / 1000).toFixed(1),
    });
    
    // ここで実際のデータ取得とキャッシュ処理を実装
    
    return {
      symbol,
      ttl,
      ttlSeconds: ttl / 1000,
      reasoning: `TTL set to ${(ttl / 1000).toFixed(1)}s based on volatility ${mockVolatility.toFixed(1)}% and user type ${userType}`,
    };
  },
});

// より詳細な実装案
export interface SmartCacheConfig {
  // リアルタイム性の要求レベル
  freshnessRequirement: 'critical' | 'high' | 'medium' | 'low';
  // ユーザーのトレードスタイル
  tradeStyle: 'scalping' | 'day-trading' | 'swing-trading' | 'investing';
  // 通貨ペアの特性
  pairCharacteristics: {
    isStableCoin: boolean;
    averageDailyVolume: number;
    recentVolatility: number;
  };
}

export function calculateSmartTTL(config: SmartCacheConfig): {
  ttl: number;
  explanation: string;
} {
  let baseTTL = 15000; // デフォルト15秒
  let explanation = '';
  
  // 1. リアルタイム性要求による調整
  const freshnessMultipliers = {
    critical: 0.2,   // 3秒
    high: 0.5,       // 7.5秒
    medium: 1.0,     // 15秒
    low: 2.0,        // 30秒
  };
  baseTTL *= freshnessMultipliers[config.freshnessRequirement];
  explanation += `Freshness: ${config.freshnessRequirement} (${freshnessMultipliers[config.freshnessRequirement]}x), `;
  
  // 2. トレードスタイルによる調整
  const styleMultipliers = {
    scalping: 0.3,        // 超短期
    'day-trading': 0.7,   // デイトレ
    'swing-trading': 1.2, // スイング
    investing: 3.0,       // 長期投資
  };
  baseTTL *= styleMultipliers[config.tradeStyle];
  explanation += `Style: ${config.tradeStyle} (${styleMultipliers[config.tradeStyle]}x), `;
  
  // 3. 通貨ペアの特性による調整
  if (config.pairCharacteristics.isStableCoin) {
    baseTTL *= 2.0; // ステーブルコインは変動が少ない
    explanation += 'StableCoin (2x), ';
  }
  
  if (config.pairCharacteristics.recentVolatility > 5) {
    baseTTL *= 0.5; // 高ボラティリティ時は短く
    explanation += 'HighVolatility (0.5x), ';
  }
  
  // 最終的な範囲制限
  const finalTTL = Math.min(Math.max(baseTTL, 2000), 60000); // 2秒〜60秒
  explanation += `Final: ${(finalTTL / 1000).toFixed(1)}s`;
  
  return { ttl: finalTTL, explanation };
}