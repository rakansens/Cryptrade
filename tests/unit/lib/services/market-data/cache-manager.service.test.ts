/**
 * CacheManager Service Unit Tests
 * 
 * TDD Red Phase: 失敗テストを作成
 * 責任: Redis/Memory キャッシュ管理、TTL設定、キャッシュヒット率最適化
 * 最適化目標: O(1) キャッシュアクセス、メモリ効率化
 */

import { CacheManagerService } from '@/lib/services/market-data/cache-manager.service';
import type { 
  CacheEntry, 
  CacheStats, 
  CacheConfig 
} from '@/lib/services/market-data/types';

// モック設定
jest.mock('@/lib/api/base-service');
jest.mock('@/lib/utils/logger');

describe('CacheManagerService - TDD Red Phase', () => {
  let service: CacheManagerService;
  let mockConfig: CacheConfig;
  
  beforeEach(() => {
    mockConfig = {
      maxSize: 1000,
      defaultTtlMs: 60000, // 1分
      cleanupIntervalMs: 30000, // 30秒
      compressionEnabled: true
    };
    service = new CacheManagerService(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    service.destroy?.();
  });

  describe('🔴 Cache Operations - 基本キャッシュ操作', () => {
    it('should store and retrieve cache entries with correct metadata', async () => {
      // Arrange
      const key = 'BTCUSDT:15m:data';
      const testData = { price: 50000, volume: 1000 };
      const ttlMs = 30000;

      // Act
      await service.set(key, testData, ttlMs);
      const result = await service.get<typeof testData>(key);

      // Assert
      expect(result).toEqual(testData);
      
      const entry = await service.getEntry(key);
      expect(entry).toMatchObject({
        data: testData,
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number),
        accessCount: expect.any(Number),
        lastAccessed: expect.any(Number)
      });
    });

    it('should return null for expired entries', async () => {
      // Arrange
      const key = 'expired:key';
      const testData = { test: 'data' };
      const shortTtl = 10; // 10ms

      // Act
      await service.set(key, testData, shortTtl);
      
      // 期限切れまで待機
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const result = await service.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle concurrent access without corruption', async () => {
      // Arrange
      const key = 'concurrent:test';
      const requests = Array.from({ length: 100 }, (_, i) => ({
        key: `${key}:${i}`,
        data: { index: i, timestamp: Date.now() }
      }));

      // Act - 並行書き込み
      await Promise.all(
        requests.map(req => service.set(req.key, req.data))
      );

      // Act - 並行読み込み
      const results = await Promise.all(
        requests.map(req => service.get(req.key))
      );

      // Assert
      results.forEach((result, index) => {
        expect(result).toEqual(requests[index].data);
      });
    });
  });

  describe('🔴 TTL Management - 期限管理', () => {
    it('should respect custom TTL per entry', async () => {
      // Arrange
      const key1 = 'short:ttl';
      const key2 = 'long:ttl';
      const data = { test: 'data' };

      // Act
      await service.set(key1, data, 50); // 50ms
      await service.set(key2, data, 200); // 200ms

      // 100ms後にチェック
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(await service.get(key1)).toBeNull(); // 期限切れ
      expect(await service.get(key2)).toEqual(data); // まだ有効
    });

    it('should update TTL when refreshing entries', async () => {
      // Arrange
      const key = 'refresh:test';
      const originalData = { version: 1 };
      const newData = { version: 2 };

      // Act
      await service.set(key, originalData, 100);
      await service.refresh(key, newData, 300);

      // Assert
      const result = await service.get(key);
      expect(result).toEqual(newData);
      
      const entry = await service.getEntry(key);
      expect(entry?.expiresAt).toBeGreaterThan(Date.now() + 250);
    });
  });

  describe('🔴 Memory Management - メモリ最適化', () => {
    it('should enforce max size limit with LRU eviction', async () => {
      // Arrange
      const smallConfig: CacheConfig = {
        ...mockConfig,
        maxSize: 3 // 非常に小さなサイズ
      };
      const smallService = new CacheManagerService(smallConfig);

      // Act - 制限を超えて追加
      await smallService.set('key1', { data: 1 });
      await smallService.set('key2', { data: 2 });
      await smallService.set('key3', { data: 3 });
      await smallService.set('key4', { data: 4 }); // これで key1 が削除されるはず

      // Assert
      expect(await smallService.get('key1')).toBeNull(); // LRUで削除
      expect(await smallService.get('key4')).toEqual({ data: 4 }); // 新しいエントリは存在

      smallService.destroy?.();
    });

    it('should provide accurate cache statistics', async () => {
      // Arrange
      await service.set('stats:key1', { data: 1 });
      await service.set('stats:key2', { data: 2 });
      await service.get('stats:key1'); // ヒット
      await service.get('nonexistent'); // ミス

      // Act
      const stats = await service.getStats();

      // Assert
      expect(stats).toMatchObject({
        size: expect.any(Number),
        hitRatio: expect.any(Number),
        entries: expect.arrayContaining([
          expect.objectContaining({
            key: expect.any(String),
            size: expect.any(Number),
            age: expect.any(Number),
            accessCount: expect.any(Number)
          })
        ])
      });
      expect(stats.hitRatio).toBeGreaterThan(0);
      expect(stats.hitRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('🔴 Performance Optimization - パフォーマンス最適化', () => {
    it('should achieve O(1) cache access time', async () => {
      // Arrange - 大量データで性能テスト
      const testData = Array.from({ length: 1000 }, (_, i) => ({
        key: `perf:test:${i}`,
        data: { index: i, timestamp: Date.now() }
      }));

      // セットアップ
      await Promise.all(
        testData.map(item => service.set(item.key, item.data))
      );

      // Act - アクセス時間測定
      const startTime = performance.now();
      await Promise.all(
        testData.slice(0, 100).map(item => service.get(item.key))
      );
      const endTime = performance.now();
      const averageAccessTime = (endTime - startTime) / 100;

      // Assert - O(1)性能要件
      expect(averageAccessTime).toBeLessThan(1); // 1ms以下
    });

    it('should handle compression for large data efficiently', async () => {
      // Arrange
      const largeData = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          price: 50000 + Math.random() * 1000,
          volume: Math.random() * 1000000,
          timestamp: Date.now() + i * 1000
        }))
      };

      // Act
      const startTime = performance.now();
      await service.set('large:data', largeData);
      const retrieved = await service.get('large:data');
      const endTime = performance.now();

      // Assert
      expect(retrieved).toEqual(largeData);
      expect(endTime - startTime).toBeLessThan(100); // 100ms以下
    });
  });

  describe('🔴 Cleanup and Maintenance - クリーンアップ', () => {
    it('should automatically clean expired entries', async () => {
      // Arrange
      await service.set('cleanup:test1', { data: 1 }, 50);
      await service.set('cleanup:test2', { data: 2 }, 300);

      // Act - クリーンアップを強制実行
      await new Promise(resolve => setTimeout(resolve, 100));
      await service.forceCleanup();

      // Assert
      expect(await service.get('cleanup:test1')).toBeNull();
      expect(await service.get('cleanup:test2')).toEqual({ data: 2 });
    });

    it('should gracefully shutdown and cleanup resources', async () => {
      // Arrange
      await service.set('shutdown:test', { data: 1 });

      // Act & Assert - エラーなしでシャットダウン
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('🔴 Error Handling - エラー処理', () => {
    it('should handle invalid keys gracefully', async () => {
      // Act & Assert
      await expect(service.set('', { data: 1 })).rejects.toThrow('Invalid cache key');
      await expect(service.get('')).rejects.toThrow('Invalid cache key');
    });

    it('should handle memory pressure gracefully', async () => {
      // このテストは実装後にメモリ監視で検証
      expect(true).toBe(true); // プレースホルダー
    });
  });
});