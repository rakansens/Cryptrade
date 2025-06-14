/**
 * Migration Guide and Utilities
 * 
 * Helps migrate from existing logging implementations to unified logger
 */

import type { LogLevel, UnifiedLoggerConfig } from './unified-logger';
import type { UnifiedLogEntry, LogFilter } from '@/types/logging.types';

// Type definitions for legacy configurations
interface LegacyLoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableThrottling?: boolean;
  throttleInterval?: number;
  source?: string;
  minLevel?: LogLevel;
  bufferSize?: number;
  flushInterval?: number;
  storage?: string;
  retention?: Record<LogLevel, number>;
  enableMetrics?: boolean;
  enableStackTrace?: boolean;
  onError?: (error: Error) => void;
  beforeLog?: (entry: UnifiedLogEntry) => UnifiedLogEntry | null;
}

interface LegacyLogEntry {
  id?: string;
  timestamp?: Date | string | number;
  level: LogLevel;
  message: string;
  environment?: string;
  source?: string;
  meta?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: Error | unknown;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  stack?: string;
  duration?: number;
  tags?: string[];
}

/**
 * Migration map for import statements
 */
export const MIGRATION_MAP = {
  // From lib/utils/logger.ts
  'lib/utils/logger': 'lib/logging',
  '@/lib/utils/logger': '@/lib/logging',
  
  // From lib/utils/logger-enhanced.ts
  'lib/utils/logger-enhanced': 'lib/logging',
  '@/lib/utils/logger-enhanced': '@/lib/logging',
  
  // From lib/logs/enhanced-logger.ts
  'lib/logs/enhanced-logger': 'lib/logging',
  '@/lib/logs/enhanced-logger': '@/lib/logging',
};

/**
 * Type migration guide
 */
export const TYPE_MIGRATIONS = {
  // Original logger types
  'LogLevel': 'LogLevel', // Same
  'LoggerConfig': 'UnifiedLoggerConfig',
  'ILogger': 'UnifiedLogger',
  'ILogTransport': 'IUnifiedTransport',
  'LogEntry': 'UnifiedLogEntry',
  
  // Enhanced logger types
  'LogFilter': 'LogFilter', // Same
  'PaginationOptions': 'PaginationOptions', // Same
  'LogQueryResult': 'LogQueryResult', // Same
  'LogStats': 'LogStats', // Same
  'LogSubscription': 'LogSubscription', // Same
  'ILogStorage': 'IUnifiedStorage',
};

/**
 * Function migration guide
 */
export const FUNCTION_MIGRATIONS = {
  // Original logger
  'createLogger': 'createUnifiedLogger',
  'logger': 'logger', // Backward compatible
  
  // Enhanced logger
  'enhancedLogger': 'enhancedLogger', // Backward compatible
  'EnhancedLogger': 'UnifiedLogger',
  
  // Helper functions (same names, improved implementations)
  'createAgentLogger': 'createAgentLogger',
  'createToolLogger': 'createToolLogger',
  'logPerformance': 'logPerformance',
  'createSessionLogger': 'createSessionLogger',
};

/**
 * Configuration migration utility
 */
