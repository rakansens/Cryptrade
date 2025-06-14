/**
 * SQLite Log Storage Implementation
 * 
 * Lightweight storage for development and testing
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type { MetadataValue } from '../types';
import path from 'path';
import fs from 'fs/promises';
import {
  LogEntry,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats,
  LoggerConfig,
  LogLevel,
} from '../types';
import { BaseLogStorage } from './base';
import { logger } from '@/lib/utils/logger';

/**
 * SQLite-based log storage
 */
export class SQLiteLogStorage extends BaseLogStorage {
  private db?: DatabaseType.Database;
  private statements: {
    insert?: DatabaseType.Statement;
    count?: DatabaseType.Statement;
    cleanup?: DatabaseType.Statement;
  } = {};

  constructor(config: LoggerConfig) {
    super(config);
  }

  /**
   * Initialize SQLite database
   */
  async init(): Promise<void> {
    // Server-side only
    if (typeof window !== 'undefined') {
      throw new Error('SQLiteLogStorage is not supported in browser environment');
    }
    
    try {
      // 動的インポート（サーバーサイドのみ）
      const Database = (await import('better-sqlite3')).default;
      
      // データベースパスの設定
      const dbPath = this.config.connectionString || '.mastra/logs.db';
      const dbDir = path.dirname(dbPath);

      // ディレクトリ作成
      await fs.mkdir(dbDir, { recursive: true });

      // データベース接続
      this.db = new Database(dbPath) as DatabaseType.Database;
      
      // パフォーマンス設定
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      
      // テーブル作成
      this.createTables();
      
      // インデックス作成
      this.createIndexes();
      
      // プリペアドステートメント作成
      this.prepareStatements();
      
      logger.info('[SQLiteLogStorage] Initialized', { path: dbPath });
    } catch (error) {
      logger.error('[SQLiteLogStorage] Failed to initialize', { error });
      throw error;
    }
  }

