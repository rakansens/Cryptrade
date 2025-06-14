/**
 * Market Domain Types - Single Source of Truth
 * 
 * This file consolidates all market-related types and their Zod schemas.
 * All types are generated from Zod schemas using z.infer<> to ensure
 * consistency between runtime validation and compile-time types.
 * 
 * @generated Epic #4 - Type Unification
 */

import { z } from 'zod';
import type { UTCTimestamp } from 'lightweight-charts';

// =============================================================================
// CORE BINANCE API SCHEMAS
// =============================================================================

// Binance API response schemas - Flexible version for production stability
export const BinanceKlineTupleSchema = z.array(z.union([z.string(), z.number()]))
  .min(6) // At least 6 elements required for basic OHLCV data
  .transform((arr) => {
    // Ensure we have at least 12 elements (Binance standard)
    while (arr.length < 12) arr.push('0');
    return arr as [number, string, string, string, string, string, number, string, number, string, string, string];
  });

export const ProcessedKlineSchema = z.object({
  time: z.number().min(0), // Unix timestamp, should be positive
  open: z.number().min(0), // Price should be positive
  high: z.number().min(0),
  low: z.number().min(0),
  close: z.number().min(0),
  volume: z.number().min(0), // Volume should be non-negative
}).refine((data) => {
  // High should be >= low, open, close
  return data.high >= data.low && 
         data.high >= data.open && 
         data.high >= data.close &&
         data.low <= data.open &&
         data.low <= data.close;
}, {
  message: "OHLC data is inconsistent: high should be maximum, low should be minimum"
});

export const BinanceTradeMessageSchema = z.object({
  e: z.string().optional(), // Event type (may not always be present)
  E: z.number(), // Event time
  s: z.string(), // Symbol
  t: z.number(), // Trade ID
  p: z.string(), // Price
  q: z.string(), // Quantity
  b: z.number().optional(), // Buyer order ID (optional)
  a: z.number().optional(), // Seller order ID (optional)
  T: z.number(), // Trade time
  m: z.boolean(), // Is buyer maker
  M: z.boolean().optional(), // Ignore (optional)
}).passthrough(); // Allow extra fields from Binance

export const BinanceKlineMessageSchema = z.object({
  e: z.literal("kline"),
  E: z.number(), // Event time
  s: z.string(), // Symbol
  k: z.object({
    t: z.number(), // Kline start time
    T: z.number(), // Kline close time
    s: z.string(), // Symbol
    i: z.string(), // Interval
    f: z.number(), // First trade ID
    L: z.number(), // Last trade ID
    o: z.string(), // Open price
    c: z.string(), // Close price
    h: z.string(), // High price
    l: z.string(), // Low price
    v: z.string(), // Base asset volume
    n: z.number(), // Number of trades
    x: z.boolean(), // Is this kline closed?
    q: z.string(), // Quote asset volume
    V: z.string(), // Taker buy base asset volume
    Q: z.string(), // Taker buy quote asset volume
    B: z.string(), // Ignore
  }),
});

export const BinanceTicker24hrSchema = z.object({
  symbol: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  weightedAvgPrice: z.string(),
  prevClosePrice: z.string(),
  lastPrice: z.string(),
  lastQty: z.string(),
  bidPrice: z.string(),
  bidQty: z.string(),
  askPrice: z.string(),
  askQty: z.string(),
  openPrice: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  openTime: z.number(),
  closeTime: z.number(),
  firstId: z.number(),
  lastId: z.number(),
  count: z.number(),
});

// =============================================================================
// CHART DATA SCHEMAS
// =============================================================================

export const PriceUpdateSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  time: z.number(),
});

export const IndicatorOptionsSchema = z.object({
  ma: z.boolean(),
  rsi: z.boolean(),
  macd: z.boolean(),
  boll: z.boolean(),
});

// Full OHLCV price data (primary version)
export const PriceDataSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const MarketTickerSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  high24h: z.string(),
  low24h: z.string(),
  volume24h: z.string(),
});

// =============================================================================
// TECHNICAL INDICATOR SCHEMAS
// =============================================================================

export const RSIDataSchema = z.object({
  time: z.number(),
  rsi: z.number().min(0).max(100),
});

export const MACDDataSchema = z.object({
  time: z.number(),
  macd: z.number(),
  signal: z.number(),
  histogram: z.number(),
});

export const MovingAverageDataSchema = z.object({
  time: z.number(),
  value: z.number(),
});

