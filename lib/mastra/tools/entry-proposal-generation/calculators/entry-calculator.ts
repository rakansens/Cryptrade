/**
 * Entry Point Calculator
 * 
 * 様々な分析結果から具体的なエントリーポイントを計算
 */

import type { PriceData } from '@/types/market';
import type { MarketContext, TradingDirection, TradingStrategyType, EntryReasoning } from '@/types/trading';
import { logger } from '@/lib/utils/logger';
import { isDevelopment } from '@/config/env';

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

export interface Pattern {
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

export interface SupportResistanceLevel {
  id: string;
  type: 'support' | 'resistance';
  price?: number;
  value?: number;
  touchPoints?: Array<{ time: number; price: number }>;
}

export interface Trendline {
  id: string;
  direction?: '上昇' | '下降';
  slope?: number;
  confidence: number;
  points: Array<{ time: number; value: number }>;
  touchPoints?: Array<{ time: number; price: number }>;
}

export interface IndicatorData {
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

export interface CalculateEntryPointsInput {
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
  
  // 空データチェック
  if (!marketData || marketData.length === 0) {
    logger.warn('[EntryCalculator] No market data provided');
    return [];
  }
  
  const lastCandle = marketData[marketData.length - 1];
  if (!lastCandle) {
    logger.warn('[EntryCalculator] No market data available');
    
    // マーケットデータがない場合は空配列を返す
    if (isDevelopment()) {
      return [];
    }
    
    throw new Error('No market data available for entry point calculation');
  }
  const currentPrice = lastCandle.close;
  const entryPoints: EntryPoint[] = [];


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

  // 4. マルチタイムフレーム分析による調整
  const adjustedEntries = adjustEntriesWithMultiTimeframe(entryPoints, marketContext);

  // 5. 戦略に基づくフィルタリング
  const filteredEntries = filterByStrategy(adjustedEntries, strategyPreference, marketContext);

  // 6. 信頼度の闾値以下を除外
  const confidenceFiltered = filteredEntries.filter(entry => entry.confidence >= 0.5);

  // 7. 信頼度でソート
  return confidenceFiltered.sort((a, b) => b.confidence - a.confidence);
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
      
      // ボラティリティに基づいたゾーンサイズ調整
      let zoneMultiplier = 0.005; // デフォルト: 0.5%
      if (marketContext.volatility === 'high') {
        zoneMultiplier = 0.01; // 高ボラティリティ: 1%
      } else if (marketContext.volatility === 'low') {
        zoneMultiplier = 0.003; // 低ボラティリティ: 0.3%
      }
      
