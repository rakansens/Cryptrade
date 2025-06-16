/**
 * RSI (Relative Strength Index) Calculator - Optimized O(N) version
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 * Uses Wilder's smoothing method for efficient calculation
 * 
 * @module indicators/rsi
 */

import type { RSIData } from '@/types/market';
import { validatePriceData, handleIndicatorError } from './validation';
import { logger } from '@/lib/utils/logger';

/**
 * RSI（相対力指数）を計算します
 * Wilder's smoothing methodを使用してO(N)の効率的な実装です
 * 
 * @param data - 時系列価格データ配列
 * @param data[].time - タイムスタンプ
 * @param data[].close - 終値
 * @param period - RSI計算期間（デフォルト: 14）
 * @returns RSIデータ配列（時刻とRSI値）
 * @throws {Error} データ検証エラー（ログに記録して空配列を返す）
 * 
 * @example
 * ```typescript
 * const rsiData = calculateRSI(priceData, 14);
 * // Returns: [{ time: 1234567890, rsi: 65.5 }, ...]
 * ```
 */
export function calculateRSI(
  data: { time: number; close: number }[],
  period: number = 14
): RSIData[] {
  // 入力データの検証
  const validation = validatePriceData(data, {
    minLength: period + 1,
    checkMonotonic: true,
    allowNaN: false,
    allowInfinity: false
  });

  if (!validation.valid) {
    return handleIndicatorError('RSI', new Error(validation.error!), []);
  }

  if (validation.warnings) {
    validation.warnings.forEach(warning => {
      logger.warn(`[RSI] ${warning}`);
    });
  }

  try {

  const gains: number[] = [];
  const losses: number[] = [];
  const rsiData: RSIData[] = [];

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];
    if (!current || !previous) continue;
    const change = current.close - previous.close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  // Calculate first RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = 100 - (100 / (1 + firstRS));
  
  const firstCandle = data[period];
  if (firstCandle) {
    rsiData.push({
      time: firstCandle.time,
      rsi: firstRSI
    });
  }

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const currentGain = gains[i - 1];
    const currentLoss = losses[i - 1];

    if (currentGain === undefined || currentLoss === undefined) continue;

    // Wilder's smoothing
    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const candle = data[i];
    if (candle) {
      rsiData.push({
        time: candle.time,
        rsi: rsi
      });
    }
  }

  return rsiData;
  } catch (error) {
    return handleIndicatorError('RSI', error, []);
  }
}

/**
 * RSI値に基づいて色を返します
 * 
 * @param rsi - RSI値（0-100）
 * @returns 色コード
 * - 70以上: 赤（#ff4d4d） - 買われすぎ
 * - 30以下: ティール（#0ddfba） - 売られすぎ
 * - その他: 紫（#7b61ff） - 中立
 */
export function getRSIColor(rsi: number): string {
  if (rsi >= 70) return '#ff4d4d'; // Overbought - Red
  if (rsi <= 30) return '#0ddfba'; // Oversold - Teal
  return '#7b61ff'; // Normal - Purple
}

/**
 * RSI値に基づいてシグナルを返します
 * 
 * @param rsi - RSI値（0-100）
 * @returns シグナル
 * - 'overbought': RSI >= 70
 * - 'oversold': RSI <= 30
 * - 'neutral': 30 < RSI < 70
 */
export function getRSISignal(rsi: number): 'overbought' | 'oversold' | 'neutral' {
  if (rsi >= 70) return 'overbought';
  if (rsi <= 30) return 'oversold';
  return 'neutral';
}