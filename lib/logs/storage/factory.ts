/**
 * Storage Factory
 * 
 * Creates appropriate storage based on environment
 */

// ⚠️ DEPRECATED: このファイルは lib/logging/storage/factory.ts へ移行しました

import type { ILogStorage, LoggerConfig } from '../types';
// 新しいファクトリを利用
import { createUnifiedStorage } from '@/lib/logging/storage/factory';
import type { UnifiedLoggerConfig } from '@/lib/logging/unified-logger';

/**
 * Wrapper that delegates to createUnifiedStorage for backward compatibility.
 */
export async function createLogStorage(config: LoggerConfig): Promise<ILogStorage> {
  // LoggerConfigからUnifiedLoggerConfigへのマッピング
  const unifiedConfig: UnifiedLoggerConfig = {
    source: config.source,
    minLevel: config.minLevel,
    bufferSize: config.bufferSize,
    flushInterval: config.flushInterval,
    storage: config.storage,
    connectionString: config.connectionString,
    retention: config.retention,
    enableMetrics: config.enableMetrics,
    enableStackTrace: config.enableStackTrace,
    format: config.format,
    onError: config.onError,
    beforeLog: config.beforeLog
  };
  
  // createUnifiedStorageに委譲し、ILogStorageとして返す
  return await createUnifiedStorage(unifiedConfig) as ILogStorage;
}