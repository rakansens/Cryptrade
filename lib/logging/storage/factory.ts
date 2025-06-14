/**
 * Unified Storage Factory
 * 
 * Creates appropriate storage implementation based on configuration
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
      const { UnifiedSQLiteStorage } = await import('./sqlite');
      return new UnifiedSQLiteStorage(config);
      
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