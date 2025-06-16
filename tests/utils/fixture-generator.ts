/**
 * 動的フィクスチャ生成ユーティリティ
 */

import { CandlestickData, Time } from 'lightweight-charts';

export class FixtureGenerator {
  /**
   * リアルな価格変動を持つローソク足データを生成
   */
  static generateRealisticCandlestickData(options: {
    symbol?: string;
    startPrice?: number;
    startTime?: number;
    count?: number;
    interval?: number;
    trend?: 'bullish' | 'bearish' | 'sideways';
    volatility?: 'low' | 'medium' | 'high';
  } = {}): CandlestickData[] {
    const {
      startPrice = 48000,
      startTime = Date.now() / 1000 - 86400 * 30,
      count = 500,
      interval = 3600,
      trend = 'sideways',
      volatility = 'medium'
    } = options;

    const volatilityMap = { low: 0.001, medium: 0.005, high: 0.015 };
    const trendMap = { bullish: 0.0001, bearish: -0.0001, sideways: 0 };
    
    const data: CandlestickData[] = [];
    let currentPrice = startPrice;
    
    for (let i = 0; i < count; i++) {
      const time = (startTime + i * interval) as Time;
      const vol = volatilityMap[volatility];
      const trendBias = trendMap[trend];
      
      // Add some market structure
      const hourOfDay = new Date((time as number) * 1000).getHours();
      const dayOfWeek = new Date((time as number) * 1000).getDay();
      
      // Higher volatility during market hours
      const timeVolatility = (hourOfDay >= 9 && hourOfDay <= 16) ? 1.5 : 1;
      
      // Weekend lower volatility
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1;
      
      const effectiveVolatility = vol * timeVolatility * weekendFactor;
      
      // Generate realistic OHLC
      const open = currentPrice;
      const direction = Math.random() - 0.5 + trendBias * 10;
      const range = Math.abs(direction) * currentPrice * effectiveVolatility;
      
      let high, low, close;
      
      if (direction > 0) {
        high = open + range * (1 + Math.random() * 0.3);
        low = open - range * Math.random() * 0.3;
        close = open + range * (0.3 + Math.random() * 0.7);
      } else {
        high = open + range * Math.random() * 0.3;
        low = open - range * (1 + Math.random() * 0.3);
        close = open - range * (0.3 + Math.random() * 0.7);
      }
      
      data.push({
        time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2))
      });
      
