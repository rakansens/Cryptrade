/**
 * Log Management System Types
 * 
 * Enhanced logging with filtering and pagination support
 */

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Core log entry structure
 */
/**
 * Allowed metadata value types
 */
export type MetadataValue = 
  | string 
  | number 
  | boolean 
  | null
  | undefined
  | Date
  | MetadataValue[]
  | { [key: string]: MetadataValue };

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, MetadataValue>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  stack?: string;
  duration?: number; // 実行時間（ミリ秒）
  tags?: string[]; // 検索用タグ
}

/**
 * Log filtering options
 */
export interface LogFilter {
  // 基本フィルター
  level?: LogLevel | LogLevel[];
  source?: string | string[];
  
  // 時間範囲フィルター
  timeRange?: {
    from: Date | string;
    to: Date | string;
  };
  
  // 関連性フィルター
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  
  // テキスト検索
  search?: string; // メッセージ内検索
  tags?: string[]; // タグによるフィルター
  
  // メタデータフィルター
  metadata?: Record<string, MetadataValue>;
  
  // パフォーマンスフィルター
  minDuration?: number;
  maxDuration?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  // ページベース
  page?: number;
  limit?: number;
  
  // カーソルベース（大規模データ用）
  cursor?: string;
  
  // ソート
  sortBy?: keyof LogEntry;
  order?: 'asc' | 'desc';
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pages: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

/**
 * Log query result
 */
export interface LogQueryResult {
  data: LogEntry[];
  pagination: PaginationMeta;
  executionTime?: number;
}

/**
 * Aggregated log statistics
 */
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  byAgent?: Record<string, number>;
  byTool?: Record<string, number>;
  
  // 時系列統計
  timeline?: {
    timestamp: Date;
    count: number;
    errorRate: number;
  }[];
  
  // パフォーマンス統計
  performance?: {
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  
  // エラー分析
  topErrors?: {
    message: string;
    count: number;
    lastOccurrence: Date;
  }[];
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  // 基本設定
  source: string;
  minLevel: LogLevel;
  
  // バッファリング
  bufferSize: number;
  flushInterval: number; // ミリ秒
  
  // ストレージ
  storage?: 'sqlite' | 'postgres' | 'memory';
  connectionString?: string;
  
  // 保持ポリシー
  retention?: {
    debug: number;  // 日数
    info: number;
    warn: number;
    error: number;
    critical: number;
  };
  
  // パフォーマンス
  enableMetrics?: boolean;
  enableStackTrace?: boolean;
  
  // フォーマット
  format?: 'json' | 'text';
  
  // フック
  onError?: (error: Error) => void;
  beforeLog?: (entry: LogEntry) => LogEntry | null;
}

/**
 * Storage adapter interface
 */
export interface ILogStorage {
  // 基本操作
  save(entries: LogEntry[]): Promise<void>;
  query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult>;
  count(filter: LogFilter): Promise<number>;
  delete(filter: LogFilter): Promise<number>;
  
  // 統計
  getStats(filter?: LogFilter): Promise<LogStats>;
  
  // メンテナンス
  cleanup(olderThan: Date): Promise<number>;
  vacuum(): Promise<void>;
  
  // ストリーミング
  stream?(filter: LogFilter): AsyncIterableIterator<LogEntry>;
}

/**
 * Log export formats
 */
export interface LogExportOptions {
  format: 'json' | 'csv' | 'txt';
  filter?: LogFilter;
  fields?: (keyof LogEntry)[];
  includeMetadata?: boolean;
}

/**
 * Real-time log subscription
 */
export interface LogSubscription {
  id: string;
  filter: LogFilter;
  callback: (log: LogEntry) => void;
  unsubscribe: () => void;
}

/**
 * Error specific log entry
 */
export interface ErrorLogEntry extends LogEntry {
  level: 'error' | 'critical';
  error: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
    cause?: unknown;
  };
}

/**
 * Performance log entry
 */
export interface PerformanceLogEntry extends LogEntry {
  performance: {
    duration: number;
    memory?: {
      used: number;
      total: number;
    };
    cpu?: number;
  };
}

/**
 * Batch operation result
 */
export interface BatchResult {
  success: number;
  failed: number;
  errors?: Error[];
}