  /**
   * Create tables
   */
  private createTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        correlationId TEXT,
        userId TEXT,
        sessionId TEXT,
        agentName TEXT,
        toolName TEXT,
        stack TEXT,
        duration INTEGER,
        tags TEXT
      )
    `);
  }

  /**
   * Create indexes for performance
   */
  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)',
      'CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source)',
      'CREATE INDEX IF NOT EXISTS idx_logs_correlationId ON logs(correlationId)',
      'CREATE INDEX IF NOT EXISTS idx_logs_userId ON logs(userId)',
      'CREATE INDEX IF NOT EXISTS idx_logs_sessionId ON logs(sessionId)',
      'CREATE INDEX IF NOT EXISTS idx_logs_agentName ON logs(agentName)',
      'CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp)',
    ];

    for (const index of indexes) {
      this.db!.exec(index);
    }
  }

  /**
   * Prepare statements for better performance
   */
  private prepareStatements(): void {
    this.statements.insert = this.db!.prepare(`
      INSERT INTO logs (
        id, timestamp, level, source, message, metadata,
        correlationId, userId, sessionId, agentName, toolName,
        stack, duration, tags
      ) VALUES (
        @id, @timestamp, @level, @source, @message, @metadata,
        @correlationId, @userId, @sessionId, @agentName, @toolName,
        @stack, @duration, @tags
      )
    `);

    this.statements.count = this.db!.prepare(`
      SELECT COUNT(*) as count FROM logs WHERE 1=1
    `);

    this.statements.cleanup = this.db!.prepare(`
      DELETE FROM logs WHERE timestamp < ?
    `);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  /**
   * Save log entries
   */
  async save(entries: LogEntry[]): Promise<void> {
    await this.ensureInitialized();
    
    const insert = this.db!.transaction((entries: LogEntry[]) => {
      for (const entry of entries) {
        const normalized = this.normalizeLogEntry(entry);
        this.statements.insert!.run({
          ...normalized,
          timestamp: normalized.timestamp.toISOString(),
          metadata: normalized.metadata ? JSON.stringify(normalized.metadata) : null,
          tags: normalized.tags ? JSON.stringify(normalized.tags) : null,
        });
      }
    });

    try {
      insert(entries);
    } catch (error) {
      logger.error('[SQLiteLogStorage] Failed to save logs', { error, count: entries.length });
      throw error;
    }
  }

  /**
   * Query logs with filtering and pagination
   */
  async query(
    filter: LogFilter,
    pagination: PaginationOptions = {}
  ): Promise<LogQueryResult> {
    await this.ensureInitialized();

    const startTime = Date.now();
    
    // Build WHERE clause
    const { conditions, params } = this.buildSQLiteWhereClause(filter);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as count FROM logs ${whereClause}`;
    const totalResult = this.db!.prepare(countSql).get(...params) as { count: number };
    const total = totalResult.count;

    // Build ORDER BY
    const sortBy = pagination.sortBy || 'timestamp';
    const order = pagination.order || 'desc';
    const orderByClause = `ORDER BY ${sortBy} ${order.toUpperCase()}`;

    // Build LIMIT/OFFSET
    const limit = pagination.limit || 50;
    const page = pagination.page || 1;
    const offset = (page - 1) * limit;
    const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

    // Query data
    const dataSql = `
      SELECT * FROM logs 
      ${whereClause} 
      ${orderByClause} 
      ${limitClause}
    `;
    
    interface LogRow {
      id: string;
      timestamp: string;
      level: string;
      source: string;
      message: string;
      metadata: string | null;
      correlationId: string | null;
      userId: string | null;
      sessionId: string | null;
      agentName: string | null;
      toolName: string | null;
      stack: string | null;
      duration: number | null;
      tags: string | null;
    }
    
    const rows = this.db!.prepare(dataSql).all(...params) as LogRow[];
    
    // Transform rows to LogEntry
    const data = rows.map(row => this.rowToLogEntry(row));

    return {
      data,
      pagination: this.buildPaginationMeta(total, { ...pagination, page, limit }, data.length),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Count logs matching filter
   */
  async count(filter: LogFilter): Promise<number> {
    await this.ensureInitialized();

    const { conditions, params } = this.buildSQLiteWhereClause(filter);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const sql = `SELECT COUNT(*) as count FROM logs ${whereClause}`;
    const result = this.db!.prepare(sql).get(...params) as { count: number };
    
    return result.count;
  }

  /**
   * Delete logs matching filter
   */
  async delete(filter: LogFilter): Promise<number> {
    await this.ensureInitialized();

    const { conditions, params } = this.buildSQLiteWhereClause(filter);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const sql = `DELETE FROM logs ${whereClause}`;
    const result = this.db!.prepare(sql).run(...params);
    
    return result.changes;
  }

  /**
   * Get aggregated statistics
   */
  async getStats(filter?: LogFilter): Promise<LogStats> {
    await this.ensureInitialized();

    const { conditions, params } = filter 
      ? this.buildSQLiteWhereClause(filter) 
      : { conditions: [], params: [] };
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get counts by level
    const levelStats = this.db!.prepare(`
      SELECT level, COUNT(*) as count 
      FROM logs ${whereClause} 
      GROUP BY level
    `).all(...params) as { level: string; count: number }[];

    // Get counts by source
    const sourceStats = this.db!.prepare(`
      SELECT source, COUNT(*) as count 
      FROM logs ${whereClause} 
      GROUP BY source 
      ORDER BY count DESC 
      LIMIT 20
    `).all(...params) as { source: string; count: number }[];

    // Get counts by agent
    const agentStats = this.db!.prepare(`
      SELECT agentName, COUNT(*) as count 
      FROM logs ${whereClause} 
      WHERE agentName IS NOT NULL 
      GROUP BY agentName 
      ORDER BY count DESC
    `).all(...params) as { agentName: string; count: number }[];

    // Get performance stats
    interface PerfStats {
      avgDuration: number | null;
      minDuration: number | null;
      maxDuration: number | null;
    }
    
    const perfStats = this.db!.prepare(`
      SELECT 
        AVG(duration) as avgDuration,
        MIN(duration) as minDuration,
        MAX(duration) as maxDuration
      FROM logs ${whereClause} 
      WHERE duration IS NOT NULL
    `).get(...params) as PerfStats;

    // Get top errors
    interface ErrorStat {
      message: string;
      count: number;
      lastOccurrence: string;
    }
    
    const topErrors = this.db!.prepare(`
      SELECT message, COUNT(*) as count, MAX(timestamp) as lastOccurrence
      FROM logs ${whereClause}
      WHERE level IN ('error', 'critical')
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `).all(...params) as ErrorStat[];

    // Build stats object
    const stats: LogStats = {
      total: await this.count(filter || {}),
      byLevel: levelStats.reduce((acc, { level, count }) => {
        acc[level as LogLevel] = count;
        return acc;
      }, {} as Record<LogLevel, number>),
      bySource: sourceStats.reduce((acc, { source, count }) => {
        acc[source] = count;
        return acc;
      }, {} as Record<string, number>),
      byAgent: agentStats.reduce((acc, { agentName, count }) => {
        acc[agentName] = count;
        return acc;
      }, {} as Record<string, number>),
      performance: perfStats.avgDuration ? {
        avgDuration: perfStats.avgDuration,
        p50Duration: perfStats.avgDuration, // 簡略化
        p95Duration: perfStats.maxDuration * 0.95,
        p99Duration: perfStats.maxDuration * 0.99,
      } : undefined,
      topErrors: topErrors.map(e => ({
        message: e.message,
        count: e.count,
        lastOccurrence: new Date(e.lastOccurrence),
      })),
    };

    return stats;
  }

  /**
   * Vacuum database
   */
  async vacuum(): Promise<void> {
    await this.ensureInitialized();
    this.db!.exec('VACUUM');
  }

  /**
   * Build SQLite-specific WHERE clause
   */
  private buildSQLiteWhereClause(filter: LogFilter): {
    conditions: string[];
    params: Array<string | number | Date | boolean | MetadataValue>;
  } {
    const base = this.buildWhereClause(filter);
    
    // SQLite specific: JSON metadata search
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        base.conditions.push(`json_extract(metadata, '$.${key}') = ?`);
        base.params.push(value);
      }
    }

    // Tags search
    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => `tags LIKE ?`);
      base.conditions.push(`(${tagConditions.join(' OR ')})`);
      base.params.push(...filter.tags.map(tag => `%"${tag}"%`));
    }

    return base;
  }

  /**
   * Convert database row to LogEntry
   */
  private rowToLogEntry(row: {
    id: string;
    timestamp: string;
    level: string;
    source: string;
    message: string;
    metadata: string | null;
    correlationId: string | null;
    userId: string | null;
    sessionId: string | null;
    agentName: string | null;
    toolName: string | null;
    stack: string | null;
    duration: number | null;
    tags: string | null;
  }): LogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      level: row.level as LogLevel,
      source: row.source,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      correlationId: row.correlationId,
      userId: row.userId,
      sessionId: row.sessionId,
      agentName: row.agentName,
      toolName: row.toolName,
      stack: row.stack,
      duration: row.duration,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    };
  }
}