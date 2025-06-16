/**
 * ローソク足データのフィクスチャ
 */

import { CandlestickData, Time } from 'lightweight-charts';

export const generateCandlestickData = (
  count: number = 100,
  startTime: number = Date.now() / 1000 - 86400 * 30, // 30 days ago
  interval: number = 3600 // 1 hour in seconds
): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let currentPrice = 48000;
  
  for (let i = 0; i < count; i++) {
    const time = (startTime + i * interval) as Time;
    const volatility = 0.02;
    const trend = Math.sin(i / 20) * 0.01; // Sinusoidal trend
    
    // Generate OHLC with realistic relationships
    const open = currentPrice;
    const change = (Math.random() - 0.5 + trend) * currentPrice * volatility;
    const high = Math.max(open, open + Math.abs(change) * (1 + Math.random()));
    const low = Math.min(open, open - Math.abs(change) * (1 + Math.random()));
    const close = open + change;
    
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
};

export const mockCandlestickData: CandlestickData[] = [
  { time: 1638360000 as Time, open: 48000, high: 48500, low: 47800, close: 48300 },
  { time: 1638363600 as Time, open: 48300, high: 48600, low: 48100, close: 48400 },
  { time: 1638367200 as Time, open: 48400, high: 48800, low: 48200, close: 48700 },
  { time: 1638370800 as Time, open: 48700, high: 49000, low: 48500, close: 48900 },
  { time: 1638374400 as Time, open: 48900, high: 49200, low: 48700, close: 48800 },
  { time: 1638378000 as Time, open: 48800, high: 49000, low: 48600, close: 48700 },
  { time: 1638381600 as Time, open: 48700, high: 48900, low: 48400, close: 48500 },
  { time: 1638385200 as Time, open: 48500, high: 48700, low: 48300, close: 48600 },
  { time: 1638388800 as Time, open: 48600, high: 48800, low: 48400, close: 48700 },
  { time: 1638392400 as Time, open: 48700, high: 49100, low: 48600, close: 49000 }
];

export const mockVolumeData = mockCandlestickData.map((candle, index) => ({
  time: candle.time,
  value: Math.random() * 1000 + 500,
  color: candle.close >= candle.open ? '#26a69a' : '#ef5350'
}));

export const generateTrendingData = (
  trend: 'up' | 'down' | 'sideways' = 'up',
  count: number = 100
): CandlestickData[] => {
  const data: CandlestickData[] = [];
  let currentPrice = 48000;
  const startTime = Date.now() / 1000 - 86400 * 10;
  
  for (let i = 0; i < count; i++) {
    const time = (startTime + i * 3600) as Time;
    let trendFactor = 0;
    
    switch (trend) {
      case 'up':
        trendFactor = 0.001;
        break;
      case 'down':
        trendFactor = -0.001;
        break;
      case 'sideways':
        trendFactor = 0;
        break;
    }
    
    const open = currentPrice;
    const change = (Math.random() - 0.5 + trendFactor) * currentPrice * 0.01;
    const high = Math.max(open, open + Math.abs(change) * (1 + Math.random() * 0.5));
    const low = Math.min(open, open - Math.abs(change) * (1 + Math.random() * 0.5));
    const close = open + change;
    
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
};

export const generateVolatileData = (
  volatilityLevel: 'low' | 'medium' | 'high' = 'medium',
  count: number = 100
): CandlestickData[] => {
  const volatilityMap = {
    low: 0.005,
    medium: 0.02,
    high: 0.05
  };
  
  const volatility = volatilityMap[volatilityLevel];
  return generateCandlestickData(count, Date.now() / 1000 - 86400 * 10, 3600).map(candle => {
    const range = candle.high - candle.low;
    const newRange = range * (volatility / 0.02); // Adjust based on baseline
    const mid = (candle.high + candle.low) / 2;
    
    return {
      ...candle,
      high: Number((mid + newRange / 2).toFixed(2)),
      low: Number((mid - newRange / 2).toFixed(2))
    };
  });
};

export const mockRealtimeUpdate = (lastCandle: CandlestickData): CandlestickData => {
  const change = (Math.random() - 0.5) * 100;
  const newClose = lastCandle.close + change;
  
  return {
    time: lastCandle.time,
    open: lastCandle.open,
    high: Math.max(lastCandle.high, newClose),
    low: Math.min(lastCandle.low, newClose),
    close: Number(newClose.toFixed(2))
  };
};