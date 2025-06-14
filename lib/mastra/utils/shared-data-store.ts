import { logger } from '@/lib/utils/logger';

/**
 * Shared Data Store
 * 
 * エージェントとツール間でデータを共有するためのストア
 * - インメモリキャッシュ
 * - TTL（有効期限）サポート
 * - 名前空間によるデータ分離
 * - 型安全なアクセス
 */

interface StoredData<T = unknown> {
  value: T;
  timestamp: number;
  ttl?: number; // milliseconds
  metadata?: Record<string, unknown>;
}

export class SharedDataStore {
  private static instance: SharedDataStore;
  private store: Map<string, Map<string, StoredData>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start cleanup interval (every 30 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  static getInstance(): SharedDataStore {
    if (!SharedDataStore.instance) {
      SharedDataStore.instance = new SharedDataStore();
    }
    return SharedDataStore.instance;
  }

  /**
   * データを保存
   */
  static set<T = unknown>(
    namespace: string,
    key: string,
    value: T,
    options?: {
      ttl?: number;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const instance = SharedDataStore.getInstance();
    
    if (!instance.store.has(namespace)) {
      instance.store.set(namespace, new Map());
    }
    
    const namespaceStore = instance.store.get(namespace)!;
    namespaceStore.set(key, {
      value,
      timestamp: Date.now(),
      ttl: options?.ttl,
      metadata: options?.metadata,
    });
    
    logger.debug('[SharedDataStore] Data stored', {
      namespace,
      key,
      ttl: options?.ttl,
      hasMetadata: !!options?.metadata,
    });
  }

  /**
   * データを取得
   */
  static get<T = unknown>(namespace: string, key: string): T | null {
    const instance = SharedDataStore.getInstance();
    const namespaceStore = instance.store.get(namespace);
    
    if (!namespaceStore) {
      return null;
    }
    
    const data = namespaceStore.get(key);
    if (!data) {
      return null;
    }
    
    // Check TTL
    if (data.ttl && Date.now() - data.timestamp > data.ttl) {
      namespaceStore.delete(key);
      logger.debug('[SharedDataStore] Data expired', { namespace, key });
      return null;
    }
    
    return data.value as T;
  }

  /**
   * データが存在するかチェック
   */
  static has(namespace: string, key: string): boolean {
    const instance = SharedDataStore.getInstance();
    const namespaceStore = instance.store.get(namespace);
    
    if (!namespaceStore) {
      return false;
    }
    
    const data = namespaceStore.get(key);
    if (!data) {
      return false;
    }
    
    // Check TTL
    if (data.ttl && Date.now() - data.timestamp > data.ttl) {
      namespaceStore.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * データを削除
   */
  static delete(namespace: string, key: string): boolean {
    const instance = SharedDataStore.getInstance();
    const namespaceStore = instance.store.get(namespace);
    
    if (!namespaceStore) {
      return false;
    }
    
    return namespaceStore.delete(key);
  }

  /**
   * 名前空間のすべてのデータをクリア
   */
  static clearNamespace(namespace: string): void {
    const instance = SharedDataStore.getInstance();
    instance.store.delete(namespace);
    
    logger.info('[SharedDataStore] Namespace cleared', { namespace });
  }

  /**
   * すべてのデータをクリア
   */
  static clearAll(): void {
    const instance = SharedDataStore.getInstance();
    instance.store.clear();
    
    logger.info('[SharedDataStore] All data cleared');
  }

  /**
   * 名前空間のすべてのキーを取得
   */
  static getKeys(namespace: string): string[] {
    const instance = SharedDataStore.getInstance();
    const namespaceStore = instance.store.get(namespace);
    
    if (!namespaceStore) {
      return [];
    }
    
    return Array.from(namespaceStore.keys());
  }

  /**
   * 名前空間のすべてのデータを取得
   */
  static getAll<T = unknown>(namespace: string): Record<string, T> {
    const instance = SharedDataStore.getInstance();
    const namespaceStore = instance.store.get(namespace);
    
    if (!namespaceStore) {
      return {};
    }
    
    const result: Record<string, T> = {};
    namespaceStore.forEach((data, key) => {
      // Check TTL
      if (!data.ttl || Date.now() - data.timestamp <= data.ttl) {
        result[key] = data.value as T;
      }
    });
    
    return result;
  }

  /**
   * 統計情報を取得
   */
  static getStats(): {
    namespaces: number;
    totalKeys: number;
    namespaceDetails: Record<string, number>;
  } {
    const instance = SharedDataStore.getInstance();
    const namespaceDetails: Record<string, number> = {};
    let totalKeys = 0;
    
    instance.store.forEach((namespaceStore, namespace) => {
      const size = namespaceStore.size;
      namespaceDetails[namespace] = size;
      totalKeys += size;
    });
    
    return {
      namespaces: instance.store.size,
      totalKeys,
      namespaceDetails,
    };
  }

  /**
   * 期限切れデータのクリーンアップ
   */
  private cleanup(): void {
    let cleanedCount = 0;
    
    this.store.forEach((namespaceStore, namespace) => {
      const keysToDelete: string[] = [];
      
      namespaceStore.forEach((data, key) => {
        if (data.ttl && Date.now() - data.timestamp > data.ttl) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        namespaceStore.delete(key);
        cleanedCount++;
      });
      
      // Remove empty namespaces
      if (namespaceStore.size === 0) {
        this.store.delete(namespace);
      }
    });
    
    if (cleanedCount > 0) {
      logger.debug('[SharedDataStore] Cleanup completed', { cleanedCount });
    }
  }

  /**
   * インスタンスを破棄（テスト用）
   */
  static destroy(): void {
    const instance = SharedDataStore.instance;
    if (instance) {
      if (instance.cleanupInterval) {
        clearInterval(instance.cleanupInterval);
        instance.cleanupInterval = null;
      }
      instance.store.clear();
      SharedDataStore.instance = null!;
    }
  }
}

// Convenience functions
export const sharedData = {
  set: SharedDataStore.set,
  get: SharedDataStore.get,
  has: SharedDataStore.has,
  delete: SharedDataStore.delete,
  clearNamespace: SharedDataStore.clearNamespace,
  clearAll: SharedDataStore.clearAll,
  getKeys: SharedDataStore.getKeys,
  getAll: SharedDataStore.getAll,
  getStats: SharedDataStore.getStats,
};