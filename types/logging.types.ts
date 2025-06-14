/**
 * Type definitions for logging system
 */

// ===== Core Types =====

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogMetadata {
  [key: string]: unknown;
  error?: Error | unknown;
  stackTrace?: string;
  timestamp?: number;
  agentName?: string;
  toolName?: string;
  operationName?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  status?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

export interface StructuredLogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: LogMetadata;
  category?: string;
  source?: string;
}

// ===== Error Types =====

export interface ErrorMetadata extends LogMetadata {
  errorCode?: string;
  errorType?: string;
  errorMessage?: string;
  errorStack?: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
}

// ===== Performance Types =====

export interface PerformanceMetadata extends LogMetadata {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metrics?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  databaseQueryTime?: number;
  apiCallTime?: number;
  [key: string]: number | undefined;
}

// ===== Agent Logging Types =====

export interface AgentLogMetadata extends LogMetadata {
  agentName: string;
  agentId?: string;
  agentVersion?: string;
  taskId?: string;
  taskType?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ===== Tool Logging Types =====

export interface ToolLogMetadata extends LogMetadata {
  toolName: string;
  toolId?: string;
  toolVersion?: string;
  executionId?: string;
  input?: unknown;
  output?: unknown;
  executionTime?: number;
  retries?: number;
  cacheHit?: boolean;
}

// ===== Network Logging Types =====

export interface NetworkLogMetadata extends LogMetadata {
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  requestSize?: number;
  responseSize?: number;
  headers?: Record<string, string>;
  retryCount?: number;
  errorDetails?: unknown;
}

// ===== Database Logging Types =====

export interface DatabaseLogMetadata extends LogMetadata {
  operation?: string;
  table?: string;
  query?: string;
  parameters?: unknown[];
  rowsAffected?: number;
  executionTime?: number;
  connectionId?: string;
  transactionId?: string;
}

// ===== Logger Configuration Types =====

export interface LoggerConfig {
  level: LogLevel;
  format?: 'json' | 'text' | 'pretty';
  output?: 'console' | 'file' | 'both';
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableMetadata?: boolean;
  metadataFilter?: (metadata: LogMetadata) => LogMetadata;
  messageFilter?: (message: string) => string;
}

// ===== Logger Interface =====

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  critical(message: string, metadata?: LogMetadata): void;
  
  // Specialized logging methods
  logPerformance(operationName: string, duration: number, metadata?: PerformanceMetadata): void;
  logError(error: Error | unknown, message: string, metadata?: ErrorMetadata): void;
  logNetwork(method: string, url: string, metadata?: NetworkLogMetadata): void;
  logDatabase(operation: string, table: string, metadata?: DatabaseLogMetadata): void;
  
  // Child logger creation
  createChild(category: string): Logger;
  withMetadata(defaultMetadata: LogMetadata): Logger;
  
  // Configuration
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

// ===== Type Guards =====

export function isLogMetadata(value: unknown): value is LogMetadata {
  return typeof value === 'object' && value !== null;
}

export function isError(value: unknown): value is Error {
  return value instanceof Error || (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'stack' in value
  );
}

export function isPerformanceMetadata(metadata: LogMetadata): metadata is PerformanceMetadata {
  return (
    'operationName' in metadata &&
    'startTime' in metadata &&
    'endTime' in metadata &&
    'duration' in metadata
  );
}

export function isAgentLogMetadata(metadata: LogMetadata): metadata is AgentLogMetadata {
  return 'agentName' in metadata;
}

export function isToolLogMetadata(metadata: LogMetadata): metadata is ToolLogMetadata {
  return 'toolName' in metadata;
}