/**
 * Updated: Unified Storage Factory - 環境変数の型安全なアクセスを実装
 * 
 * Creates appropriate storage implementation based on configuration.
 *
 * CHANGELOG (2025-06-14):
 * - Added robust fallback logic for the `sqlite` storage type.
 *   The factory now attempts to import and initialise SQLite storage
 *   immediately. On failure (missing native bindings, etc.), it logs the
 *   error and falls back to in-memory storage to keep the application
 *   running in environments where `better-sqlite3` binaries are
 *   unavailable (e.g., Node.js v23+).
 * - Introduced `sqliteUnavailable` flag and mutated logger config to
 *   prevent再試行 and spammy error logs on subsequent storage creations.
 */

import type { IUnifiedStorage } from '../unified-logger';
import { isTest } from '@/config/env';
import { logger } from '@/lib/utils/logger';

// Storage configuration type
export interface StorageConfig {
  storage?: 'memory' | 'sqlite' | 'postgres';
  connectionUrl?: string;
  tableName?: string;
  [key: string]: any;
}

// Track whether SQLite storage is unavailable to avoid repeated costly attempts
let sqliteUnavailable = false;

export async function createUnifiedStorage(config: StorageConfig): Promise<IUnifiedStorage> {
  // Browser environment always uses memory storage
  if (typeof window !== 'undefined') {
    const { UnifiedMemoryStorage } = await import('./memory');
    return new UnifiedMemoryStorage(config);
  }

  // Server-side storage selection
  switch (config.storage) {
    case 'memory':
      const { UnifiedMemoryStorage } = await import('./memory');
      return new UnifiedMemoryStorage(config);
      
    case 'sqlite':
      if (sqliteUnavailable) {
        const { UnifiedMemoryStorage: FallbackCached } = await import('./memory');
        return new FallbackCached(config);
      }
      try {
        const { UnifiedSQLiteStorage } = await import('./sqlite');
        // Immediately attempt initialization to catch native binding errors
        const sqliteStorage = new UnifiedSQLiteStorage(config);
        try {
          await sqliteStorage.init();
          return sqliteStorage;
        } catch (initError) {
          logger.error('[UnifiedStorage] SQLite init failed, falling back to memory', { error: initError });
          sqliteUnavailable = true;
        }
      } catch (importError) {
        logger.error('[UnifiedStorage] SQLite module load failed, falling back to memory', { error: importError });
        sqliteUnavailable = true;
      }
      // Mutate config so subsequent calls default to memory storage
      config.storage = 'memory';
      const { UnifiedMemoryStorage: MemoryFallback } = await import('./memory');
      return new MemoryFallback(config);
      
    case 'postgres':
      try {
        const { UnifiedPostgreSQLStorage } = await import('./postgres');
        return new UnifiedPostgreSQLStorage({
          ...(config.connectionUrl && { connectionUrl: config.connectionUrl }),
          ...(config.tableName && { tableName: config.tableName })
        });
      } catch (error) {
        // If PostgreSQL module fails to load, fall back to memory storage
        logger.warn('[UnifiedStorage] PostgreSQL storage failed to initialize, using memory storage as fallback', { error });
        const { UnifiedMemoryStorage: FallbackMemory } = await import('./memory');
        return new FallbackMemory(config);
      }
      
    default:
      // Default based on environment
      if (isTest()) {
        const { UnifiedMemoryStorage: TestMemory } = await import('./memory');
        return new TestMemory(config);
      } else {
        // Production uses SQLite by default
        const { UnifiedSQLiteStorage: ProdSQLite } = await import('./sqlite');
        return new ProdSQLite(config);
      }
  }
}