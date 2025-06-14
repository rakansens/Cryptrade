/**
 * In-Memory Log Storage Implementation
 * 
 * Fast storage for testing and development
 */

import {
  LogEntry,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats,
  LoggerConfig,
  LogLevel,
  MetadataValue,
} from '../types';
import { BaseLogStorage } from './base';

/**
 * In-memory log storage for testing
 */
export class MemoryLogStorage extends BaseLogStorage {
  private logs: LogEntry[] = [];
  private maxSize: number;

  constructor(config: LoggerConfig) {
    super(config);
    this.maxSize = config.bufferSize || 10000;
  }

  async init(): Promise<void> {
    this.logs = [];
    this.isInitialized = true;
  }

  async close(): Promise<void> {
    this.logs = [];
    this.isInitialized = false;
  }

  async save(entries: LogEntry[]): Promise<void> {
    await this.ensureInitialized();
    
    for (const entry of entries) {
      const normalized = this.normalizeLogEntry(entry);
      this.logs.push(normalized);
    }

    // メモリ制限を適用
    if (this.logs.length > this.maxSize) {
      const toRemove = this.logs.length - this.maxSize;
      this.logs.splice(0, toRemove);
    }
  }

  async query(
    filter: LogFilter,
    pagination: PaginationOptions = {}
  ): Promise<LogQueryResult> {
    await this.ensureInitialized();

    const startTime = Date.now();
    
    // フィルタリング
    let filtered = this.logs.filter(log => this.matchesFilter(log, filter));

    // ソート
    const sortBy = pagination.sortBy || 'timestamp';
    const order = pagination.order || 'desc';
    filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      // Handle Date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        return order === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      // Handle string/number comparison
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });

    // ページネーション
    const limit = pagination.limit || 50;
    const page = pagination.page || 1;
    const offset = (page - 1) * limit;
    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      pagination: this.buildPaginationMeta(filtered.length, { ...pagination, page, limit }, data.length),
      executionTime: Date.now() - startTime,
    };
  }

  async count(filter: LogFilter): Promise<number> {
    await this.ensureInitialized();
    return this.logs.filter(log => this.matchesFilter(log, filter)).length;
  }

  async delete(filter: LogFilter): Promise<number> {
    await this.ensureInitialized();
    
    const before = this.logs.length;
    this.logs = this.logs.filter(log => !this.matchesFilter(log, filter));
    
    return before - this.logs.length;
  }

  async getStats(filter?: LogFilter): Promise<LogStats> {
    await this.ensureInitialized();

    const filtered = filter 
      ? this.logs.filter(log => this.matchesFilter(log, filter))
      : this.logs;

    // Level別集計
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const bySource: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byTool: Record<string, number> = {};
    const durations: number[] = [];
    const errorMessages: Map<string, { count: number; lastOccurrence: Date }> = new Map();

    for (const log of filtered) {
      // Level集計
      byLevel[log.level]++;

      // Source集計
      bySource[log.source] = (bySource[log.source] || 0) + 1;

      // Agent集計
      if (log.agentName) {
        byAgent[log.agentName] = (byAgent[log.agentName] || 0) + 1;
      }

      // Tool集計
      if (log.toolName) {
        byTool[log.toolName] = (byTool[log.toolName] || 0) + 1;
      }

      // Duration集計
      if (log.duration !== undefined) {
        durations.push(log.duration);
      }

      // Error集計
      if (log.level === 'error' || log.level === 'critical') {
        const existing = errorMessages.get(log.message);
        if (existing) {
          existing.count++;
          if (log.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = log.timestamp;
          }
        } else {
          errorMessages.set(log.message, {
            count: 1,
            lastOccurrence: log.timestamp,
          });
        }
      }
    }

    // パフォーマンス統計
    let performance;
    if (durations.length > 0) {
      durations.sort((a, b) => a - b);
      performance = {
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: durations[Math.floor(durations.length * 0.5)],
        p95Duration: durations[Math.floor(durations.length * 0.95)],
        p99Duration: durations[Math.floor(durations.length * 0.99)],
      };
    }

    // Top errors
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: filtered.length,
      byLevel,
      bySource,
      byAgent,
      byTool,
      performance,
      topErrors,
    };
  }

  async vacuum(): Promise<void> {
    // メモリストレージでは不要
  }

  /**
   * Check if log entry matches filter
   */
  private matchesFilter(log: LogEntry, filter: LogFilter): boolean {
    // Level filter
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      if (!levels.includes(log.level)) return false;
    }

    // Source filter
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(log.source)) return false;
    }

    // Time range filter
    if (filter.timeRange) {
      if (filter.timeRange.from && log.timestamp < new Date(filter.timeRange.from)) {
        return false;
      }
      if (filter.timeRange.to && log.timestamp > new Date(filter.timeRange.to)) {
        return false;
      }
    }

    // ID filters
    if (filter.correlationId && log.correlationId !== filter.correlationId) return false;
    if (filter.userId && log.userId !== filter.userId) return false;
    if (filter.sessionId && log.sessionId !== filter.sessionId) return false;
    if (filter.agentName && log.agentName !== filter.agentName) return false;
    if (filter.toolName && log.toolName !== filter.toolName) return false;

    // Text search
    if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      if (!log.tags || !filter.tags.some(tag => log.tags!.includes(tag))) {
        return false;
      }
    }

    // Duration filters
    if (filter.minDuration !== undefined && (log.duration === undefined || log.duration < filter.minDuration)) {
      return false;
    }
    if (filter.maxDuration !== undefined && (log.duration === undefined || log.duration > filter.maxDuration)) {
      return false;
    }

    // Metadata filter
    if (filter.metadata) {
      if (!log.metadata) return false;
      
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (!this.isMetadataEqual(log.metadata[key], value)) return false;
      }
    }

    return true;
  }

  /**
   * Deep equality check for metadata values
   */
  private isMetadataEqual(a: MetadataValue, b: MetadataValue): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;
    
    // Handle Date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    // Handle array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.isMetadataEqual(item, b[index]));
    }
    
    // Handle object comparison
    if (typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(key => 
        this.isMetadataEqual(
          (a as Record<string, MetadataValue>)[key], 
          (b as Record<string, MetadataValue>)[key]
        )
      );
    }
    
    return false;
  }
}