      currentPrice = close;
    }
    
    return data;
  }

  /**
   * パターンを含むチャートデータを生成
   */
  static generatePatternData(patternType: string, options: any = {}) {
    const baseData = this.generateRealisticCandlestickData({ count: 200, ...options });
    
    switch (patternType) {
      case 'triangle':
        return this.addTrianglePattern(baseData);
      case 'head-and-shoulders':
        return this.addHeadAndShouldersPattern(baseData);
      case 'double-top':
        return this.addDoubleTopPattern(baseData);
      case 'flag':
        return this.addFlagPattern(baseData);
      default:
        return baseData;
    }
  }

  private static addTrianglePattern(data: CandlestickData[]): CandlestickData[] {
    const patternStart = Math.floor(data.length * 0.6);
    const patternLength = 30;
    
    for (let i = 0; i < patternLength; i++) {
      const index = patternStart + i;
      if (index >= data.length) break;
      
      const convergence = 1 - (i / patternLength) * 0.5;
      const candle = data[index];
      if (!candle) continue;
      const middle = (candle.high + candle.low) / 2;
      const range = (candle.high - candle.low) * convergence;
      
      data[index] = {
        ...candle,
        high: middle + range / 2,
        low: middle - range / 2,
        open: middle - range / 4 + Math.random() * range / 2,
        close: middle - range / 4 + Math.random() * range / 2
      };
    }
    
    return data;
  }

  private static addHeadAndShouldersPattern(data: CandlestickData[]): CandlestickData[] {
    const patternStart = Math.floor(data.length * 0.5);
    const shoulderHeight = 200;
    const headHeight = 400;
    
    // Left shoulder
    for (let i = 0; i < 10; i++) {
      const index = patternStart + i;
      if (index >= data.length) break;
      
      const progress = i / 10;
      const height = Math.sin(progress * Math.PI) * shoulderHeight;
      this.adjustCandle(data, index, height);
    }
    
    // Head
    for (let i = 0; i < 10; i++) {
      const index = patternStart + 15 + i;
      if (index >= data.length) break;
      
      const progress = i / 10;
      const height = Math.sin(progress * Math.PI) * headHeight;
      this.adjustCandle(data, index, height);
    }
    
    // Right shoulder
    for (let i = 0; i < 10; i++) {
      const index = patternStart + 30 + i;
      if (index >= data.length) break;
      
      const progress = i / 10;
      const height = Math.sin(progress * Math.PI) * shoulderHeight;
      this.adjustCandle(data, index, height);
    }
    
    return data;
  }

  private static addDoubleTopPattern(data: CandlestickData[]): CandlestickData[] {
    const patternStart = Math.floor(data.length * 0.6);
    const topHeight = 300;
    
    // First top
    for (let i = 0; i < 15; i++) {
      const index = patternStart + i;
      if (index >= data.length) break;
      
      const progress = i / 15;
      const height = Math.sin(progress * Math.PI) * topHeight;
      this.adjustCandle(data, index, height);
    }
    
    // Second top
    for (let i = 0; i < 15; i++) {
      const index = patternStart + 20 + i;
      if (index >= data.length) break;
      
      const progress = i / 15;
      const height = Math.sin(progress * Math.PI) * topHeight * 0.95; // Slightly lower
      this.adjustCandle(data, index, height);
    }
    
    return data;
  }

  private static addFlagPattern(data: CandlestickData[]): CandlestickData[] {
    const patternStart = Math.floor(data.length * 0.7);
    
    // Strong move up (pole)
    for (let i = 0; i < 5; i++) {
      const index = patternStart + i;
      if (index >= data.length) break;
      
      const candle = data[index];
      if (!candle) continue;
      const increase = 100 * (i + 1);
      data[index] = {
        ...candle,
        open: candle.open + increase,
        high: candle.high + increase + 50,
        low: candle.low + increase,
        close: candle.close + increase + 40
      };
    }
    
    // Consolidation (flag)
    const flagStart = patternStart + 5;
    const basePrice = data[flagStart - 1]?.close ?? 0;
    
    for (let i = 0; i < 10; i++) {
      const index = flagStart + i;
      if (index >= data.length) break;
      
      const drift = -10 * i; // Slight downward drift
      const range = 50;
      
      const existingCandle = data[index];
      if (!existingCandle) continue;
      data[index] = {
        time: existingCandle.time,
        open: basePrice + drift + Math.random() * range - range / 2,
        high: basePrice + drift + range,
        low: basePrice + drift - range,
        close: basePrice + drift + Math.random() * range - range / 2
      };
    }
    
    return data;
  }

  private static adjustCandle(data: CandlestickData[], index: number, adjustment: number) {
    if (index >= data.length) return;
    
    const candle = data[index];
    if (!candle) return;
    data[index] = {
      ...candle,
      open: candle.open + adjustment,
      high: candle.high + adjustment + Math.random() * 20,
      low: candle.low + adjustment - Math.random() * 20,
      close: candle.close + adjustment
    };
  }

  /**
   * WebSocketストリームデータを生成
   */
  static *generateWebSocketStream(options: {
    type: 'kline' | 'trade' | 'depth' | 'ticker';
    symbol?: string;
    interval?: string;
    count?: number;
    delay?: number;
  }) {
    const { type, symbol = 'BTCUSDT', interval = '1m', count = 100 } = options;
    
    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'kline':
          yield this.generateKlineMessage(symbol, interval, i);
          break;
        case 'trade':
          yield this.generateTradeMessage(symbol, i);
          break;
        case 'depth':
          yield this.generateDepthMessage(symbol, i);
          break;
        case 'ticker':
          yield this.generateTickerMessage(symbol, i);
          break;
      }
    }
  }

  private static generateKlineMessage(symbol: string, interval: string, index: number) {
    const now = Date.now();
    const price = 48000 + Math.sin(index / 10) * 1000 + (Math.random() - 0.5) * 200;
    
    return {
      e: 'kline',
      E: now,
      s: symbol,
      k: {
        t: now - 60000,
        T: now,
        s: symbol,
        i: interval,
        f: 100 + index * 10,
        L: 109 + index * 10,
        o: (price - 50).toFixed(2),
        c: price.toFixed(2),
        h: (price + 50).toFixed(2),
        l: (price - 50).toFixed(2),
        v: (100 + Math.random() * 100).toFixed(8),
        n: Math.floor(100 + Math.random() * 100),
        x: false,
        q: (price * 100).toFixed(8),
        V: (50 + Math.random() * 50).toFixed(8),
        Q: (price * 50).toFixed(8),
        B: '0'
      }
    };
  }

  private static generateTradeMessage(symbol: string, index: number) {
    const price = 48000 + (Math.random() - 0.5) * 100;
    
    return {
      e: 'trade',
      E: Date.now(),
      s: symbol,
      t: 1000000 + index,
      p: price.toFixed(2),
      q: (Math.random() * 2).toFixed(8),
      b: Math.floor(Math.random() * 1000),
      a: Math.floor(Math.random() * 1000),
      T: Date.now(),
      m: Math.random() > 0.5,
      M: true
    };
  }

  private static generateDepthMessage(symbol: string, index: number) {
    const basePrice = 48000;
    const bids = [];
    const asks = [];
    
    for (let i = 0; i < 10; i++) {
      bids.push([
        (basePrice - i * 10).toFixed(2),
        (Math.random() * 10).toFixed(8)
      ]);
      asks.push([
        (basePrice + i * 10).toFixed(2),
        (Math.random() * 10).toFixed(8)
      ]);
    }
    
    return {
      e: 'depthUpdate',
      E: Date.now(),
      s: symbol,
      U: 1000000 + index * 2,
      u: 1000001 + index * 2,
      b: bids,
      a: asks
    };
  }

  private static generateTickerMessage(symbol: string, index: number) {
    const price = 48000 + Math.sin(index / 20) * 500;
    const change = (Math.random() - 0.5) * 1000;
    
    return {
      e: '24hrTicker',
      E: Date.now(),
      s: symbol,
      p: change.toFixed(2),
      P: ((change / price) * 100).toFixed(2),
      w: (price - 50).toFixed(2),
      x: (price - change).toFixed(2),
      c: price.toFixed(2),
      Q: (Math.random() * 2).toFixed(8),
      b: (price - 1).toFixed(2),
      B: (Math.random() * 10).toFixed(8),
      a: (price + 1).toFixed(2),
      A: (Math.random() * 10).toFixed(8),
      o: (price - change).toFixed(2),
      h: (price + 200).toFixed(2),
      l: (price - 200).toFixed(2),
      v: (10000 + Math.random() * 5000).toFixed(8),
      q: ((price * 10000).toFixed(8)),
      O: Date.now() - 86400000,
      C: Date.now(),
      F: 100000 + index * 100,
      L: 100099 + index * 100,
      n: 100
    };
  }
}