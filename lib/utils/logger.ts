// Transport-agnostic logger utility with DI support
// NOTE: This file is used in both client and server environments
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableThrottling: boolean;
  throttleInterval: number; // milliseconds
}

// Transport interfaces
interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  error?: Error | unknown;
  timestamp: Date;
  environment: string;
}

interface ILogTransport {
  log(entry: LogEntry): void;
  configure?(config: Record<string, unknown>): void;
}

interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void;
  warn(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void;
  error(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void;
  time(label: string): void;
  timeEnd(label: string): void;
  willLog(level: LogLevel): boolean;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  clearThrottle(): void;
}

// Log level hierarchy (lower number = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Safe environment variable access for client/server compatibility
function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined') {
    // Browser environment - only access process.env for public variables
    try {
      return process?.env?.[key];
    } catch {
      return undefined;
    }
  } else {
    // Server environment - can access all environment variables
    try {
      // Try to use the centralized env config
      const { env } = require('@/config/env');
      return env?.[key];
    } catch {
      // Fallback to process.env if env config fails
      try {
        return process?.env?.[key];
      } catch {
        return undefined;
      }
    }
  }
}

// Get log level from environment
function getLogLevel(): LogLevel {
  const envLevel = getEnvVar('LOG_LEVEL')?.toLowerCase() as LogLevel;
  return envLevel && envLevel in LOG_LEVELS ? envLevel : getDefaultLogLevel();
}

