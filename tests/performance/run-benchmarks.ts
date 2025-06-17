/**
 * Performance Benchmark Runner
 * Measures baseline performance for critical functions
 */

import fs from 'fs/promises';
import path from 'path';
import { PerformanceBenchmark } from './performance-benchmark';
import { WSManager } from '@/lib/ws/WSManager';
import { PatternDetector } from '@/lib/analysis/pattern-detector';
import { calculateRSI } from '@/lib/indicators/rsi';
import { calculateMovingAverage } from '@/lib/indicators/moving-average';
import { calculateBollingerBands } from '@/lib/indicators/bollinger-bands';
import { calculateMACD } from '@/lib/indicators/macd';
import type { PriceData } from '@/types/market';

// Mock data generators
function generateMockCandles(count: number): PriceData[] {
  const candles: PriceData[] = [];
  let basePrice = 50000;
  const baseTime = Date.now() - count * 60000;
  
  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 1000;
    const open = basePrice;
    const close = basePrice + variation;
    const high = Math.max(open, close) + Math.random() * 500;
    const low = Math.min(open, close) - Math.random() * 500;
    
    candles.push({
      time: baseTime + i * 60000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000
    });
    
    basePrice = close;
  }
  
  return candles;
}

function generateMockWSMessage() {
  return {
    e: 'kline',
    E: Date.now(),
    s: 'BTCUSDT',
    k: {
      t: Date.now(),
      o: '50000',
      h: '50500',
      l: '49500',
      c: '50250',
      v: '1000000'
    }
  };
}

