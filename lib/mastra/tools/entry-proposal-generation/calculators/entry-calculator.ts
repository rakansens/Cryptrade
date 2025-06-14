/**
 * Entry Point Calculator
 * 
 * 様々な分析結果から具体的なエントリーポイントを計算
 */

import type { PriceData } from '@/types/market';
import type { MarketContext, TradingDirection, TradingStrategyType, EntryReasoning } from '@/types/trading';
import { logger } from '@/lib/utils/logger';

export interface EntryPoint {
  price: number;
  zone?: {
    min: number;
    max: number;
  };
  direction: TradingDirection;
  strategy: TradingStrategyType;
  confidence: number;
  reasoning: EntryReasoning;
  relatedPatterns?: string[];
  relatedDrawings?: string[];
}

interface Pattern {
  id: string;
  type: string;
  confidence: number;
  trading_implication: 'bullish' | 'bearish' | 'neutral';
  metrics?: {
    breakout_level?: number;
  };
  startTime: number;
  endTime: number;
}

interface SupportResistanceLevel {
  id: string;
  type: 'support' | 'resistance';
  price?: number;
  value?: number;
  touchPoints?: Array<{ time: number; price: number }>;
}

interface Trendline {
  id: string;
  direction?: '上昇' | '下降';
  slope?: number;
  confidence: number;
  points: Array<{ time: number; value: number }>;
  touchPoints?: Array<{ time: number; price: number }>;
}

interface IndicatorData {
  rsi?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  ma?: {
    short: number;
    long: number;
  };
}

interface CalculateEntryPointsInput {
  marketData: PriceData[];
  analysisResults?: {
    patterns?: Pattern[];
    supportResistance?: SupportResistanceLevel[];
    trendlines?: Trendline[];
    indicators?: IndicatorData;
  };
  marketContext: MarketContext;
  strategyPreference: string;
}

export async function calculateEntryPoints(
  input: CalculateEntryPointsInput
): Promise<EntryPoint[]> {
  const { marketData, analysisResults, marketContext, strategyPreference } = input;
  const currentPrice = marketData[marketData.length - 1].close;
  const entryPoints: EntryPoint[] = [];

  logger.debug('[EntryCalculator] Starting calculation', {
    currentPrice,
    trend: marketContext.trend,
    hasPatterns: !!analysisResults?.patterns?.length,
    hasSR: !!analysisResults?.supportResistance?.length,
  });

  // 1. パターンベースのエントリー
  if (analysisResults?.patterns && analysisResults.patterns.length > 0) {
    for (const pattern of analysisResults.patterns) {
      const patternEntries = calculatePatternBasedEntries(pattern, currentPrice, marketContext);
      entryPoints.push(...patternEntries);
    }
  }

  // 2. サポート/レジスタンスベースのエントリー
  if (analysisResults?.supportResistance && analysisResults.supportResistance.length > 0) {
    for (const level of analysisResults.supportResistance) {
      const srEntries = calculateSRBasedEntries(level, currentPrice, marketContext, marketData);
      entryPoints.push(...srEntries);
    }
  }

  // 3. トレンドラインベースのエントリー
  if (analysisResults?.trendlines && analysisResults.trendlines.length > 0) {
    for (const trendline of analysisResults.trendlines) {
      const trendEntries = calculateTrendlineBasedEntries(trendline, currentPrice, marketContext, marketData);
      entryPoints.push(...trendEntries);
    }
  }

  // 4. 戦略に基づくフィルタリング
  const filteredEntries = filterByStrategy(entryPoints, strategyPreference, marketContext);

  // 5. 信頼度でソート
  return filteredEntries.sort((a, b) => b.confidence - a.confidence);
}

/**
 * パターンベースのエントリーポイント計算
 */
