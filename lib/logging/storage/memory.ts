/**
 * Unified Memory Storage
 * 
 * In-memory storage implementation for testing and browser environments
 */

import type {
  IUnifiedStorage,
  UnifiedLogEntry,
  UnifiedLoggerConfig,
  LogFilter,
  PaginationOptions,
  LogQueryResult,
  LogStats
} from '../unified-logger';

export class UnifiedMemoryStorage implements IUnifiedStorage {
  private config: UnifiedLoggerConfig;
  private entries: UnifiedLogEntry[] = [];
  private initialized = false;

  constructor(config: UnifiedLoggerConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async save(entries: UnifiedLogEntry[]): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    
    this.entries.push(...entries);
    
    // Maintain reasonable memory limits
    const maxEntries = 10000; // Configurable limit
    if (this.entries.length > maxEntries) {
      // Remove oldest entries
      this.entries = this.entries.slice(-maxEntries);
    }
  }

  async query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult> {
    const startTime = Date.now();
    
    // Filter entries
    let filtered = this.entries.filter(entry => this.matchesFilter(entry, filter));
    
    // Sort
    const sortBy = pagination?.sortBy || 'timestamp';
    const order = pagination?.order || 'desc';
    
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return order === 'asc' ? -1 : 1;
      if (bVal === undefined) return order === 'asc' ? 1 : -1;
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const offset = (page - 1) * limit;
    
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);
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
    const entries = filter 
      ? this.entries.filter(entry => this.matchesFilter(entry, filter))
      : this.entries;
    
    const stats: LogStats = {
      total: entries.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        critical: 0,
      },
      bySource: {},
    };
    
    // Aggregate by level and source
    for (const entry of entries) {
      stats.byLevel[entry.level]++;
      stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
    }
    
    // Agent statistics
    const agentEntries = entries.filter(e => e.agentName);
    if (agentEntries.length > 0) {
      stats.byAgent = {};
      for (const entry of agentEntries) {
        if (entry.agentName) {
          stats.byAgent[entry.agentName] = (stats.byAgent[entry.agentName] || 0) + 1;
        }
      }
    }
    
    // Tool statistics
    const toolEntries = entries.filter(e => e.toolName);
    if (toolEntries.length > 0) {
      stats.byTool = {};
      for (const entry of toolEntries) {
        if (entry.toolName) {
          stats.byTool[entry.toolName] = (stats.byTool[entry.toolName] || 0) + 1;
        }
      }
    }
    
    // Performance statistics
    const perfEntries = entries.filter(e => e.duration !== undefined);
    if (perfEntries.length > 0) {
      const durations = perfEntries.map(e => e.duration!).sort((a, b) => a - b);
      stats.performance = {
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p50Duration: durations[Math.floor(durations.length * 0.5)],
        p95Duration: durations[Math.floor(durations.length * 0.95)],
        p99Duration: durations[Math.floor(durations.length * 0.99)],
      };
    }
    
    return stats;
  }

  async delete(filter: LogFilter): Promise<number> {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter(entry => !this.matchesFilter(entry, filter));
    return initialLength - this.entries.length;
  }

  async close(): Promise<void> {
    // Memory storage doesn't need cleanup
    this.initialized = false;
  }

  private matchesFilter(entry: UnifiedLogEntry, filter: LogFilter): boolean {
    // Level filter
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      if (!levels.includes(entry.level)) return false;
    }
    
    // Source filter
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(entry.source)) return false;
    }
    
    // Time range filter
    if (filter.timeRange) {
      const from = new Date(filter.timeRange.from);
      const to = new Date(filter.timeRange.to);
      if (entry.timestamp < from || entry.timestamp > to) return false;
    }
    
    // Context filters
    if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
    if (filter.userId && entry.userId !== filter.userId) return false;
    if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
    if (filter.agentName && entry.agentName !== filter.agentName) return false;
    if (filter.toolName && entry.toolName !== filter.toolName) return false;
    
    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (!entry.message.toLowerCase().includes(searchLower)) {
        // Also search in metadata
        const metaString = JSON.stringify(entry.meta || {}).toLowerCase();
        if (!metaString.includes(searchLower)) return false;
      }
    }
    
    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      if (!entry.tags || !filter.tags.some(tag => entry.tags!.includes(tag))) {
        return false;
      }
    }
    
    // Duration filters
    if (filter.minDuration !== undefined && (entry.duration === undefined || entry.duration < filter.minDuration)) {
      return false;
    }
    if (filter.maxDuration !== undefined && (entry.duration === undefined || entry.duration > filter.maxDuration)) {
      return false;
    }
    
    // Metadata filter
    if (filter.metadata) {
      if (!entry.meta) return false;
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (entry.meta[key] !== value) return false;
      }
    }
    
    return true;
  }
}