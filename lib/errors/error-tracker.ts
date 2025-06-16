/**
 * Error Tracking Service
 * 
 * Centralized error tracking with Mastra's trackException
 */

import { logger } from '@/lib/utils/logger';
import { MastraBaseError, SerializedError } from './base-error';
import { env } from '@/config/env';

/**
 * Context for error tracking
 */
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  workflowId?: string;
  endpoint?: string;
  statusCode?: number;
  type?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Batch error entry
 */
export interface BatchError {
  error: Error | MastraBaseError;
  context?: ErrorContext;
}

/**
 * Error tracking service for centralized error management
 */
export class ErrorTracker {
  private static instance: ErrorTracker;
  private errorBuffer: SerializedError[] = [];
  private flushInterval?: NodeJS.Timeout;

  private constructor() {
    // バッファーを定期的にフラッシュ
    if (env.NODE_ENV !== 'test') {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 30000); // 30秒ごと
    }
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Track an exception with enhanced context
   */
  trackException(
    error: Error | MastraBaseError,
    context?: ErrorContext
  ): void {
    try {
      const errorData = this.serializeError(error, context);
      
      // ログに記録
      logger.error('Exception tracked', errorData as unknown as Record<string, unknown>);
      
      // バッファーに追加
      this.errorBuffer.push(errorData);
      
      // クリティカルエラーは即座に送信
      if (errorData.severity === 'CRITICAL') {
        this.flush();
      }
      
      // 開発環境ではコンソールにも出力
      if (env.NODE_ENV === 'development') {
        console.error('🚨 Error Tracked:', error);
      }
      
      // 本番環境ではSentryなどに送信
      if (env.NODE_ENV === 'production' && env.ENABLE_SENTRY) {
        // Sentry.captureException(error, { extra: context });
      }
    } catch (trackingError) {
      // トラッキング自体のエラーは静かに失敗
      logger.warn('Failed to track exception', { 
        originalError: error.message,
        trackingError: String(trackingError) 
      });
    }
  }

  /**
   * Track multiple errors at once
   */
  trackBatch(errors: BatchError[]): void {
    errors.forEach(({ error, context }) => {
      this.trackException(error, context);
    });
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.errorBuffer.length,
      byCategory: {},
      bySeverity: {},
      recent: [],
    };

    this.errorBuffer.forEach(error => {
      // カテゴリー別集計
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      // 重要度別集計
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    // 直近のエラー
    stats.recent = this.errorBuffer.slice(-10);

    return stats;
  }

  /**
   * Clear error buffer
   */
  clear(): void {
    this.errorBuffer = [];
  }

  /**
   * Flush errors to external service
   */
  private async flush(): Promise<void> {
    if (this.errorBuffer.length === 0) return;

    const errors = [...this.errorBuffer];
    this.errorBuffer = [];

    try {
      // バッチでエラーを送信
      if (env.TELEMETRY_ENDPOINT) {
        await fetch(`${env.TELEMETRY_ENDPOINT}/errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.TELEMETRY_API_KEY || '',
          },
          body: JSON.stringify({ errors }),
        });
      }
    } catch (error) {
      // 送信失敗時はバッファーに戻す
      this.errorBuffer.unshift(...errors);
      logger.warn('Failed to flush errors', { error: String(error) });
    }
  }

  /**
   * Serialize error to trackable format
   */
  private serializeError(
    error: Error | MastraBaseError,
    context?: ErrorContext
  ): SerializedError {
    if (error instanceof MastraBaseError) {
      return {
        ...error.toJSON(),
        context: { ...error.context, ...context },
      };
    }

    // 通常のErrorをMastraBaseError形式に変換
    return {
      name: error.name,
      message: error.message,
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      category: 'UNKNOWN' as const,
      severity: 'ERROR' as const,
      retryable: false,
      stack: error.stack,
      context,
    } as SerializedError;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

/**
 * Error statistics interface
 */
export interface ErrorStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recent: SerializedError[];
}

/**
 * Global error tracker instance
 */
export const errorTracker = ErrorTracker.getInstance();

/**
 * Convenient wrapper functions
 */
export function trackException(error: Error | MastraBaseError, context?: ErrorContext): void {
  errorTracker.trackException(error, context);
}

export function trackAgentError(
  error: Error,
  agentName: string,
  context?: ErrorContext
): void {
  errorTracker.trackException(error, {
    agentName,
    ...context,
  });
}

export function trackToolError(
  error: Error,
  toolName: string,
  context?: ErrorContext
): void {
  errorTracker.trackException(error, {
    toolName,
    ...context,
  });
}

export function trackApiError(
  error: Error,
  endpoint: string,
  statusCode?: number,
  context?: ErrorContext
): void {
  errorTracker.trackException(error, {
    endpoint,
    ...(statusCode !== undefined && { statusCode }),
    type: 'API_ERROR',
    ...context,
  });
}