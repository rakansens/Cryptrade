/**
 * Entry Condition Evaluator
 * 
 * エントリーポイントに対する具体的な条件を評価・設定
 */

import type { EntryConditions, MarketContext, TradingStrategyType } from '@/types/trading';
import type { EntryPoint } from '../calculators/entry-calculator';
import { logger } from '@/lib/utils/logger';

interface EvaluateEntryConditionsInput {
  entryPoint: EntryPoint;
  marketContext: MarketContext;
  currentPrice: number;
}

export async function evaluateEntryConditions(
  input: EvaluateEntryConditionsInput
): Promise<EntryConditions> {
  const { entryPoint, marketContext, currentPrice } = input;

  // エントリータイプの決定
  const trigger = determineEntryTrigger(entryPoint, currentPrice, marketContext);
  
  // 確認条件の設定
  const confirmationRequired = determineConfirmationRequirements(
    entryPoint,
    marketContext,
    trigger
  );

  // 有効期限の設定
  const validUntil = calculateValidUntil(entryPoint.strategy, marketContext);

  // 時間枠の整合性
  const timeframeAlignment = determineTimeframeAlignment(entryPoint.strategy);

  logger.debug('[ConditionEvaluator] Conditions evaluated', {
    trigger,
    confirmationCount: confirmationRequired.length,
    validHours: validUntil ? (validUntil - Date.now()) / (1000 * 60 * 60) : 'unlimited',
    timeframe: timeframeAlignment,
  });

  return {
    trigger,
    priceLevel: trigger !== 'market' ? entryPoint.price : undefined,
    confirmationRequired,
    validUntil,
    timeframeAlignment,
  };
}

/**
 * エントリートリガータイプの決定
 */
function determineEntryTrigger(
  entryPoint: EntryPoint,
  currentPrice: number,
  marketContext: MarketContext
): EntryConditions['trigger'] {
  const priceDistance = Math.abs(entryPoint.price - currentPrice) / currentPrice;

  // 現在価格に非常に近い場合（0.5%以内）
  if (priceDistance < 0.005) {
    return 'market';
  }

  // パターンベースのエントリー
  if (entryPoint.relatedPatterns && entryPoint.relatedPatterns.length > 0) {
    return 'pattern';
  }

  // ブレイクアウトエントリー
  if (entryPoint.reasoning.primary.includes('ブレイクアウト') || 
      entryPoint.reasoning.primary.includes('突破')) {
    return 'breakout';
  }

  // バウンスエントリー
  if (entryPoint.reasoning.primary.includes('反発') || 
      entryPoint.reasoning.primary.includes('バウンス')) {
    return 'bounce';
  }

  // その他は指値注文
  return 'limit';
}

/**
 * 確認条件の決定
 */
function determineConfirmationRequirements(
  entryPoint: EntryPoint,
  marketContext: MarketContext,
  trigger: EntryConditions['trigger']
): Array<{ type: 'volume' | 'candleClose' | 'indicatorCross' | 'timeframe'; description: string }> {
  const confirmations: Array<{ 
    type: 'volume' | 'candleClose' | 'indicatorCross' | 'timeframe'; 
    description: string 
  }> = [];

  // ブレイクアウトの場合はボリューム確認を追加
  if (trigger === 'breakout') {
    confirmations.push({
      type: 'volume',
      description: '平均ボリュームの1.5倍以上での出来高確認',
    });
  }

  // バウンスの場合はローソク足の確定を待つ
  if (trigger === 'bounce') {
    confirmations.push({
      type: 'candleClose',
      description: `${entryPoint.price}レベルでの陽線（陰線）確定`,
    });
  }

  // 高ボラティリティ時は追加確認
  if (marketContext.volatility === 'high') {
    confirmations.push({
      type: 'timeframe',
      description: '上位時間足でのトレンド確認',
    });
  }

  // スイング・ポジショントレードでは複数確認
  if (entryPoint.strategy === 'swingTrading' || entryPoint.strategy === 'position') {
    if (confirmations.length === 0) {
      confirmations.push({
        type: 'candleClose',
        description: '日足での確定待ち',
      });
    }
  }

  return confirmations;
}

/**
 * 有効期限の計算
 */
function calculateValidUntil(
  strategy: TradingStrategyType,
  marketContext: MarketContext
): number | undefined {
  const now = Date.now();
  let hoursValid: number;

  switch (strategy) {
    case 'scalping':
      hoursValid = 2; // 2時間
      break;
    case 'dayTrading':
      hoursValid = 8; // 8時間
      break;
    case 'swingTrading':
      hoursValid = 48; // 2日
      break;
    case 'position':
      return undefined; // 無期限
    default:
      hoursValid = 24;
  }

  // 高ボラティリティ時は期限を短縮
  if (marketContext.volatility === 'high') {
    hoursValid = hoursValid * 0.5;
  }

  return now + (hoursValid * 60 * 60 * 1000);
}

/**
 * 時間枠の整合性を決定
 */
function determineTimeframeAlignment(strategy: TradingStrategyType): string | undefined {
  switch (strategy) {
    case 'scalping':
      return '5m'; // 5分足でエントリー
    case 'dayTrading':
      return '1h'; // 1時間足でエントリー
    case 'swingTrading':
      return '4h'; // 4時間足でエントリー
    case 'position':
      return '1d'; // 日足でエントリー
    default:
      return undefined;
  }
}