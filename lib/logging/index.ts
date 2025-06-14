/**
 * Unified Logging System
 * 
 * Main export file providing backward compatibility with all existing logger implementations
 */

// Core unified logger
export {
  UnifiedLogger,
  createUnifiedLogger,
  unifiedLogger,
  type LogLevel,
  type UnifiedLogEntry,
  type UnifiedLoggerConfig,
  type IUnifiedTransport,
  type IUnifiedStorage,
  type LogFilter,
  type PaginationOptions,
  type LogQueryResult,
  type LogStats,
  type LogSubscription,
} from './unified-logger';

// Helper functions
export {
  createAgentLogger,
  createToolLogger,
  logPerformance,
  createSessionLogger,
  createCorrelationLogger,
  createStructuredLogger,
  logErrorChain,
  conditionalLog,
  BatchLogger,
  RateLimitedLogger,
} from './helpers';

// Transports
export { ConsoleTransport } from './transports/console';
export { SentryTransport } from './transports/sentry';
export { NoopTransport } from './transports/noop';

// Storage
export { createUnifiedStorage } from './storage/factory';
export { UnifiedMemoryStorage } from './storage/memory';
export { UnifiedSQLiteStorage } from './storage/sqlite';

// Type definitions for logging
export interface LogEntry extends UnifiedLogEntry {}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  [key: string]: unknown;
}

export type LogCallback = (log: UnifiedLogEntry) => void;

export interface LoggerMethods {
  debug: (message: string, meta?: LogContext) => void;
  info: (message: string, meta?: LogContext, error?: Error) => void;
  warn: (message: string, meta?: LogContext, error?: Error) => void;
  error: (message: string, meta?: LogContext, error?: Error) => void;
  critical: (message: string, meta?: LogContext, error?: Error) => void;
}

// Backward compatibility exports
import { unifiedLogger, type LogLevel, type UnifiedLogEntry, type LogFilter, type PaginationOptions } from './unified-logger';

/**
 * Default logger instance (backward compatibility)
 * 
 * This maintains compatibility with:
 * - lib/utils/logger.ts
 * - lib/utils/logger-enhanced.ts  
 * - lib/logs/enhanced-logger.ts
 */
export const logger = {
  // Core logging methods (compatible with all existing loggers)
  debug: (message: string, meta?: LogContext) => unifiedLogger.debug(message, meta),
  info: (message: string, meta?: LogContext, error?: Error) => unifiedLogger.info(message, meta, error),
  warn: (message: string, meta?: LogContext, error?: Error) => unifiedLogger.warn(message, meta, error),
  error: (message: string, meta?: LogContext, error?: Error) => unifiedLogger.error(message, meta, error),
  
  // Enhanced logging methods
  critical: (message: string, meta?: LogContext, error?: Error) => unifiedLogger.critical(message, meta, error),
  
  // Timer methods (from original logger)
  time: (label: string) => unifiedLogger.time(label),
  timeEnd: (label: string) => unifiedLogger.timeEnd(label),
  
  // Utility methods (from original logger)
  willLog: (level: LogLevel) => unifiedLogger.willLog(level),
  setLevel: (level: LogLevel) => unifiedLogger.setLevel(level),
  getLevel: () => unifiedLogger.getLevel(),
  clearThrottle: () => unifiedLogger.clearThrottle(),
  
  // Context management (from enhanced loggers)
  pushContext: (context: LogContext) => unifiedLogger.pushContext(context),
  popContext: () => unifiedLogger.popContext(),
  withContext: async <T>(context: LogContext, fn: () => Promise<T>): Promise<T> => 
    unifiedLogger.withContext(context, fn),
  
  // Query methods (from enhanced loggers)
  query: (filter: LogFilter, pagination?: PaginationOptions) => unifiedLogger.query(filter, pagination),
  getStats: (filter?: LogFilter) => unifiedLogger.getStats(filter),
  subscribe: (filter: LogFilter, callback: LogCallback) => unifiedLogger.subscribe(filter, callback),
  
  // Maintenance methods
  cleanup: () => unifiedLogger.cleanup(),
  close: () => unifiedLogger.close(),
  
  // Access to underlying unified logger
  unified: unifiedLogger,
};

/**
 * Enhanced logger (backward compatibility with lib/logs/enhanced-logger.ts)
 */
export const enhancedLogger = {
  debug: (message: string, metadata?: LogContext) => unifiedLogger.debug(message, metadata),
  info: (message: string, metadata?: LogContext) => unifiedLogger.info(message, metadata),
  warn: (message: string, metadata?: LogContext) => unifiedLogger.warn(message, metadata),
  error: (message: string, metadata?: LogContext) => unifiedLogger.error(message, metadata),
  critical: (message: string, metadata?: LogContext) => unifiedLogger.critical(message, metadata),
  
  // Context management
  pushContext: (context: LogContext) => unifiedLogger.pushContext(context),
  popContext: () => unifiedLogger.popContext(),
  withContext: async <T>(context: LogContext, fn: () => Promise<T>): Promise<T> => 
    unifiedLogger.withContext(context, fn),
  
  // Query and subscription
  query: (filter: LogFilter, pagination?: PaginationOptions) => unifiedLogger.query(filter, pagination),
  getStats: (filter?: LogFilter) => unifiedLogger.getStats(filter),
  subscribe: (filter: LogFilter, callback: LogCallback) => unifiedLogger.subscribe(filter, callback),
  
  // Maintenance
  init: () => unifiedLogger.init(),
  close: () => unifiedLogger.close(),
  cleanup: () => unifiedLogger.cleanup(),
};

// Default export for convenience
export default {
  logger,
  enhancedLogger,
  unifiedLogger,
};