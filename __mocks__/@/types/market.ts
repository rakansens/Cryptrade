// Mock for market types
import { z } from 'zod';

// Mock environment for testing
const mockEnv = {
  NODE_ENV: process.env.NODE_ENV || 'test',
  FORCE_VALIDATION: process.env.FORCE_VALIDATION === 'true'
};

// Binance Ticker 24hr Schema
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

// Binance Kline Response Schema
export const BinanceKlineTupleSchema = z.array(z.union([z.string(), z.number()]))
  .min(6)
  .transform((arr) => {
    while (arr.length < 12) arr.push('0');
    return arr as [number, string, string, string, string, string, number, string, number, string, string, string];
  });

export const BinanceKlinesResponseSchema = z.array(BinanceKlineTupleSchema);

export const ProcessedKlineSchema = z.object({
  time: z.number().min(0),
  open: z.number().min(0),
  high: z.number().min(0),
  low: z.number().min(0),
  close: z.number().min(0),
  volume: z.number().min(0),
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

export const ProcessedKlinesSchema = z.array(ProcessedKlineSchema);

export interface ProcessedKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface Ticker {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
}

export type BinanceTicker24hr = z.infer<typeof BinanceTicker24hrSchema>;

// Environment-aware validation helpers
const shouldValidate = mockEnv.NODE_ENV !== 'production' || mockEnv.FORCE_VALIDATION === true;

// Smart dual-mode validator that matches the real implementation
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
      console.warn('[validateBinanceKlines] Empty array received', {
        reason: 'No kline data provided from Binance API',
        suggestion: 'Check if the symbol, interval, and time range are valid'
      });
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
      const invalidKlines: Array<{ index: number; kline: unknown }> = [];
      
      const processed = (data as unknown[]).map((kline, index) => {
        if (!Array.isArray(kline) || kline.length < 6) {
          invalidKlines.push({ index, kline });
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
      
      if (invalidKlines.length > 0) {
        console.error(`[validateBinanceKlines] Filtered out ${invalidKlines.length} invalid klines`, {
          totalKlines: data.length,
          validKlines: processed.length,
          invalidSamples: invalidKlines.slice(0, 3), // Show first 3 invalid entries
          reason: 'Klines must be arrays with at least 6 elements [time, open, high, low, close, volume]'
        });
      }
      
      return processed;
    }
  } catch (error: unknown) {
    console.error('[validateBinanceKlines] Validation failed:', error);
    throw error; // Re-throw to let caller handle appropriately
  }
}