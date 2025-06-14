/**
 * Risk Management Calculator
 * 
 * エントリーポイントに対するストップロス、テイクプロフィット、
 * ポジションサイズなどのリスク管理パラメータを計算
 */

import type { PriceData } from '@/types/market';
import type { RiskParameters, TradingDirection, TradingStrategyType } from '@/types/trading';
import { logger } from '@/lib/utils/logger';

interface CalculateRiskManagementInput {
  entryPrice: number;
  direction: TradingDirection;
  marketData: PriceData[];
  volatility: 'low' | 'normal' | 'high';
  strategy: TradingStrategyType;
  riskPercentage: number;
}

export async function calculateRiskManagement(
  input: CalculateRiskManagementInput
): Promise<RiskParameters> {
  const { entryPrice, direction, marketData, volatility, strategy, riskPercentage } = input;

  // ATR（Average True Range）の計算
  const atr = calculateATR(marketData, 14);
  const currentPrice = marketData[marketData.length - 1].close;

  // 戦略とボラティリティに基づくストップロス距離の計算
  const stopLossDistance = calculateStopLossDistance(
    entryPrice,
    atr,
    volatility,
    strategy
  );

  // ストップロス価格の計算
  const stopLoss = direction === 'long' 
    ? entryPrice - stopLossDistance
    : entryPrice + stopLossDistance;

  const stopLossPercent = (stopLossDistance / entryPrice) * 100;

  // テイクプロフィット目標の計算
  const takeProfitTargets = calculateTakeProfitTargets(
    entryPrice,
    stopLossDistance,
    direction,
    strategy,
    marketData
  );

  // リスクリワード比の計算
  const primaryTarget = takeProfitTargets[0].price;
  const reward = Math.abs(primaryTarget - entryPrice);
  const risk = stopLossDistance;
  const riskRewardRatio = reward / risk;

  // ポジションサイズの推奨（アカウントの何%か）
  const positionSizePercent = calculatePositionSizePercent(
    riskPercentage,
    volatility,
    strategy,
    riskRewardRatio
  );

  logger.debug('[RiskCalculator] Calculated parameters', {
    entryPrice,
    stopLoss,
    stopLossPercent,
    takeProfitCount: takeProfitTargets.length,
    riskRewardRatio,
    positionSizePercent,
  });

  return {
    stopLoss,
    stopLossPercent,
    takeProfitTargets,
    riskRewardRatio,
    positionSizePercent,
    maxLossAmount: undefined, // これは実際のアカウント残高が必要
  };
}

/**
 * ATR（Average True Range）の計算
 */
function calculateATR(marketData: PriceData[], period: number): number {
  if (marketData.length < period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < marketData.length; i++) {
    const current = marketData[i];
    const previous = marketData[i - 1];

    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previous.close);
    const lowClose = Math.abs(current.low - previous.close);

    const trueRange = Math.max(highLow, highClose, lowClose);
    trueRanges.push(trueRange);
  }

  // 最新のperiod期間のATRを計算
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;

  return atr;
}

/**
 * ストップロス距離の計算
 */
function calculateStopLossDistance(
  entryPrice: number,
  atr: number,
  volatility: 'low' | 'normal' | 'high',
  strategy: TradingStrategyType
): number {
  // 基本はATRの倍数で計算
  let atrMultiplier = 2.0;

  // 戦略による調整
  switch (strategy) {
    case 'scalping':
      atrMultiplier = 0.5; // タイトなストップ
      break;
    case 'dayTrading':
      atrMultiplier = 1.5;
      break;
    case 'swingTrading':
      atrMultiplier = 2.5;
      break;
    case 'position':
      atrMultiplier = 3.0; // より広いストップ
      break;
  }

  // ボラティリティによる調整
  switch (volatility) {
    case 'low':
      atrMultiplier *= 0.8;
      break;
    case 'high':
      atrMultiplier *= 1.2;
      break;
  }

  // 最小ストップロス距離（エントリー価格の0.5%）
  const minStopDistance = entryPrice * 0.005;
  
  // 最大ストップロス距離（エントリー価格の5%）
  const maxStopDistance = entryPrice * 0.05;

  const stopDistance = Math.max(
    minStopDistance,
    Math.min(atr * atrMultiplier, maxStopDistance)
  );

  return stopDistance;
}

