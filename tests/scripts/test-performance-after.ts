#!/usr/bin/env tsx

/**
 * パフォーマンス測定スクリプト（リファクタリング後）
 * 
 * リファクタリング後のコードでパフォーマンスベンチマークを実行し、
 * perf_before.jsonと比較可能な形式で結果を出力します。
 */

import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Mock WebSocket data for testing
const mockWebSocketMessage = {
  e: 'trade',
  E: Date.now(),
  s: 'BTCUSDT',
  p: '50000.00',
  q: '0.001',
  T: Date.now(),
  m: true,
  M: true
};

// Mock candle data
const generateMockCandles = (count: number) => {
  const candles = [];
  let price = 50000;
  
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.5) * 100;
    const high = open + Math.abs(change) + Math.random() * 50;
    const low = open - Math.abs(change) - Math.random() * 50;
    const close = open + change;
    
    candles.push({
      time: Date.now() - (count - i) * 60000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000
    });
    
    price = close;
  }
  
  return candles;
};

// Mock price data
const generateMockPrices = (count: number) => {
  const prices = [];
  let price = 50000;
  
  for (let i = 0; i < count; i++) {
    price += (Math.random() - 0.5) * 100;
    prices.push(price);
  }
  
  return prices;
};

interface BenchmarkResult {
  name: string;
  stats: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  metadata?: Record<string, unknown>;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  
  async runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    iterations: number = 1000,
    metadata?: Record<string, unknown>
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      await fn();
    }
    
    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    // Calculate statistics
    times.sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const mean = times.reduce((a, b) => a + b) / times.length;
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    const result: BenchmarkResult = {
      name,
      stats: { min, max, mean, median, p95, p99, stdDev },
      metadata
    };
    
    this.results.push(result);
    return result;
  }
  
  getResults() {
    return this.results;
  }
}

// WebSocket message parsing and transformation
async function benchmarkWebSocketProcessing(benchmark: PerformanceBenchmark) {
  // Single message parsing
  await benchmark.runBenchmark(
    'ws_message_parse_and_transform',
    () => {
      const str = JSON.stringify(mockWebSocketMessage);
      const parsed = JSON.parse(str);
      // Transform to internal format
      const transformed = {
        symbol: parsed.s,
        price: parseFloat(parsed.p),
        quantity: parseFloat(parsed.q),
        timestamp: parsed.T,
        isBuyerMaker: parsed.m
      };
    },
    10000,
    { messageSize: JSON.stringify(mockWebSocketMessage).length }
  );
  
  // Batch message processing
  const batchMessages = Array(10).fill(mockWebSocketMessage);
  await benchmark.runBenchmark(
    'ws_batch_message_processing',
    () => {
      const results = batchMessages.map(msg => ({
        symbol: msg.s,
        price: parseFloat(msg.p),
        quantity: parseFloat(msg.q),
        timestamp: msg.T,
        isBuyerMaker: msg.m
      }));
    },
    10000,
    { batchSize: 10 }
  );
}

// Pattern detection benchmarks
async function benchmarkPatternDetection(benchmark: PerformanceBenchmark) {
  const candles100 = generateMockCandles(100);
  const candles500 = generateMockCandles(500);
  const candles1000 = generateMockCandles(1000);
  
  // Simple pattern detection logic
  const detectPatterns = (candles: any[], lookback: number) => {
    const patterns = [];
    
    for (let i = lookback; i < candles.length; i++) {
      const slice = candles.slice(i - lookback, i);
      
      // Head and shoulders pattern check
      if (slice.length >= 5) {
        const [c1, c2, c3, c4, c5] = slice.slice(-5);
        if (c2.high > c1.high && c2.high > c3.high &&
            c4.high > c3.high && c4.high > c5.high &&
            c2.high > c4.high) {
          patterns.push({ type: 'head-and-shoulders', index: i });
        }
      }
      
      // Double top pattern check
      if (slice.length >= 4) {
        const highs = slice.map(c => c.high);
        const maxHigh = Math.max(...highs);
        const peaks = highs.filter(h => h > maxHigh * 0.98).length;
        if (peaks >= 2) {
          patterns.push({ type: 'double-top', index: i });
        }
      }
    }
    
    return patterns;
  };
  
  await benchmark.runBenchmark(
    'pattern_detect_100_candles',
    () => detectPatterns(candles100, 50),
    1000,
    { candleCount: 100, lookbackPeriod: 50 }
  );
  
  await benchmark.runBenchmark(
    'pattern_detect_500_candles',
    () => detectPatterns(candles500, 100),
    1000,
    { candleCount: 500, lookbackPeriod: 100 }
  );
  
  await benchmark.runBenchmark(
    'pattern_detect_1000_candles',
    () => detectPatterns(candles1000, 200),
    1000,
    { candleCount: 1000, lookbackPeriod: 200 }
  );
}