      entries.push({
        price: breakoutPrice,
        zone: {
          min: breakoutPrice * (1 - zoneMultiplier),
          max: breakoutPrice * (1 + zoneMultiplier),
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
        relatedDrawings: [], // パターンには関連する描画がない場合は空配列
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
  _marketData: PriceData[]
): EntryPoint[] {
  const entries: EntryPoint[] = [];
  const levelPrice = level.price || level.value;
  if (!levelPrice) return entries;
  
  const priceDistance = Math.abs(currentPrice - levelPrice) / currentPrice;
  

  // レベルに近い場合（3%以内）
  if (priceDistance < 0.03) {
    // ボラティリティに基づいたゾーンサイズ調整
    let zoneMultiplier = 0.005; // デフォルト: 0.5%
    if (marketContext.volatility === 'high') {
      zoneMultiplier = 0.01; // 高ボラティリティ: 1%
    } else if (marketContext.volatility === 'low') {
      zoneMultiplier = 0.003; // 低ボラティリティ: 0.3%
    }

    // バウンストレード
    if (level.type === 'support' && currentPrice > levelPrice) {
      entries.push({
        price: levelPrice * 1.002, // サポートの少し上
        zone: {
          min: levelPrice * (1 - zoneMultiplier/2),
          max: levelPrice * (1 + zoneMultiplier),
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
        zone: {
          min: levelPrice,
          max: levelPrice * (1 + zoneMultiplier),
        },
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
  _marketContext: MarketContext,
  marketData: PriceData[]
): EntryPoint[] {
  const entries: EntryPoint[] = [];
  
  // トレンドラインの現在価格を計算
  const lastCandle = marketData[marketData.length - 1];
  if (!lastCandle) return entries;
  
  const currentTime = lastCandle.time;
  const trendlinePrice = calculateTrendlinePrice(trendline, currentTime);
  
  if (!trendlinePrice) return entries;

  const priceDistance = Math.abs(currentPrice - trendlinePrice) / currentPrice;
  

  // トレンドラインに近い場合（2%以内）
  if (priceDistance < 0.02) {
    const isUptrend = trendline.direction === '上昇' || (trendline.slope ?? 0) > 0;
    
    // ボラティリティに基づいたゾーンサイズ調整
    let zoneMultiplier = 0.005; // デフォルト: 0.5%
    if (_marketContext.volatility === 'high') {
      zoneMultiplier = 0.01; // 高ボラティリティ: 1%
    } else if (_marketContext.volatility === 'low') {
      zoneMultiplier = 0.003; // 低ボラティリティ: 0.3%
    }
    
    if (isUptrend && currentPrice > trendlinePrice) {
      entries.push({
        price: trendlinePrice * 1.001,
        zone: {
          min: trendlinePrice * (1 - zoneMultiplier),
          max: trendlinePrice * (1 + zoneMultiplier),
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
  
  if (!point1 || !point2) {
    return 0;
  }
  
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
 * マルチタイムフレーム分析による調整
 */
function adjustEntriesWithMultiTimeframe(
  entries: EntryPoint[],
  marketContext: MarketContext
): EntryPoint[] {
  if (!marketContext.multiTimeframeAnalysis) {
    return entries;
  }

  const { higherTimeframe, alignment, conflictingSignals } = marketContext.multiTimeframeAnalysis;

  return entries.map(entry => {
    let adjustedConfidence = entry.confidence;
    const technicalFactors = [...entry.reasoning.technicalFactors];
    const risks = [...entry.reasoning.risks];

    // アライメントがある場合、信頼度を向上
    if (alignment && 
        ((entry.direction === 'long' && higherTimeframe.trend === 'bullish') ||
         (entry.direction === 'short' && higherTimeframe.trend === 'bearish'))) {
      adjustedConfidence *= 1.2;
      technicalFactors.push({
        factor: 'multiTimeframeAlignment',
        weight: 0.15,
        description: `上位時間軸（${higherTimeframe.interval}）も同じ${
          higherTimeframe.trend === 'bullish' ? '上昇' : '下降'
        }トレンド（強度: ${(higherTimeframe.condition.strength * 100).toFixed(0)}%）`,
      });
    }

    // 矛盾するシグナルの場合、信頼度を低下
    if (conflictingSignals) {
      if ((entry.direction === 'long' && higherTimeframe.trend === 'bearish') ||
          (entry.direction === 'short' && higherTimeframe.trend === 'bullish')) {
        adjustedConfidence *= 0.7;
        risks.push(
          `上位時間軸（${higherTimeframe.interval}）は${
            higherTimeframe.trend === 'bullish' ? '上昇' : '下降'
          }トレンドで矛盾あり`
        );
      }
    }

    // 上位時間軸が強いトレンドの場合の追加調整
    if (higherTimeframe.condition.type === 'trending' && 
        higherTimeframe.condition.strength > 0.8) {
      if ((entry.direction === 'long' && higherTimeframe.trend === 'bearish') ||
          (entry.direction === 'short' && higherTimeframe.trend === 'bullish')) {
        // 強い逆トレンドの場合はさらに信頼度を下げる
        adjustedConfidence *= 0.8;
      }
    }

    // 重みを再計算
    const totalWeight = technicalFactors.reduce((sum, f) => sum + f.weight, 0);
    const normalizedFactors = technicalFactors.map(f => ({
      ...f,
      weight: f.weight / totalWeight,
    }));

    return {
      ...entry,
      confidence: Math.min(Math.max(adjustedConfidence, 0.1), 0.95),
      reasoning: {
        ...entry.reasoning,
        technicalFactors: normalizedFactors,
        risks,
      },
    };
  });
}

/**
 * 戦略に基づくフィルタリング
 */
function filterByStrategy(
  entries: EntryPoint[],
  strategyPreference: string,
  marketContext: MarketContext
): EntryPoint[] {
  let filteredEntries = entries;

  // 市場トレンドに基づいた方向性フィルタリング
  if (marketContext.trend === 'bullish') {
    // ブルマーケットではロングエントリーを優先
    filteredEntries = entries.map(entry => {
      if (entry.direction === 'long') {
        return { ...entry, confidence: entry.confidence * 1.1 }; // ロングの信頼度を上げる
      } else if (entry.direction === 'short') {
        return { ...entry, confidence: entry.confidence * 0.8 }; // ショートの信頼度を下げる
      }
      return entry;
    });
  } else if (marketContext.trend === 'bearish') {
    // ベアマーケットではショートエントリーを優先
    filteredEntries = entries.map(entry => {
      if (entry.direction === 'short') {
        return { ...entry, confidence: entry.confidence * 1.1 }; // ショートの信頼度を上げる
      } else if (entry.direction === 'long') {
        return { ...entry, confidence: entry.confidence * 0.8 }; // ロングの信頼度を下げる
      }
      return entry;
    });
  }

  if (strategyPreference === 'auto') {
    // 市場状況に基づいて最適な戦略を選択
    if (marketContext.volatility === 'high') {
      // 高ボラティリティ時は短期戦略を優先
      return filteredEntries.filter(e => 
        e.strategy === 'scalping' || e.strategy === 'dayTrading'
      );
    } else if (marketContext.trend !== 'neutral') {
      // トレンドがある場合はスイングトレードを優先
      return filteredEntries.filter(e => 
        e.strategy === 'swingTrading' || e.strategy === 'position'
      );
    }
    return filteredEntries;
  }

  // 特定の戦略が指定されている場合
  return filteredEntries.filter(e => e.strategy === strategyPreference);
}