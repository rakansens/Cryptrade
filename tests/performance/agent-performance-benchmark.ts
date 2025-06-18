#!/usr/bin/env tsx

/**
 * Agent System Performance Benchmark
 * 
 * Comprehensive performance measurement for the agent system
 * Measures: latency, token usage, memory consumption, A2A overhead
 */

import { performance } from 'perf_hooks';
import { memoryUsage } from 'process';
import fs from 'fs/promises';
import path from 'path';
import { executeImprovedOrchestrator } from '../../lib/mastra/agents/orchestrator.agent';
import { agentNetwork } from '../../lib/mastra/network/agent-network';
import { registerAllAgents } from '../../lib/mastra/network/agent-registry';
import { marketDataResilientTool } from '../../lib/mastra/tools/market-data-resilient.tool';
import { logger } from '../../lib/utils/logger';
import { useEnhancedConversationMemory } from '../../lib/store/enhanced-conversation-memory.store';

interface PerformanceMetric {
  name: string;
  category: 'agent' | 'tool' | 'a2a' | 'memory' | 'concurrent';
  measurements: {
    latency: number[];
    memory: number[];
    tokenUsage?: {
      input: number[];
      output: number[];
    };
  };
  stats?: {
    latency: {
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    memory: {
      min: number;
      max: number;
      avg: number;
      delta: number;
    };
    tokenUsage?: {
      inputAvg: number;
      outputAvg: number;
      totalAvg: number;
    };
  };
  metadata?: Record<string, any>;
}

class AgentPerformanceBenchmark {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private outputDir = path.join(__dirname, 'results');
  
  async setup() {
    // Disable logging for benchmarks
    logger.info = () => {};
    logger.debug = () => {};
    logger.warn = () => {};
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Register all agents
    registerAllAgents();
    
    console.log('🚀 Agent Performance Benchmark');
    console.log('==============================\n');
  }
  
  /**
   * Measure agent execution performance
   */
  async measureAgent(
    name: string,
    query: string,
    iterations: number = 50,
    warmup: number = 5
  ): Promise<PerformanceMetric> {
    console.log(`\n📊 Benchmarking: ${name}`);
    console.log(`  Query: "${query}"`);
    console.log(`  Iterations: ${iterations} (warmup: ${warmup})`);
    
    const metric: PerformanceMetric = {
      name,
      category: 'agent',
      measurements: {
        latency: [],
        memory: [],
        tokenUsage: {
          input: [],
          output: []
        }
      }
    };
    
    // Warmup
    console.log('  Warming up...');
    for (let i = 0; i < warmup; i++) {
      await executeImprovedOrchestrator(query, `bench-warmup-${i}`);
    }
    
    // Actual measurements
    console.log('  Measuring...');
    const sessionId = `bench-${name}-${Date.now()}`;
    
    for (let i = 0; i < iterations; i++) {
      const memBefore = memoryUsage();
      const start = performance.now();
      
      try {
        const result = await executeImprovedOrchestrator(query, sessionId);
        
        const end = performance.now();
        const memAfter = memoryUsage();
        
        metric.measurements.latency.push(end - start);
        metric.measurements.memory.push(memAfter.heapUsed - memBefore.heapUsed);
        
        // Estimate token usage (rough approximation)
        const inputTokens = Math.ceil(query.length / 4);
        const outputTokens = Math.ceil(JSON.stringify(result).length / 4);
        metric.measurements.tokenUsage?.input.push(inputTokens);
        metric.measurements.tokenUsage?.output.push(outputTokens);
        
      } catch (error) {
        console.error(`  Error in iteration ${i}:`, error);
      }
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
    
    // Calculate statistics
    metric.stats = this.calculateStats(metric);
    this.metrics.set(name, metric);
    
    this.printMetricSummary(metric);
    
    return metric;
  }
  
  /**
   * Measure A2A communication overhead
   */
  async measureA2ACommunication(iterations: number = 100): Promise<PerformanceMetric> {
    console.log(`\n📡 Benchmarking: A2A Communication`);
    console.log(`  Iterations: ${iterations}`);
    
    const metric: PerformanceMetric = {
      name: 'A2A Communication Overhead',
      category: 'a2a',
      measurements: {
        latency: [],
        memory: []
      }
    };
    
    // Direct agent-to-agent message passing
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        await agentNetwork.sendMessage(
          'orchestratorAgent',
          'priceInquiryAgent',
          'price_check',
          { symbol: 'BTCUSDT' }
        );
      } catch (error) {
        // Expected for non-existent routes
      }
      
      const end = performance.now();
      metric.measurements.latency.push(end - start);
      
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
    
    metric.stats = this.calculateStats(metric);
    this.metrics.set('a2a-overhead', metric);
    
    this.printMetricSummary(metric);
    
    return metric;
  }
  
