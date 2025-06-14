/**
 * Market Context Analyzer
 * 
 * 現在の市場状況を分析し、エントリー提案のためのコンテキストを提供
 */

import type { PriceData } from '@/types/market';
import type { MarketContext } from '@/types/trading';
import { logger } from '@/lib/utils/logger';

export async function analyzeMarketContext(
  marketData: PriceData[],
  symbol: string
): Promise<MarketContext> {
  const currentCandle = marketData[marketData.length - 1];
  const currentPrice = currentCandle.close;

  // トレンド分析
  const trend = analyzeTrend(marketData);
  
  // ボラティリティ分析
  const volatility = analyzeVolatility(marketData);
  
  // ボリューム分析
  const volume = analyzeVolume(marketData);
  
  // キーレベルの特定
  const keyLevels = identifyKeyLevels(marketData);

  logger.debug('[MarketContextAnalyzer] Analysis complete', {
    symbol,
    currentPrice,
    trend,
    volatility,
    volume,
    keyLevels,
  });

  return {
    currentPrice,
    trend,
    volatility,
    volume,
    keyLevels,
  };
}

/**
 * トレンド分析
 */
function analyzeTrend(marketData: PriceData[]): 'bullish' | 'bearish' | 'neutral' {
  if (marketData.length < 50) {
    return 'neutral';
  }

  // 複数の時間枠でトレンドを確認
  const ma20 = calculateSMA(marketData.slice(-20).map(d => d.close));
  const ma50 = calculateSMA(marketData.slice(-50).map(d => d.close));
  const currentPrice = marketData[marketData.length - 1].close;

  // 価格と移動平均線の位置関係
  const priceAboveMa20 = currentPrice > ma20;
  const priceAboveMa50 = currentPrice > ma50;
  const ma20AboveMa50 = ma20 > ma50;

  // 最近の高値・安値の更新状況
  const recent20 = marketData.slice(-20);
  const higherHighs = countHigherHighs(recent20);
  const lowerLows = countLowerLows(recent20);

  // トレンド判定
  let bullishScore = 0;
  let bearishScore = 0;

  if (priceAboveMa20) bullishScore += 1;
  else bearishScore += 1;

  if (priceAboveMa50) bullishScore += 1;
  else bearishScore += 1;

  if (ma20AboveMa50) bullishScore += 1;
  else bearishScore += 1;

  if (higherHighs > lowerLows) bullishScore += 2;
  else if (lowerLows > higherHighs) bearishScore += 2;

  // 最終判定
  if (bullishScore >= 4) return 'bullish';
  if (bearishScore >= 4) return 'bearish';
  return 'neutral';
}

/**
 * ボラティリティ分析
 */
function analyzeVolatility(marketData: PriceData[]): 'low' | 'normal' | 'high' {
  if (marketData.length < 20) {
    return 'normal';
  }

  // 最近20期間のボラティリティを計算
  const recent = marketData.slice(-20);
  const returns = [];

  for (let i = 1; i < recent.length; i++) {
    const returnRate = (recent[i].close - recent[i - 1].close) / recent[i - 1].close;
    returns.push(returnRate);
  }

  // 標準偏差を計算
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // 年率換算（仮想通貨は24時間365日取引）
  const annualizedVol = stdDev * Math.sqrt(365 * 24);

  // ボラティリティレベルの判定
  if (annualizedVol < 0.5) return 'low';    // 50%未満
  if (annualizedVol > 1.0) return 'high';   // 100%超
  return 'normal';
}

/**
 * ボリューム分析
 */
function analyzeVolume(marketData: PriceData[]): 'low' | 'average' | 'high' {
  if (marketData.length < 20) {
    return 'average';
  }

  const recent = marketData.slice(-20);
  const currentVolume = recent[recent.length - 1].volume;
  const averageVolume = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length;

  const volumeRatio = currentVolume / averageVolume;

  if (volumeRatio < 0.5) return 'low';
  if (volumeRatio > 1.5) return 'high';
  return 'average';
}

/**
 * キーレベルの特定
 */
function identifyKeyLevels(marketData: PriceData[]): MarketContext['keyLevels'] {
  const currentPrice = marketData[marketData.length - 1].close;
  const dayData = marketData.slice(-24); // 24時間分（1時間足の場合）

  // 日足の高値・安値
  const dailyHigh = Math.max(...dayData.map(d => d.high));
  const dailyLow = Math.min(...dayData.map(d => d.low));

  // 直近のサポート・レジスタンスを簡易的に計算
  const { nearestSupport, nearestResistance } = findNearestSR(marketData, currentPrice);

  return {
    nearestSupport,
    nearestResistance,
    dailyHigh,
    dailyLow,
  };
}

/**
 * 単純移動平均の計算
 */
function calculateSMA(prices: number[]): number {
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

/**
 * より高い高値の数をカウント
 */
function countHigherHighs(data: PriceData[]): number {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].high > data[i - 1].high) {
      count++;
    }
  }
  return count;
}

/**
 * より低い安値の数をカウント
 */
function countLowerLows(data: PriceData[]): number {
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].low < data[i - 1].low) {
      count++;
    }
  }
  return count;
}

/**
 * 最も近いサポート・レジスタンスを見つける
 */
function findNearestSR(
  marketData: PriceData[],
  currentPrice: number
): { nearestSupport?: number; nearestResistance?: number } {
  const pricePoints: number[] = [];

  // 最近50本の高値・安値を収集
  const recent = marketData.slice(-50);
  recent.forEach(candle => {
    pricePoints.push(candle.high);
    pricePoints.push(candle.low);
  });

  // 価格をソート
  pricePoints.sort((a, b) => a - b);

  // 現在価格より下の最も近い価格（サポート候補）
  let nearestSupport: number | undefined;
  for (let i = pricePoints.length - 1; i >= 0; i--) {
    if (pricePoints[i] < currentPrice * 0.995) { // 0.5%以上離れている
      nearestSupport = pricePoints[i];
      break;
    }
  }

  // 現在価格より上の最も近い価格（レジスタンス候補）
  let nearestResistance: number | undefined;
  for (let i = 0; i < pricePoints.length; i++) {
    if (pricePoints[i] > currentPrice * 1.005) { // 0.5%以上離れている
      nearestResistance = pricePoints[i];
      break;
    }
  }

  return { nearestSupport, nearestResistance };
}