function getDefaultLogLevel(): LogLevel {
  const nodeEnv = getEnvVar('NODE_ENV');
  const quietLogs = getEnvVar('QUIET_LOGS') === 'true';
  
  if (quietLogs) {
    return 'warn'; // Only show warnings and errors when quiet mode is on
  }
  
  switch (nodeEnv) {
    case 'production':
      return 'warn';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
}

// Logger configuration
const config: LoggerConfig = {
  level: getLogLevel(),
  enableConsole: getEnvVar('DISABLE_CONSOLE_LOGS') !== 'true',
  enableThrottling: getEnvVar('NODE_ENV') === 'production',
  throttleInterval: 5000, // 5 seconds in production
};

// Throttling mechanism to prevent log spam
const throttleMap = new Map<string, number>();

function shouldThrottle(key: string): boolean {
  if (!config.enableThrottling) return false;
  
  const now = Date.now();
  const lastLog = throttleMap.get(key);
  
  if (!lastLog || now - lastLog > config.throttleInterval) {
    throttleMap.set(key, now);
    return false;
  }
  
  return true;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

// Transport implementations
class ConsoleTransport implements ILogTransport {
  private enableConsole: boolean;

  constructor(enableConsole: boolean = true) {
    this.enableConsole = enableConsole;
  }

  configure(config: { enableConsole: boolean }) {
    this.enableConsole = config.enableConsole;
  }

  log(entry: LogEntry): void {
    if (!this.enableConsole) return;
    
    const formatted = this.formatMessage(entry);
    const errorObj = entry.error ? this.serializeError(entry.error) : undefined;
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted, errorObj);
        break;
      case 'info':
        console.log(formatted, errorObj);
        break;
      case 'warn':
        console.warn(formatted, errorObj);
        break;
      case 'error':
        console.error(formatted, errorObj);
        break;
    }
  }

  private serializeError(error: Error | unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: getEnvVar('NODE_ENV') === 'development' ? error.stack : undefined,
        ...Object.getOwnPropertyNames(error).reduce((acc, prop) => {
          if (!['name', 'message', 'stack'].includes(prop)) {
            acc[prop] = (error as Record<string, unknown>)[prop];
          }
          return acc;
        }, {} as Record<string, unknown>)
      };
    }
    return error;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    let formatted = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.environment}] ${entry.message}`;
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      try {
        formatted += ` ${JSON.stringify(entry.meta, this.errorReplacer)}`;
      } catch (e) {
        formatted += ` ${JSON.stringify({ error: 'Failed to serialize metadata' })}`;
      }
    }
    
    return formatted;
  }

  private errorReplacer(key: string, value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: getEnvVar('NODE_ENV') === 'development' ? value.stack : undefined,
        ...Object.getOwnPropertyNames(value).reduce((acc, prop) => {
          if (!['name', 'message', 'stack'].includes(prop)) {
            acc[prop] = (value as Record<string, unknown>)[prop];
          }
          return acc;
        }, {} as Record<string, unknown>)
      };
    }
    return value;
  }
}

class NoopTransport implements ILogTransport {
  log(_entry: LogEntry): void {
    // Do nothing - useful for testing or disabling logs
  }
}

class SentryTransport implements ILogTransport {
  private sentryEnabled: boolean;

  constructor(sentryEnabled: boolean = false) {
    this.sentryEnabled = sentryEnabled;
  }

  configure(config: { sentryEnabled: boolean }) {
    this.sentryEnabled = config.sentryEnabled;
  }

  log(entry: LogEntry): void {
    if (!this.sentryEnabled) return;
    
    // Stub implementation - would integrate with actual Sentry SDK
    if (entry.level === 'error' && entry.error) {
      // In real implementation:
      // Sentry.captureException(entry.error, { 
      //   extra: entry.meta, 
      //   tags: { message: entry.message, environment: entry.environment } 
      // });
      console.warn('[SENTRY STUB] Would send to Sentry:', {
        message: entry.message,
        error: entry.error,
        meta: entry.meta,
        level: entry.level
      });
    }
  }
}

// Core Logger implementation
class Logger implements ILogger {
  private transports: ILogTransport[];
  private config: LoggerConfig;
  private throttleMap = new Map<string, number>();

  constructor(transports: ILogTransport[], config: LoggerConfig) {
    this.transports = transports;
    this.config = config;
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

  private createLogEntry(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error | unknown): LogEntry {
    return {
      level,
      message,
      meta,
      error,
      timestamp: new Date(),
      environment: getEnvVar('NODE_ENV') || 'development'
    };
  }

  private logToTransports(entry: LogEntry): void {
    this.transports.forEach(transport => {
      try {
        transport.log(entry);
      } catch (error) {
        // Fallback to console if transport fails
        console.error('Transport failed:', error);
      }
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    
    const throttleKey = `debug:${message}`;
    if (this.shouldThrottle(throttleKey)) return;
    
    const entry = this.createLogEntry('debug', message, meta);
    this.logToTransports(entry);
  }

  info(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    if (!this.shouldLog('info')) return;
    
    const throttleKey = `info:${message}`;
    if (this.shouldThrottle(throttleKey)) return;
    
    const entry = this.createLogEntry('info', message, meta, error);
    this.logToTransports(entry);
  }

  warn(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, meta, error);
    this.logToTransports(entry);
  }

  error(message: string, meta?: Record<string, unknown>, error?: Error | unknown): void {
    if (!this.shouldLog('error')) return;
    
    const entry = this.createLogEntry('error', message, meta, error);
    this.logToTransports(entry);
  }

  time(label: string): void {
    if (!this.shouldLog('debug')) return;
    console.time(label);
  }

  timeEnd(label: string): void {
    if (!this.shouldLog('debug')) return;
    console.timeEnd(label);
  }

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
}

// Logger factory with DI
function createLogger(): ILogger {
  const config: LoggerConfig = {
    level: getLogLevel(),
    enableConsole: getEnvVar('DISABLE_CONSOLE_LOGS') !== 'true',
    enableThrottling: getEnvVar('NODE_ENV') === 'production',
    throttleInterval: 5000,
  };

  const transports: ILogTransport[] = [];

  // Configure transports based on environment variables
  const transportType = getEnvVar('LOG_TRANSPORT') || 'console';
  
  switch (transportType) {
    case 'console':
      transports.push(new ConsoleTransport(config.enableConsole));
      break;
    case 'noop':
      transports.push(new NoopTransport());
      break;
    case 'sentry':
      transports.push(new SentryTransport(true));
      // Also add console in production for debugging
      if (getEnvVar('NODE_ENV') === 'production') {
        transports.push(new ConsoleTransport(config.enableConsole));
      }
      break;
    case 'multi':
      // Multiple transports for production
      transports.push(new ConsoleTransport(config.enableConsole));
      if (getEnvVar('ENABLE_SENTRY') === 'true') {
        transports.push(new SentryTransport(true));
      }
      break;
    default:
      transports.push(new ConsoleTransport(config.enableConsole));
  }

  return new Logger(transports, config);
}

// Main logger instance
export const logger = createLogger();

// Export types and classes for external use and testing
export type { LogLevel, LoggerConfig, ILogger, ILogTransport, LogEntry };
export { ConsoleTransport, NoopTransport, SentryTransport, Logger, createLogger };