export function migrateLoggerConfig(oldConfig: LegacyLoggerConfig): Partial<UnifiedLoggerConfig> {
  const newConfig: Partial<UnifiedLoggerConfig> = {};
  
  // Original logger config
  if (oldConfig.level !== undefined) newConfig.level = oldConfig.level;
  if (oldConfig.enableConsole !== undefined) newConfig.enableConsole = oldConfig.enableConsole;
  if (oldConfig.enableThrottling !== undefined) newConfig.enableThrottling = oldConfig.enableThrottling;
  if (oldConfig.throttleInterval !== undefined) newConfig.throttleInterval = oldConfig.throttleInterval;
  
  // Enhanced logger config
  if (oldConfig.source !== undefined) newConfig.source = oldConfig.source;
  if (oldConfig.minLevel !== undefined) newConfig.level = oldConfig.minLevel;
  if (oldConfig.bufferSize !== undefined) newConfig.bufferSize = oldConfig.bufferSize;
  if (oldConfig.flushInterval !== undefined) newConfig.flushInterval = oldConfig.flushInterval;
  if (oldConfig.storage !== undefined) newConfig.storage = oldConfig.storage as 'memory' | 'sqlite' | 'postgres';
  if (oldConfig.retention !== undefined) newConfig.retention = oldConfig.retention;
  if (oldConfig.enableMetrics !== undefined) newConfig.enableMetrics = oldConfig.enableMetrics;
  if (oldConfig.enableStackTrace !== undefined) newConfig.enableStackTrace = oldConfig.enableStackTrace;
  if (oldConfig.onError !== undefined) newConfig.onError = oldConfig.onError;
  if (oldConfig.beforeLog !== undefined) newConfig.beforeLog = oldConfig.beforeLog;
  
  // Set defaults for new unified config
  if (newConfig.source === undefined) newConfig.source = 'cryptrade';
  if (newConfig.enableStorage === undefined) newConfig.enableStorage = true;
  if (newConfig.format === undefined) newConfig.format = 'json';
  
  return newConfig;
}

/**
 * Log entry migration utility
 */
