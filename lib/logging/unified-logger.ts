/**
 * Unified Logger System
 * 
 * Integrates all three existing logging implementations into a single,
 * consistent, and powerful logging system with backward compatibility.
 */

// Conditional import to avoid env validation in tests
interface EnvConfig {
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  [key: string]: string | undefined;
}

let env: EnvConfig;
try {
  if (process.env.NODE_ENV === 'test') {
    env = {}; // Use empty env in tests
  } else {
    env = require('@/config/env').env as EnvConfig;
  }
} catch {
  env = {}; // Fallback to empty env
}

// Unified Types (combining all existing types)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface UnifiedLogEntry {
  // Core properties (from original logger)
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  environment: string;
  
  // Metadata and context (from enhanced loggers)
  meta?: Record<string, unknown>;
  error?: Error | unknown;
  
  // Enhanced properties
  source: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  stack?: string;
  duration?: number;
  tags?: string[];
}

export interface UnifiedLoggerConfig {
  // Basic configuration
  level: LogLevel;
  source: string;
  
  // Console transport configuration
  enableConsole: boolean;
  disableConsole?: boolean; // Backward compatibility
  
  // Throttling configuration  
  enableThrottling: boolean;
  throttleInterval: number;
  
  // Storage configuration
  enableStorage: boolean;
  storage: 'memory' | 'sqlite' | 'postgres';
  bufferSize: number;
  flushInterval: number;
  
  // Retention policy
  retention?: {
    debug: number;
    info: number;
    warn: number;
    error: number;
    critical: number;
  };
  
  // Advanced features
  enableMetrics: boolean;
  enableStackTrace: boolean;
  format: 'json' | 'text';
  
  // Hooks and callbacks
  onError?: (error: Error) => void;
  beforeLog?: (entry: UnifiedLogEntry) => UnifiedLogEntry | null;
}

export interface IUnifiedTransport {
  log(entry: UnifiedLogEntry): void | Promise<void>;
  configure?(config: Partial<UnifiedLoggerConfig>): void;
  close?(): Promise<void>;
}

export interface IUnifiedStorage {
  save(entries: UnifiedLogEntry[]): Promise<void>;
  query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult>;
  getStats(filter?: LogFilter): Promise<LogStats>;
  delete(filter: LogFilter): Promise<number>;
  close(): Promise<void>;
  init(): Promise<void>;
}

export interface LogFilter {
  level?: LogLevel | LogLevel[];
  source?: string | string[];
  timeRange?: {
    from: Date | string;
    to: Date | string;
  };
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  agentName?: string;
  toolName?: string;
  search?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  minDuration?: number;
  maxDuration?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: keyof UnifiedLogEntry;
  order?: 'asc' | 'desc';
}

export interface LogQueryResult {
  data: UnifiedLogEntry[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
  executionTime?: number;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  byAgent?: Record<string, number>;
  byTool?: Record<string, number>;
  timeline?: Array<{
    timestamp: Date;
    count: number;
    errorRate: number;
  }>;
  performance?: {
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
}

export interface LogSubscription {
  id: string;
  filter: LogFilter;
  callback: (log: UnifiedLogEntry) => void;
  unsubscribe: () => void;
}

// Log level hierarchy
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

// Safe environment variable access
function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined') {
    try {
      return process?.env?.[key];
    } catch {
      return undefined;
    }
  } else {
    try {
      return env?.[key] || process?.env?.[key];
    } catch {
      try {
        return process?.env?.[key];
      } catch {
        return undefined;
      }
    }
  }
}

// Get default log level
function getDefaultLogLevel(): LogLevel {
  const envLevel = getEnvVar('LOG_LEVEL')?.toLowerCase() as LogLevel;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  
  const nodeEnv = getEnvVar('NODE_ENV');
  const quietLogs = getEnvVar('QUIET_LOGS') === 'true';
  
  if (quietLogs) return 'warn';
  
  switch (nodeEnv) {
    case 'production': return 'warn';
    case 'test': return 'error';
    default: return 'debug';
  }
}

