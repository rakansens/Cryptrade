// Mock for market types
import { z } from 'zod';

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
});

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

// Helper function for validating Binance klines
export function validateBinanceKlines(data: unknown): ProcessedKline[] {
  if (!Array.isArray(data)) {
    throw new Error(`Invalid klines payload: expected array, got ${typeof data}`);
  }
  
  if (data.length === 0) {
    return [];
  }
  
  const result = BinanceKlinesResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Binance klines validation failed');
  }
  
  return result.data.map((kline) => ({
    time: Math.floor(Number(kline[0]) / 1000),
    open: parseFloat(String(kline[1])),
    high: parseFloat(String(kline[2])),
    low: parseFloat(String(kline[3])),
    close: parseFloat(String(kline[4])),
    volume: parseFloat(String(kline[5])),
  }));
}