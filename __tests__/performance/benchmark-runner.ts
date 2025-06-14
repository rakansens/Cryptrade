#!/usr/bin/env tsx

/**
 * Performance Benchmark Runner
 * 
 * Runs performance tests and compares against baselines
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import { multiTimeframeLineDetector } from '../../lib/analysis/multi-timeframe-line-detector';
import { enhancedChartControlTool } from '../../lib/mastra/tools/enhanced-chart-control.tool';
import { createMockCandlestickData } from '../helpers/test-factory';
import { logger } from '../../lib/utils/logger';

interface BenchmarkResult {
  name: string;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  timestamp: string;
}

interface BenchmarkConfig {
  name: string;
  fn: () => Promise<any>;
  iterations: number;
  warmup: number;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private baselineFile = path.join(__dirname, 'baseline.json');
  
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    console.log(`\n🏃 Running benchmark: ${config.name}`);
    
    // Warmup runs
    console.log(`  Warmup: ${config.warmup} iterations...`);
    for (let i = 0; i < config.warmup; i++) {
      await config.fn();
    }
    
    // Actual benchmark runs
    console.log(`  Benchmark: ${config.iterations} iterations...`);
    const times: number[] = [];
    
    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      await config.fn();
      const end = performance.now();
      times.push(end - start);
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
    
    // Calculate statistics
    const averageTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const variance = times.reduce((sum, t) => sum + Math.pow(t - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const result: BenchmarkResult = {
      name: config.name,
      iterations: config.iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    this.printResult(result);
    
    return result;
  }
  
  private printResult(result: BenchmarkResult) {
    console.log(`\n📊 Results for: ${result.name}`);
    console.log(`  Average: ${result.averageTime.toFixed(2)}ms`);
    console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
    console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
    console.log(`  Std Dev: ${result.standardDeviation.toFixed(2)}ms`);
  }
  
  async compareWithBaseline() {
    try {
      const baselineData = await fs.readFile(this.baselineFile, 'utf-8');
      const baseline = JSON.parse(baselineData) as BenchmarkResult[];
      
      console.log('\n📈 Comparison with baseline:');
      console.log(''.padEnd(80, '='));
      console.log(
        'Benchmark'.padEnd(30) +
        'Current'.padEnd(15) +
        'Baseline'.padEnd(15) +
        'Change'.padEnd(15) +
        'Status'
      );
      console.log(''.padEnd(80, '-'));
      
      for (const result of this.results) {
        const baselineResult = baseline.find(b => b.name === result.name);
        if (baselineResult) {
          const change = ((result.averageTime - baselineResult.averageTime) / baselineResult.averageTime) * 100;
          const status = change > 10 ? '❌ SLOWER' : change < -10 ? '✅ FASTER' : '✓ OK';
          
          console.log(
            result.name.padEnd(30) +
            `${result.averageTime.toFixed(2)}ms`.padEnd(15) +
            `${baselineResult.averageTime.toFixed(2)}ms`.padEnd(15) +
            `${change > 0 ? '+' : ''}${change.toFixed(1)}%`.padEnd(15) +
            status
          );
        } else {
          console.log(
            result.name.padEnd(30) +
            `${result.averageTime.toFixed(2)}ms`.padEnd(15) +
            'N/A'.padEnd(15) +
            'NEW'.padEnd(15) +
            '🆕 NEW'
          );
        }
      }
      console.log(''.padEnd(80, '='));
    } catch (error) {
      console.log('\n⚠️  No baseline found. Run with --save-baseline to create one.');
    }
  }
  
  async saveBaseline() {
    await fs.writeFile(
      this.baselineFile,
      JSON.stringify(this.results, null, 2)
    );
    console.log('\n✅ Baseline saved to:', this.baselineFile);
  }
  
  async saveResults() {
    const resultsFile = path.join(
      __dirname,
      `results-${new Date().toISOString().split('T')[0]}.json`
    );
    
    await fs.writeFile(
      resultsFile,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.results,
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: require('os').cpus().length
        }
      }, null, 2)
    );
    
    console.log('\n💾 Results saved to:', resultsFile);
  }
}

// Benchmark configurations
const benchmarks: BenchmarkConfig[] = [
  {
    name: 'Orchestrator Intent Analysis',
    fn: async () => {
      await executeImprovedOrchestrator(
        'BTCの価格を教えて',
        'bench-session',
        { userLevel: 'intermediate', marketStatus: 'open' }
      );
    },
    iterations: 100,
    warmup: 10
  },
  
  {
    name: 'Line Detection (100 candles)',
    fn: async () => {
      const data = createMockCandlestickData(100);
      await multiTimeframeLineDetector.detectLines('BTCUSDT', data);
    },
    iterations: 50,
    warmup: 5
  },
  
  {
    name: 'Line Detection (1000 candles)',
    fn: async () => {
      const data = createMockCandlestickData(1000);
      await multiTimeframeLineDetector.detectLines('BTCUSDT', data);
    },
    iterations: 20,
    warmup: 2
  },
  
  {
    name: 'Chart Control Tool',
    fn: async () => {
      await enhancedChartControlTool.execute({
        context: {
          userRequest: 'トレンドラインを描いて',
          conversationHistory: [],
          currentState: { symbol: 'BTCUSDT', timeframe: '1h' }
        }
      });
    },
    iterations: 50,
    warmup: 5
  },
  
  {
    name: 'Complex Query Processing',
    fn: async () => {
      await executeImprovedOrchestrator(
        'BTCの詳細な技術分析を行い、エントリーポイントを提案して、リスク管理も含めて',
        'bench-complex',
        { userLevel: 'expert', marketStatus: 'open' }
      );
    },
    iterations: 20,
    warmup: 2
  }
];

// Main execution
async function main() {
  console.log('🚀 Cryptrade Performance Benchmark Suite');
  console.log('========================================\n');
  
  // Disable logging for benchmarks
  logger.info = () => {};
  logger.debug = () => {};
  
  const runner = new BenchmarkRunner();
  const args = process.argv.slice(2);
  
  // Run benchmarks
  for (const benchmark of benchmarks) {
    await runner.runBenchmark(benchmark);
  }
  
  // Handle command line arguments
  if (args.includes('--save-baseline')) {
    await runner.saveBaseline();
  }
  
  if (args.includes('--compare') || !args.includes('--save-baseline')) {
    await runner.compareWithBaseline();
  }
  
  // Always save results
  await runner.saveResults();
  
  console.log('\n✨ Benchmark complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { BenchmarkRunner, BenchmarkConfig, BenchmarkResult };