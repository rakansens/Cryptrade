/**
 * API Cache Utility
 * 
 * APIレスポンスのキャッシュとフォールバック機能を提供
 * - メモリキャッシュ
 * - LocalStorageキャッシュ（ブラウザ環境）
 * - TTL（Time To Live）サポート
 * - エラー時のフォールバック
 */

import { logger } from '@/lib/utils/logger';

export interface CacheOptions {
  ttl?: number; // ミリ秒単位のTTL（デフォルト: 5分）
  useLocalStorage?: boolean; // LocalStorageを使用するか
  maxMemoryItems?: number; // メモリキャッシュの最大アイテム数
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  key: string;
}

export class ApiCache {
  private static instance: ApiCache;
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5分
  private readonly maxMemoryItems = 100;
  private readonly localStoragePrefix = 'api_cache_';

  private constructor() {
    // Singleton
  }

  static getInstance(): ApiCache {
    if (!ApiCache.instance) {
      ApiCache.instance = new ApiCache();
    }
    return ApiCache.instance;
  }

  /**
   * キャッシュからデータを取得
   */
  get<T>(key: string, options?: CacheOptions): T | null {
    const ttl = options?.ttl ?? this.defaultTTL;
    
    // メモリキャッシュから取得
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && this.isValid(memoryItem, ttl)) {
      logger.debug('[ApiCache] Cache hit (memory)', { key });
      return memoryItem.data as T;
    }

    // LocalStorageから取得（ブラウザ環境のみ）
    if (options?.useLocalStorage && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.localStoragePrefix + key);
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored);
          if (this.isValid(item, ttl)) {
            logger.debug('[ApiCache] Cache hit (localStorage)', { key });
            // メモリキャッシュにも保存
            this.setMemoryCache(key, item);
            return item.data;
          }
        }
      } catch (error) {
        logger.error('[ApiCache] Failed to read from localStorage', { error, key });
      }
    }

    logger.debug('[ApiCache] Cache miss', { key });
    return null;
  }

  /**
   * キャッシュにデータを保存
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      key
    };

    // メモリキャッシュに保存
    this.setMemoryCache(key, item);

    // LocalStorageに保存（ブラウザ環境のみ）
    if (options?.useLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.localStoragePrefix + key, JSON.stringify(item));
        logger.debug('[ApiCache] Saved to localStorage', { key });
      } catch (error) {
        logger.error('[ApiCache] Failed to save to localStorage', { error, key });
        // LocalStorageが満杯の場合、古いアイテムを削除
        this.cleanupLocalStorage();
      }
    }
  }

  /**
   * キャッシュから削除
   */
  delete(key: string, options?: CacheOptions): void {
    this.memoryCache.delete(key);
    
    if (options?.useLocalStorage && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.localStoragePrefix + key);
      } catch (error) {
        logger.error('[ApiCache] Failed to delete from localStorage', { error, key });
      }
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  clear(): void {
    this.memoryCache.clear();
    
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(this.localStoragePrefix)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        logger.error('[ApiCache] Failed to clear localStorage', { error });
      }
    }
  }

  /**
   * キャッシュキーを生成
   */
  static createKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('_');
    return `${prefix}_${sortedParams}`;
  }

  private isValid<T>(item: CacheItem<T>, ttl: number): boolean {
    return Date.now() - item.timestamp < ttl;
  }

  private setMemoryCache<T>(key: string, item: CacheItem<T>): void {
    // メモリキャッシュのサイズ制限
    if (this.memoryCache.size >= this.maxMemoryItems) {
      // 最も古いアイテムを削除
      const oldestKey = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(key, item);
  }

  private cleanupLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const items: Array<{ key: string; timestamp: number }> = [];
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(this.localStoragePrefix)) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item.timestamp) {
              items.push({ key, timestamp: item.timestamp });
            }
          } catch {
            // 無効なアイテムは削除
            localStorage.removeItem(key);
          }
        }
      });

      // 古い順にソートして半分を削除
      items.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = Math.floor(items.length / 2);
      items.slice(0, toDelete).forEach(item => {
        localStorage.removeItem(item.key);
      });

      logger.info('[ApiCache] Cleaned up localStorage', { removed: toDelete });
    } catch (error) {
      logger.error('[ApiCache] Failed to cleanup localStorage', { error });
    }
  }
}

// Export singleton instance
export const apiCache = ApiCache.getInstance();