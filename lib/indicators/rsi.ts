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
import { RSIIndicator } from './rsi-indicator';

/**
 * RSI（相対力指数）を計算します
 * Wilder's smoothing methodを使用してO(N)の効率的な実装です
 * 
 * @deprecated Use RSIIndicator class instead for better performance and consistency
 * @param {Array<{time: number, close: number}>} data - 時系列価格データ配列
 * @param {number} period - RSI計算期間（デフォルト: 14）
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
  // Convert data to PriceDataLightweight format
  const convertedData = data.map(d => ({
    time: d.time as any, // Type assertion for compatibility
    close: d.close
  }));
  
  // Use the new RSIIndicator class
  const rsiIndicator = new RSIIndicator(period);
  return rsiIndicator.calculate(convertedData);
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