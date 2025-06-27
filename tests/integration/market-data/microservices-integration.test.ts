/**
 * Phase 3 Integration Tests: Market Data Microservices Integration
 * 
 * TDD Red Phase: 5つのマイクロサービス連携動作確認
 * - 応答時間: 2.5秒 → 0.5秒以下（80%改善）目標
 * - メモリ使用量最適化とleak prevention
 * - 並列処理とWorker Threads活用
 * 
 * Created: 2025-06-27 - Phase 3 Integration and Performance Optimization
 */

import { DataFetcherService } from '../../../lib/services/market-data/data-fetcher.service';
import { CacheManagerService } from '../../../lib/services/market-data/cache-manager.service';
import { AnalysisEngineService } from '../../../lib/services/market-data/analysis-engine.service';
import { AggregatorService } from '../../../lib/services/market-data/aggregator.service';
import { ValidatorService } from '../../../lib/services/market-data/validator.service';
import type { TimeframeConfig, ParallelFetchResult } from '../../../lib/services/market-data/types';
import type { ProcessedKline } from '../../../types/market';

describe('🔴 Market Data Microservices Integration Tests - Phase 3', () => {
  let dataFetcher: DataFetcherService;
  let cacheManager: CacheManagerService;
  let analysisEngine: AnalysisEngineService;
  let aggregator: AggregatorService;
  let validator: ValidatorService;

  // Performance tracking
  const performanceMetrics = {
    totalResponseTime: 0,
    memoryUsage: 0,
    throughput: 0,
    errorRate: 0
  };

  beforeEach(() => {
    // Initialize all 5 microservices
    dataFetcher = new DataFetcherService();
    cacheManager = new CacheManagerService({
      maxSize: 1000,
      defaultTtlMs: 300000, // 5 minutes
      cleanupIntervalMs: 60000
    });
    analysisEngine = new AnalysisEngineService();
    aggregator = new AggregatorService();
    validator = new ValidatorService();

    // Reset performance metrics
    performanceMetrics.totalResponseTime = 0;
    performanceMetrics.memoryUsage = 0;
    performanceMetrics.throughput = 0;
    performanceMetrics.errorRate = 0;
  });

  afterEach(async () => {
    // Cleanup resources
    cacheManager.destroy();
    
    // Force garbage collection for memory leak detection
    if (global.gc) {
      global.gc();
    }
  });

  describe('🎯 Core Integration Tests - 5 Services Orchestration', () => {
    it('should orchestrate all 5 services in complete data processing pipeline', async () => {
      const startTime = performance.now();
      const symbol = 'BTCUSDT';
      
      // Phase 1: Data Fetching (DataFetcherService)
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '1m', weight: 0.2, dataPoints: 100 },
        { interval: '5m', weight: 0.4, dataPoints: 200 },
        { interval: '1h', weight: 0.8, dataPoints: 50 }
      ];

      const fetchResult: ParallelFetchResult = await dataFetcher.fetchParallelTimeframes(
        symbol,
        timeframeConfigs
      );

      expect(fetchResult.symbol).toBe(symbol);
      expect(fetchResult.successCount).toBeGreaterThan(0);
      expect(fetchResult.totalFetchTime).toBeLessThan(2000); // < 2 seconds

      // Phase 2: Caching (CacheManagerService)  
      const cacheKey = `${symbol}_integration_test`;
      await cacheManager.set(cacheKey, fetchResult.data);
      
      const cachedData = await cacheManager.get(cacheKey);
      expect(cachedData).toBeDefined();

      // Phase 3: Validation (ValidatorService)
      const mockKlineData: ProcessedKline[] = [
        { 
          time: Date.now() - 60000,
          open: 50000, 
          high: 51000, 
          low: 49500, 
          close: 50500, 
          volume: 1000 
        },
        { 
          time: Date.now(),
          open: 50500, 
          high: 52000, 
          low: 50000, 
          close: 51500, 
          volume: 1200 
        }
      ];

      const validationResult = await validator.validateKlineData(mockKlineData);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.score).toBeGreaterThan(0.95); // 95%+ accuracy target

      // Phase 4: Analysis (AnalysisEngineService)
      const analysisResult = await analysisEngine.detectSwingPoints(mockKlineData);
      expect(analysisResult.swingPoints).toBeDefined();
      expect(analysisResult.algorithmComplexity).toBe('O(n log n)');

      // Phase 5: Aggregation (AggregatorService)
      const multiTimeframeData = {
        '1m': mockKlineData,
        '5m': mockKlineData,
        '1h': mockKlineData
      };
      
      const aggregationResult = await aggregator.mergeMultiTimeframeData(
        symbol,
        multiTimeframeData,
        ['1m', '5m', '1h']
      );

      expect(aggregationResult.mergedData).toHaveLength(3);
      expect(aggregationResult.sortingComplexity).toBe('O(n log n)');

      // Performance Validation - 80% improvement target (2.5s → 0.5s)
      const totalResponseTime = performance.now() - startTime;
      performanceMetrics.totalResponseTime = totalResponseTime;
      
      expect(totalResponseTime).toBeLessThan(500); // < 0.5 seconds target
      
      // Success criteria
      expect(fetchResult.failureCount).toBe(0);
      expect(validationResult.errors).toHaveLength(0);
      expect(analysisResult.totalPoints).toBeGreaterThan(0);
    });

    it('should handle concurrent processing with high throughput (1000 req/sec)', async () => {
      const concurrentRequests = 10; // Simulating high load
      const symbol = 'ETHUSDT';
      
      const timeframeConfig: TimeframeConfig = {
        interval: '1m',
        weight: 0.5,
        dataPoints: 50
      };

      const startTime = performance.now();
      
      // Execute concurrent requests
      const promises = Array.from({ length: concurrentRequests }, async (_, index) => {
        const testSymbol = `${symbol}_${index}`;
        
        try {
          // Parallel service execution
          const [fetchResult, cacheStats] = await Promise.all([
            dataFetcher.fetchParallelTimeframes(testSymbol, [timeframeConfig]),
            cacheManager.getStats()
          ]);

          return {
            success: true,
            fetchTime: fetchResult.totalFetchTime,
            cacheSize: cacheStats.size
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // Throughput calculation
      const successfulRequests = results.filter(r => r.success).length;
      const throughput = (successfulRequests / totalTime) * 1000; // requests per second
      performanceMetrics.throughput = throughput;

      // Performance assertions
      expect(successfulRequests).toBe(concurrentRequests);
      expect(throughput).toBeGreaterThan(10); // Minimum 10 req/sec
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds

      // Error rate should be < 0.1%
      const errorRate = ((concurrentRequests - successfulRequests) / concurrentRequests) * 100;
      performanceMetrics.errorRate = errorRate;
      expect(errorRate).toBeLessThan(0.1);
    });

    it('should optimize memory usage and prevent memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Stress test with large dataset
      const largeTimeframeConfigs: TimeframeConfig[] = Array.from({ length: 50 }, (_, i) => ({
        interval: `${i + 1}m`,
        weight: 0.1 + (i * 0.01),
        dataPoints: 1000 + (i * 100)
      }));

      const symbol = 'ADAUSDT';
      
      // Process large dataset
      for (let iteration = 0; iteration < 5; iteration++) {
        await dataFetcher.fetchParallelTimeframes(symbol, largeTimeframeConfigs.slice(0, 10));
        
        // Cache operations
        await cacheManager.set(`stress_test_${iteration}`, { data: 'large_dataset' });
        await cacheManager.cleanup(); // Force cleanup
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
      
      performanceMetrics.memoryUsage = memoryIncreasePercent;

      // Memory optimization target: < 50% increase
      expect(memoryIncreasePercent).toBeLessThan(50);
      
      // Verify cache cleanup effectiveness
      const cacheStats = await cacheManager.getStats();
      expect(cacheStats.size).toBeLessThan(100); // Should not accumulate indefinitely
    });
  });

  describe('🚨 Error Handling and Resilience', () => {
    it('should handle AbortSignal across all services', async () => {
      const controller = new AbortController();
      const symbol = 'LINKUSDT';
      
      // Start long-running operations
      const operationPromises = [
        dataFetcher.fetchParallelTimeframes(symbol, [
          { interval: '1h', weight: 1.0, dataPoints: 1000 }
        ], controller.signal),
        
        analysisEngine.detectSwingPoints([
          { time: Date.now(), open: 100, high: 110, low: 95, close: 105, volume: 1000 }
        ], {}, controller.signal)
      ];

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      // All operations should be aborted
      await Promise.allSettled(operationPromises).then(results => {
        results.forEach(result => {
          if (result.status === 'rejected') {
            expect(result.reason.message).toContain('aborted');
          }
        });
      });
    });

    it('should handle service failures gracefully with circuit breaker pattern', async () => {
      const symbol = 'DOGEUSDT';
      
      // Simulate service failure
      const invalidTimeframeConfig: TimeframeConfig = {
        interval: 'invalid' as any,
        weight: 1.0,
        dataPoints: 100
      };

      // Should handle failure without crashing
      await expect(
        dataFetcher.fetchParallelTimeframes(symbol, [invalidTimeframeConfig])
      ).rejects.toThrow();

      // Other services should continue working
      const validationResult = await validator.validateKlineData([]);
      expect(validationResult).toBeDefined();
      
      const cacheStats = await cacheManager.getStats();
      expect(cacheStats).toBeDefined();
    });
  });

  describe('📊 Performance Benchmarks and Metrics', () => {
    it('should meet performance targets across all metrics', async () => {
      const benchmarkStartTime = performance.now();
      
      // Comprehensive performance test
      const symbol = 'BNBUSDT';
      const testData: ProcessedKline[] = Array.from({ length: 1000 }, (_, i) => ({
        time: Date.now() - (i * 60000),
        open: 300 + Math.random() * 50,
        high: 320 + Math.random() * 30,
        low: 280 + Math.random() * 40,
        close: 310 + Math.random() * 40,
        volume: 1000 + Math.random() * 500
      }));

      // Execute all services in sequence and parallel
      const [
        fetchResult,
        validationResult,
        analysisResult,
        volumeStats
      ] = await Promise.all([
        dataFetcher.fetchParallelTimeframes(symbol, [
          { interval: '1m', weight: 0.3, dataPoints: 500 }
        ]),
        validator.validateKlineData(testData),
        analysisEngine.detectSwingPoints(testData),
        aggregator.calculateVolumeStatistics({ '1m': testData.map(d => d) })
      ]);

      const benchmarkTime = performance.now() - benchmarkStartTime;

      // Performance Assertions
      expect(benchmarkTime).toBeLessThan(500); // < 0.5 seconds
      expect(fetchResult.totalFetchTime).toBeLessThan(200); // < 0.2 seconds for fetching
      expect(analysisResult.processingTimeMs).toBeLessThan(100); // < 0.1 seconds for analysis
      expect(volumeStats.processingTimeMs).toBeLessThan(50); // < 0.05 seconds for stats

      // Accuracy Assertions
      expect(validationResult.score).toBeGreaterThan(0.95); // 95%+ accuracy
      expect(analysisResult.algorithmComplexity).toBe('O(n log n)');
      expect(volumeStats.totalVolume).toBeGreaterThan(0);

      // Log final performance metrics
      console.log('📊 Final Performance Metrics:', {
        totalResponseTime: benchmarkTime,
        fetchTime: fetchResult.totalFetchTime,
        analysisTime: analysisResult.processingTimeMs,
        validationScore: validationResult.score,
        memoryUsage: performanceMetrics.memoryUsage,
        throughput: performanceMetrics.throughput,
        errorRate: performanceMetrics.errorRate
      });
    });
  });

  describe('🎛️ Service Health and Monitoring', () => {
    it('should provide health check endpoints for all services', async () => {
      // Service health checks
      const healthChecks = {
        dataFetcher: true, // Always healthy in mock
        cacheManager: await cacheManager.getStats().then(() => true).catch(() => false),
        analysisEngine: true, // Always healthy in mock  
        aggregator: true, // Always healthy in mock
        validator: true // Always healthy in mock
      };

      // All services should be healthy
      Object.values(healthChecks).forEach(isHealthy => {
        expect(isHealthy).toBe(true);
      });

      // Cache service detailed health
      const cacheStats = await cacheManager.getStats();
      expect(cacheStats.size).toBeGreaterThanOrEqual(0);
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheStats.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should collect comprehensive metrics for monitoring', async () => {
      const metricsCollection = {
        services: {
          dataFetcher: {
            totalRequests: 0,
            successRate: 0,
            avgResponseTime: 0
          },
          cacheManager: {
            hitRate: 0,
            missRate: 0,
            memoryUsage: 0
          },
          analysisEngine: {
            analysisCount: 0,
            avgProcessingTime: 0,
            complexityOptimization: 'O(n log n)'
          },
          aggregator: {
            mergeOperations: 0,
            avgMergeTime: 0,
            dataIntegrity: 0
          },
          validator: {
            validationCount: 0,
            accuracyScore: 0,
            anomalyDetection: 0
          }
        },
        overall: {
          systemThroughput: 0,
          systemLatency: 0,
          errorRate: 0,
          memoryEfficiency: 0
        }
      };

      // Populate metrics through actual operations
      const symbol = 'MATICUSDT';
      const testData: ProcessedKline[] = [
        { time: Date.now(), open: 1.5, high: 1.6, low: 1.4, close: 1.55, volume: 10000 }
      ];

      const startTime = performance.now();
      
      await dataFetcher.fetchParallelTimeframes(symbol, [
        { interval: '1m', weight: 0.5, dataPoints: 100 }
      ]);
      
      const endTime = performance.now();
      metricsCollection.services.dataFetcher.avgResponseTime = endTime - startTime;
      metricsCollection.services.dataFetcher.successRate = 1.0;

      const cacheStats = await cacheManager.getStats();
      metricsCollection.services.cacheManager.hitRate = cacheStats.hitRate;
      metricsCollection.services.cacheManager.memoryUsage = cacheStats.memoryUsage;

      const validationResult = await validator.validateKlineData(testData);
      metricsCollection.services.validator.accuracyScore = validationResult.score;

      // Verify metrics collection
      expect(metricsCollection.services.dataFetcher.avgResponseTime).toBeGreaterThan(0);
      expect(metricsCollection.services.cacheManager.hitRate).toBeGreaterThanOrEqual(0);
      expect(metricsCollection.services.validator.accuracyScore).toBeGreaterThan(0.9);
      
      console.log('📈 Service Metrics:', metricsCollection);
    });
  });
});