// Default configuration
const DEFAULT_CONFIG: UnifiedLoggerConfig = {
  level: getDefaultLogLevel(),
  source: 'cryptrade',
  enableConsole: getEnvVar('DISABLE_CONSOLE_LOGS') !== 'true',
  enableThrottling: getEnvVar('NODE_ENV') === 'production',
  throttleInterval: 5000,
  enableStorage: getEnvVar('NODE_ENV') !== 'test',
  storage: getEnvVar('NODE_ENV') === 'test' ? 'memory' : 'sqlite',
  bufferSize: 100,
  flushInterval: 5000,
  retention: {
    debug: 1,
    info: 7,
    warn: 30,
    error: 90,
    critical: 365,
  },
  enableMetrics: true,
  enableStackTrace: getEnvVar('NODE_ENV') !== 'production',
  format: 'json',
};

/**
 * Unified Logger Implementation
 */
export class UnifiedLogger {
  private config: UnifiedLoggerConfig;
  private transports: IUnifiedTransport[] = [];
  private storage?: IUnifiedStorage;
  private buffer: UnifiedLogEntry[] = [];
  private throttleMap = new Map<string, number>();
  private contextStack: Record<string, unknown>[] = [];
  private subscriptions = new Map<string, LogSubscription>();
  private flushTimer?: NodeJS.Timeout;
  private timers = new Map<string, number>();
  private initialized = false;
  private initPromise?: Promise<void>;

  constructor(config?: Partial<UnifiedLoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupFlushTimer();
  }

