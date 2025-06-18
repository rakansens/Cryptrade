#!/usr/bin/env tsx

/**
 * Quick script to test market data performance
 * Run with: npm run test:market-performance
 */

import { marketDataResilientTool } from '@/lib/mastra/tools/market-data-resilient.tool';
import { getMarketDataCache } from '@/lib/services/market-data-cache.service';

async function testPerformance() {
  console.log('🚀 Testing Market Data Performance\n');
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  const results: any[] = [];
  
  // Clear cache
  const cache = await getMarketDataCache();
  await cache.clear();
  
  console.log('📊 Cold Cache Test (First Request)');
  for (const symbol of symbols) {
    const start = Date.now();
    const result = await (marketDataResilientTool as any).execute({
      context: { symbol }
    });
    const latency = Date.now() - start;
    
    results.push({ symbol, latency, fromCache: result.metadata?.fromCache });
    console.log(`  ${symbol}: ${latency}ms ${result.metadata?.fromCache ? '(cached)' : '(fresh)'}`);
  }
  
  console.log('\n📊 Warm Cache Test (Second Request)');
  for (const symbol of symbols) {
    const start = Date.now();
    const result = await (marketDataResilientTool as any).execute({
      context: { symbol }
    });
    const latency = Date.now() - start;
    
    results.push({ symbol, latency, fromCache: result.metadata?.fromCache });
    console.log(`  ${symbol}: ${latency}ms ${result.metadata?.fromCache ? '(cached)' : '(fresh)'}`);
  }
  
  // Get cache stats
  const stats = cache.getStats();
  
  console.log('\n📈 Cache Statistics:');
  console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
  console.log(`  L1 Hit Rate: ${(stats.l1HitRate * 100).toFixed(2)}%`);
  console.log(`  Avg Latency: ${stats.avgLatency.toFixed(2)}ms`);
  console.log(`  P95 Latency: ${stats.latencyPercentiles.p95.toFixed(2)}ms`);
  
  // Calculate improvement
  const coldAvg = results.slice(0, 3).reduce((sum, r) => sum + r.latency, 0) / 3;
  const warmAvg = results.slice(3, 6).reduce((sum, r) => sum + r.latency, 0) / 3;
  const improvement = ((coldAvg - warmAvg) / coldAvg) * 100;
  
  console.log('\n✨ Performance Summary:');
  console.log(`  Cold Cache Avg: ${coldAvg.toFixed(2)}ms`);
  console.log(`  Warm Cache Avg: ${warmAvg.toFixed(2)}ms`);
  console.log(`  Improvement: ${improvement.toFixed(1)}%`);
  console.log(`  Target Met: ${warmAvg < 300 ? '✅ YES' : '❌ NO'} (Target: <300ms)`);
}

// Run the test
testPerformance().catch(console.error);