export function migrateLogEntry(oldEntry: LegacyLogEntry): UnifiedLogEntry {
  const timestamp = oldEntry.timestamp instanceof Date 
    ? oldEntry.timestamp 
    : typeof oldEntry.timestamp === 'string' || typeof oldEntry.timestamp === 'number'
    ? new Date(oldEntry.timestamp)
    : new Date();

  const newEntry: UnifiedLogEntry = {
    id: oldEntry.id || `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    level: oldEntry.level,
    message: oldEntry.message,
    environment: oldEntry.environment || process.env.NODE_ENV || 'development',
    source: oldEntry.source || 'cryptrade',
    meta: oldEntry.meta || oldEntry.metadata || {},
  };
  
  // Handle error variations
  if (oldEntry.error) {
    newEntry.error = oldEntry.error instanceof Error ? oldEntry.error : new Error(String(oldEntry.error));
  }
  
  // Enhanced properties
  if (oldEntry.correlationId) newEntry.correlationId = oldEntry.correlationId;
  if (oldEntry.userId) newEntry.userId = oldEntry.userId;
  if (oldEntry.sessionId) newEntry.sessionId = oldEntry.sessionId;
  if (oldEntry.agentName) newEntry.agentName = oldEntry.agentName;
  if (oldEntry.toolName) newEntry.toolName = oldEntry.toolName;
  if (oldEntry.stack) newEntry.stack = oldEntry.stack;
  if (oldEntry.duration) newEntry.duration = oldEntry.duration;
  if (oldEntry.tags) newEntry.tags = oldEntry.tags;
  
  return newEntry;
}

/**
 * Filter migration utility
 */
export function migrateLogFilter(oldFilter: LogFilter): LogFilter {
  // Most filter properties are compatible, just ensure consistent naming
  const newFilter: LogFilter = { ...oldFilter };
  
  // Handle any naming differences
  if (oldFilter.timeRange) {
    newFilter.timeRange = {
      from: oldFilter.timeRange.from,
      to: oldFilter.timeRange.to,
    };
  }
  
  return newFilter;
}

/**
 * Generate migration checklist
 */
export function generateMigrationChecklist(filePath: string): string[] {
  const checklist: string[] = [];
  
  checklist.push(`Migration checklist for ${filePath}:`);
  checklist.push('');
  checklist.push('□ Update import statements:');
  
  for (const [oldImport, newImport] of Object.entries(MIGRATION_MAP)) {
    checklist.push(`  - Change "${oldImport}" to "${newImport}"`);
  }
  
  checklist.push('');
  checklist.push('□ Update type references:');
  
  for (const [oldType, newType] of Object.entries(TYPE_MIGRATIONS)) {
    if (oldType !== newType) {
      checklist.push(`  - Change "${oldType}" to "${newType}"`);
    }
  }
  
  checklist.push('');
  checklist.push('□ Update function calls:');
  
  for (const [oldFunc, newFunc] of Object.entries(FUNCTION_MIGRATIONS)) {
    if (oldFunc !== newFunc) {
      checklist.push(`  - Change "${oldFunc}" to "${newFunc}"`);
    }
  }
  
  checklist.push('');
  checklist.push('□ Test functionality:');
  checklist.push('  - Verify all log levels work correctly');
  checklist.push('  - Test context management');
  checklist.push('  - Verify storage functionality');
  checklist.push('  - Check query and subscription features');
  checklist.push('  - Validate performance logging');
  
  checklist.push('');
  checklist.push('□ Configuration updates:');
  checklist.push('  - Review logger configuration');
  checklist.push('  - Update environment variables if needed');
  checklist.push('  - Verify transport settings');
  checklist.push('  - Check retention policies');
  
  return checklist;
}

/**
 * Migration example for existing code
 */
export const MIGRATION_EXAMPLES = {
  beforeLogger: `
// Before (lib/utils/logger.ts)
import { logger } from '@/lib/utils/logger';

logger.info('User logged in', { userId: '123' });
logger.error('Database error', { error: err });
  `,
  
  afterLogger: `
// After (unified logger)
import { logger } from '@/lib/logging';

logger.info('User logged in', { userId: '123' });
logger.error('Database error', { error: err });
  `,
  
  beforeEnhanced: `
// Before (lib/utils/logger-enhanced.ts)
import { logger, createAgentLogger } from '@/lib/utils/logger-enhanced';

const agentLogger = createAgentLogger('trading');
agentLogger.info('Analysis complete', { result });

await logger.withContext({ sessionId }, async () => {
  logger.info('Processing request');
});
  `,
  
  afterEnhanced: `
// After (unified logger)
import { logger, createAgentLogger } from '@/lib/logging';

const agentLogger = createAgentLogger('trading');
agentLogger.info('Analysis complete', { result });

await logger.withContext({ sessionId }, async () => {
  logger.info('Processing request');
});
  `,
  
  beforeFullEnhanced: `
// Before (lib/logs/enhanced-logger.ts)
import { enhancedLogger } from '@/lib/logs/enhanced-logger';

await enhancedLogger.init();
enhancedLogger.info('System started');

const logs = await enhancedLogger.query({
  level: 'error',
  timeRange: { from: yesterday, to: now }
});
  `,
  
  afterFullEnhanced: `
// After (unified logger)
import { enhancedLogger } from '@/lib/logging';

await enhancedLogger.init();
enhancedLogger.info('System started');

const logs = await enhancedLogger.query({
  level: 'error',
  timeRange: { from: yesterday, to: now }
});
  `,
};

/**
 * Validation helper to check if migration is complete
 */
export function validateMigration(): {
  success: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if old logger files still exist
  try {
    require.resolve('@/lib/utils/logger');
    warnings.push('Old logger file still exists: lib/utils/logger.ts');
  } catch {
    // Good, file doesn't exist or isn't being used
  }
  
  try {
    require.resolve('@/lib/utils/logger-enhanced');
    warnings.push('Old enhanced logger wrapper still exists: lib/utils/logger-enhanced.ts');
  } catch {
    // Good, file doesn't exist or isn't being used
  }
  
  try {
    require.resolve('@/lib/logs/enhanced-logger');
    warnings.push('Old enhanced logger still exists: lib/logs/enhanced-logger.ts');
  } catch {
    // Good, file doesn't exist or isn't being used
  }
  
  // Check if unified logger works
  try {
    const { logger } = require('@/lib/logging');
    if (!logger || typeof logger.info !== 'function') {
      errors.push('Unified logger not properly exported or missing methods');
    }
  } catch (error) {
    errors.push(`Failed to import unified logger: ${error}`);
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}