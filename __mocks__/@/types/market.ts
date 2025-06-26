// Mock for market types
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