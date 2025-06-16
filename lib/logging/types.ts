/**
 * Logging types and interfaces
 */

export interface LogEntry {
  id?: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface LogQuery {
  level?: LogEntry['level'];
  category?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface StorageMetrics {
  totalEntries: number;
  storageSize?: number;
  lastWriteTime?: Date;
  writeErrors?: number;
  readErrors?: number;
}

export interface UnifiedStorageInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(entry: LogEntry): Promise<void>;
  writeMany(entries: LogEntry[]): Promise<void>;
  query(query: LogQuery): Promise<LogEntry[]>;
  clear(): Promise<void>;
  getMetrics(): Promise<StorageMetrics>;
}

export interface TransportConfig {
  level?: LogEntry['level'];
  enabled?: boolean;
  options?: Record<string, any>;
}