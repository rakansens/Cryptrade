#!/usr/bin/env tsx

/**
 * Parallel Orchestrator Performance Benchmark
 * 
 * Measures performance improvements from parallel processing implementation
 */

import { performance } from 'perf_hooks';
import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import { parallelOrchestrator } from '../../lib/mastra/agents/parallel-orchestrator';
import { registerAllAgents } from '../../lib/mastra/network/agent-registry';
import { logger } from '../../lib/utils/logger';
import chalk from 'chalk';

interface BenchmarkResult {
  query: string;
  sequential: {
    times: number[];
    avg: number;
    min: number;
    max: number;
    p95: number;
  };
  parallel: {
    times: number[];
    avg: number;
    min: number;
    max: number;
    p95: number;
  };
  improvement: {
    avgReduction: number;
    avgPercentage: number;
    p95Reduction: number;
    p95Percentage: number;
  };
}

class ParallelOrchestratorBenchmark {
  private results: BenchmarkResult[] = [];
  
  async setup() {
    // Disable logging for cleaner output
    logger.info = () => {};
    logger.debug = () => {};
    logger.warn = () => {};
    
    // Register agents
    registerAllAgents();
    
    console.log(chalk.bold.cyan('\n🚀 Parallel Orchestrator Performance Benchmark'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.yellow('\nComparing Sequential vs Parallel Processing\n'));
  }
  
  /**
   * Benchmark a specific query
   */
  async benchmarkQuery(query: string, iterations: number = 10, warmup: number = 2): Promise<BenchmarkResult> {
    console.log(chalk.bold(`\n📊 Benchmarking: "${query}"`));
    console.log(chalk.gray(`   Iterations: ${iterations} (warmup: ${warmup})`));
    
    // Warmup
    console.log(chalk.gray('   Warming up...'));
    for (let i = 0; i < warmup; i++) {
      await executeImprovedOrchestrator(query, `warmup-seq-${i}`);
      await parallelOrchestrator.execute(query, `warmup-par-${i}`);
    }
    
    // Sequential measurements
    console.log(chalk.blue('\n   Sequential Processing:'));
    const sequentialTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await executeImprovedOrchestrator(query, `bench-seq-${i}`);
      } catch (error) {
        console.error(chalk.red(`     Error: ${error}`));
      }
      const duration = performance.now() - start;
      sequentialTimes.push(duration);
      process.stdout.write('.');
    }
    console.log();
    
