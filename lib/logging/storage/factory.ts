/**
 * Unified Storage Factory
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
 */

import type { IUnifiedStorage, UnifiedLoggerConfig } from '../unified-logger';

export async function createUnifiedStorage(config: UnifiedLoggerConfig): Promise<IUnifiedStorage> {
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
      try {
        const { UnifiedSQLiteStorage } = await import('./sqlite');
        // Immediately attempt initialization to catch native binding errors
        const sqliteStorage = new UnifiedSQLiteStorage(config);
        try {
          await sqliteStorage.init();
          return sqliteStorage;
        } catch (initError) {
          console.error('[UnifiedStorage] SQLite init failed, falling back to memory:', initError);
        }
      } catch (importError) {
        console.error('[UnifiedStorage] SQLite module load failed, falling back to memory:', importError);
      }
      const { UnifiedMemoryStorage: MemoryFallback } = await import('./memory');
      return new MemoryFallback(config);
      
    case 'postgres':
      // TODO: PostgreSQL implementation
      console.warn('[UnifiedStorage] PostgreSQL not implemented yet, falling back to memory');
      const { UnifiedMemoryStorage: FallbackMemory } = await import('./memory');
      return new FallbackMemory(config);
      
    default:
      // Default based on environment
      if (process.env.NODE_ENV === 'test') {
        const { UnifiedMemoryStorage: TestMemory } = await import('./memory');
        return new TestMemory(config);
      } else {
        // Production uses SQLite by default
        const { UnifiedSQLiteStorage: ProdSQLite } = await import('./sqlite');
        return new ProdSQLite(config);
      }
  }
}