export const BollingerBandsDataSchema = z.object({
  time: z.number(),
  upper: z.number(),
  middle: z.number(),  // SMA
  lower: z.number(),
});

export const BollingerBandsConfigSchema = z.object({
  period: z.number(),
  stdDev: z.number(),
});

// =============================================================================
// ARRAY SCHEMAS
// =============================================================================

export const BinanceKlinesResponseSchema = z.array(BinanceKlineTupleSchema);
export const ProcessedKlinesSchema = z.array(ProcessedKlineSchema);
export const RSIDataArraySchema = z.array(RSIDataSchema);
export const MACDDataArraySchema = z.array(MACDDataSchema);
export const MovingAverageDataArraySchema = z.array(MovingAverageDataSchema);
export const BollingerBandsDataArraySchema = z.array(BollingerBandsDataSchema);

// =============================================================================
// TYPE EXPORTS (Generated from Zod schemas)
// =============================================================================

// Core Binance Types
export type BinanceKlineTuple = z.infer<typeof BinanceKlineTupleSchema>;
export type ProcessedKline = z.infer<typeof ProcessedKlineSchema>;
export type BinanceTradeMessage = z.infer<typeof BinanceTradeMessageSchema>;
export type BinanceKlineMessage = z.infer<typeof BinanceKlineMessageSchema>;
export type BinanceTicker24hr = z.infer<typeof BinanceTicker24hrSchema>;

// Chart Data Types
export type PriceUpdate = z.infer<typeof PriceUpdateSchema>;
export type IndicatorOptions = z.infer<typeof IndicatorOptionsSchema>;
export type PriceData = z.infer<typeof PriceDataSchema>;
export type MarketTicker = z.infer<typeof MarketTickerSchema>;

// Technical Indicator Types
export type RSIData = z.infer<typeof RSIDataSchema>;
export type MACDData = z.infer<typeof MACDDataSchema>;
export type MovingAverageData = z.infer<typeof MovingAverageDataSchema>;
export type BollingerBandsData = z.infer<typeof BollingerBandsDataSchema>;
export type BollingerBandsConfig = z.infer<typeof BollingerBandsConfigSchema>;

// Array Types
export type ProcessedKlines = z.infer<typeof ProcessedKlinesSchema>;
export type RSIDataArray = z.infer<typeof RSIDataArraySchema>;
export type MACDDataArray = z.infer<typeof MACDDataArraySchema>;
export type MovingAverageDataArray = z.infer<typeof MovingAverageDataArraySchema>;
export type BollingerBandsDataArray = z.infer<typeof BollingerBandsDataArraySchema>;

// =============================================================================
// COMPATIBILITY TYPES (for indicators that need UTCTimestamp)
// =============================================================================

// Lightweight Charts compatibility - for indicators that specifically need UTCTimestamp
export interface PriceDataLightweight {
  time: UTCTimestamp;
  close: number;
}

export interface MovingAverageDataLightweight {
  time: UTCTimestamp;
  value: number;
}

