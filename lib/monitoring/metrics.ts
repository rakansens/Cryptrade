import { logger } from '@/lib/utils/logger';

/**
 * Prometheus-compatible metrics collector
 */

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  help?: string;
  type?: 'counter' | 'gauge' | 'histogram';
}

class MetricsCollector {
  private metrics: Map<string, MetricValue> = new Map();

  constructor() {
    // Initialize default metrics
    this.register('drawing_success_total', {
      type: 'counter',
      help: 'Total number of successful drawing operations',
      value: 0,
    });

    this.register('drawing_failed_total', {
      type: 'counter',
      help: 'Total number of failed drawing operations',
      value: 0,
    });

    this.register('drawing_retry_total', {
      type: 'counter',
      help: 'Total number of drawing operation retries',
      value: 0,
    });

    this.register('orchestrator_retry_total', {
      type: 'counter',
      help: 'Total number of orchestrator retries',
      value: 0,
    });

    this.register('drawing_queue_size', {
      type: 'gauge',
      help: 'Current size of the drawing operation queue',
      value: 0,
    });

    this.register('drawing_operation_duration_ms', {
      type: 'histogram',
      help: 'Duration of drawing operations in milliseconds',
      value: 0,
    });

    this.register('chart_control_parse_error_total', {
      type: 'counter',
      help: 'Total number of chart control JSON parse errors',
      value: 0,
    });

    // Market Data & Circuit Breaker metrics
    this.register('market_data_requests', {
      type: 'counter',
      help: 'Total number of market data requests',
      value: 0,
    });

    this.register('market_data_success', {
      type: 'counter',
      help: 'Total number of successful market data requests',
      value: 0,
    });

    this.register('market_data_failures', {
      type: 'counter',
      help: 'Total number of failed market data requests',
      value: 0,
    });

    this.register('market_data_circuit_open', {
      type: 'counter',
      help: 'Total number of requests rejected due to open circuit',
      value: 0,
    });

    this.register('market_data_cache_hits', {
      type: 'counter',
      help: 'Total number of market data cache hits',
      value: 0,
    });

    this.register('market_data_fallback', {
      type: 'counter',
      help: 'Total number of times fallback data was used',
      value: 0,
    });
  }

  register(name: string, metric: MetricValue): void {
    this.metrics.set(name, metric);
    logger.info('[Metrics] Registered metric', { name, type: metric.type });
  }

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn('[Metrics] Attempted to increment unknown metric', { name });
      return;
    }

    if (metric.type !== 'counter') {
      logger.warn('[Metrics] Attempted to increment non-counter metric', { name, type: metric.type });
      return;
    }

    metric.value += value;
    logger.debug('[Metrics] Incremented counter', { name, value: metric.value, increment: value });
  }

  set(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn('[Metrics] Attempted to set unknown metric', { name });
      return;
    }

    metric.value = value;
    logger.debug('[Metrics] Set metric value', { name, value });
  }

  observe(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn('[Metrics] Attempted to observe unknown metric', { name });
      return;
    }

    if (metric.type !== 'histogram') {
      logger.warn('[Metrics] Attempted to observe non-histogram metric', { name, type: metric.type });
      return;
    }

    // For simplicity, just track the latest value
    // In production, you'd want to maintain buckets
    metric.value = value;
    logger.debug('[Metrics] Observed histogram value', { name, value });
  }

  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      if (metric.help) {
        lines.push(`# HELP ${name} ${metric.help}`);
      }
      if (metric.type) {
        lines.push(`# TYPE ${name} ${metric.type}`);
      }
      lines.push(`${name} ${metric.value}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get all metrics as JSON
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metric] of this.metrics) {
      result[name] = {
        value: metric.value,
        type: metric.type,
        help: metric.help,
      };
    }

    return result;
  }

  /**
   * Reset all counters (useful for testing)
   */
  reset(): void {
    for (const [name, metric] of this.metrics) {
      if (metric.type === 'counter') {
        metric.value = 0;
      }
    }
    logger.info('[Metrics] Reset all counters');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Helper functions
export const incrementMetric = (name: string, value?: number) => 
  metricsCollector.increment(name, value);

export const setMetric = (name: string, value: number) => 
  metricsCollector.set(name, value);

export const observeMetric = (name: string, value: number) =>
  metricsCollector.observe(name, value);