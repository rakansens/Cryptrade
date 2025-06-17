#!/usr/bin/env node

/**
 * Performance Benchmark Script
 * Measures baseline performance for critical functions
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// Performance measurement utilities
class PerformanceBenchmark {
  constructor() {
    this.metrics = new Map();
  }

  async measure(name, category, fn, samples = 100, metadata = {}) {
    const times = [];
    
    // Warm up
    for (let i = 0; i < 5; i++) {
      await fn();
    }
    
    // Actual measurements
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    const stats = this.calculateStats(times);
    
    this.metrics.set(name, {
      name,
      category,
      samples: times,
      stats,
      metadata
    });
  }

  calculateStats(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median,
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)],
      stdDev
    };
  }

  exportMetrics() {
    const metrics = Array.from(this.metrics.values());
    const byCategory = {};
    
    metrics.forEach(metric => {
      if (!byCategory[metric.category]) {
        byCategory[metric.category] = [];
      }
      byCategory[metric.category].push({
        name: metric.name,
        stats: metric.stats,
        metadata: metric.metadata
      });
    });
    
    const summary = {};
    Object.keys(byCategory).forEach(category => {
      const categoryMetrics = byCategory[category];
      const meanTimes = categoryMetrics.map(m => m.stats.mean);
      summary[category] = {
        count: categoryMetrics.length,
        avgMean: meanTimes.reduce((a, b) => a + b, 0) / meanTimes.length,
        totalMean: meanTimes.reduce((a, b) => a + b, 0)
      };
    });
    
    return {
      timestamp: new Date().toISOString(),
      totalMetrics: metrics.length,
      byCategory,
      summary
    };
  }
}

// Mock data generators
function generateMockCandles(count) {
  const candles = [];
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

// Simulate WebSocket message processing
function processWebSocketMessage(message) {
  // Parse message
  const parsed = typeof message === 'string' ? JSON.parse(message) : message;
  
  // Validate required fields
  if (!parsed.e || !parsed.s || !parsed.k) {
    throw new Error('Invalid message format');
  }
  
  // Transform to internal format
  return {
    symbol: parsed.s,
    eventType: parsed.e,
    eventTime: parsed.E,
    candle: {
      time: parsed.k.t,
      open: parseFloat(parsed.k.o),
      high: parseFloat(parsed.k.h),
      low: parseFloat(parsed.k.l),
      close: parseFloat(parsed.k.c),
      volume: parseFloat(parsed.k.v)
    }
  };
}

// Simulate pattern detection
function detectPatterns(candles, options = {}) {
  const patterns = [];
  const { lookbackPeriod = 50, minConfidence = 0.7 } = options;
  
  // Use recent data
  const recentCandles = candles.slice(-lookbackPeriod);
  
  // Find peaks and troughs
  const peaks = [];
  const troughs = [];
  
  for (let i = 1; i < recentCandles.length - 1; i++) {
    const prev = recentCandles[i - 1];
    const curr = recentCandles[i];
    const next = recentCandles[i + 1];
    
    if (curr.high > prev.high && curr.high > next.high) {
      peaks.push({ index: i, price: curr.high });
    }
    
    if (curr.low < prev.low && curr.low < next.low) {
      troughs.push({ index: i, price: curr.low });
    }
  }
  
  // Simulate head and shoulders detection
  if (peaks.length >= 3) {
    for (let i = 0; i < peaks.length - 2; i++) {
      const leftShoulder = peaks[i];
      const head = peaks[i + 1];
      const rightShoulder = peaks[i + 2];
      
      if (head.price > leftShoulder.price && 
          head.price > rightShoulder.price &&
          Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price < 0.02) {
        patterns.push({
          type: 'headAndShoulders',
          confidence: 0.75 + Math.random() * 0.2,
          startIndex: leftShoulder.index,
          endIndex: rightShoulder.index
        });
      }
    }
  }
  
  // Simulate double top detection
  if (peaks.length >= 2) {
    for (let i = 0; i < peaks.length - 1; i++) {
      const first = peaks[i];
      const second = peaks[i + 1];
      
      if (Math.abs(first.price - second.price) / first.price < 0.01) {
        patterns.push({
          type: 'doubleTop',
          confidence: 0.8 + Math.random() * 0.15,
          startIndex: first.index,
          endIndex: second.index
        });
      }
    }
  }
  
  return patterns.filter(p => p.confidence >= minConfidence);
}

// Simulate RSI calculation
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return [];
  
  const rsi = [];
  let gains = 0;
  let losses = 0;
  
  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate RSI for each subsequent price
  for (let i = period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

// Simulate moving average calculation
function calculateMA(prices, period) {
  const ma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

// Simulate support/resistance detection
function detectSupportResistance(candles) {
  const levels = [];
  const tolerance = 0.002; // 0.2% tolerance for clustering
  
  // Extract highs and lows
  const pricePoints = [];
  candles.forEach(candle => {
    pricePoints.push(candle.high);
    pricePoints.push(candle.low);
  });
  
  // Sort and cluster
  pricePoints.sort((a, b) => a - b);
  const clusters = [];
  let currentCluster = [pricePoints[0]];
  
  for (let i = 1; i < pricePoints.length; i++) {
    const price = pricePoints[i];
    const clusterAvg = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
    
    if (Math.abs(price - clusterAvg) / clusterAvg < tolerance) {
      currentCluster.push(price);
    } else {
      if (currentCluster.length >= 3) {
        levels.push({
          price: clusterAvg,
          touchCount: currentCluster.length,
          strength: Math.min(currentCluster.length / 10, 1)
        });
      }
      currentCluster = [price];
    }
  }
  
  return levels;
}

async function runBenchmarks() {
  console.log('🚀 Starting performance benchmarks...\n');
  
  const benchmark = new PerformanceBenchmark();
  
  // 1. WebSocket Message Handling
  console.log('📡 Benchmarking WebSocket operations...');
  
  const mockMessage = {
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
  
  await benchmark.measure(
    'ws_message_parse_and_transform',
    'websocket',
    async () => {
      const stringified = JSON.stringify(mockMessage);
      processWebSocketMessage(stringified);
    },
    10000,
    { messageSize: JSON.stringify(mockMessage).length }
  );
  
  await benchmark.measure(
    'ws_batch_message_processing',
    'websocket',
    async () => {
      const messages = Array(10).fill(mockMessage);
      messages.forEach(msg => processWebSocketMessage(msg));
    },
    1000,
    { batchSize: 10 }
  );
  
  // 2. Pattern Detection
  console.log('🔍 Benchmarking pattern detection...');
  
  const candles100 = generateMockCandles(100);
  const candles500 = generateMockCandles(500);
  const candles1000 = generateMockCandles(1000);
  
  await benchmark.measure(
    'pattern_detect_100_candles',
    'pattern',
    async () => detectPatterns(candles100, { lookbackPeriod: 50 }),
    100,
    { candleCount: 100, lookbackPeriod: 50 }
  );
  
  await benchmark.measure(
    'pattern_detect_500_candles',
    'pattern',
    async () => detectPatterns(candles500, { lookbackPeriod: 100 }),
    50,
    { candleCount: 500, lookbackPeriod: 100 }
  );
  
  await benchmark.measure(
    'pattern_detect_1000_candles',
    'pattern',
    async () => detectPatterns(candles1000, { lookbackPeriod: 200 }),
    20,
    { candleCount: 1000, lookbackPeriod: 200 }
  );
  
  // 3. Technical Indicators
  console.log('📊 Benchmarking technical indicators...');
  
  const prices100 = candles100.map(c => c.close);
  const prices500 = candles500.map(c => c.close);
  const prices1000 = candles1000.map(c => c.close);
  
  await benchmark.measure(
    'rsi_calculate_100_prices',
    'indicator',
    async () => calculateRSI(prices100, 14),
    1000,
    { priceCount: 100, period: 14 }
  );
  
  await benchmark.measure(
    'rsi_calculate_500_prices',
    'indicator',
    async () => calculateRSI(prices500, 14),
    500,
    { priceCount: 500, period: 14 }
  );
  
  await benchmark.measure(
    'ma_calculate_100_prices',
    'indicator',
    async () => calculateMA(prices100, 20),
    1000,
    { priceCount: 100, period: 20 }
  );
  
  await benchmark.measure(
    'ma_calculate_500_prices',
    'indicator',
    async () => calculateMA(prices500, 50),
    500,
    { priceCount: 500, period: 50 }
  );
  
  // 4. Chart Analysis
  console.log('📈 Benchmarking chart analysis...');
  
  await benchmark.measure(
    'support_resistance_detect_100',
    'analysis',
    async () => detectSupportResistance(candles100),
    200,
    { candleCount: 100 }
  );
  
  await benchmark.measure(
    'support_resistance_detect_500',
    'analysis',
    async () => detectSupportResistance(candles500),
    100,
    { candleCount: 500 }
  );
  
  await benchmark.measure(
    'trend_analysis_500',
    'analysis',
    async () => {
      const closes = candles500.map(c => c.close);
      const ma20 = calculateMA(closes, 20);
      const ma50 = calculateMA(closes, 50);
      
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
  
  // 5. Complex Operations
  console.log('🔧 Benchmarking complex operations...');
  
  await benchmark.measure(
    'full_market_analysis',
    'analysis',
    async () => {
      const prices = candles500.map(c => c.close);
      
      // Calculate all indicators
      const rsi = calculateRSI(prices, 14);
      const ma20 = calculateMA(prices, 20);
      const ma50 = calculateMA(prices, 50);
      
      // Detect patterns
      const patterns = detectPatterns(candles500);
      
      // Find support/resistance
      const levels = detectSupportResistance(candles500);
      
      return {
        indicators: { rsi: rsi[rsi.length - 1], ma20: ma20[ma20.length - 1], ma50: ma50[ma50.length - 1] },
        patterns: patterns.length,
        levels: levels.length
      };
    },
    50,
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
}

// Run benchmarks
runBenchmarks().catch(console.error);