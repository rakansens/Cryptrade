#!/usr/bin/env tsx

/**
 * Market Data Cache Performance Test
 * 
 * Validates that market data queries complete in under 300ms
 * Tests both cold and warm cache scenarios
 */

import { performance } from 'perf_hooks';
import { marketDataResilientTool } from '@/lib/mastra/tools/market-data-resilient.tool';
import { getMarketDataCache } from '@/lib/services/market-data-cache.service';
import { logger } from '@/lib/utils/logger';

interface TestResult {
  scenario: string;
  symbol: string;
  latency: number;
  fromCache: boolean;
  cacheLevel?: 'L1' | 'L2';
  passed: boolean;
}

const TARGET_LATENCY = 300; // 300ms target
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];

class MarketDataCacheBenchmark {
  private results: TestResult[] = [];
  
  async setup() {
    logger.info('🚀 Market Data Cache Performance Test');
    logger.info('=====================================\n');
    logger.info(`Target latency: <${TARGET_LATENCY}ms`);
    logger.info(`Test symbols: ${SYMBOLS.join(', ')}\n`);
    
    // Clear cache to start fresh
    const cache = await getMarketDataCache();
    await cache.clear();
  }
  
  /**
   * Test cold cache performance
   */
  async testColdCache(): Promise<void> {
    console.log('\n📊 Testing Cold Cache Performance...');
    
    for (const symbol of SYMBOLS) {
      const start = performance.now();
      
      try {
        const result = await (marketDataResilientTool as any).execute({
          context: { symbol }
        });
        
        const latency = performance.now() - start;
        const passed = latency < TARGET_LATENCY;
        
        this.results.push({
          scenario: 'Cold Cache',
          symbol,
          latency,
          fromCache: result.metadata?.fromCache || false,
          passed
        });
        
        console.log(`  ${symbol}: ${latency.toFixed(2)}ms ${passed ? '✅' : '❌'}`);
        
      } catch (error) {
        console.error(`  ${symbol}: Error - ${error}`);
        this.results.push({
          scenario: 'Cold Cache',
          symbol,
          latency: -1,
          fromCache: false,
          passed: false
        });
      }
    }
  }
  
  /**
   * Test warm cache performance (L1 cache)
   */
  async testWarmCacheL1(): Promise<void> {
    console.log('\n📊 Testing Warm Cache (L1) Performance...');
    
    // Ensure data is in cache by fetching once
    for (const symbol of SYMBOLS) {
      await (marketDataResilientTool as any).execute({
        context: { symbol }
      });
    }
    
    // Small delay to ensure cache is set
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test L1 cache hits
    for (const symbol of SYMBOLS) {
      const start = performance.now();
      
      try {
        const result = await (marketDataResilientTool as any).execute({
          context: { symbol }
        });
        
        const latency = performance.now() - start;
        const passed = latency < TARGET_LATENCY;
        
        this.results.push({
          scenario: 'Warm Cache (L1)',
          symbol,
          latency,
          fromCache: result.metadata?.fromCache || false,
          cacheLevel: 'L1',
          passed
        });
        
        console.log(`  ${symbol}: ${latency.toFixed(2)}ms ${passed ? '✅' : '❌'} ${result.metadata?.fromCache ? '(cached)' : ''}`);
        
      } catch (error) {
        console.error(`  ${symbol}: Error - ${error}`);
        this.results.push({
          scenario: 'Warm Cache (L1)',
          symbol,
          latency: -1,
          fromCache: false,
          passed: false
        });
      }
    }
  }
  
