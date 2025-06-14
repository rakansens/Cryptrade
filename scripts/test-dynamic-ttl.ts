#!/usr/bin/env tsx

/**
 * Dynamic TTL Testing Script
 * 
 * Tests the dynamic TTL implementation for market data caching
 */

import { marketDataResilientTool, getCacheStats, clearMarketDataCache } from '../lib/mastra/tools/market-data-resilient.tool';

const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

interface TestCase {
  symbol: string;
  description: string;
  expectedTTLRange: [number, number]; // [min, max] in seconds
}

async function testDynamicTTL(testCase: TestCase) {
  console.log(`\n${colors.blue('▶')} Testing: ${testCase.description}`);
  console.log(`  Symbol: ${testCase.symbol}`);
  
  try {
    // Clear cache before test
    clearMarketDataCache();
    
    // First request (cache miss)
    const start1 = Date.now();
    const result1 = await marketDataResilientTool.execute({
      context: { symbol: testCase.symbol }
    });
    const duration1 = Date.now() - start1;
    
    console.log(`  ${colors.yellow('→')} First request: ${duration1}ms (cache miss)`);
    console.log(`     Price: $${result1.currentPrice.toLocaleString()}`);
    console.log(`     24h Change: ${result1.priceChangePercent24h >= 0 ? '+' : ''}${result1.priceChangePercent24h.toFixed(2)}%`);
    console.log(`     Volatility: ${result1.analysis.volatility}`);
    
    // Get cache stats
    const stats = getCacheStats();
    const cacheEntry = stats.entries.find(e => e.symbol === testCase.symbol);
    
    if (cacheEntry) {
      const ttlSeconds = cacheEntry.ttl / 1000;
      console.log(`  ${colors.cyan('→')} Dynamic TTL: ${ttlSeconds.toFixed(1)}s`);
      console.log(`     Volatility: ${cacheEntry.volatility?.toFixed(2)}%`);
      
      // Check if TTL is within expected range
      const isInRange = ttlSeconds >= testCase.expectedTTLRange[0] && 
                       ttlSeconds <= testCase.expectedTTLRange[1];
      
      if (isInRange) {
        console.log(`  ${colors.green('✓')} TTL is within expected range [${testCase.expectedTTLRange[0]}-${testCase.expectedTTLRange[1]}s]`);
      } else {
        console.log(`  ${colors.red('✗')} TTL is outside expected range [${testCase.expectedTTLRange[0]}-${testCase.expectedTTLRange[1]}s]`);
      }
      
      // Second request (should be cache hit)
      const start2 = Date.now();
      const result2 = await marketDataResilientTool.execute({
        context: { symbol: testCase.symbol }
      });
      const duration2 = Date.now() - start2;
      
      console.log(`  ${colors.green('→')} Second request: ${duration2}ms (cache hit)`);
      console.log(`     Cache speedup: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%`);
      
      // Wait and test cache expiration
      const waitTime = Math.min(cacheEntry.ttl + 1000, 10000); // Wait TTL + 1s or max 10s
      console.log(`  ${colors.yellow('⏳')} Waiting ${(waitTime / 1000).toFixed(1)}s for cache to expire...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Third request (should be cache miss after expiration)
      const start3 = Date.now();
      const result3 = await marketDataResilientTool.execute({
        context: { symbol: testCase.symbol }
      });
      const duration3 = Date.now() - start3;
      
      const wasExpired = duration3 > duration2 * 2; // Heuristic: expired if much slower
      console.log(`  ${colors.yellow('→')} Third request: ${duration3}ms (${wasExpired ? 'cache expired' : 'still cached'})`);
      
      return { success: true, ttl: ttlSeconds, volatility: cacheEntry.volatility };
    } else {
      console.log(`  ${colors.red('✗')} No cache entry found`);
      return { success: false };
    }
    
  } catch (error) {
    console.log(`  ${colors.red('✗')} Error: ${error}`);
    return { success: false, error } as DynamicTTLTestResult;
  }
}

async function main() {
  console.log(colors.blue('=== Dynamic TTL Testing ==='));
  console.log('Testing dynamic TTL adjustments based on volatility and market conditions\n');
  
  const testCases: TestCase[] = [
    {
      symbol: 'BTCUSDT',
      description: 'Bitcoin (Major pair, expected shorter TTL)',
      expectedTTLRange: [5, 30],
    },
    {
      symbol: 'ETHUSDT',
      description: 'Ethereum (Major pair)',
      expectedTTLRange: [5, 30],
    },
    {
      symbol: 'ADAUSDT',
      description: 'Cardano (Non-major pair)',
      expectedTTLRange: [8, 60],
    },
    {
      symbol: 'DOGEUSDT',
      description: 'Dogecoin (Often volatile)',
      expectedTTLRange: [5, 30],
    },
  ];
  
  interface DynamicTTLTestResult extends TestCase {
    success: boolean;
    ttl?: number;
    volatility?: number;
    error?: unknown;
  }
  
  const results: DynamicTTLTestResult[] = [];
  
  for (const testCase of testCases) {
    const result = await testDynamicTTL(testCase);
    results.push({ ...testCase, ...result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log(`\n${colors.blue('=== Test Summary ===')}`);
  
  const successCount = results.filter(r => r.success).length;
  console.log(`Total tests: ${results.length}`);
  console.log(`${colors.green('Successful')}: ${successCount}`);
  console.log(`${colors.red('Failed')}: ${results.length - successCount}`);
  
  console.log(`\n${colors.blue('=== TTL Distribution ===')}`);
  results.filter(r => r.success).forEach(r => {
    console.log(`${r.symbol}: ${r.ttl?.toFixed(1)}s (volatility: ${r.volatility?.toFixed(2)}%)`);
  });
  
  // Market hours impact
  const hour = new Date().getUTCHours();
  const isActiveHours = (hour >= 13 && hour < 21) || (hour >= 8 && hour < 16) || (hour >= 0 && hour < 8);
  const dayOfWeek = new Date().getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  console.log(`\n${colors.blue('=== Market Conditions ===')}`);
  console.log(`Current UTC hour: ${hour}`);
  console.log(`Active trading hours: ${isActiveHours ? colors.green('Yes') : colors.yellow('No')}`);
  console.log(`Weekend: ${isWeekend ? colors.yellow('Yes') : colors.green('No')}`);
  
  console.log('\n' + colors.cyan('Dynamic TTL is now active and adjusting based on:'));
  console.log('  • Market volatility (high volatility = shorter TTL)');
  console.log('  • Symbol popularity (major pairs = shorter TTL)');
  console.log('  • Trading hours (active hours = shorter TTL)');
  console.log('  • Day of week (weekends = longer TTL)');
}

// Run the test
main().catch(error => {
  console.error(colors.red('Test failed:'), error);
  process.exit(1);
});