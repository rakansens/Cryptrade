/**
 * Unified Logger Helper Functions
 * 
 * Provides backward compatibility and convenience functions
 */

import { unifiedLogger, UnifiedLogger, type LogLevel, type UnifiedLoggerConfig } from './unified-logger';
import type { LogMetadata, AgentLogMetadata, ToolLogMetadata } from '@/types/logging.types';

/**
 * Agent-specific logger helper
 */
export function createAgentLogger(agentName: string, logger?: UnifiedLogger) {
  const targetLogger = logger || unifiedLogger;
  
  return {
    debug: (message: string, meta?: Partial<AgentLogMetadata>) => {
      targetLogger.debug(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    info: (message: string, meta?: Partial<AgentLogMetadata>) => {
      targetLogger.info(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    warn: (message: string, meta?: Partial<AgentLogMetadata>) => {
      targetLogger.warn(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    error: (message: string, meta?: Partial<AgentLogMetadata>) => {
      targetLogger.error(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    critical: (message: string, meta?: Partial<AgentLogMetadata>) => {
      targetLogger.critical(`[${agentName}] ${message}`, { ...meta, agentName });
    },
  };
}

/**
 * Tool-specific logger helper
 */
export function createToolLogger(toolName: string, logger?: UnifiedLogger) {
  const targetLogger = logger || unifiedLogger;
  
  return {
    debug: (message: string, meta?: Partial<ToolLogMetadata>) => {
      targetLogger.debug(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    info: (message: string, meta?: Partial<ToolLogMetadata>) => {
      targetLogger.info(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    warn: (message: string, meta?: Partial<ToolLogMetadata>) => {
      targetLogger.warn(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    error: (message: string, meta?: Partial<ToolLogMetadata>) => {
      targetLogger.error(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    critical: (message: string, meta?: Partial<ToolLogMetadata>) => {
      targetLogger.critical(`[${toolName}] ${message}`, { ...meta, toolName });
    },
  };
}

/**
 * Performance logging helper
 */
export async function logPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  logger?: UnifiedLogger
): Promise<T> {
  const targetLogger = logger || unifiedLogger;
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    targetLogger.info(`${operation} completed`, {
      operation,
      duration,
      success: true,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    targetLogger.error(`${operation} failed`, {
      operation,
      duration,
      success: false,
      error: String(error),
    });
    
    throw error;
  }
}

/**
 * Session logging helper
 */
export function createSessionLogger(sessionId: string, userId?: string, logger?: UnifiedLogger) {
  const targetLogger = logger || unifiedLogger;
  
  targetLogger.pushContext({ sessionId, userId });
  
  return {
    end: () => {
      targetLogger.popContext();
    },
  };
}

/**
 * Correlation logging helper
 */
export function createCorrelationLogger(correlationId: string, logger?: UnifiedLogger) {
  const targetLogger = logger || unifiedLogger;
  
  targetLogger.pushContext({ correlationId });
  
  return {
    debug: (message: string, meta?: LogMetadata) => {
      targetLogger.debug(message, meta);
    },
    info: (message: string, meta?: LogMetadata) => {
      targetLogger.info(message, meta);
    },
    warn: (message: string, meta?: LogMetadata) => {
      targetLogger.warn(message, meta);
    },
    error: (message: string, meta?: LogMetadata) => {
      targetLogger.error(message, meta);
    },
    critical: (message: string, meta?: LogMetadata) => {
      targetLogger.critical(message, meta);
    },
    end: () => {
      targetLogger.popContext();
    },
  };
}

/**
 * Batch logging operations
 */
export class BatchLogger {
  private logger: UnifiedLogger;
  private entries: Array<{ level: LogLevel; message: string; meta?: LogMetadata }> = [];
  private context: LogMetadata = {};

  constructor(logger?: UnifiedLogger) {
    this.logger = logger || unifiedLogger;
  }

  addContext(context: Record<string, unknown>): this {
    Object.assign(this.context, context);
    return this;
  }

  debug(message: string, meta?: LogMetadata): this {
    this.entries.push({ level: 'debug', message, meta: { ...this.context, ...meta } });
    return this;
  }

  info(message: string, meta?: LogMetadata): this {
    this.entries.push({ level: 'info', message, meta: { ...this.context, ...meta } });
    return this;
  }

  warn(message: string, meta?: LogMetadata): this {
    this.entries.push({ level: 'warn', message, meta: { ...this.context, ...meta } });
    return this;
  }

  error(message: string, meta?: LogMetadata): this {
    this.entries.push({ level: 'error', message, meta: { ...this.context, ...meta } });
    return this;
  }

  critical(message: string, meta?: LogMetadata): this {
    this.entries.push({ level: 'critical', message, meta: { ...this.context, ...meta } });
    return this;
  }

  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    this.logger.pushContext(this.context);
    
    try {
      for (const entry of this.entries) {
        this.logger[entry.level](entry.message, entry.meta);
      }
    } finally {
      this.logger.popContext();
      this.entries = [];
    }
  }

  clear(): this {
    this.entries = [];
    this.context = {};
    return this;
  }

  getEntryCount(): number {
    return this.entries.length;
  }
}

/**
 * Structured logging helper
 */
export function createStructuredLogger(baseContext: Record<string, unknown>, logger?: UnifiedLogger) {
  const targetLogger = logger || unifiedLogger;
  
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      targetLogger.debug(message, { ...baseContext, ...data });
    },
    info: (message: string, data?: Record<string, unknown>) => {
      targetLogger.info(message, { ...baseContext, ...data });
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      targetLogger.warn(message, { ...baseContext, ...data });
    },
    error: (message: string, error?: Error, data?: Record<string, unknown>) => {
      targetLogger.error(message, { ...baseContext, ...data }, error);
    },
    critical: (message: string, error?: Error, data?: Record<string, unknown>) => {
      targetLogger.critical(message, { ...baseContext, ...data }, error);
    },
    withData: (additionalData: Record<string, unknown>) => {
      return createStructuredLogger({ ...baseContext, ...additionalData }, targetLogger);
    },
  };
}

/**
 * Error chain logging helper
 */
export function logErrorChain(error: Error, context?: string, logger?: UnifiedLogger): void {
  const targetLogger = logger || unifiedLogger;
  
  let current: Error | undefined = error;
  let depth = 0;
  
  while (current && depth < 10) { // Prevent infinite loops
    const prefix = depth === 0 ? 'Error' : `Caused by (${depth})`;
    const contextMsg = context ? `[${context}] ${prefix}` : prefix;
    
    targetLogger.error(`${contextMsg}: ${current.message}`, {
      errorName: current.name,
      errorStack: current.stack,
      errorDepth: depth,
      context,
    });
    
    // Try to get the cause
    current = (current as Error & { cause?: unknown }).cause as Error | undefined;
    depth++;
  }
}

/**
 * Conditional logging helper
 */
export function conditionalLog(
  condition: boolean | (() => boolean),
  level: LogLevel,
  message: string,
  meta?: LogMetadata,
  logger?: UnifiedLogger
): void {
  const shouldLog = typeof condition === 'function' ? condition() : condition;
  if (!shouldLog) return;
  
  const targetLogger = logger || unifiedLogger;
  targetLogger[level](message, meta);
}

/**
 * Rate-limited logging helper
 */
export class RateLimitedLogger {
  private logger: UnifiedLogger;
  private limits = new Map<string, { lastLog: number; count: number }>();
  private windowMs: number;
  private maxCount: number;

  constructor(windowMs = 60000, maxCount = 10, logger?: UnifiedLogger) {
    this.logger = logger || unifiedLogger;
    this.windowMs = windowMs;
    this.maxCount = maxCount;
  }

  log(level: LogLevel, message: string, meta?: LogMetadata): boolean {
    const key = `${level}:${message}`;
    const now = Date.now();
    const limit = this.limits.get(key);
    
    if (!limit) {
      this.limits.set(key, { lastLog: now, count: 1 });
      this.logger[level](message, meta);
      return true;
    }
    
    if (now - limit.lastLog > this.windowMs) {
      // Reset window
      limit.lastLog = now;
      limit.count = 1;
      this.logger[level](message, meta);
      return true;
    }
    
    if (limit.count >= this.maxCount) {
      return false; // Rate limited
    }
    
    limit.count++;
    this.logger[level](message, meta);
    return true;
  }

  debug(message: string, meta?: LogMetadata): boolean {
    return this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMetadata): boolean {
    return this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMetadata): boolean {
    return this.log('warn', message, meta);
  }

  error(message: string, meta?: LogMetadata): boolean {
    return this.log('error', message, meta);
  }

  critical(message: string, meta?: LogMetadata): boolean {
    return this.log('critical', message, meta);
  }
}