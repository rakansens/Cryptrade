/**
 * Aggregator Service Unit Tests
 * 
 * TDD Red Phase: 失敗テストを作成  
 * 責任: Multi-timeframe統合, データマージ, 統計計算
 * 最適化目標: 重複除去とソート最適化
 */

import { AggregatorService } from '@/lib/services/market-data/aggregator.service';
import type { 
  MultiTimeframeData,
  CrossTimeframeValidation,
  GroupingResult,
  SimilarityMatcher
} from '@/lib/services/market-data/types';
import type { ProcessedKline } from '@/types/market';

// モック設定
jest.mock('@/lib/api/base-service');
jest.mock('@/lib/utils/logger');

describe('AggregatorService - TDD Red Phase', () => {
  let service: AggregatorService;
  let mockTimeframeData: Record<string, ProcessedKline[]>;
  let mockAbortController: AbortController;
  
  beforeEach(() => {
    service = new AggregatorService();
    mockAbortController = new AbortController();
    
    // マルチタイムフレームテストデータ
    mockTimeframeData = {
      '1m': Array.from({ length: 60 }, (_, i) => ({
        openTime: Date.now() + i * 60000,
        open: 50000 + Math.random() * 100,
        high: 50050 + Math.random() * 100,
        low: 49950 + Math.random() * 100,
        close: 50000 + Math.random() * 100,
        volume: Math.random() * 100,
        closeTime: Date.now() + i * 60000 + 59999,
        quoteAssetVolume: 0,
        numberOfTrades: 10,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0
      })),
      '5m': Array.from({ length: 12 }, (_, i) => ({
        openTime: Date.now() + i * 300000,
        open: 50000 + Math.random() * 200,
        high: 50100 + Math.random() * 200,
        low: 49900 + Math.random() * 200,
        close: 50000 + Math.random() * 200,
        volume: Math.random() * 500,
        closeTime: Date.now() + i * 300000 + 299999,
        quoteAssetVolume: 0,
        numberOfTrades: 50,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0
      })),
      '15m': Array.from({ length: 4 }, (_, i) => ({
        openTime: Date.now() + i * 900000,
        open: 50000 + Math.random() * 500,
        high: 50250 + Math.random() * 500,
        low: 49750 + Math.random() * 500,
        close: 50000 + Math.random() * 500,
        volume: Math.random() * 1500,
        closeTime: Date.now() + i * 900000 + 899999,
        quoteAssetVolume: 0,
        numberOfTrades: 150,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0
      }))
    };
    
    jest.clearAllMocks();
  });

  describe('🔴 Multi-Timeframe Integration - マルチタイムフレーム統合', () => {
    it('should merge data from multiple timeframes efficiently', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

      // Act & Assert
      const result = await service.mergeMultiTimeframeData(
        symbol,
        mockTimeframeData,
        timeframes,
        mockAbortController.signal
      );

      expect(result).toEqual({
        symbol,
        mergedData: expect.arrayContaining([
          expect.objectContaining({
            timeframe: expect.stringMatching(/^(1m|5m|15m|1h|4h|1d)$/),
            data: expect.any(Array),
            weight: expect.any(Number),
            dataPoints: expect.any(Number)
          })
        ]),
        processingTimeMs: expect.any(Number),
        totalDataPoints: expect.any(Number),
        duplicatesRemoved: expect.any(Number),
        sortingComplexity: 'O(n log n)'
      });
    });

    it('should handle data deduplication across timeframes', async () => {
      // Arrange - 重複データを含むテストケース
      const duplicatedData = {
        '1m': mockTimeframeData['1m'],
        '5m': [...mockTimeframeData['1m'].slice(0, 5)] // 重複データ
      };

      // Act
      const result = await service.mergeMultiTimeframeData(
        'BTCUSDT',
        duplicatedData,
        ['1m', '5m'],
        mockAbortController.signal
      );

      // Assert
      expect(result.duplicatesRemoved).toBeGreaterThan(0);
      expect(result.mergedData.length).toBeLessThan(
        mockTimeframeData['1m'].length + duplicatedData['5m'].length
      );
    });

    it('should achieve optimal sorting performance for large datasets', async () => {
      // Arrange - 大きなデータセットで性能テスト
      const largeTimeframeData = {
        '1m': Array.from({ length: 10000 }, (_, i) => mockTimeframeData['1m'][0]),
        '5m': Array.from({ length: 2000 }, (_, i) => mockTimeframeData['5m'][0])
      };

      // Act
      const startTime = performance.now();
      await service.mergeMultiTimeframeData(
        'BTCUSDT',
        largeTimeframeData,
        ['1m', '5m']
      );
      const endTime = performance.now();

      // Assert - O(n log n)性能要件
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });
  });

  describe('🔴 Statistical Calculations - 統計計算', () => {
    it('should calculate volume statistics across timeframes', async () => {
      // Act & Assert
      const result = await service.calculateVolumeStatistics(
        mockTimeframeData,
        mockAbortController.signal
      );

      expect(result).toEqual({
        totalVolume: expect.any(Number),
        averageVolume: expect.any(Number),
        volumeByTimeframe: expect.objectContaining({
          '1m': expect.any(Number),
          '5m': expect.any(Number),
          '15m': expect.any(Number)
        }),
        volumeTrend: expect.stringMatching(/^(increasing|decreasing|stable)$/),
        processingTimeMs: expect.any(Number)
      });

      expect(result.totalVolume).toBeGreaterThan(0);
      expect(result.averageVolume).toBeGreaterThan(0);
    });

    it('should calculate price range statistics efficiently', async () => {
      // Act & Assert
      const result = await service.calculatePriceRangeStatistics(
        mockTimeframeData,
        mockAbortController.signal
      );

      expect(result).toEqual({
        overallRange: expect.objectContaining({
          high: expect.any(Number),
          low: expect.any(Number),
          range: expect.any(Number),
          rangePercent: expect.any(Number)
        }),
        timeframeRanges: expect.any(Object),
        volatilityScore: expect.any(Number),
        processingTimeMs: expect.any(Number)
      });

      expect(result.overallRange.high).toBeGreaterThan(result.overallRange.low);
      expect(result.volatilityScore).toBeGreaterThanOrEqual(0);
    });

    it('should calculate volatility metrics across timeframes', async () => {
      // Act & Assert
      const result = await service.calculateVolatilityMetrics(
        mockTimeframeData,
        { period: 20, method: 'standardDeviation' },
        mockAbortController.signal
      );

      expect(result).toEqual({
        averageVolatility: expect.any(Number),
        volatilityByTimeframe: expect.any(Object),
        volatilityTrend: expect.stringMatching(/^(increasing|decreasing|stable)$/),
        riskLevel: expect.stringMatching(/^(low|medium|high)$/),
        processingTimeMs: expect.any(Number)
      });
    });
  });

  describe('🔴 Data Processing Optimization - データ処理最適化', () => {
    it('should process multi-timeframe data under 50ms', async () => {
      // Act
      const startTime = performance.now();
      await service.mergeMultiTimeframeData(
        'BTCUSDT',
        mockTimeframeData,
        ['1m', '5m', '15m']
      );
      const endTime = performance.now();

      // Assert - 性能要件
      expect(endTime - startTime).toBeLessThan(50); // 50ms以内
    });

    it('should handle concurrent processing without data corruption', async () => {
      // Arrange
      const concurrentOperations = Array.from({ length: 5 }, () =>
        service.mergeMultiTimeframeData(
          'BTCUSDT',
          mockTimeframeData,
          ['1m', '5m']
        )
      );

      // Act & Assert
      const results = await Promise.all(concurrentOperations);
      
      results.forEach(result => {
        expect(result.symbol).toBe('BTCUSDT');
        expect(result.mergedData).toBeDefined();
      });
    });
  });

  describe('🔴 Cross-Timeframe Validation - クロスタイムフレーム検証', () => {
    it('should validate data consistency across timeframes', async () => {
      // Act & Assert
      const result = await service.validateCrossTimeframe(
        mockTimeframeData,
        { tolerancePercent: 0.5 },
        mockAbortController.signal
      );

      expect(result).toEqual(expect.objectContaining({
        validationScore: expect.any(Number),
        supportingTimeframes: expect.arrayContaining([expect.any(String)]),
        touchCounts: expect.any(Object),
        avgStrength: expect.any(Number),
        metadata: expect.objectContaining({
          calculatedAt: expect.any(Number),
          tolerancePercent: expect.any(Number)
        })
      }) as CrossTimeframeValidation);

      expect(result.validationScore).toBeGreaterThanOrEqual(0);
      expect(result.validationScore).toBeLessThanOrEqual(1);
    });
  });

  describe('🔴 Grouping Operations - グループ化操作', () => {
    it('should group similar data points efficiently', async () => {
      // Arrange
      const dataPoints = mockTimeframeData['1m'];
      const matcher: SimilarityMatcher<ProcessedKline> = {
        calculate: (a, b) => Math.abs(a.close - b.close) / Math.max(a.close, b.close),
        threshold: 0.01 // 1%以内で類似と判定
      };

      // Act & Assert
      const result = await service.groupSimilarData(
        dataPoints,
        matcher,
        mockAbortController.signal
      );

      expect(result).toEqual(expect.objectContaining({
        groups: expect.arrayContaining([expect.any(Array)]),
        metadata: expect.objectContaining({
          totalItems: expect.any(Number),
          groupCount: expect.any(Number),
          avgGroupSize: expect.any(Number),
          processingTimeMs: expect.any(Number)
        })
      }) as GroupingResult<ProcessedKline>);

      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.metadata.totalItems).toBe(dataPoints.length);
    });

    it('should optimize grouping algorithm for large datasets', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 5000 }, () => mockTimeframeData['1m'][0]);
      const matcher: SimilarityMatcher<ProcessedKline> = {
        calculate: (a, b) => Math.abs(a.close - b.close),
        threshold: 100
      };

      // Act
      const startTime = performance.now();
      await service.groupSimilarData(largeDataset, matcher);
      const endTime = performance.now();

      // Assert - 効率的なグループ化
      expect(endTime - startTime).toBeLessThan(200); // 200ms以内
    });
  });

  describe('🔴 Error Handling - エラー処理', () => {
    it('should handle abort signal during processing', async () => {
      // Arrange
      setTimeout(() => mockAbortController.abort(), 50);

      // Act & Assert
      await expect(
        service.mergeMultiTimeframeData(
          'BTCUSDT',
          mockTimeframeData,
          ['1m', '5m'],
          mockAbortController.signal
        )
      ).rejects.toThrow('Operation aborted');
    });

    it('should handle empty timeframe data gracefully', async () => {
      // Arrange
      const emptyData = {};

      // Act & Assert
      await expect(
        service.mergeMultiTimeframeData('BTCUSDT', emptyData, ['1m'])
      ).rejects.toThrow('No timeframe data provided');
    });

    it('should handle mismatched timeframe configurations', async () => {
      // Arrange
      const mismatchedTimeframes = ['1m', '2m']; // 2mは存在しない

      // Act & Assert
      const result = await service.mergeMultiTimeframeData(
        'BTCUSDT',
        mockTimeframeData,
        mismatchedTimeframes
      );

      // 存在するタイムフレームのみ処理 (1m, 2m両方処理される - 2mは空配列)
      expect(result.mergedData.length).toBe(2); // 1m + 2m(空)
    });
  });
});