async function runBenchmarks() {
  console.log('🚀 Starting performance benchmarks...\n');
  
  const benchmark = new PerformanceBenchmark();
  
  // 1. WebSocket Message Handling
  console.log('📡 Benchmarking WebSocket operations...');
  
  // WSManager message parsing
  const wsManager = new WSManager({ debug: false });
  const mockMessage = generateMockWSMessage();
  
  await benchmark.measureSync(
    'ws_message_parse',
    'websocket',
    () => {
      // Simulate message parsing
      const parsed = JSON.stringify(mockMessage);
      JSON.parse(parsed);
    },
    10000,
    { messageSize: JSON.stringify(mockMessage).length }
  );
  
  // WebSocket subscription handling
  await benchmark.measure(
    'ws_subscription_create',
    'websocket',
    async () => {
      const subscription = wsManager.subscribe('btcusdt@kline_1m');
      subscription.subscribe().unsubscribe();
    },
    100,
    { streamName: 'btcusdt@kline_1m' }
  );
  
  // 2. Pattern Detection
  console.log('🔍 Benchmarking pattern detection...');
  
  const candles100 = generateMockCandles(100);
  const candles500 = generateMockCandles(500);
  const candles1000 = generateMockCandles(1000);
  
  const detector100 = new PatternDetector(candles100);
  const detector500 = new PatternDetector(candles500);
  const detector1000 = new PatternDetector(candles1000);
  
  await benchmark.measureSync(
    'pattern_detect_100_candles',
    'pattern',
    () => detector100.detectPatterns({
      lookbackPeriod: 50,
      minConfidence: 0.7,
      patternTypes: ['headAndShoulders', 'doubleTop', 'ascendingTriangle']
    }),
    100,
    { candleCount: 100, lookbackPeriod: 50 }
  );
  
  await benchmark.measureSync(
    'pattern_detect_500_candles',
    'pattern',
    () => detector500.detectPatterns({
      lookbackPeriod: 100,
      minConfidence: 0.7,
      patternTypes: ['headAndShoulders', 'doubleTop', 'ascendingTriangle']
    }),
    50,
    { candleCount: 500, lookbackPeriod: 100 }
  );
  
  await benchmark.measureSync(
    'pattern_detect_1000_candles',
    'pattern',
    () => detector1000.detectPatterns({
      lookbackPeriod: 200,
      minConfidence: 0.7,
      patternTypes: ['headAndShoulders', 'doubleTop', 'ascendingTriangle']
    }),
    20,
    { candleCount: 1000, lookbackPeriod: 200 }
  );
  
  // 3. Technical Indicators
  console.log('📊 Benchmarking technical indicators...');
  
  const prices100 = candles100.map(c => c.close);
  const prices500 = candles500.map(c => c.close);
  
  // RSI
  await benchmark.measureSync(
    'rsi_calculate_100_prices',
    'indicator',
    () => calculateRSI(prices100, 14),
    1000,
    { priceCount: 100, period: 14 }
  );
  
  await benchmark.measureSync(
    'rsi_calculate_500_prices',
    'indicator',
    () => calculateRSI(prices500, 14),
    500,
    { priceCount: 500, period: 14 }
  );
  
  // Moving Average
  await benchmark.measureSync(
    'ma_calculate_100_prices',
    'indicator',
    () => calculateMovingAverage(prices100, 20),
    1000,
    { priceCount: 100, period: 20 }
  );
  
  await benchmark.measureSync(
    'ma_calculate_500_prices',
    'indicator',
    () => calculateMovingAverage(prices500, 50),
    500,
    { priceCount: 500, period: 50 }
  );
  
  // Bollinger Bands
  await benchmark.measureSync(
    'bb_calculate_100_prices',
    'indicator',
    () => calculateBollingerBands(prices100, 20, 2),
    1000,
    { priceCount: 100, period: 20, stdDev: 2 }
  );
  
  // MACD
  await benchmark.measureSync(
    'macd_calculate_100_prices',
    'indicator',
    () => calculateMACD(prices100, 12, 26, 9),
    1000,
    { priceCount: 100, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }
  );
  
  // 4. Chart Analysis (simulated)
  console.log('📈 Benchmarking chart analysis...');
  
  // Support/Resistance calculation
  await benchmark.measureSync(
    'support_resistance_detect',
    'analysis',
    () => {
      const highs = candles500.map(c => c.high);
      const lows = candles500.map(c => c.low);
      const levels: number[] = [];
      
      // Simple peak/trough detection
      for (let i = 1; i < highs.length - 1; i++) {
        if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) {
          levels.push(highs[i]);
        }
        if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) {
          levels.push(lows[i]);
        }
      }
      
      // Cluster nearby levels
      levels.sort((a, b) => a - b);
      const clusters: number[] = [];
      let currentCluster: number[] = [];
      
      for (const level of levels) {
        if (currentCluster.length === 0 || 
            Math.abs(level - currentCluster[currentCluster.length - 1]) < 100) {
          currentCluster.push(level);
        } else {
          if (currentCluster.length > 0) {
            clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
          }
          currentCluster = [level];
        }
      }
      
      return clusters;
    },
    100,
    { candleCount: 500 }
  );
  
  // Trend analysis
  await benchmark.measureSync(
    'trend_analysis',
    'analysis',
    () => {
      const closes = candles500.map(c => c.close);
      const ma20 = calculateMovingAverage(closes, 20);
      const ma50 = calculateMovingAverage(closes, 50);
      
      // Simple trend detection
      const recentMA20 = ma20.slice(-10);
      const recentMA50 = ma50.slice(-10);
      
      const ma20Slope = (recentMA20[recentMA20.length - 1] - recentMA20[0]) / recentMA20.length;
      const ma50Slope = (recentMA50[recentMA50.length - 1] - recentMA50[0]) / recentMA50.length;
      
      return {
        trend: ma20Slope > 0 && ma50Slope > 0 ? 'bullish' : 
               ma20Slope < 0 && ma50Slope < 0 ? 'bearish' : 'sideways',
        strength: Math.abs((ma20Slope + ma50Slope) / 2)
      };
    },
    100,
    { candleCount: 500 }
  );
  
  // Export results
  const results = benchmark.exportMetrics();
  
  console.log('\n✅ Benchmarks completed!');
  console.log('\n📊 Summary:');
  console.log(JSON.stringify(results.summary, null, 2));
  
  // Save to file
  const outputPath = path.join(process.cwd(), 'perf_before.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
  
  // Cleanup
  wsManager.destroy();
}

// Run benchmarks
runBenchmarks().catch(console.error);