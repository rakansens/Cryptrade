/**
 * Type definitions for technical indicators
 */

// ===== Base Types =====

export interface IndicatorDataPoint {
  time: number;
  value: number;
}

export interface MultiValueIndicatorDataPoint {
  time: number;
  [key: string]: number;
}

export interface PriceDataPoint {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

// ===== MACD Types =====

export interface MACDDataPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface MACDParameters {
  short: number;
  long: number;
  signal: number;
}

export interface MACDSeriesData {
  macdSeries: IndicatorDataPoint[];
  signalSeries: IndicatorDataPoint[];
  histogramSeries: IndicatorDataPoint[];
  zeroSeries: IndicatorDataPoint[];
}

// ===== RSI Types =====

export interface RSIDataPoint {
  time: number;
  rsi: number;
}

export interface RSIParameters {
  period: number;
}

export interface RSISeriesData {
  rsiSeries: IndicatorDataPoint[];
  overboughtSeries: IndicatorDataPoint[];
  oversoldSeries: IndicatorDataPoint[];
}

// ===== Moving Average Types =====

export interface MAParameters {
  period: number;
  type?: 'simple' | 'exponential' | 'weighted';
}

export interface MASeriesData {
  maSeries: IndicatorDataPoint[];
}

// ===== Bollinger Bands Types =====

export interface BollingerBandsDataPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface BollingerBandsParameters {
  period: number;
  stdDev: number;
}

export interface BollingerBandsSeriesData {
  upperSeries: IndicatorDataPoint[];
  middleSeries: IndicatorDataPoint[];
  lowerSeries: IndicatorDataPoint[];
}

// ===== Volume Types =====

export interface VolumeDataPoint {
  time: number;
  value: number;
  color?: string;
}

// ===== Stochastic Types =====

export interface StochasticDataPoint {
  time: number;
  k: number;
  d: number;
}

export interface StochasticParameters {
  kPeriod: number;
  dPeriod: number;
  smoothK: number;
}

export interface StochasticSeriesData {
  kSeries: IndicatorDataPoint[];
  dSeries: IndicatorDataPoint[];
}

// ===== Indicator Calculator Types =====

export type IndicatorCalculator<TInput, TOutput> = (
  data: TInput[],
  parameters?: Record<string, unknown>
) => TOutput[];

export type SeriesDataFormatter<TInput, TOutput> = (
  data: TInput[]
) => TOutput;

// ===== Generic Indicator Types =====

export interface IndicatorDefinition<TParams = Record<string, unknown>> {
  name: string;
  displayName: string;
  parameters: TParams;
  defaultParameters: TParams;
  calculate: IndicatorCalculator<PriceDataPoint, unknown>;
  format: SeriesDataFormatter<unknown, Record<string, IndicatorDataPoint[]>>;
}

// ===== Type Guards =====

export function isPriceDataPoint(value: unknown): value is PriceDataPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.time === 'number' &&
    typeof obj.close === 'number'
  );
}

export function isMACDDataPoint(value: unknown): value is MACDDataPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.time === 'number' &&
    typeof obj.macd === 'number' &&
    typeof obj.signal === 'number' &&
    typeof obj.histogram === 'number'
  );
}

export function isRSIDataPoint(value: unknown): value is RSIDataPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.time === 'number' &&
    typeof obj.rsi === 'number'
  );
}