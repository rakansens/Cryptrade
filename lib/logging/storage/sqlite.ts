/**
 * Unified SQLite Storage
 * 
 * SQLite storage implementation for server environments
 */

import type {
  IUnifiedStorage,
  UnifiedLogEntry,
  UnifiedLoggerConfig,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats,
  LogLevel
} from '../unified-logger';

// Minimal SQLite type definitions
interface SQLiteStatement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): Record<string, unknown>;
  all(...params: unknown[]): Record<string, unknown>[];
}

interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: (args: T) => void): (args: T) => void;
}

interface SQLiteLogRow {
  id: string;
  timestamp: number;
  level: string;
  source: string;
  message: string;
  environment: string;
  meta: string | null;
  error: string | null;
  correlation_id: string | null;
  user_id: string | null;
  session_id: string | null;
  agent_name: string | null;
  tool_name: string | null;
  stack: string | null;
  duration: number | null;
  tags: string | null;
}

export class UnifiedSQLiteStorage implements IUnifiedStorage {
  private config: UnifiedLoggerConfig;
  private db: SQLiteDatabase | null = null;
  private initialized = false;

  constructor(config: UnifiedLoggerConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Dynamic import for server-side only
      const Database = (await import('better-sqlite3')).default;
      
      // Use configured connection string or default path
      const dbPath = this.config.connectionString || './logs/unified.db';
      
      // Ensure directory exists
      const path = await import('path');
      const fs = await import('fs').then(m => m.promises);
      const dir = path.dirname(dbPath);
      await fs.mkdir(dir, { recursive: true });
      
      this.db = new Database(dbPath) as SQLiteDatabase;
      
      // Create tables
      await this.createTables();
      
      this.initialized = true;
    } catch (error) {
      console.error('[UnifiedSQLiteStorage] Initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS log_entries (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        environment TEXT NOT NULL,
        meta TEXT,
        error TEXT,
        correlation_id TEXT,
        user_id TEXT,
        session_id TEXT,
        agent_name TEXT,
        tool_name TEXT,
        stack TEXT,
        duration INTEGER,
        tags TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON log_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_level ON log_entries(level);
      CREATE INDEX IF NOT EXISTS idx_source ON log_entries(source);
      CREATE INDEX IF NOT EXISTS idx_correlation_id ON log_entries(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_user_id ON log_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_id ON log_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_name ON log_entries(agent_name);
      CREATE INDEX IF NOT EXISTS idx_tool_name ON log_entries(tool_name);
    `;
    
    this.db!.exec(schema);
  }

  async save(entries: UnifiedLogEntry[]): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    
    const insert = this.db!.prepare(`
      INSERT INTO log_entries (
        id, timestamp, level, source, message, environment,
        meta, error, correlation_id, user_id, session_id,
        agent_name, tool_name, stack, duration, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db!.transaction((entries: UnifiedLogEntry[]) => {
      for (const entry of entries) {
        insert.run(
          entry.id,
          entry.timestamp.getTime(),
          entry.level,
          entry.source,
          entry.message,
          entry.environment,
          entry.meta ? JSON.stringify(entry.meta) : null,
          entry.error ? JSON.stringify(entry.error) : null,
          entry.correlationId || null,
          entry.userId || null,
          entry.sessionId || null,
          entry.agentName || null,
          entry.toolName || null,
          entry.stack || null,
          entry.duration || null,
          entry.tags ? JSON.stringify(entry.tags) : null
        );
      }
    });
    
    transaction(entries);
  }

  async query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult> {
    if (!this.initialized) {
      await this.init();
    }
    
    const startTime = Date.now();
    
    // Build WHERE clause
    const { where, params } = this.buildWhereClause(filter);
    
    // Build ORDER BY clause
    const sortBy = this.mapSortField(pagination?.sortBy || 'timestamp');
    const order = pagination?.order || 'desc';
    const orderBy = `ORDER BY ${sortBy} ${order.toUpperCase()}`;
    
    // Pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const offset = (page - 1) * limit;
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM log_entries ${where}`;
    const countResult = this.db!.prepare(countQuery).get(params) as { total: number };
    const total = countResult.total;
    
    // Data query
    const dataQuery = `
      SELECT * FROM log_entries 
      ${where} 
      ${orderBy} 
      LIMIT ? OFFSET ?
    `;
    const rows = this.db!.prepare(dataQuery).all([...params, limit, offset]) as unknown as SQLiteLogRow[];
    
    // Convert rows to entries
    const data = rows.map(row => this.rowToEntry(row));
    
    const pages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        total,
        page,
        pages,
        limit,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
      executionTime: Date.now() - startTime,
    };
  }

  async getStats(filter?: LogFilter): Promise<LogStats> {
    if (!this.initialized) {
      await this.init();
    }
    
    const { where, params } = filter ? this.buildWhereClause(filter) : { where: '', params: [] };
    
    // Basic counts
    const totalQuery = `SELECT COUNT(*) as total FROM log_entries ${where}`;
    const totalResult = this.db!.prepare(totalQuery).get(params) as { total: number };
    
    // By level
    const levelQuery = `
      SELECT level, COUNT(*) as count 
      FROM log_entries ${where} 
      GROUP BY level
    `;
    const levelResults = this.db!.prepare(levelQuery).all(params) as Array<{ level: string; count: number }>;
    
    // By source
    const sourceQuery = `
      SELECT source, COUNT(*) as count 
      FROM log_entries ${where} 
      GROUP BY source
    `;
    const sourceResults = this.db!.prepare(sourceQuery).all(params) as Array<{ source: string; count: number }>;
    
    const stats: LogStats = {
      total: totalResult.total,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        critical: 0,
      },
      bySource: {},
    };
    
    // Populate level stats
    for (const row of levelResults) {
      stats.byLevel[row.level as keyof typeof stats.byLevel] = row.count;
    }
    
    // Populate source stats
    for (const row of sourceResults) {
      stats.bySource[row.source] = row.count;
    }
    
    // Agent stats
    const agentQuery = `
      SELECT agent_name, COUNT(*) as count 
      FROM log_entries 
      ${where} AND agent_name IS NOT NULL 
      GROUP BY agent_name
    `;
    const agentResults = this.db!.prepare(agentQuery).all(params) as Array<{ agent_name: string; count: number }>;
    if (agentResults.length > 0) {
      stats.byAgent = {};
      for (const row of agentResults) {
        stats.byAgent[row.agent_name] = row.count;
      }
    }
    
    // Tool stats
    const toolQuery = `
      SELECT tool_name, COUNT(*) as count 
      FROM log_entries 
      ${where} AND tool_name IS NOT NULL 
      GROUP BY tool_name
    `;
    const toolResults = this.db!.prepare(toolQuery).all(params) as Array<{ tool_name: string; count: number }>;
    if (toolResults.length > 0) {
      stats.byTool = {};
      for (const row of toolResults) {
        stats.byTool[row.tool_name] = row.count;
      }
    }
    
    // Performance stats
    const perfQuery = `
      SELECT 
        AVG(duration) as avg_duration,
        duration as value
      FROM log_entries 
      ${where} AND duration IS NOT NULL
      ORDER BY duration
    `;
    const perfResults = this.db!.prepare(perfQuery).all(params) as Array<{ avg_duration: number; value: number | null }>;
    if (perfResults.length > 0) {
      const durations = perfResults.map(r => r.value).filter(d => d !== null);
      if (durations.length > 0) {
        stats.performance = {
          avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
          p50Duration: durations[Math.floor(durations.length * 0.5)],
          p95Duration: durations[Math.floor(durations.length * 0.95)],
          p99Duration: durations[Math.floor(durations.length * 0.99)],
        };
      }
    }
    
    return stats;
  }

  async delete(filter: LogFilter): Promise<number> {
    if (!this.initialized) {
      await this.init();
    }
    
    const { where, params } = this.buildWhereClause(filter);
    const query = `DELETE FROM log_entries ${where}`;
    const result = this.db!.prepare(query).run(params);
    return result.changes;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  private buildWhereClause(filter: LogFilter): { where: string; params: Array<string | number | null> } {
    const conditions: string[] = [];
    const params: Array<string | number | null> = [];
    
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      conditions.push(`level IN (${levels.map(() => '?').join(', ')})`);
      params.push(...levels);
    }
    
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      conditions.push(`source IN (${sources.map(() => '?').join(', ')})`);
      params.push(...sources);
    }
    
    if (filter.timeRange) {
      const from = new Date(filter.timeRange.from).getTime();
      const to = new Date(filter.timeRange.to).getTime();
      conditions.push('timestamp >= ? AND timestamp <= ?');
      params.push(from, to);
    }
    
    if (filter.correlationId) {
      conditions.push('correlation_id = ?');
      params.push(filter.correlationId);
    }
    
    if (filter.userId) {
      conditions.push('user_id = ?');
      params.push(filter.userId);
    }
    
    if (filter.sessionId) {
      conditions.push('session_id = ?');
      params.push(filter.sessionId);
    }
    
    if (filter.agentName) {
      conditions.push('agent_name = ?');
      params.push(filter.agentName);
    }
    
    if (filter.toolName) {
      conditions.push('tool_name = ?');
      params.push(filter.toolName);
    }
    
    if (filter.search) {
      conditions.push('(message LIKE ? OR meta LIKE ?)');
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    if (filter.minDuration !== undefined) {
      conditions.push('duration >= ?');
      params.push(filter.minDuration);
    }
    
    if (filter.maxDuration !== undefined) {
      conditions.push('duration <= ?');
      params.push(filter.maxDuration);
    }
    
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params };
  }

  private mapSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      timestamp: 'timestamp',
      level: 'level',
      source: 'source',
      message: 'message',
      environment: 'environment',
      correlationId: 'correlation_id',
      userId: 'user_id',
      sessionId: 'session_id',
      agentName: 'agent_name',
      toolName: 'tool_name',
      duration: 'duration',
    };
    
    return fieldMap[field] || 'timestamp';
  }

  private rowToEntry(row: SQLiteLogRow): UnifiedLogEntry {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      level: row.level as LogLevel,
      source: row.source,
      message: row.message,
      environment: row.environment,
      meta: row.meta ? JSON.parse(row.meta) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined,
      correlationId: row.correlation_id,
      userId: row.user_id,
      sessionId: row.session_id,
      agentName: row.agent_name,
      toolName: row.tool_name,
      stack: row.stack,
      duration: row.duration,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
    };
  }
}