  /**
   * Test concurrent requests
   */
  async testConcurrentRequests(): Promise<void> {
    console.log('\n📊 Testing Concurrent Requests...');
    
    const concurrentBatch = 10;
    const requests = [];
    
    const start = performance.now();
    
    // Launch concurrent requests
    for (let i = 0; i < concurrentBatch; i++) {
      const symbol = SYMBOLS[i % SYMBOLS.length];
      requests.push(
        (marketDataResilientTool as any).execute({
          context: { symbol }
        }).then((result: any) => ({
          symbol,
          latency: performance.now() - start,
          fromCache: result.metadata?.fromCache || false
        }))
      );
    }
    
    const results = await Promise.all(requests);
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const maxLatency = Math.max(...results.map(r => r.latency));
    const passed = maxLatency < TARGET_LATENCY;
    
    console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Max latency: ${maxLatency.toFixed(2)}ms ${passed ? '✅' : '❌'}`);
    console.log(`  Cache hits: ${results.filter(r => r.fromCache).length}/${results.length}`);
    
    this.results.push({
      scenario: 'Concurrent Requests',
      symbol: 'Multiple',
      latency: maxLatency,
      fromCache: results.some(r => r.fromCache),
      passed
    });
  }
  
  /**
   * Test cache invalidation and refresh
   */
  async testCacheInvalidation(): Promise<void> {
    console.log('\n📊 Testing Cache Invalidation...');
    
    const symbol = 'BTCUSDT';
    const cache = await getMarketDataCache();
    
    // First request (should hit API)
    const start1 = performance.now();
    await (marketDataResilientTool as any).execute({
      context: { symbol }
    });
    const latency1 = performance.now() - start1;
    
    // Invalidate cache
    await cache.invalidatePattern(symbol);
    
    // Second request (should hit API again)
    const start2 = performance.now();
    const result2 = await (marketDataResilientTool as any).execute({
      context: { symbol }
    });
    const latency2 = performance.now() - start2;
    
    console.log(`  First request: ${latency1.toFixed(2)}ms`);
    console.log(`  After invalidation: ${latency2.toFixed(2)}ms ${latency2 < TARGET_LATENCY ? '✅' : '❌'}`);
    
    this.results.push({
      scenario: 'Cache Invalidation',
      symbol,
      latency: latency2,
      fromCache: result2.metadata?.fromCache || false,
      passed: latency2 < TARGET_LATENCY
    });
  }
  
  /**
   * Generate performance report
   */
  async generateReport(): Promise<void> {
    console.log('\n📈 Performance Test Summary');
    console.log('===========================\n');
    
    const cache = await getMarketDataCache();
    const cacheStats = cache.getStats();
    
    // Group results by scenario
    const scenarios = [...new Set(this.results.map(r => r.scenario))];
    
    for (const scenario of scenarios) {
      const scenarioResults = this.results.filter(r => r.scenario === scenario);
      const passed = scenarioResults.filter(r => r.passed).length;
      const total = scenarioResults.length;
      const avgLatency = scenarioResults
        .filter(r => r.latency > 0)
        .reduce((sum, r) => sum + r.latency, 0) / scenarioResults.length;
      
      console.log(`${scenario}:`);
      console.log(`  Passed: ${passed}/${total} (${((passed/total) * 100).toFixed(1)}%)`);
      console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
      console.log('');
    }
    
    // Cache statistics
    console.log('Cache Statistics:');
    console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
    console.log(`  L1 Hit Rate: ${(cacheStats.l1HitRate * 100).toFixed(2)}%`);
    console.log(`  L2 Hit Rate: ${(cacheStats.l2HitRate * 100).toFixed(2)}%`);
    console.log(`  Avg Latency: ${cacheStats.avgLatency.toFixed(2)}ms`);
    console.log(`  P50 Latency: ${cacheStats.latencyPercentiles.p50.toFixed(2)}ms`);
    console.log(`  P95 Latency: ${cacheStats.latencyPercentiles.p95.toFixed(2)}ms`);
    console.log(`  P99 Latency: ${cacheStats.latencyPercentiles.p99.toFixed(2)}ms`);
    
    // Overall results
    const allPassed = this.results.filter(r => r.passed).length;
    const allTotal = this.results.length;
    const overallSuccess = (allPassed / allTotal) * 100;
    
    console.log(`\nOverall Success Rate: ${overallSuccess.toFixed(1)}%`);
    console.log(`Target Achievement: ${overallSuccess >= 95 ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Performance improvement
    const coldAvg = this.results
      .filter(r => r.scenario === 'Cold Cache' && r.latency > 0)
      .reduce((sum, r) => sum + r.latency, 0) / SYMBOLS.length;
    
    const warmAvg = this.results
      .filter(r => r.scenario === 'Warm Cache (L1)' && r.latency > 0)
      .reduce((sum, r) => sum + r.latency, 0) / SYMBOLS.length;
    
    const improvement = ((coldAvg - warmAvg) / coldAvg) * 100;
    
    console.log(`\nPerformance Improvement:`);
    console.log(`  Cold Cache Avg: ${coldAvg.toFixed(2)}ms`);
    console.log(`  Warm Cache Avg: ${warmAvg.toFixed(2)}ms`);
    console.log(`  Improvement: ${improvement.toFixed(1)}%`);
    
    // Save detailed results
    const fs = await import('fs/promises');
    const reportPath = `${__dirname}/results/cache_performance_${Date.now()}.json`;
    await fs.mkdir(`${__dirname}/results`, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      targetLatency: TARGET_LATENCY,
      results: this.results,
      cacheStats,
      summary: {
        overallSuccessRate: overallSuccess,
        coldCacheAvg: coldAvg,
        warmCacheAvg: warmAvg,
        performanceImprovement: improvement
      }
    }, null, 2));
    
    console.log(`\n✅ Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const benchmark = new MarketDataCacheBenchmark();
  
  try {
    await benchmark.setup();
    
    // Run all tests
    await benchmark.testColdCache();
    await benchmark.testWarmCacheL1();
    await benchmark.testConcurrentRequests();
    await benchmark.testCacheInvalidation();
    
    // Generate report
    await benchmark.generateReport();
    
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MarketDataCacheBenchmark };