import type { UTCTimestamp } from 'lightweight-charts';

/**
 * 共通の価格データ型（Lightweight Charts互換）
 */
export interface PriceDataLightweight {
  time: UTCTimestamp;
  close: number;
}

/**
 * バリデーションオプション
 */
export interface ValidationOptions {
  minLength: number;
  checkMonotonic?: boolean;
  allowNaN?: boolean;
  allowInfinity?: boolean;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  data?: PriceDataLightweight[];
  error?: string;
  warnings?: string[];
}

/**
 * エラーハンドリングオプション
 */
export interface ErrorHandlingOptions {
  throwOnError?: boolean;
  logErrors?: boolean;
  fallbackValue?: any;
}

/**
 * 指標設定の基底インターフェース
 */
export interface BaseIndicatorConfig {
  period?: number;
  validationOptions?: ValidationOptions;
  errorHandling?: ErrorHandlingOptions;
}

/**
 * 指標タイプの列挙
 */
export type IndicatorType = 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BollingerBands' | 'ATR';

/**
 * 共通の指標データポイント
 */
export interface BaseIndicatorData {
  time: UTCTimestamp;
}

/**
 * 移動平均データ
 */
export interface MovingAverageData extends BaseIndicatorData {
  value: number;
}

/**
 * RSIデータ
 */
export interface RSIData extends BaseIndicatorData {
  rsi: number;
}

/**
 * ボリンジャーバンドデータ
 */
export interface BollingerBandsData extends BaseIndicatorData {
  upper: number;
  middle: number;
  lower: number;
}

/**
 * MACDデータ
 */
export interface MACDData extends BaseIndicatorData {
  macd: number;
  signal: number;
  histogram: number;
}