/**
 * テイクプロフィット目標の計算
 */
function calculateTakeProfitTargets(
  entryPrice: number,
  stopLossDistance: number,
  direction: TradingDirection,
  strategy: TradingStrategyType,
  marketData: PriceData[]
): Array<{ price: number; percentage: number }> {
  const targets: Array<{ price: number; percentage: number }> = [];

  // リスクリワード比に基づく目標設定
  const rrRatios = getTargetRRRatios(strategy);

  // 最近の高値/安値も考慮
  const recentData = marketData.slice(-20);
  const recentHigh = Math.max(...recentData.map(d => d.high));
  const recentLow = Math.min(...recentData.map(d => d.low));

  for (let i = 0; i < rrRatios.length; i++) {
    const ratio = rrRatios[i];
    const targetDistance = stopLossDistance * ratio.rr;
    
    let targetPrice = direction === 'long'
      ? entryPrice + targetDistance
      : entryPrice - targetDistance;

    // 直近の高値/安値を考慮した調整
    if (direction === 'long' && targetPrice > recentHigh * 1.02) {
      // 直近高値を少し超える程度に調整
      targetPrice = recentHigh * 1.015;
    } else if (direction === 'short' && targetPrice < recentLow * 0.98) {
      // 直近安値を少し下回る程度に調整
      targetPrice = recentLow * 0.985;
    }

    targets.push({
      price: targetPrice,
      percentage: ratio.percentage,
    });
  }

  return targets;
}

/**
 * 戦略別のリスクリワード比設定
 */
function getTargetRRRatios(strategy: TradingStrategyType): Array<{ rr: number; percentage: number }> {
  switch (strategy) {
    case 'scalping':
      return [
        { rr: 1.5, percentage: 50 },
        { rr: 2.0, percentage: 50 },
      ];
    case 'dayTrading':
      return [
        { rr: 2.0, percentage: 40 },
        { rr: 3.0, percentage: 40 },
        { rr: 4.0, percentage: 20 },
      ];
    case 'swingTrading':
      return [
        { rr: 2.5, percentage: 30 },
        { rr: 4.0, percentage: 40 },
        { rr: 6.0, percentage: 30 },
      ];
    case 'position':
      return [
        { rr: 3.0, percentage: 25 },
        { rr: 5.0, percentage: 50 },
        { rr: 8.0, percentage: 25 },
      ];
    default:
      return [
        { rr: 2.0, percentage: 50 },
        { rr: 3.0, percentage: 50 },
      ];
  }
}

/**
 * ポジションサイズ比率の計算
 */
function calculatePositionSizePercent(
  baseRiskPercentage: number,
  volatility: 'low' | 'normal' | 'high',
  strategy: TradingStrategyType,
  riskRewardRatio: number
): number {
  let sizePercent = baseRiskPercentage;

  // ボラティリティによる調整
  switch (volatility) {
    case 'low':
      sizePercent *= 1.2; // 低ボラなら少し大きめに
      break;
    case 'high':
      sizePercent *= 0.7; // 高ボラなら小さめに
      break;
  }

  // 戦略による調整
  switch (strategy) {
    case 'scalping':
      sizePercent *= 1.5; // 短期なので大きめでもOK
      break;
    case 'position':
      sizePercent *= 0.6; // 長期なので控えめに
      break;
  }

  // リスクリワード比による調整
  if (riskRewardRatio >= 3) {
    sizePercent *= 1.1; // 良いRRなら少し増やす
  } else if (riskRewardRatio < 1.5) {
    sizePercent *= 0.8; // 悪いRRなら減らす
  }

  // 上限と下限の設定
  return Math.max(0.5, Math.min(sizePercent, 5.0));
}