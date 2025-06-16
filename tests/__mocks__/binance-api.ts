/**
 * Binance API モック
 */

import { mockKlineData, mockTickerData, mockDepthData } from '../__fixtures__/binance/websocket-responses';

export class MockBinanceAPIService {
  private subscriptions = new Map<string, any>();
  private intervalIds = new Map<string, NodeJS.Timeout>();

  async getKlines(symbol: string, interval: string, limit: number = 100) {
    // Return mock historical kline data
    const klines = [];
    const now = Date.now();
    const intervalMs = this.getIntervalMs(interval);
    
    for (let i = limit - 1; i >= 0; i--) {
      const time = now - (i * intervalMs);
      const open = 48000 + Math.random() * 1000 - 500;
      const close = open + (Math.random() - 0.5) * 200;
      const high = Math.max(open, close) + Math.random() * 100;
      const low = Math.min(open, close) - Math.random() * 100;
      
      klines.push([
        time,
        open.toFixed(2),
        high.toFixed(2),
        low.toFixed(2),
        close.toFixed(2),
        (Math.random() * 1000).toFixed(8),
        time + intervalMs - 1,
        (Math.random() * 50000000).toFixed(8),
        Math.floor(Math.random() * 1000),
        (Math.random() * 500).toFixed(8),
        (Math.random() * 25000000).toFixed(8),
        '0'
      ]);
    }
    
    return klines;
  }

  async get24hrTicker(symbol: string) {
    return {
      symbol,
      priceChange: '500.00',
      priceChangePercent: '1.04',
      weightedAvgPrice: '48250.00',
      prevClosePrice: '48000.00',
      lastPrice: '48500.00',
      lastQty: '0.50000000',
      bidPrice: '48499.00',
      bidQty: '10.00000000',
      askPrice: '48501.00',
      askQty: '10.00000000',
      openPrice: '48000.00',
      highPrice: '49000.00',
      lowPrice: '47500.00',
      volume: '10000.00000000',
      quoteVolume: '482500000.00000000',
      openTime: Date.now() - 86400000,
      closeTime: Date.now(),
      firstId: 100,
      lastId: 200,
      count: 100
    };
  }

  async getOrderBook(symbol: string, limit: number = 100) {
    const bids = [];
    const asks = [];
    const basePrice = 48500;
    
    for (let i = 0; i < limit; i++) {
      bids.push([
        (basePrice - i * 0.1).toFixed(2),
        (Math.random() * 10).toFixed(8)
      ]);
      asks.push([
        (basePrice + i * 0.1).toFixed(2),
        (Math.random() * 10).toFixed(8)
      ]);
    }
    
    return {
      lastUpdateId: Date.now(),
      bids,
      asks
    };
  }

  subscribeToStream(stream: string, callback: (data: any) => void) {
    this.subscriptions.set(stream, callback);
    
    // Simulate real-time updates
    const intervalId = setInterval(() => {
      if (stream.includes('kline')) {
        callback(mockKlineData);
      } else if (stream.includes('ticker')) {
        callback(mockTickerData);
      } else if (stream.includes('depth')) {
        callback(mockDepthData);
      }
    }, 1000);
    
    this.intervalIds.set(stream, intervalId);
    
    return () => {
      this.unsubscribeFromStream(stream);
    };
  }

  unsubscribeFromStream(stream: string) {
    this.subscriptions.delete(stream);
    const intervalId = this.intervalIds.get(stream);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(stream);
    }
  }

  private getIntervalMs(interval: string): number {
    const intervalMap: Record<string, number> = {
      '1m': 60000,
      '3m': 180000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '2h': 7200000,
      '4h': 14400000,
      '6h': 21600000,
      '8h': 28800000,
      '12h': 43200000,
      '1d': 86400000,
      '3d': 259200000,
      '1w': 604800000,
      '1M': 2592000000
    };
    
    return intervalMap[interval] || 3600000;
  }
}

export const mockBinanceAPI = new MockBinanceAPIService();