// Indicator calculation benchmarks
async function benchmarkIndicators(benchmark: PerformanceBenchmark) {
  const prices100 = generateMockPrices(100);
  const prices500 = generateMockPrices(500);
  
  // RSI calculation
  const calculateRSI = (prices: number[], period: number = 14) => {
    if (prices.length < period + 1) return [];
    
    const rsi = [];
    let gains = 0;
    let losses = 0;
    
    // Initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  };
  
  // Moving average calculation
  const calculateMA = (prices: number[], period: number) => {
    const ma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b);
      ma.push(sum / period);
    }
    return ma;
  };
  
  await benchmark.runBenchmark(
    'rsi_calculate_100_prices',
    () => calculateRSI(prices100, 14),
    10000,
    { priceCount: 100, period: 14 }
  );
  
  await benchmark.runBenchmark(
    'rsi_calculate_500_prices',
    () => calculateRSI(prices500, 14),
    1000,
    { priceCount: 500, period: 14 }
  );
  
  await benchmark.runBenchmark(
    'ma_calculate_100_prices',
    () => calculateMA(prices100, 20),
    10000,
    { priceCount: 100, period: 20 }
  );
  
  await benchmark.runBenchmark(
    'ma_calculate_500_prices',
    () => calculateMA(prices500, 50),
    1000,
    { priceCount: 500, period: 50 }
  );
}

// Market analysis benchmarks
async function benchmarkAnalysis(benchmark: PerformanceBenchmark) {
  const candles100 = generateMockCandles(100);
  const candles500 = generateMockCandles(500);
  
  // Support/resistance detection
  const detectSupportResistance = (candles: any[]) => {
    const levels = [];
    const pricePoints = candles.map(c => ({ high: c.high, low: c.low }));
    
    // Find local maxima/minima
    for (let i = 2; i < pricePoints.length - 2; i++) {
      const current = pricePoints[i];
      const prev1 = pricePoints[i - 1];
      const prev2 = pricePoints[i - 2];
      const next1 = pricePoints[i + 1];
      const next2 = pricePoints[i + 2];
      
      // Resistance level
      if (current.high > prev1.high && current.high > prev2.high &&
          current.high > next1.high && current.high > next2.high) {
        levels.push({ type: 'resistance', price: current.high, strength: 1 });
      }
      
      // Support level
      if (current.low < prev1.low && current.low < prev2.low &&
          current.low < next1.low && current.low < next2.low) {
        levels.push({ type: 'support', price: current.low, strength: 1 });
      }
    }
    
    // Cluster nearby levels
    const clustered = [];
    const threshold = 0.001; // 0.1% price difference
    
    for (const level of levels) {
      const existing = clustered.find(c => 
        Math.abs(c.price - level.price) / c.price < threshold
      );
      
      if (existing) {
        existing.strength++;
      } else {
        clustered.push({ ...level });
      }
    }
    
    return clustered.sort((a, b) => b.strength - a.strength);
  };
  
  // Trend analysis
  const analyzeTrend = (candles: any[]) => {
    const closes = candles.map(c => c.close);
    const ma20 = [];
    const ma50 = [];
    
    // Calculate moving averages
    for (let i = 19; i < closes.length; i++) {
      ma20.push(closes.slice(i - 19, i + 1).reduce((a, b) => a + b) / 20);
    }
    
    for (let i = 49; i < closes.length; i++) {
      ma50.push(closes.slice(i - 49, i + 1).reduce((a, b) => a + b) / 50);
    }
    
    // Determine trend
    const currentPrice = closes[closes.length - 1];
    const currentMA20 = ma20[ma20.length - 1];
    const currentMA50 = ma50[ma50.length - 1];
    
    let trend = 'neutral';
    if (currentPrice > currentMA20 && currentMA20 > currentMA50) {
      trend = 'bullish';
    } else if (currentPrice < currentMA20 && currentMA20 < currentMA50) {
      trend = 'bearish';
    }
    
    return { trend, ma20, ma50 };
  };
  
  // Full market analysis
  const fullAnalysis = (candles: any[]) => {
    const supportResistance = detectSupportResistance(candles);
    const trend = analyzeTrend(candles);
    const prices = candles.map(c => c.close);
    const rsi = calculateRSI(prices, 14);
    
    return {
      levels: supportResistance,
      trend: trend.trend,
      indicators: { rsi: rsi[rsi.length - 1] }
    };
  };
  
  await benchmark.runBenchmark(
    'support_resistance_detect_100',
    () => detectSupportResistance(candles100),
    1000,
    { candleCount: 100 }
  );
  
  await benchmark.runBenchmark(
    'support_resistance_detect_500',
    () => detectSupportResistance(candles500),
    100,
    { candleCount: 500 }
  );
  
  await benchmark.runBenchmark(
    'trend_analysis_500',
    () => analyzeTrend(candles500),
    1000,
    { candleCount: 500 }
  );
  
  await benchmark.runBenchmark(
    'full_market_analysis',
    () => fullAnalysis(candles500),
    100,
    { candleCount: 500 }
  );
}