function calculatePatternBasedEntries(
  pattern: Pattern,
  currentPrice: number,
  marketContext: MarketContext
): EntryPoint[] {
  const entries: EntryPoint[] = [];

  // パターンのブレイクアウトレベルが存在する場合
  if (pattern.metrics?.breakout_level) {
    const breakoutPrice = pattern.metrics.breakout_level;
    const priceDistance = Math.abs(currentPrice - breakoutPrice) / currentPrice;

    // ブレイクアウトが近い場合（5%以内）
    if (priceDistance < 0.05) {
      const direction: TradingDirection = pattern.trading_implication === 'bullish' ? 'long' : 'short';
      
      entries.push({
        price: breakoutPrice,
        zone: {
          min: breakoutPrice * 0.995,
          max: breakoutPrice * 1.005,
        },
        direction,
        strategy: determineStrategyFromPattern(pattern),
        confidence: pattern.confidence * 0.9, // パターンの信頼度を基準に
        reasoning: {
          primary: `${pattern.type}パターンのブレイクアウト`,
          technicalFactors: [
            {
              factor: 'patternBreakout',
              weight: 0.8,
              description: `${pattern.type}パターンの完成によるブレイクアウトシグナル`,
            },
            {
              factor: 'marketTrend',
              weight: 0.2,
              description: `市場トレンド（${marketContext.trend}）との整合性`,
            },
          ],
          risks: [
            'ブレイクアウトの失敗（フォルスブレイク）',
            'ボラティリティによる急激な価格変動',
          ],
        },
        relatedPatterns: [pattern.id],
      });
    }
  }

  return entries;
}

/**
 * サポート/レジスタンスベースのエントリーポイント計算
 */
function calculateSRBasedEntries(
  level: SupportResistanceLevel,
  currentPrice: number,
  marketContext: MarketContext,
  marketData: PriceData[]
): EntryPoint[] {
  const entries: EntryPoint[] = [];
  const levelPrice = level.price || level.value;
  const priceDistance = Math.abs(currentPrice - levelPrice) / currentPrice;

  // レベルに近い場合（3%以内）
  if (priceDistance < 0.03) {
    // バウンストレード
    if (level.type === 'support' && currentPrice > levelPrice) {
      entries.push({
        price: levelPrice * 1.002, // サポートの少し上
        zone: {
          min: levelPrice,
          max: levelPrice * 1.005,
        },
        direction: 'long',
        strategy: 'swingTrading',
        confidence: calculateSRConfidence(level, marketContext, 'bounce'),
        reasoning: {
          primary: 'サポートラインからの反発',
          technicalFactors: [
            {
              factor: 'supportBounce',
              weight: 0.7,
              description: `${level.touchPoints?.length || 0}回テストされたサポートからの反発`,
            },
            {
              factor: 'volumeConfirmation',
              weight: 0.3,
              description: 'ボリュームによる確認',
            },
          ],
          risks: [
            'サポートライン割れによる下落継続',
            '売り圧力の増加',
          ],
        },
        relatedDrawings: [level.id],
      });
    }

    // ブレイクアウトトレード
    if (level.type === 'resistance' && currentPrice < levelPrice) {
      entries.push({
        price: levelPrice * 1.002, // レジスタンスの少し上
        direction: 'long',
        strategy: 'dayTrading',
        confidence: calculateSRConfidence(level, marketContext, 'breakout'),
        reasoning: {
          primary: 'レジスタンスラインのブレイクアウト',
          technicalFactors: [
            {
              factor: 'resistanceBreak',
              weight: 0.6,
              description: `${level.touchPoints?.length || 0}回テストされたレジスタンスの突破`,
            },
            {
              factor: 'momentum',
              weight: 0.4,
              description: '上昇モメンタムの確認',
            },
          ],
          risks: [
            'フォルスブレイクによる戻り',
            '利益確定売りの発生',
          ],
        },
        relatedDrawings: [level.id],
      });
    }
  }

  return entries;
}

/**
 * トレンドラインベースのエントリーポイント計算
 */
