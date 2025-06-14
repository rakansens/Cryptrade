/**
 * Enhanced Logger with Storage Integration
 * 
 * Wraps existing logger with storage and filtering capabilities
 */

import {
  LogEntry,
  LogLevel,
  LoggerConfig,
  ILogStorage,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats,
  LogSubscription,
  MetadataValue,
} from './types';
import { logger as baseLogger } from '@/lib/utils/logger';
import { createLogStorage } from './storage/factory';
import { env } from '@/config/env';

/**
 * Enhanced logger with storage and filtering
 */
export class EnhancedLogger {
  private storage?: ILogStorage;
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private subscriptions: Map<string, LogSubscription> = new Map();
  private contextStack: Record<string, MetadataValue>[] = [];
  private initPromise?: Promise<void>;

  constructor(config: LoggerConfig) {
    this.config = config;
    
    // バッファリング設定
    if (config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, config.flushInterval);
    }
  }

  /**
   * Initialize logger
   */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._init();
    }
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    this.storage = await createLogStorage(this.config);
    await this.storage.init();
  }

  /**
   * Close logger
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
    if (this.storage) {
      await this.storage.close();
    }
  }

  /**
   * Log methods
   */
  debug(message: string, metadata?: Record<string, MetadataValue>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, MetadataValue>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, MetadataValue>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, MetadataValue>): void {
    this.log('error', message, metadata);
  }

  critical(message: string, metadata?: Record<string, MetadataValue>): void {
    this.log('critical', message, metadata);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, MetadataValue>): void {
    // レベルチェック
    if (!this.shouldLog(level)) return;

    // エントリー作成
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      source: this.config.source,
      message,
      metadata: { ...this.getCurrentContext(), ...metadata },
      correlationId: this.getCorrelationId(),
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      agentName: (metadata?.agentName as string) || this.getFromContext('agentName') as string | undefined,
      toolName: (metadata?.toolName as string) || this.getFromContext('toolName') as string | undefined,
      duration: metadata?.duration as number | undefined,
      tags: metadata?.tags as string[] | undefined,
    };

    // スタックトレース追加（エラーの場合）
    if (this.config.enableStackTrace && (level === 'error' || level === 'critical')) {
      entry.stack = new Error().stack;
    }

    // beforeLogフック
    if (this.config.beforeLog) {
      const modified = this.config.beforeLog(entry);
      if (!modified) return; // ログをスキップ
    }

    // 既存のloggerにも出力
    this.logToBaseLogger(level, message, entry.metadata);

    // バッファに追加
    this.buffer.push(entry);

    // バッファサイズチェック
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }

    // リアルタイム配信
    this.notifySubscribers(entry);
  }

  /**
   * Flush buffer to storage
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (!this.storage) {
      // ストレージが初期化されていない場合は初期化を待つ
      await this.init();
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.storage!.save(entries);
    } catch (error) {
      // エラー時はバッファに戻す
      this.buffer.unshift(...entries);
      
      if (this.config.onError) {
        this.config.onError(error as Error);
      } else {
        console.error('[EnhancedLogger] Failed to flush logs:', error);
      }
    }
  }

  /**
   * Query logs
   */
  async query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult> {
    await this.init();
    return this.storage!.query(filter, pagination);
  }

  /**
   * Get log statistics
   */
  async getStats(filter?: LogFilter): Promise<LogStats> {
    await this.init();
    return this.storage!.getStats(filter);
  }

  /**
   * Subscribe to real-time logs
   */
  subscribe(filter: LogFilter, callback: (log: LogEntry) => void): LogSubscription {
    const id = this.generateId();
    const subscription: LogSubscription = {
      id,
      filter,
      callback,
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  /**
   * Push context for correlation
   */
  pushContext(context: Record<string, MetadataValue>): void {
    this.contextStack.push(context);
  }

  /**
   * Pop context
   */
  popContext(): void {
    this.contextStack.pop();
  }

  /**
   * With context helper
   */
  async withContext<T>(
    context: Record<string, MetadataValue>,
    fn: () => Promise<T>
  ): Promise<T> {
    this.pushContext(context);
    try {
      return await fn();
    } finally {
      this.popContext();
    }
  }

  /**
   * Clean up old logs
   */
  async cleanup(): Promise<number> {
    await this.init();
    const now = new Date();
    const cutoffDates: Partial<Record<LogLevel, Date>> = {};

    if (this.config.retention) {
      for (const [level, days] of Object.entries(this.config.retention)) {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        cutoffDates[level as LogLevel] = cutoff;
      }
    }

    let totalDeleted = 0;
    for (const [level, cutoff] of Object.entries(cutoffDates)) {
      const deleted = await this.storage!.delete({
        level: level as LogLevel,
        timeRange: { to: cutoff },
      });
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  /**
   * Helper methods
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    const minIndex = levels.indexOf(this.config.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  private getCurrentContext(): Record<string, MetadataValue> {
    return this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {});
  }

  private getFromContext(key: string): MetadataValue {
    for (let i = this.contextStack.length - 1; i >= 0; i--) {
      if (this.contextStack[i][key] !== undefined) {
        return this.contextStack[i][key];
      }
    }
    return undefined;
  }

  private getCorrelationId(): string | undefined {
    return this.getFromContext('correlationId') as string | undefined;
  }

  private getUserId(): string | undefined {
    return this.getFromContext('userId') as string | undefined;
  }

  private getSessionId(): string | undefined {
    return this.getFromContext('sessionId') as string | undefined;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private logToBaseLogger(level: LogLevel, message: string, metadata?: Record<string, MetadataValue>): void {
    switch (level) {
      case 'debug':
        baseLogger.debug(message, metadata);
        break;
      case 'info':
        baseLogger.info(message, metadata);
        break;
      case 'warn':
        baseLogger.warn(message, metadata);
        break;
      case 'error':
        baseLogger.error(message, metadata);
        break;
      case 'critical':
        baseLogger.error(`[CRITICAL] ${message}`, metadata);
        break;
    }
  }

  private notifySubscribers(entry: LogEntry): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(entry, subscription.filter)) {
        try {
          subscription.callback(entry);
        } catch (error) {
          console.error('[EnhancedLogger] Subscriber error:', error);
        }
      }
    }
  }

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    // シンプルなフィルタリング実装
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      if (!levels.includes(entry.level)) return false;
    }

    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(entry.source)) return false;
    }

    if (filter.search && !entry.message.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }

    return true;
  }
}

/**
 * Default enhanced logger instance
 */
export const enhancedLogger = new EnhancedLogger({
  source: 'cryptrade',
  minLevel: env.NODE_ENV === 'production' ? 'info' : 'debug',
  bufferSize: 100,
  flushInterval: 5000,
  storage: env.NODE_ENV === 'test' ? 'memory' : 'sqlite',
  retention: {
    debug: 1,
    info: 7,
    warn: 30,
    error: 90,
    critical: 365,
  },
  enableMetrics: true,
  enableStackTrace: env.NODE_ENV !== 'production',
});

// 自動初期化
if (env.NODE_ENV !== 'test') {
  enhancedLogger.init().catch(error => {
    console.error('[EnhancedLogger] Failed to initialize:', error);
  });
}

// プロセス終了時のクリーンアップ
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await enhancedLogger.close();
  });
}