// Mock logger first
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }
}));

import { metricsCollector, incrementMetric, setMetric, observeMetric } from '../metrics';
import { logger } from '@/lib/utils/logger';

describe('MetricsCollector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all metrics
    metricsCollector.reset();
  });

  describe('Metric Registration', () => {
    it('should register a new metric', () => {
      metricsCollector.register('test_metric', {
        type: 'counter',
        help: 'Test metric for unit tests',
        value: 0,
      });

      expect(logger.info).toHaveBeenCalledWith('[Metrics] Registered metric', {
        name: 'test_metric',
        type: 'counter'
      });
    });

    it('should initialize with default metrics', () => {
      // Export metrics to check initialization
      const exported = metricsCollector.export();
      
      expect(exported).toContain('drawing_success_total');
      expect(exported).toContain('drawing_failed_total');
      expect(exported).toContain('drawing_retry_total');
      expect(exported).toContain('orchestrator_retry_total');
      expect(exported).toContain('drawing_queue_size');
      expect(exported).toContain('drawing_operation_duration_ms');
      expect(exported).toContain('chart_control_parse_error_total');
      expect(exported).toContain('market_data_requests');
      expect(exported).toContain('market_data_success');
      expect(exported).toContain('market_data_failures');
      expect(exported).toContain('market_data_circuit_open');
      expect(exported).toContain('market_data_cache_hits');
      expect(exported).toContain('market_data_fallback');
    });
  });

  describe('Counter Operations', () => {
    it('should increment counter metric', () => {
      metricsCollector.increment('drawing_success_total');
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_success_total.value).toBe(1);
    });

    it('should increment counter by custom value', () => {
      metricsCollector.increment('drawing_retry_total', 5);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_retry_total.value).toBe(5);
    });

    it('should accumulate increments', () => {
      metricsCollector.increment('market_data_requests', 3);
      metricsCollector.increment('market_data_requests', 2);
      metricsCollector.increment('market_data_requests');
      
      const json = metricsCollector.toJSON();
      expect(json.market_data_requests.value).toBe(6);
    });

    it('should warn when incrementing unknown metric', () => {
      metricsCollector.increment('unknown_metric');
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Metrics] Attempted to increment unknown metric',
        { name: 'unknown_metric' }
      );
    });

    it('should warn when incrementing non-counter metric', () => {
      metricsCollector.increment('drawing_queue_size'); // This is a gauge
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Metrics] Attempted to increment non-counter metric',
        { name: 'drawing_queue_size', type: 'gauge' }
      );
    });
  });

  describe('Gauge Operations', () => {
    it('should set gauge metric value', () => {
      metricsCollector.set('drawing_queue_size', 10);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_queue_size.value).toBe(10);
    });

    it('should overwrite gauge value', () => {
      metricsCollector.set('drawing_queue_size', 10);
      metricsCollector.set('drawing_queue_size', 5);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_queue_size.value).toBe(5);
    });

    it('should warn when setting unknown metric', () => {
      metricsCollector.set('unknown_metric', 100);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Metrics] Attempted to set unknown metric',
        { name: 'unknown_metric' }
      );
    });

    it('should allow setting counter values', () => {
      metricsCollector.set('drawing_success_total', 42);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_success_total.value).toBe(42);
    });
  });

  describe('Histogram Operations', () => {
    it('should observe histogram values', () => {
      metricsCollector.observe('drawing_operation_duration_ms', 125);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_operation_duration_ms.value).toBe(125);
    });

    it('should update histogram with latest observation', () => {
      metricsCollector.observe('drawing_operation_duration_ms', 100);
      metricsCollector.observe('drawing_operation_duration_ms', 200);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_operation_duration_ms.value).toBe(200);
    });

    it('should warn when observing unknown metric', () => {
      metricsCollector.observe('unknown_metric', 50);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Metrics] Attempted to observe unknown metric',
        { name: 'unknown_metric' }
      );
    });

    it('should warn when observing non-histogram metric', () => {
      metricsCollector.observe('drawing_success_total', 50); // This is a counter
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[Metrics] Attempted to observe non-histogram metric',
        { name: 'drawing_success_total', type: 'counter' }
      );
    });
  });

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', () => {
      metricsCollector.increment('drawing_success_total', 10);
      metricsCollector.set('drawing_queue_size', 5);
      metricsCollector.observe('drawing_operation_duration_ms', 250);
      
      const exported = metricsCollector.export();
      
      // Check format
      expect(exported).toContain('# HELP drawing_success_total Total number of successful drawing operations');
      expect(exported).toContain('# TYPE drawing_success_total counter');
      expect(exported).toContain('drawing_success_total 10');
      
      expect(exported).toContain('# HELP drawing_queue_size Current size of the drawing operation queue');
      expect(exported).toContain('# TYPE drawing_queue_size gauge');
      expect(exported).toContain('drawing_queue_size 5');
      
      expect(exported).toContain('# HELP drawing_operation_duration_ms Duration of drawing operations in milliseconds');
      expect(exported).toContain('# TYPE drawing_operation_duration_ms histogram');
      expect(exported).toContain('drawing_operation_duration_ms 250');
    });

    it('should handle empty metrics gracefully', () => {
      const exported = metricsCollector.export();
      
      expect(exported).toBeDefined();
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should include all registered metrics', () => {
      const expectedMetrics = [
        'drawing_success_total',
        'drawing_failed_total',
        'drawing_retry_total',
        'orchestrator_retry_total',
        'drawing_queue_size',
        'drawing_operation_duration_ms',
        'chart_control_parse_error_total',
        'market_data_requests',
        'market_data_success',
        'market_data_failures',
        'market_data_circuit_open',
        'market_data_cache_hits',
        'market_data_fallback'
      ];
      
      const exported = metricsCollector.export();
      
      expectedMetrics.forEach(metric => {
        expect(exported).toContain(metric);
      });
    });
  });

  describe('JSON Export', () => {
    it('should export all metrics as JSON', () => {
      metricsCollector.increment('drawing_success_total', 20);
      metricsCollector.set('drawing_queue_size', 3);
      
      const json = metricsCollector.toJSON();
      
      expect(json).toHaveProperty('drawing_success_total');
      expect(json.drawing_success_total).toEqual({
        value: 20,
        type: 'counter',
        help: 'Total number of successful drawing operations'
      });
      
      expect(json).toHaveProperty('drawing_queue_size');
      expect(json.drawing_queue_size).toEqual({
        value: 3,
        type: 'gauge',
        help: 'Current size of the drawing operation queue'
      });
    });

    it('should include all metric metadata', () => {
      const json = metricsCollector.toJSON();
      
      Object.values(json).forEach(metric => {
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('type');
        expect(metric).toHaveProperty('help');
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all counters to zero', () => {
      // Set some values
      metricsCollector.increment('drawing_success_total', 10);
      metricsCollector.increment('drawing_failed_total', 5);
      metricsCollector.set('drawing_queue_size', 8);
      
      // Reset
      metricsCollector.reset();
      
      const json = metricsCollector.toJSON();
      
      // Counters should be reset
      expect(json.drawing_success_total.value).toBe(0);
      expect(json.drawing_failed_total.value).toBe(0);
      
      // Gauges should not be reset
      expect(json.drawing_queue_size.value).toBe(8);
    });

    it('should log reset action', () => {
      metricsCollector.reset();
      
      expect(logger.info).toHaveBeenCalledWith('[Metrics] Reset all counters');
    });
  });

  describe('Helper Functions', () => {
    it('should increment metric using helper', () => {
      incrementMetric('drawing_success_total');
      incrementMetric('drawing_success_total', 2);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_success_total.value).toBe(3);
    });

    it('should set metric using helper', () => {
      setMetric('drawing_queue_size', 15);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_queue_size.value).toBe(15);
    });

    it('should observe metric using helper', () => {
      observeMetric('drawing_operation_duration_ms', 300);
      
      const json = metricsCollector.toJSON();
      expect(json.drawing_operation_duration_ms.value).toBe(300);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should track drawing operation metrics', () => {
      // Simulate successful drawing operations
      incrementMetric('drawing_success_total', 5);
      observeMetric('drawing_operation_duration_ms', 150);
      
      // Simulate failed operations with retries
      incrementMetric('drawing_failed_total');
      incrementMetric('drawing_retry_total', 3);
      
      // Update queue size
      setMetric('drawing_queue_size', 2);
      
      const json = metricsCollector.toJSON();
      
      expect(json.drawing_success_total.value).toBe(5);
      expect(json.drawing_failed_total.value).toBe(1);
      expect(json.drawing_retry_total.value).toBe(3);
      expect(json.drawing_queue_size.value).toBe(2);
      expect(json.drawing_operation_duration_ms.value).toBe(150);
    });

    it('should track market data operations', () => {
      // Simulate market data requests
      incrementMetric('market_data_requests', 100);
      incrementMetric('market_data_success', 95);
      incrementMetric('market_data_failures', 3);
      incrementMetric('market_data_circuit_open', 2);
      
      // Cache metrics
      incrementMetric('market_data_cache_hits', 50);
      incrementMetric('market_data_fallback', 5);
      
      const json = metricsCollector.toJSON();
      
      expect(json.market_data_requests.value).toBe(100);
      expect(json.market_data_success.value).toBe(95);
      expect(json.market_data_failures.value).toBe(3);
      expect(json.market_data_circuit_open.value).toBe(2);
      expect(json.market_data_cache_hits.value).toBe(50);
      expect(json.market_data_fallback.value).toBe(5);
    });

    it('should handle high-frequency metric updates', () => {
      // Simulate rapid metric updates
      for (let i = 0; i < 1000; i++) {
        incrementMetric('drawing_success_total');
        if (i % 10 === 0) {
          incrementMetric('drawing_retry_total');
        }
        if (i % 50 === 0) {
          incrementMetric('drawing_failed_total');
        }
      }
      
      const json = metricsCollector.toJSON();
      
      expect(json.drawing_success_total.value).toBe(1000);
      expect(json.drawing_retry_total.value).toBe(100);
      expect(json.drawing_failed_total.value).toBe(20);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation durations', () => {
      const durations = [50, 100, 150, 200, 250, 300];
      
      durations.forEach(duration => {
        observeMetric('drawing_operation_duration_ms', duration);
      });
      
      // In this simple implementation, only the last value is kept
      const json = metricsCollector.toJSON();
      expect(json.drawing_operation_duration_ms.value).toBe(300);
    });

    it('should handle concurrent metric updates', () => {
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve().then(() => {
          incrementMetric('market_data_requests');
          if (i % 2 === 0) {
            incrementMetric('market_data_success');
          }
        })
      );
      
      return Promise.all(promises).then(() => {
        const json = metricsCollector.toJSON();
        expect(json.market_data_requests.value).toBe(100);
        expect(json.market_data_success.value).toBe(50);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric names gracefully', () => {
      const invalidNames = ['', null, undefined, 123, {}, []];
      
      invalidNames.forEach(name => {
        expect(() => incrementMetric(name as any)).not.toThrow();
        expect(() => setMetric(name as any, 10)).not.toThrow();
        expect(() => observeMetric(name as any, 10)).not.toThrow();
      });
    });

    it('should handle invalid values gracefully', () => {
      const invalidValues = [null, undefined, 'string', {}, []];
      
      invalidValues.forEach(value => {
        expect(() => incrementMetric('drawing_success_total', value as any)).not.toThrow();
        expect(() => setMetric('drawing_queue_size', value as any)).not.toThrow();
        expect(() => observeMetric('drawing_operation_duration_ms', value as any)).not.toThrow();
      });
    });
  });
});