export interface BollingerBandsDataLightweight {
  time: UTCTimestamp;
  upper: number;
  middle: number;  // SMA
  lower: number;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

// Environment-aware validation helpers
const shouldValidate = process.env.NODE_ENV !== 'production' || process.env.FORCE_VALIDATION === 'true';

// Fast validation for production (basic type checks)
function fastValidateTradeMessage(data: unknown): BinanceTradeMessage | null {
  if (!data || typeof data !== 'object') return null;
  if (data.e !== 'trade') return null;
  if (typeof data.E !== 'number' || typeof data.s !== 'string') return null;
  if (typeof data.t !== 'number' || typeof data.p !== 'string') return null;
  if (typeof data.q !== 'string' || typeof data.T !== 'number') return null;
  if (typeof data.m !== 'boolean') return null;
  // Optional fields don't need validation
  
  return data as BinanceTradeMessage;
}

function fastValidateKlineMessage(data: unknown): BinanceKlineMessage | null {
  if (!data || typeof data !== 'object') return null;
  if (data.e !== 'kline') return null;
  if (typeof data.E !== 'number' || typeof data.s !== 'string') return null;
  if (!data.k || typeof data.k !== 'object') return null;
  
  const k = data.k;
  if (typeof k.t !== 'number' || typeof k.T !== 'number') return null;
  if (typeof k.s !== 'string' || typeof k.i !== 'string') return null;
  if (typeof k.o !== 'string' || typeof k.c !== 'string') return null;
  if (typeof k.h !== 'string' || typeof k.l !== 'string') return null;
  if (typeof k.v !== 'string' || typeof k.x !== 'boolean') return null;
  
  return data as BinanceKlineMessage;
}

// Smart dual-mode validator
export function validateBinanceKlines(data: unknown): ProcessedKline[] {
  try {
    // ① First check: Is this already processed data?
    const processedArrayResult = ProcessedKlinesSchema.safeParse(data);
    if (processedArrayResult.success) {
      console.debug('[validateBinanceKlines] Data already processed, returning as-is');
      return processedArrayResult.data;
    }

    // ② Not processed yet - check if it's an array (Binance returns object on error)
    if (!Array.isArray(data)) {
      console.error('[validateBinanceKlines] Expected array, got:', typeof data, data);
      throw new Error(`Invalid klines payload: expected array, got ${typeof data}`);
    }

    // ③ Empty array handling
    if (data.length === 0) {
      console.warn('[validateBinanceKlines] Empty array received');
      return [];
    }

    if (shouldValidate) {
      // Full Zod validation in development/testing with safeParse
      const parseResult = BinanceKlinesResponseSchema.safeParse(data);
      if (!parseResult.success) {
        console.error('[validateBinanceKlines] Raw schema validation failed:', {
          error: parseResult.error.issues,
          dataLength: data.length,
          firstElement: data[0],
          sampleData: JSON.stringify(data.slice(0, 2)).slice(0, 500)
        });
        throw new Error('Binance klines raw schema validation failed');
      }
      
      return parseResult.data.map((kline, index) => {
        const processedResult = ProcessedKlineSchema.safeParse({
          time: Math.floor(Number(kline[0]) / 1000), // Convert ms to seconds
          open: parseFloat(String(kline[1])),
          high: parseFloat(String(kline[2])),
          low: parseFloat(String(kline[3])),
          close: parseFloat(String(kline[4])),
          volume: parseFloat(String(kline[5])),
        });
        
        if (!processedResult.success) {
          console.error(`[validateBinanceKlines] ProcessedKline validation failed at index ${index}:`, {
            error: processedResult.error.issues,
            rawKline: kline
          });
          throw new Error(`Failed to process kline data at index ${index}`);
        }
        
        return processedResult.data;
      });
    } else {
      // Fast validation in production with better error handling
      return (data as unknown[]).map((kline, index) => {
        if (!Array.isArray(kline) || kline.length < 6) {
          console.error(`[validateBinanceKlines] Invalid kline at index ${index}:`, kline);
          return null;
        }
        return {
          time: Math.floor(Number(kline[0]) / 1000), // Convert ms to seconds
          open: parseFloat(String(kline[1])),
          high: parseFloat(String(kline[2])),
          low: parseFloat(String(kline[3])),
          close: parseFloat(String(kline[4])),
          volume: parseFloat(String(kline[5])),
        };
      }).filter(Boolean) as ProcessedKline[];
    }
  } catch (error) {
    console.error('[validateBinanceKlines] Validation failed:', error);
    throw error; // Re-throw to let caller handle appropriately
  }
}

export function validateBinanceTradeMessage(data: unknown): BinanceTradeMessage | null {
  try {
    if (shouldValidate) {
      // Full Zod validation in development/testing with safeParse
      const result = BinanceTradeMessageSchema.safeParse(data);
      if (!result.success) {
        console.debug('[validateBinanceTradeMessage] Schema validation failed:', {
          issues: result.error.issues,
          data: JSON.stringify(data).slice(0, 200)
        });
        return null;
      }
      return result.data;
    } else {
      // Fast validation in production
      return fastValidateTradeMessage(data);
    }
  } catch (error) {
    console.debug('[validateBinanceTradeMessage] Validation error:', error);
    return null;
  }
}

export function validateBinanceKlineMessage(data: unknown): BinanceKlineMessage | null {
  try {
    if (shouldValidate) {
      // Full Zod validation in development/testing with safeParse
      const result = BinanceKlineMessageSchema.safeParse(data);
      if (!result.success) {
        console.debug('[validateBinanceKlineMessage] Schema validation failed:', {
          issues: result.error.issues,
          data: JSON.stringify(data).slice(0, 200)
        });
        return null;
      }
      return result.data;
    } else {
      // Fast validation in production
      return fastValidateKlineMessage(data);
    }
  } catch (error) {
    console.debug('[validateBinanceKlineMessage] Validation error:', error);
    return null;
  }
}