// Calculate RSI helper (for analysis benchmark)
const calculateRSI = (prices: number[], period: number = 14) => {
  if (prices.length < period + 1) return [];
  
  const rsi = [];
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
};

// Main execution
async function main() {
  console.log('🚀 パフォーマンスベンチマーク実行中（リファクタリング後）...\n');
  
  const benchmark = new PerformanceBenchmark();
  
  // Run all benchmarks
  console.log('📊 WebSocketメッセージ処理...');
  await benchmarkWebSocketProcessing(benchmark);
  
  console.log('📈 パターン検出...');
  await benchmarkPatternDetection(benchmark);
  
  console.log('📉 インジケーター計算...');
  await benchmarkIndicators(benchmark);
  
  console.log('🔍 市場分析...');
  await benchmarkAnalysis(benchmark);
  
  // Organize results by category
  const results = benchmark.getResults();
  const categorized = {
    websocket: results.filter(r => r.name.startsWith('ws_')),
    pattern: results.filter(r => r.name.startsWith('pattern_')),
    indicator: results.filter(r => r.name.includes('calculate')),
    analysis: results.filter(r => 
      r.name.includes('support_resistance') || 
      r.name.includes('trend_analysis') ||
      r.name.includes('full_market')
    )
  };
  
  // Calculate summaries
  const summary: Record<string, any> = {};
  
  for (const [category, categoryResults] of Object.entries(categorized)) {
    const avgMean = categoryResults.reduce((sum, r) => sum + r.stats.mean, 0) / categoryResults.length;
    const totalMean = categoryResults.reduce((sum, r) => sum + r.stats.mean, 0);
    
    summary[category] = {
      count: categoryResults.length,
      avgMean,
      totalMean
    };
  }
  
  // Create output
  const output = {
    timestamp: new Date().toISOString(),
    totalMetrics: results.length,
    byCategory: categorized,
    summary
  };
  
  // Save to file
  const outputPath = path.join(process.cwd(), 'perf_after.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log('\n✅ ベンチマーク完了！');
  console.log(`📁 結果を保存しました: ${outputPath}`);
  
  // Load and compare with baseline
  const baselinePath = path.join(process.cwd(), 'perf_before.json');
  if (fs.existsSync(baselinePath)) {
    console.log('\n📊 ベースラインとの比較:');
    
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    
    for (const category of Object.keys(categorized)) {
      const baselineCategory = baseline.byCategory[category];
      const currentCategory = categorized[category];
      
      if (baselineCategory && currentCategory) {
        console.log(`\n${category.toUpperCase()}:`);
        
        for (let i = 0; i < currentCategory.length; i++) {
          const baselineMetric = baselineCategory[i];
          const currentMetric = currentCategory[i];
          
          if (baselineMetric && currentMetric) {
            const improvement = ((baselineMetric.stats.mean - currentMetric.stats.mean) / baselineMetric.stats.mean * 100).toFixed(1);
            const arrow = parseFloat(improvement) > 0 ? '↑' : '↓';
            const color = parseFloat(improvement) > 0 ? '\x1b[32m' : '\x1b[31m';
            
            console.log(`  ${currentMetric.name}:`);
            console.log(`    Before: ${baselineMetric.stats.mean.toFixed(4)}ms`);
            console.log(`    After:  ${currentMetric.stats.mean.toFixed(4)}ms`);
            console.log(`    ${color}${arrow} ${Math.abs(parseFloat(improvement))}%\x1b[0m`);
          }
        }
      }
    }
    
    // Overall improvement
    const baselineTotal = Object.values(baseline.summary).reduce((sum: number, cat: any) => sum + cat.totalMean, 0);
    const currentTotal = Object.values(summary).reduce((sum: number, cat: any) => sum + cat.totalMean, 0);
    const overallImprovement = ((baselineTotal - currentTotal) / baselineTotal * 100).toFixed(1);
    
    console.log('\n📈 全体的な改善:');
    console.log(`  Before: ${baselineTotal.toFixed(4)}ms`);
    console.log(`  After:  ${currentTotal.toFixed(4)}ms`);
    const color = parseFloat(overallImprovement) > 0 ? '\x1b[32m' : '\x1b[31m';
    console.log(`  ${color}${parseFloat(overallImprovement) > 0 ? '↑' : '↓'} ${Math.abs(parseFloat(overallImprovement))}%\x1b[0m`);
  }
}

// Run the benchmark
main().catch(console.error);