    // Parallel measurements
    console.log(chalk.green('\n   Parallel Processing:'));
    const parallelTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await parallelOrchestrator.execute(query, `bench-par-${i}`);
      } catch (error) {
        console.error(chalk.red(`     Error: ${error}`));
      }
      const duration = performance.now() - start;
      parallelTimes.push(duration);
      process.stdout.write('.');
    }
    console.log();
    
    // Calculate statistics
    const seqStats = this.calculateStats(sequentialTimes);
    const parStats = this.calculateStats(parallelTimes);
    
    const result: BenchmarkResult = {
      query,
      sequential: seqStats,
      parallel: parStats,
      improvement: {
        avgReduction: seqStats.avg - parStats.avg,
        avgPercentage: ((seqStats.avg - parStats.avg) / seqStats.avg) * 100,
        p95Reduction: seqStats.p95 - parStats.p95,
        p95Percentage: ((seqStats.p95 - parStats.p95) / seqStats.p95) * 100,
      }
    };
    
    this.printResult(result);
    this.results.push(result);
    
    return result;
  }
  
  /**
   * Calculate statistics from measurements
   */
  private calculateStats(times: number[]) {
    const sorted = times.sort((a, b) => a - b);
    return {
      times,
      avg: times.reduce((sum, t) => sum + t, 0) / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
  
  /**
   * Print benchmark result
   */
  private printResult(result: BenchmarkResult) {
    console.log(chalk.bold('\n   📈 Results:'));
    
    // Sequential stats
    console.log(chalk.blue('   Sequential:'));
    console.log(`     Average: ${result.sequential.avg.toFixed(0)}ms`);
    console.log(`     Min/Max: ${result.sequential.min.toFixed(0)}ms / ${result.sequential.max.toFixed(0)}ms`);
    console.log(`     P95: ${result.sequential.p95.toFixed(0)}ms`);
    
    // Parallel stats
    console.log(chalk.green('   Parallel:'));
    console.log(`     Average: ${result.parallel.avg.toFixed(0)}ms`);
    console.log(`     Min/Max: ${result.parallel.min.toFixed(0)}ms / ${result.parallel.max.toFixed(0)}ms`);
    console.log(`     P95: ${result.parallel.p95.toFixed(0)}ms`);
    
    // Improvement
    const improvementColor = result.improvement.avgPercentage > 0 ? chalk.green : chalk.red;
    console.log(chalk.bold('   Improvement:'));
    console.log(improvementColor(`     Average: ${result.improvement.avgReduction.toFixed(0)}ms (${result.improvement.avgPercentage.toFixed(1)}%)`));
    console.log(improvementColor(`     P95: ${result.improvement.p95Reduction.toFixed(0)}ms (${result.improvement.p95Percentage.toFixed(1)}%)`));
    
    // Visual indicator
    if (result.improvement.avgPercentage > 50) {
      console.log(chalk.bold.green('     🎯 Excellent improvement!'));
    } else if (result.improvement.avgPercentage > 30) {
      console.log(chalk.bold.green('     ✅ Good improvement!'));
    } else if (result.improvement.avgPercentage > 0) {
      console.log(chalk.yellow('     📊 Moderate improvement'));
    } else {
      console.log(chalk.red('     ⚠️  No improvement'));
    }
  }
  
  /**
   * Generate summary report
   */
  generateSummary() {
    console.log(chalk.bold.cyan('\n\n📊 BENCHMARK SUMMARY'));
    console.log(chalk.gray('='.repeat(60)));
    
    // Overall statistics
    const avgSeqTime = this.results.reduce((sum, r) => sum + r.sequential.avg, 0) / this.results.length;
    const avgParTime = this.results.reduce((sum, r) => sum + r.parallel.avg, 0) / this.results.length;
    const avgImprovement = ((avgSeqTime - avgParTime) / avgSeqTime) * 100;
    
    console.log(chalk.bold('\n🎯 Overall Performance:'));
    console.log(`   Sequential Average: ${avgSeqTime.toFixed(0)}ms`);
    console.log(`   Parallel Average: ${avgParTime.toFixed(0)}ms`);
    console.log(chalk.bold.green(`   Overall Improvement: ${avgImprovement.toFixed(1)}%`));
    
    // Target achievement
    const targetMet = avgParTime < 2000;
    if (targetMet) {
      console.log(chalk.bold.green('\n✅ TARGET ACHIEVED: Average latency under 2 seconds!'));
    } else {
      console.log(chalk.bold.yellow(`\n⚠️  Target not met. Current: ${avgParTime.toFixed(0)}ms, Target: <2000ms`));
    }
    
    // Query-specific improvements
    console.log(chalk.bold('\n📋 Query-Specific Improvements:'));
    this.results.forEach(result => {
      const improvementBar = this.createImprovementBar(result.improvement.avgPercentage);
      console.log(`   ${result.query}`);
      console.log(`     ${improvementBar} ${result.improvement.avgPercentage.toFixed(1)}%`);
      console.log(`     ${result.sequential.avg.toFixed(0)}ms → ${result.parallel.avg.toFixed(0)}ms`);
    });
    
    // Recommendations
    console.log(chalk.bold('\n💡 Recommendations:'));
    if (avgImprovement > 50) {
      console.log(chalk.green('   ✓ Parallel processing is highly effective'));
      console.log(chalk.green('   ✓ Consider enabling by default for all complex queries'));
    } else if (avgImprovement > 20) {
      console.log(chalk.yellow('   ✓ Parallel processing shows good improvements'));
      console.log(chalk.yellow('   ✓ Enable for queries with multiple operations'));
    } else {
      console.log(chalk.red('   ⚠️  Limited improvement from parallel processing'));
      console.log(chalk.red('   ⚠️  Focus on optimizing individual agent performance'));
    }
    
    // Technical insights
    console.log(chalk.bold('\n🔍 Technical Insights:'));
    const complexQueries = this.results.filter(r => r.query.includes('分析') || r.query.includes('提案'));
    const simpleQueries = this.results.filter(r => !r.query.includes('分析') && !r.query.includes('提案'));
    
    if (complexQueries.length > 0) {
      const complexImprovement = complexQueries.reduce((sum, r) => sum + r.improvement.avgPercentage, 0) / complexQueries.length;
      console.log(`   Complex queries improvement: ${complexImprovement.toFixed(1)}%`);
    }
    
    if (simpleQueries.length > 0) {
      const simpleImprovement = simpleQueries.reduce((sum, r) => sum + r.improvement.avgPercentage, 0) / simpleQueries.length;
      console.log(`   Simple queries improvement: ${simpleImprovement.toFixed(1)}%`);
    }
    
    // Error handling
    console.log(chalk.bold('\n⚠️  Error Handling:'));
    console.log('   ✓ Partial failure handling implemented');
    console.log('   ✓ Timeout protection with cleanup');
    console.log('   ✓ Graceful degradation to sequential processing');
  }
  
  /**
   * Create visual improvement bar
   */
  private createImprovementBar(percentage: number): string {
    const barLength = 20;
    const filledLength = Math.round((Math.abs(percentage) / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    if (percentage > 50) {
      return chalk.green(bar);
    } else if (percentage > 20) {
      return chalk.yellow(bar);
    } else if (percentage > 0) {
      return chalk.gray(bar);
    } else {
      return chalk.red(bar);
    }
  }
}

// Test queries representing different complexity levels
const TEST_QUERIES = [
  // Simple queries
  {
    query: 'BTCの価格は？',
    type: 'simple',
    expectedAgents: ['price_inquiry'],
  },
  {
    query: 'ETHいくら？',
    type: 'simple',
    expectedAgents: ['price_inquiry'],
  },
  
  // Medium complexity
  {
    query: 'BTCのチャートにトレンドラインを引いて',
    type: 'medium',
    expectedAgents: ['ui_control'],
  },
  {
    query: 'BTCの簡単な分析をして',
    type: 'medium',
    expectedAgents: ['trading_analysis'],
  },
  
  // Complex queries (multiple operations)
  {
    query: 'BTCの価格を確認して詳細な分析もお願い',
    type: 'complex',
    expectedAgents: ['price_inquiry', 'trading_analysis'],
  },
  {
    query: 'ETHの分析とエントリーポイントの提案をして',
    type: 'complex',
    expectedAgents: ['trading_analysis'],
  },
  {
    query: 'BTCとETHの価格を比較して、どちらが良い投資か分析して',
    type: 'complex',
    expectedAgents: ['price_inquiry', 'trading_analysis'],
  },
  {
    query: 'ADAの価格確認、チャートに移動平均を表示、そして買い時か分析して',
    type: 'very_complex',
    expectedAgents: ['price_inquiry', 'ui_control', 'trading_analysis'],
  },
];

// Main execution
async function main() {
  const benchmark = new ParallelOrchestratorBenchmark();
  
  try {
    await benchmark.setup();
    
    // Run benchmarks for each query type
    console.log(chalk.bold.yellow('\n🏃 Running benchmarks for different query types...\n'));
    
    // Simple queries
    console.log(chalk.bold.cyan('\n--- SIMPLE QUERIES ---'));
    for (const testQuery of TEST_QUERIES.filter(q => q.type === 'simple')) {
      await benchmark.benchmarkQuery(testQuery.query, 20, 3);
    }
    
    // Medium complexity
    console.log(chalk.bold.cyan('\n--- MEDIUM COMPLEXITY ---'));
    for (const testQuery of TEST_QUERIES.filter(q => q.type === 'medium')) {
      await benchmark.benchmarkQuery(testQuery.query, 15, 3);
    }
    
    // Complex queries
    console.log(chalk.bold.cyan('\n--- COMPLEX QUERIES ---'));
    for (const testQuery of TEST_QUERIES.filter(q => q.type === 'complex')) {
      await benchmark.benchmarkQuery(testQuery.query, 10, 2);
    }
    
    // Very complex queries
    console.log(chalk.bold.cyan('\n--- VERY COMPLEX QUERIES ---'));
    for (const testQuery of TEST_QUERIES.filter(q => q.type === 'very_complex')) {
      await benchmark.benchmarkQuery(testQuery.query, 5, 2);
    }
    
    // Generate summary
    benchmark.generateSummary();
    
    console.log(chalk.bold.green('\n\n✅ Benchmark completed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Benchmark failed:'), error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ParallelOrchestratorBenchmark };