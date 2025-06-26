/**
 * DataFetcher Service Unit Tests
 * 
 * TDD Red Phase: 失敗テストを作成
 * 責任: 並列データ取得、AbortSignal対応、タイムアウト処理
 * 最適化目標: O(n²) → O(n) 並列処理効率化
 */

import { DataFetcherService } from '@/lib/services/market-data/data-fetcher.service';
import type { TimeframeConfig, ParallelFetchResult } from '@/lib/services/market-data/types';
import type { ProcessedKline } from '@/types/market';

// モック設定
jest.mock('@/lib/api/base-service');
jest.mock('@/lib/utils/logger');

describe('DataFetcherService - TDD Red Phase', () => {
  let service: DataFetcherService;
  let mockAbortController: AbortController;
  
  beforeEach(() => {
    service = new DataFetcherService();
    mockAbortController = new AbortController();
    jest.clearAllMocks();
  });

  describe('🔴 fetchParallelTimeframes - 並列データ取得', () => {
    it('should fetch data from multiple timeframes in parallel', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 },
        { interval: '1h', weight: 0.3, dataPoints: 500 },
        { interval: '4h', weight: 0.35, dataPoints: 400 }
      ];

      const expectedResult: ParallelFetchResult = {
        symbol,
        data: {
          '15m': { data: [], weight: 0.2, dataPoints: 200, fetchedAt: expect.any(Number) },
          '1h': { data: [], weight: 0.3, dataPoints: 500, fetchedAt: expect.any(Number) },
          '4h': { data: [], weight: 0.35, dataPoints: 400, fetchedAt: expect.any(Number) }
        },
        totalFetchTime: expect.any(Number),
        successCount: 3,
        failureCount: 0
      };

      // Act & Assert
      await expect(
        service.fetchParallelTimeframes(symbol, timeframeConfigs)
      ).resolves.toEqual(expectedResult);
    });

    it('should handle partial failures gracefully', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 },
        { interval: 'invalid', weight: 0.3, dataPoints: 500 }
      ];

      // Act & Assert - 部分的成功でも結果を返す
      const result = await service.fetchParallelTimeframes(symbol, timeframeConfigs);
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.failureCount).toBeGreaterThan(0);
    });
  });

  describe('🔴 AbortSignal Support - キャンセレーション対応', () => {
    it('should respect abort signal and cancel all parallel requests', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 },
        { interval: '1h', weight: 0.3, dataPoints: 500 }
      ];

      // Act - すぐにアボート
      mockAbortController.abort();

      // Assert
      await expect(
        service.fetchParallelTimeframes(symbol, timeframeConfigs, mockAbortController.signal)
      ).rejects.toThrow('Operation aborted');
    });

    it('should clean up resources when aborted mid-request', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 }
      ];

      // Act - 500msで アボート
      setTimeout(() => mockAbortController.abort(), 500);

      // Assert
      await expect(
        service.fetchParallelTimeframes(symbol, timeframeConfigs, mockAbortController.signal)
      ).rejects.toThrow('Operation aborted');
    });
  });

  describe('🔴 Timeout Handling - タイムアウト処理', () => {
    it('should timeout individual timeframe requests after specified duration', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 }
      ];
      const timeoutMs = 100; // 非常に短いタイムアウト

      // Act & Assert
      const result = await service.fetchParallelTimeframes(
        symbol, 
        timeframeConfigs, 
        undefined, 
        { timeoutMs }
      );
      
      // タイムアウトエラーでも部分的結果を返すべき
      expect(result.failureCount).toBeGreaterThan(0);
    });

    it('should apply different timeouts per timeframe based on data points', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 100 },  // 短時間
        { interval: '1d', weight: 0.15, dataPoints: 1000 }  // 長時間
      ];

      // Act
      const result = await service.fetchParallelTimeframes(symbol, timeframeConfigs);

      // Assert - データポイント数に応じた適応的タイムアウト
      expect(result.data['15m']?.fetchedAt).toBeLessThan(
        result.data['1d']?.fetchedAt || 0
      );
    });
  });

  describe('🔴 Performance Optimization - O(n)最適化', () => {
    it('should achieve O(n) time complexity for parallel fetching', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = Array.from(
        { length: 10 }, 
        (_, i) => ({ interval: `${i+1}m`, weight: 0.1, dataPoints: 100 })
      );

      // Act
      const startTime = performance.now();
      await service.fetchParallelTimeframes(symbol, timeframeConfigs);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert - O(n)のため、タイムフレーム数が増えても線形時間内
      expect(executionTime).toBeLessThan(1000); // 1秒以内
    });

    it('should not create O(n²) nested loops during parallel execution', async () => {
      // このテストは実装後にパフォーマンス測定で検証
      expect(true).toBe(true); // プレースホルダー
    });
  });

  describe('🔴 Error Recovery - エラー回復', () => {
    it('should retry failed requests with exponential backoff', async () => {
      // Arrange
      const symbol = 'BTCUSDT';
      const timeframeConfigs: TimeframeConfig[] = [
        { interval: '15m', weight: 0.2, dataPoints: 200 }
      ];

      // Act & Assert
      const result = await service.fetchParallelTimeframes(
        symbol, 
        timeframeConfigs, 
        undefined,
        { retryAttempts: 3, exponentialBackoff: true }
      );

      expect(result).toBeDefined();
    });
  });
});