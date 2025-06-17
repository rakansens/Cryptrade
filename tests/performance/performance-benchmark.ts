/**
 * Performance Benchmarking Utilities
 * Measures execution time for critical functions
 */

export interface PerformanceMetric {
  name: string;
  category: 'websocket' | 'analysis' | 'pattern' | 'indicator' | 'rendering';
  samples: number[];
  stats: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  metadata?: Record<string, any>;
}

export class PerformanceBenchmark {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  /**
   * Measure function execution time
   */
  async measure<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => T | Promise<T>,
    samples: number = 100,
    metadata?: Record<string, any>
  ): Promise<T> {
    const times: number[] = [];
    let result: T;
    
    // Warm up (5 runs)
    for (let i = 0; i < 5; i++) {
      await fn();
    }
    
    // Actual measurements
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      result = await fn();
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
    
    return result!;
  }
  
  /**
   * Measure sync function with high precision
   */
  measureSync<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => T,
    samples: number = 1000,
    metadata?: Record<string, any>
  ): T {
    const times: number[] = [];
    let result: T;
    
    // Warm up
    for (let i = 0; i < 10; i++) {
      fn();
    }
    
    // Measurements
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      result = fn();
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
    
    return result!;
  }
  
  /**
   * Calculate statistics from samples
   */
  private calculateStats(samples: number[]): PerformanceMetric['stats'] {
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
  
  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }
  
  /**
   * Export metrics to JSON
   */
  exportMetrics(): Record<string, any> {
    const metrics = this.getMetrics();
    const byCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push({
        name: metric.name,
        stats: metric.stats,
        metadata: metric.metadata
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    return {
      timestamp: new Date().toISOString(),
      totalMetrics: metrics.length,
      byCategory,
      summary: this.generateSummary(metrics)
    };
  }
  
  private generateSummary(metrics: PerformanceMetric[]): Record<string, any> {
    const categories = ['websocket', 'analysis', 'pattern', 'indicator', 'rendering'] as const;
    const summary: Record<string, any> = {};
    
    categories.forEach(category => {
      const categoryMetrics = metrics.filter(m => m.category === category);
      if (categoryMetrics.length > 0) {
        const meanTimes = categoryMetrics.map(m => m.stats.mean);
        summary[category] = {
          count: categoryMetrics.length,
          avgMean: meanTimes.reduce((a, b) => a + b, 0) / meanTimes.length,
          totalMean: meanTimes.reduce((a, b) => a + b, 0)
        };
      }
    });
    
    return summary;
  }
}