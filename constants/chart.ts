// Chart constants and types
export const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
  { value: 'ADAUSDT', label: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
] as const;

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const;

export type SymbolValue = typeof SYMBOLS[number]['value'];
export type Timeframe = typeof TIMEFRAMES[number];

export interface IndicatorSettings {
  ma: {
    ma1: number;
    ma2: number; 
    ma3: number;
  };
  rsi: number;
  rsiUpper: number;
  rsiLower: number;
  macd: {
    short: number;
    long: number;
    signal: number;
  };
  boll: { 
    period: number; 
    stdDev: number; 
  };
  lineWidth: {
    ma: number;
    ma1: number;
    ma2: number;
    ma3: number;
    rsi: number;
    macd: number;
    boll: number;
  };
  colors: {
    ma1: string;
    ma2: string;
    ma3: string;
    rsi: string;
    macd: string;
    boll: string;
  };
}