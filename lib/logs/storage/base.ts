/**
 * Base Log Storage Implementation
 * 
 * Abstract base class for log storage adapters
 */

import {
  LogEntry,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats,
  ILogStorage,
  LoggerConfig,
  PaginationMeta,
  LogLevel,
} from '../types';
import { logger } from '@/lib/utils/logger';

/**
 * Abstract base class for log storage implementations
 */
export abstract class BaseLogStorage implements ILogStorage {
  protected config: LoggerConfig;
  protected isInitialized = false;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Initialize storage (create tables, indexes, etc.)
   */
  abstract init(): Promise<void>;

  /**
   * Close storage connection
   */
  abstract close(): Promise<void>;

  /**
   * Save log entries
   */
  abstract save(entries: LogEntry[]): Promise<void>;

  /**
   * Query logs with filtering and pagination
   */
  abstract query(
    filter: LogFilter,
    pagination?: PaginationOptions
  ): Promise<LogQueryResult>;

  /**
   * Count logs matching filter
   */
  abstract count(filter: LogFilter): Promise<number>;

  /**
   * Delete logs matching filter
   */
  abstract delete(filter: LogFilter): Promise<number>;

  /**
   * Get aggregated statistics
   */
  abstract getStats(filter?: LogFilter): Promise<LogStats>;

  /**
   * Clean up old logs based on retention policy
   */
  async cleanup(olderThan?: Date): Promise<number> {
    if (!this.config.retention) {
      return 0;
    }

    const now = new Date();
    let totalDeleted = 0;

    // 各レベルごとに保持期間を適用
    for (const [level, days] of Object.entries(this.config.retention)) {
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const deleted = await this.delete({
        level: level as LogLevel,
        timeRange: {
          from: new Date(0),
          to: cutoffDate,
        },
      });

      totalDeleted += deleted;
      
      logger.info(`[LogStorage] Cleaned up ${deleted} ${level} logs older than ${days} days`);
    }

    return totalDeleted;
  }

  /**
   * Vacuum/optimize storage
   */
  abstract vacuum(): Promise<void>;

  /**
   * Stream logs (optional implementation)
   */
  async *stream(filter: LogFilter): AsyncIterableIterator<LogEntry> {
    let cursor: string | undefined;
    const limit = 100;

    while (true) {
      const result = await this.query(filter, {
        cursor,
        limit,
        sortBy: 'timestamp',
        order: 'asc',
      });

      for (const entry of result.data) {
        yield entry;
      }

      if (!result.pagination.hasNext) {
        break;
      }

      cursor = result.pagination.nextCursor;
    }
  }

  /**
   * Build pagination metadata
   */
  protected buildPaginationMeta(
    total: number,
    options: PaginationOptions,
    dataLength: number
  ): PaginationMeta {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const pages = Math.ceil(total / limit);

    return {
      total,
      page,
      pages,
      limit,
      hasNext: page < pages,
      hasPrev: page > 1,
      nextCursor: options.cursor ? this.generateCursor(page + 1) : undefined,
      prevCursor: options.cursor && page > 1 ? this.generateCursor(page - 1) : undefined,
    };
  }

  /**
   * Generate cursor for pagination
   */
  protected generateCursor(page: number): string {
    return Buffer.from(JSON.stringify({ page })).toString('base64');
  }

  /**
   * Parse cursor
   */
  protected parseCursor(cursor: string): { page: number } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { page: 1 };
    }
  }

  /**
   * Validate and ensure storage is initialized
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
      this.isInitialized = true;
    }
  }

  /**
   * Apply default values to log entry
   */
  protected normalizeLogEntry(entry: Partial<LogEntry>): LogEntry {
    return {
      id: entry.id || this.generateId(),
      timestamp: entry.timestamp || new Date(),
      level: entry.level || 'info',
      source: entry.source || 'unknown',
      message: entry.message || '',
      metadata: entry.metadata,
      correlationId: entry.correlationId,
      userId: entry.userId,
      sessionId: entry.sessionId,
      agentName: entry.agentName,
      toolName: entry.toolName,
      stack: entry.stack,
      duration: entry.duration,
      tags: entry.tags,
    };
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build WHERE clause from filter (for SQL-based implementations)
   */
  protected buildWhereClause(filter: LogFilter): {
    conditions: string[];
    params: Array<string | number | Date | boolean>;
  } {
    const conditions: string[] = [];
    const params: Array<string | number | Date | boolean> = [];

    // Level filter
    if (filter.level) {
      if (Array.isArray(filter.level)) {
        conditions.push(`level IN (${filter.level.map(() => '?').join(', ')})`);
        params.push(...filter.level);
      } else {
        conditions.push('level = ?');
        params.push(filter.level);
      }
    }

    // Source filter
    if (filter.source) {
      if (Array.isArray(filter.source)) {
        conditions.push(`source IN (${filter.source.map(() => '?').join(', ')})`);
        params.push(...filter.source);
      } else {
        conditions.push('source = ?');
        params.push(filter.source);
      }
    }

    // Time range filter
    if (filter.timeRange) {
      if (filter.timeRange.from) {
        conditions.push('timestamp >= ?');
        params.push(new Date(filter.timeRange.from));
      }
      if (filter.timeRange.to) {
        conditions.push('timestamp <= ?');
        params.push(new Date(filter.timeRange.to));
      }
    }

    // Correlation ID
    if (filter.correlationId) {
      conditions.push('correlationId = ?');
      params.push(filter.correlationId);
    }

    // User ID
    if (filter.userId) {
      conditions.push('userId = ?');
      params.push(filter.userId);
    }

    // Session ID
    if (filter.sessionId) {
      conditions.push('sessionId = ?');
      params.push(filter.sessionId);
    }

    // Agent name
    if (filter.agentName) {
      conditions.push('agentName = ?');
      params.push(filter.agentName);
    }

    // Tool name
    if (filter.toolName) {
      conditions.push('toolName = ?');
      params.push(filter.toolName);
    }

    // Text search
    if (filter.search) {
      conditions.push('message LIKE ?');
      params.push(`%${filter.search}%`);
    }

    // Duration filters
    if (filter.minDuration !== undefined) {
      conditions.push('duration >= ?');
      params.push(filter.minDuration);
    }
    if (filter.maxDuration !== undefined) {
      conditions.push('duration <= ?');
      params.push(filter.maxDuration);
    }

    return { conditions, params };
  }
}