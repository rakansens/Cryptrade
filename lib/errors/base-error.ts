/**
 * Enhanced Error Handling with MastraBaseError
 * 
 * Type-safe error handling with proper error tracking and context
 */

import { logger } from '@/lib/utils/logger';

/**
 * Base error class for all Mastra-related errors
 * Provides type-safe error handling with context and metadata
 */
export class MastraBaseError<
  TData = unknown,
  TContext = unknown
> extends Error {
  // Error metadata
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly correlationId?: string;
  
  // Type-safe data and context
  public readonly data?: TData;
  public readonly context?: TContext;
  
  // Error categorization
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  
  // Retry information
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    options: MastraErrorOptions<TData, TContext>
  ) {
    super(message);
    this.name = options.name || this.constructor.name;
    this.code = options.code;
    this.timestamp = new Date();
    this.correlationId = options.correlationId;
    this.data = options.data;
    this.context = options.context;
    this.category = options.category || 'UNKNOWN';
    this.severity = options.severity || 'ERROR';
    this.retryable = options.retryable || false;
    this.retryAfter = options.retryAfter;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to a serializable format
   */
  toJSON(): SerializedError<TData, TContext> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      data: this.data,
      context: this.context,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      stack: this.stack,
    };
  }

  /**
   * Log the error with appropriate severity
   */
  log(): void {
    const errorDetails = this.toJSON();
    
    switch (this.severity) {
      case 'WARNING':
        logger.warn(this.message, errorDetails);
        break;
      case 'ERROR':
        logger.error(this.message, errorDetails);
        break;
      case 'CRITICAL':
        logger.error(`[CRITICAL] ${this.message}`, errorDetails);
        break;
      default:
        logger.info(this.message, errorDetails);
    }
  }
}

/**
 * Error categories for better organization
 */
export type ErrorCategory = 
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'AGENT_ERROR'
  | 'TOOL_ERROR'
  | 'WORKFLOW_ERROR'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'UNKNOWN';

/**
 * Error severity levels
 */
export type ErrorSeverity = 
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

/**
 * Options for creating MastraBaseError
 */
export interface MastraErrorOptions<TData = unknown, TContext = unknown> {
  name?: string;
  code: string;
  correlationId?: string;
  data?: TData;
  context?: TContext;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * Serialized error format
 */
export interface SerializedError<TData = unknown, TContext = unknown> {
  name: string;
  message: string;
  code: string;
  timestamp: string;
  correlationId?: string;
  data?: TData;
  context?: TContext;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  retryAfter?: number;
  stack?: string;
}

/**
 * Specific error classes
 */

// API関連エラー
export class ApiError extends MastraBaseError {
  constructor(
    message: string,
    statusCode: number,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: `API_${statusCode}`,
      category: 'API_ERROR',
      data: { statusCode },
      retryable: statusCode >= 500 || statusCode === 429,
      ...options,
    });
  }
}

// エージェントエラー
export class AgentError extends MastraBaseError {
  constructor(
    message: string,
    agentName: string,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: 'AGENT_EXECUTION_ERROR',
      category: 'AGENT_ERROR',
      data: { agentName },
      ...options,
    });
  }
}

// ツールエラー
export class ToolError extends MastraBaseError {
  constructor(
    message: string,
    toolName: string,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: 'TOOL_EXECUTION_ERROR',
      category: 'TOOL_ERROR',
      data: { toolName },
      ...options,
    });
  }
}

// バリデーションエラー
export class ValidationError extends MastraBaseError {
  constructor(
    message: string,
    field: string,
    value: unknown,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      category: 'VALIDATION_ERROR',
      data: { field, value },
      severity: 'WARNING',
      ...options,
    });
  }
}

// レート制限エラー
export class RateLimitError extends MastraBaseError {
  constructor(
    message: string,
    retryAfter: number,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      category: 'RATE_LIMIT_ERROR',
      retryable: true,
      retryAfter,
      severity: 'WARNING',
      ...options,
    });
  }
}

// 認証エラー
export class AuthError extends MastraBaseError {
  constructor(
    message: string,
    options?: Partial<MastraErrorOptions>
  ) {
    super(message, {
      code: 'AUTH_ERROR',
      category: 'AUTH_ERROR',
      severity: 'ERROR',
      retryable: false,
      ...options,
    });
  }
}