function calculateTrendlineBasedEntries(
  trendline: Trendline,
  currentPrice: number,
  marketContext: MarketContext,
  marketData: PriceData[]
): EntryPoint[] {
  const entries: EntryPoint[] = [];
  
  // トレンドラインの現在価格を計算
  const currentTime = marketData[marketData.length - 1].time;
  const trendlinePrice = calculateTrendlinePrice(trendline, currentTime);
  
  if (!trendlinePrice) return entries;

  const priceDistance = Math.abs(currentPrice - trendlinePrice) / currentPrice;

  // トレンドラインに近い場合（2%以内）
  if (priceDistance < 0.02) {
    const isUptrend = trendline.direction === '上昇' || trendline.slope > 0;
    
    if (isUptrend && currentPrice > trendlinePrice) {
      entries.push({
        price: trendlinePrice * 1.001,
        zone: {
          min: trendlinePrice * 0.995,
          max: trendlinePrice * 1.005,
        },
        direction: 'long',
        strategy: 'swingTrading',
        confidence: trendline.confidence * 0.85,
        reasoning: {
          primary: '上昇トレンドラインからの反発',
          technicalFactors: [
            {
              factor: 'trendlineBounce',
              weight: 0.7,
              description: `${trendline.touchPoints?.length || 0}回確認されたトレンドラインからの反発`,
            },
            {
              factor: 'trendContinuation',
              weight: 0.3,
              description: 'トレンド継続の可能性',
            },
          ],
          risks: [
            'トレンドライン割れによるトレンド転換',
            '調整局面の長期化',
          ],
        },
        relatedDrawings: [trendline.id],
      });
    }
  }

  return entries;
}

/**
 * サポート/レジスタンスの信頼度計算
 */
function calculateSRConfidence(
  level: SupportResistanceLevel,
  marketContext: MarketContext,
  tradeType: 'bounce' | 'breakout'
): number {
  let confidence = 0.5;

  // タッチ回数による信頼度
  const touches = level.touchPoints?.length || 0;
  confidence += Math.min(touches * 0.05, 0.2);

  // 市場トレンドとの整合性
  if (tradeType === 'bounce' && level.type === 'support' && marketContext.trend === 'bullish') {
    confidence += 0.1;
  } else if (tradeType === 'breakout' && level.type === 'resistance' && marketContext.trend === 'bullish') {
    confidence += 0.15;
  }

  // ボラティリティによる調整
  if (marketContext.volatility === 'low') {
    confidence += 0.05;
  } else if (marketContext.volatility === 'high') {
    confidence -= 0.1;
  }

  return Math.min(Math.max(confidence, 0.3), 0.95);
}

/**
 * トレンドライン価格の計算
 */
function calculateTrendlinePrice(trendline: Trendline, currentTime: number): number | null {
  if (!trendline.points || trendline.points.length < 2) return null;

  const point1 = trendline.points[0];
  const point2 = trendline.points[1];
  
  // 線形補間で現在時刻の価格を計算
  const slope = (point2.value - point1.value) / (point2.time - point1.time);
  const price = point1.value + slope * (currentTime - point1.time);

  return price;
}

/**
 * パターンから戦略タイプを決定
 */
function determineStrategyFromPattern(pattern: Pattern): TradingStrategyType {
  const patternDuration = pattern.endTime - pattern.startTime;
  const hours = patternDuration / (60 * 60); // 秒単位から時間単位へ

  if (hours < 4) return 'scalping';
  if (hours < 24) return 'dayTrading';
  if (hours < 168) return 'swingTrading'; // 1週間
  return 'position';
}

/**
 * 戦略に基づくフィルタリング
 */
function filterByStrategy(
  entries: EntryPoint[],
  strategyPreference: string,
  marketContext: MarketContext
): EntryPoint[] {
  if (strategyPreference === 'auto') {
    // 市場状況に基づいて最適な戦略を選択
    if (marketContext.volatility === 'high') {
      // 高ボラティリティ時は短期戦略を優先
      return entries.filter(e => 
        e.strategy === 'scalping' || e.strategy === 'dayTrading'
      );
    } else if (marketContext.trend !== 'neutral') {
      // トレンドがある場合はスイングトレードを優先
      return entries.filter(e => 
        e.strategy === 'swingTrading' || e.strategy === 'position'
      );
    }
    return entries;
  }

  // 特定の戦略が指定されている場合
  return entries.filter(e => e.strategy === strategyPreference);
}