  /**
   * Measure tool execution times
   */
  async measureToolPerformance(iterations: number = 50): Promise<PerformanceMetric> {
    console.log(`\n🔧 Benchmarking: Tool Execution`);
    console.log(`  Tool: marketDataResilientTool`);
    console.log(`  Iterations: ${iterations}`);
    
    const metric: PerformanceMetric = {
      name: 'Market Data Tool',
      category: 'tool',
      measurements: {
        latency: [],
        memory: []
      }
    };
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        await (marketDataResilientTool as any).execute({
          context: { symbol: 'BTCUSDT' }
        });
      } catch (error) {
        console.error(`  Error in iteration ${i}:`, error);
      }
      
      const end = performance.now();
      metric.measurements.latency.push(end - start);
      
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
    
    metric.stats = this.calculateStats(metric);
    this.metrics.set('tool-execution', metric);
    
    this.printMetricSummary(metric);
    
    return metric;
  }
  
  /**
   * Measure memory consumption patterns
   */
  async measureMemoryConsumption(): Promise<PerformanceMetric> {
    console.log(`\n💾 Benchmarking: Memory Consumption`);
    
    const metric: PerformanceMetric = {
      name: 'Memory Usage Pattern',
      category: 'memory',
      measurements: {
        latency: [],
        memory: []
      }
    };
    
    const memoryStore = useEnhancedConversationMemory.getState();
    const sessionId = `bench-memory-${Date.now()}`;
    
    // Add messages and track memory growth
    for (let i = 0; i < 100; i++) {
      const memBefore = memoryUsage();
      
      await memoryStore.addMessage({
        sessionId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i}: ${Array(100).fill('x').join('')}`,
        agentId: 'test-agent'
      });
      
      const memAfter = memoryUsage();
      metric.measurements.memory.push(memAfter.heapUsed - memBefore.heapUsed);
      
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }
    process.stdout.write('\n');
    
    metric.stats = this.calculateStats(metric);
    this.metrics.set('memory-consumption', metric);
    
    this.printMetricSummary(metric);
    
    return metric;
  }
  
  /**
   * Measure concurrent request handling
   */
  async measureConcurrentRequests(concurrency: number = 10): Promise<PerformanceMetric> {
    console.log(`\n🔄 Benchmarking: Concurrent Requests`);
    console.log(`  Concurrency: ${concurrency}`);
    
    const metric: PerformanceMetric = {
      name: 'Concurrent Request Handling',
      category: 'concurrent',
      measurements: {
        latency: [],
        memory: []
      },
      metadata: {
        concurrency
      }
    };
    
    const queries = [
      'BTCの価格は？',
      'ETHの分析をして',
      'トレンドラインを引いて',
      'RSIを表示して',
      'ADAの価格を教えて'
    ];
    
    // Run batches of concurrent requests
    for (let batch = 0; batch < 5; batch++) {
      const start = performance.now();
      
      const promises = Array(concurrency).fill(0).map((_, i) => 
        executeImprovedOrchestrator(
          queries[i % queries.length],
          `bench-concurrent-${batch}-${i}`
        )
      );
      
      await Promise.all(promises);
      
      const end = performance.now();
      metric.measurements.latency.push(end - start);
      
      process.stdout.write('.');
    }
    process.stdout.write('\n');
    
    metric.stats = this.calculateStats(metric);
    this.metrics.set('concurrent-requests', metric);
    
    this.printMetricSummary(metric);
    
    return metric;
  }
  
  /**
   * Calculate statistics from measurements
   */
  private calculateStats(metric: PerformanceMetric): PerformanceMetric['stats'] {
    const latencies = metric.measurements.latency.sort((a, b) => a - b);
    const memories = metric.measurements.memory.sort((a, b) => a - b);
    
    const stats: PerformanceMetric['stats'] = {
      latency: {
        min: latencies[0] || 0,
        max: latencies[latencies.length - 1] || 0,
        avg: latencies.reduce((sum, v) => sum + v, 0) / latencies.length || 0,
        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0
      },
      memory: {
        min: memories[0] || 0,
        max: memories[memories.length - 1] || 0,
        avg: memories.reduce((sum, v) => sum + v, 0) / memories.length || 0,
        delta: (memories[memories.length - 1] || 0) - (memories[0] || 0)
      }
    };
    
    if (metric.measurements.tokenUsage) {
      const inputTokens = metric.measurements.tokenUsage.input;
      const outputTokens = metric.measurements.tokenUsage.output;
      
      stats.tokenUsage = {
        inputAvg: inputTokens.reduce((sum, v) => sum + v, 0) / inputTokens.length || 0,
        outputAvg: outputTokens.reduce((sum, v) => sum + v, 0) / outputTokens.length || 0,
        totalAvg: 0
      };
      stats.tokenUsage.totalAvg = stats.tokenUsage.inputAvg + stats.tokenUsage.outputAvg;
    }
    
    return stats;
  }
  
  /**
   * Print metric summary
   */
  private printMetricSummary(metric: PerformanceMetric) {
    if (!metric.stats) return;
    
    console.log(`\n  📈 Results: ${metric.name}`);
    console.log(`  Latency (ms):`);
    console.log(`    Min: ${metric.stats.latency.min.toFixed(2)}`);
    console.log(`    Avg: ${metric.stats.latency.avg.toFixed(2)}`);
    console.log(`    P50: ${metric.stats.latency.p50.toFixed(2)}`);
    console.log(`    P95: ${metric.stats.latency.p95.toFixed(2)}`);
    console.log(`    P99: ${metric.stats.latency.p99.toFixed(2)}`);
    console.log(`    Max: ${metric.stats.latency.max.toFixed(2)}`);
    
    if (metric.stats.tokenUsage) {
      console.log(`  Token Usage:`);
      console.log(`    Input: ${metric.stats.tokenUsage.inputAvg.toFixed(0)}`);
      console.log(`    Output: ${metric.stats.tokenUsage.outputAvg.toFixed(0)}`);
      console.log(`    Total: ${metric.stats.tokenUsage.totalAvg.toFixed(0)}`);
    }
  }
  
  /**
   * Generate performance report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        memory: require('os').totalmem()
      },
      metrics: Array.from(this.metrics.values()).map(m => ({
        name: m.name,
        category: m.category,
        stats: m.stats,
        metadata: m.metadata
      })),
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generateRecommendations()
    };
    
    // Save detailed report
    const reportFile = path.join(
      this.outputDir,
      `performance_benchmark.json`
    );
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    // Generate summary
    const summary = this.generateSummary();
    console.log('\n' + summary);
    
    console.log(`\n✅ Report saved to: ${reportFile}`);
    
    return report;
  }
  
  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      if (!metric.stats) continue;
      
      // High latency bottlenecks
      if (metric.stats.latency.p95 > 5000) {
        bottlenecks.push(`High latency in ${name}: P95=${metric.stats.latency.p95.toFixed(0)}ms`);
      }
      
      // High variance bottlenecks
      const variance = metric.stats.latency.max - metric.stats.latency.min;
      if (variance > metric.stats.latency.avg * 2) {
        bottlenecks.push(`High variance in ${name}: ${variance.toFixed(0)}ms`);
      }
      
      // Memory bottlenecks
      if (metric.stats.memory.avg > 1024 * 1024) { // 1MB
        bottlenecks.push(`High memory usage in ${name}: ${(metric.stats.memory.avg / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    return bottlenecks;
  }
  
  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze A2A overhead
    const a2aMetric = this.metrics.get('a2a-overhead');
    if (a2aMetric?.stats && a2aMetric.stats.latency.avg > 100) {
      recommendations.push('Consider implementing A2A connection pooling to reduce overhead');
    }
    
    // Analyze tool execution
    const toolMetric = this.metrics.get('tool-execution');
    if (toolMetric?.stats && toolMetric.stats.latency.avg > 1000) {
      recommendations.push('Implement aggressive caching for market data tool responses');
    }
    
    // Analyze memory patterns
    const memoryMetric = this.metrics.get('memory-consumption');
    if (memoryMetric?.stats && memoryMetric.stats.memory.delta > 10 * 1024 * 1024) {
      recommendations.push('Implement memory archiving for conversation history');
    }
    
    // General recommendations
    recommendations.push(
      'Use GPT-3.5-turbo for simple queries to reduce latency',
      'Implement request batching for concurrent operations',
      'Add circuit breakers for failing agent communications'
    );
    
    return recommendations;
  }
  
  /**
   * Generate Japanese summary
   */
  private generateSummary(): string {
    const metrics = Array.from(this.metrics.values());
    const avgLatency = metrics.reduce((sum, m) => sum + (m.stats?.latency.avg || 0), 0) / metrics.length;
    const bottleneckCount = this.identifyBottlenecks().length;
    
    return `
📊 パフォーマンス測定完了
========================
平均レイテンシ: ${avgLatency.toFixed(0)}ms
ボトルネック: ${bottleneckCount}件検出
最適化提案: ${this.generateRecommendations().length}件

エージェントシステムの応答速度は${avgLatency < 1000 ? '良好' : '改善が必要'}です。
${bottleneckCount > 0 ? 'A2A通信とメモリ管理に課題があります。' : ''}
`;
  }
}

// Main execution
async function main() {
  const benchmark = new AgentPerformanceBenchmark();
  
  try {
    await benchmark.setup();
    
    // Run all benchmarks
    await benchmark.measureAgent('Price Inquiry', 'BTCの価格は？', 50, 5);
    await benchmark.measureAgent('UI Control', 'トレンドラインを引いて', 30, 3);
    await benchmark.measureAgent('Trading Analysis', 'BTCの詳細な分析をして', 20, 2);
    await benchmark.measureAgent('Complex Query', 'BTCの分析とエントリーポイントの提案をして', 10, 2);
    
    await benchmark.measureA2ACommunication(100);
    await benchmark.measureToolPerformance(50);
    await benchmark.measureMemoryConsumption();
    await benchmark.measureConcurrentRequests(10);
    
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

export { AgentPerformanceBenchmark };