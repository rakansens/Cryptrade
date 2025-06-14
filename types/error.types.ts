/**
 * Type definitions for error handling system
 */

// ===== Error Details Types =====

export interface ErrorDetails {
  [key: string]: unknown;
  context?: string;
  originalError?: unknown;
  metadata?: Record<string, unknown>;
  timestamp?: string | Date;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

export interface ValidationErrorDetails extends ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  validationErrors?: ValidationFieldError[];
}

export interface ValidationFieldError {
  field: string;
  value: unknown;
  constraints: string[];
  message: string;
}

export interface NetworkErrorDetails extends ErrorDetails {
  url?: string;
  method?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  responseBody?: unknown;
  requestBody?: unknown;
  timeout?: number;
  retryCount?: number;
}

export interface DatabaseErrorDetails extends ErrorDetails {
  query?: string;
  table?: string;
  operation?: string;
  constraint?: string;
  sqlState?: string;
  databaseError?: unknown;
}

export interface AuthErrorDetails extends ErrorDetails {
  userId?: string;
  action?: string;
  resource?: string;
  requiredPermission?: string;
  actualPermissions?: string[];
  authMethod?: string;
}

export interface RateLimitErrorDetails extends ErrorDetails {
  limit?: number;
  current?: number;
  resetTime?: Date;
  retryAfter?: number;
  endpoint?: string;
  identifier?: string;
}

export interface FileSystemErrorDetails extends ErrorDetails {
  path?: string;
  operation?: string;
  permissions?: string;
  errorCode?: string;
  systemError?: unknown;
}

export interface ConfigurationErrorDetails extends ErrorDetails {
  configKey?: string;
  expectedType?: string;
  actualType?: string;
  validValues?: unknown[];
  configPath?: string;
}

// ===== Error Response Types =====

export interface ErrorResponse {
  error: {
    name: string;
    message: string;
    code: string;
    statusCode: number;
    details?: ErrorDetails;
    timestamp: string | Date;
    stack?: string;
    requestId?: string;
  };
}

export interface APIErrorResponse extends ErrorResponse {
  error: ErrorResponse['error'] & {
    endpoint?: string;
    method?: string;
    apiVersion?: string;
  };
}

// ===== Error Handler Types =====

export type ErrorHandler<T extends Error = Error> = (
  error: T,
  context?: ErrorHandlerContext
) => void | Promise<void>;

export interface ErrorHandlerContext {
  request?: unknown;
  response?: unknown;
  user?: unknown;
  correlationId?: string;
  [key: string]: unknown;
}

// ===== Error Recovery Types =====

export interface ErrorRecoveryStrategy<T = unknown> {
  canRecover: (error: Error) => boolean;
  recover: (error: Error) => T | Promise<T>;
  maxRetries?: number;
  retryDelay?: number;
}

// ===== Type Guards =====

export function isErrorDetails(value: unknown): value is ErrorDetails {
  return typeof value === 'object' && value !== null;
}

export function isValidationErrorDetails(details: ErrorDetails): details is ValidationErrorDetails {
  return 'field' in details || 'validationErrors' in details;
}

export function isNetworkErrorDetails(details: ErrorDetails): details is NetworkErrorDetails {
  return 'url' in details || 'statusCode' in details;
}

export function isDatabaseErrorDetails(details: ErrorDetails): details is DatabaseErrorDetails {
  return 'query' in details || 'table' in details || 'sqlState' in details;
}

export function isAuthErrorDetails(details: ErrorDetails): details is AuthErrorDetails {
  return 'requiredPermission' in details || 'authMethod' in details;
}

export function isRateLimitErrorDetails(details: ErrorDetails): details is RateLimitErrorDetails {
  return 'limit' in details && 'resetTime' in details;
}

// ===== Error Code Constants =====

export const ErrorCodes = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Auth errors
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Rate limit errors
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Business logic errors
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];