  /**
   * Initialize logger (async setup)
   */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._init();
    }
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    if (this.initialized) return;

    // Setup transports
    await this.setupTransports();
    
    // Setup storage
    if (this.config.enableStorage) {
      await this.setupStorage();
    }

    this.initialized = true;
  }

  private async setupTransports(): Promise<void> {
    // Console transport (always included for compatibility)
    if (this.config.enableConsole) {
      const { ConsoleTransport } = await import('./transports/console');
      this.transports.push(new ConsoleTransport(this.config));
    }

    // Additional transports based on environment
    const transportType = getEnvVar('LOG_TRANSPORT');
    if (transportType === 'sentry' || getEnvVar('ENABLE_SENTRY') === 'true') {
      const { SentryTransport } = await import('./transports/sentry');
      this.transports.push(new SentryTransport(this.config));
    }
  }

  private async setupStorage(): Promise<void> {
    const { createUnifiedStorage } = await import('./storage/factory');
    this.storage = await createUnifiedStorage(this.config);
    await this.storage.init();
  }

  private setupFlushTimer(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          console.error('[UnifiedLogger] Flush error:', error);
        });
      }, this.config.flushInterval);
    }
  }

  /**
   * Core logging methods
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    this.log('info', message, meta, error);
  }

  warn(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    this.log('warn', message, meta, error);
  }

  error(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    this.log('error', message, meta, error);
  }

  critical(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    this.log('critical', message, meta, error);
  }

  /**
   * Timer methods (backward compatibility)
   */
  time(label: string): void {
    if (!this.shouldLog('debug')) return;
    this.timers.set(label, Date.now());
  }

  timeEnd(label: string): void {
    if (!this.shouldLog('debug')) return;
    const start = this.timers.get(label);
    if (start) {
      const duration = Date.now() - start;
      this.timers.delete(label);
      this.debug(`Timer ${label}`, { duration });
    }
  }

  /**
   * Context management
   */
  pushContext(context: Record<string, unknown>): void {
    this.contextStack.push(context);
  }

  popContext(): void {
    this.contextStack.pop();
  }

  async withContext<T>(
    context: Record<string, unknown>,
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
   * Query and subscription methods
   */
  async query(filter: LogFilter, pagination?: PaginationOptions): Promise<LogQueryResult> {
    await this.ensureInitialized();
    if (!this.storage) {
      throw new Error('Storage not available');
    }
    return this.storage.query(filter, pagination);
  }

  async getStats(filter?: LogFilter): Promise<LogStats> {
    await this.ensureInitialized();
    if (!this.storage) {
      throw new Error('Storage not available');
    }
    return this.storage.getStats(filter);
  }

  subscribe(filter: LogFilter, callback: (log: UnifiedLogEntry) => void): LogSubscription {
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
   * Configuration methods
   */
  willLog(level: LogLevel): boolean {
    return this.shouldLog(level);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  clearThrottle(): void {
    this.throttleMap.clear();
  }

  /**
   * Cleanup and maintenance
   */
  async cleanup(): Promise<number> {
    await this.ensureInitialized();
    if (!this.storage || !this.config.retention) return 0;

    const now = new Date();
    let totalDeleted = 0;

    for (const [level, days] of Object.entries(this.config.retention)) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      
      const deleted = await this.storage.delete({
        level: level as LogLevel,
        timeRange: { from: new Date(0), to: cutoff },
      });
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
    
    if (this.storage) {
      await this.storage.close();
    }
    
    for (const transport of this.transports) {
      if (transport.close) {
        await transport.close();
      }
    }
  }

  /**
   * Private methods
   */
  private async log(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error | unknown): Promise<void> {
    if (!this.shouldLog(level)) return;

    const throttleKey = `${level}:${message}`;
    if (this.shouldThrottle(throttleKey)) return;

    const entry = this.createLogEntry(level, message, meta, error);
    
    // Apply beforeLog hook
    if (this.config.beforeLog) {
      const modified = this.config.beforeLog(entry);
      if (!modified) return;
      Object.assign(entry, modified);
    }

    // Log to transports (synchronous for console compatibility)
    this.logToTransports(entry);

    // Add to buffer for storage
    if (this.config.enableStorage) {
      this.buffer.push(entry);
      
      if (this.buffer.length >= this.config.bufferSize) {
        await this.flush();
      }
    }

    // Notify subscribers
    this.notifySubscribers(entry);
  }

  private createLogEntry(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error | unknown): UnifiedLogEntry {
    const entry: UnifiedLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      environment: getEnvVar('NODE_ENV') || 'development',
      source: this.config.source,
      meta: { ...this.getCurrentContext(), ...meta },
      error,
    };

    // Add context information
    const context = this.getCurrentContext();
    entry.correlationId = context.correlationId;
    entry.userId = context.userId;
    entry.sessionId = context.sessionId;
    entry.agentName = meta?.agentName || context.agentName;
    entry.toolName = meta?.toolName || context.toolName;
    entry.duration = meta?.duration;
    entry.tags = meta?.tags;

    // Add stack trace for errors
    if (this.config.enableStackTrace && (level === 'error' || level === 'critical')) {
      entry.stack = new Error().stack;
    }

    return entry;
  }

  private logToTransports(entry: UnifiedLogEntry): void {
    for (const transport of this.transports) {
      try {
        const result = transport.log(entry);
        // Handle async transports
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('[UnifiedLogger] Transport error:', error);
          });
        }
      } catch (error) {
        console.error('[UnifiedLogger] Transport error:', error);
      }
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.enableStorage) return;

    await this.ensureInitialized();
    if (!this.storage) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.storage.save(entries);
    } catch (error) {
      // Restore buffer on error
      this.buffer.unshift(...entries);
      
      if (this.config.onError) {
        this.config.onError(error as Error);
      } else {
        console.error('[UnifiedLogger] Storage flush error:', error);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private shouldThrottle(key: string): boolean {
    if (!this.config.enableThrottling) return false;
    
    const now = Date.now();
    const lastLog = this.throttleMap.get(key);
    
    if (!lastLog || now - lastLog > this.config.throttleInterval) {
      this.throttleMap.set(key, now);
      return false;
    }
    
    return true;
  }

  private getCurrentContext(): Record<string, unknown> {
    return this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {});
  }

  private notifySubscribers(entry: UnifiedLogEntry): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(entry, subscription.filter)) {
        try {
          subscription.callback(entry);
        } catch (error) {
          console.error('[UnifiedLogger] Subscriber error:', error);
        }
      }
    }
  }

  private matchesFilter(entry: UnifiedLogEntry, filter: LogFilter): boolean {
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}

/**
 * Create logger with configuration
 */
export function createUnifiedLogger(config?: Partial<UnifiedLoggerConfig>): UnifiedLogger {
  return new UnifiedLogger(config);
}

/**
 * Default logger instance
 */
export const unifiedLogger = createUnifiedLogger();

// Auto-initialize in non-test environments
if (getEnvVar('NODE_ENV') !== 'test') {
  unifiedLogger.init().catch(error => {
    console.error('[UnifiedLogger] Initialization failed:', error);
  });
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await unifiedLogger.close();
  });
}