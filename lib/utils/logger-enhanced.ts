/**
 * Enhanced Logger Wrapper
 * 
 * Drop-in replacement for existing logger with enhanced features
 */

import { enhancedLogger } from '@/lib/logging';
import { logger as originalLogger } from './logger';

/**
 * Enhanced logger that maintains backward compatibility
 * while adding storage and filtering capabilities
 */
export const logger = {
  // 既存のメソッドをラップ
  debug: (message: string, meta?: Record<string, unknown>) => {
    enhancedLogger.debug(message, meta);
  },
  
  info: (message: string, meta?: Record<string, unknown>) => {
    enhancedLogger.info(message, meta);
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    enhancedLogger.warn(message, meta);
  },
  
  error: (message: string, meta?: Record<string, unknown>) => {
    enhancedLogger.error(message, meta);
  },

  // 新しいメソッド
  critical: (message: string, meta?: Record<string, unknown>) => {
    enhancedLogger.critical(message, meta);
  },

  // コンテキスト管理
  withContext: async <T>(
    context: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> => {
    return enhancedLogger.withContext(context, fn);
  },

  pushContext: (context: Record<string, unknown>) => {
    enhancedLogger.pushContext(context);
  },

  popContext: () => {
    enhancedLogger.popContext();
  },

  // クエリ機能
  query: enhancedLogger.query.bind(enhancedLogger),
  getStats: enhancedLogger.getStats.bind(enhancedLogger),
  subscribe: enhancedLogger.subscribe.bind(enhancedLogger),

  // 既存のloggerも保持（移行期間用）
  original: originalLogger,
};

/**
 * Agent-specific logger helper
 */
export function createAgentLogger(agentName: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      logger.debug(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      logger.info(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      logger.warn(`[${agentName}] ${message}`, { ...meta, agentName });
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      logger.error(`[${agentName}] ${message}`, { ...meta, agentName });
    },
  };
}

/**
 * Tool-specific logger helper
 */
export function createToolLogger(toolName: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      logger.debug(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      logger.info(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      logger.warn(`[${toolName}] ${message}`, { ...meta, toolName });
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      logger.error(`[${toolName}] ${message}`, { ...meta, toolName });
    },
  };
}

/**
 * Performance logging helper
 */
export async function logPerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    logger.info(`${operation} completed`, {
      operation,
      duration,
      success: true,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error(`${operation} failed`, {
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
export function createSessionLogger(sessionId: string, userId?: string) {
  logger.pushContext({ sessionId, userId });
  
  return {
    end: () => {
      logger.popContext();
    },
  };
}