/**
 * Unified Error Class Hierarchy
 * 
 * Base error classes for consistent error handling across the application.
 * All custom errors should extend from these base classes.
 */

import type { 
  ErrorDetails, 
  ValidationErrorDetails, 
  NetworkErrorDetails,
  DatabaseErrorDetails,
  AuthErrorDetails,
  RateLimitErrorDetails,
  ConfigurationErrorDetails,
  ValidationFieldError,
  ErrorCode 
} from '@/types/error.types';

/**
 * Base application error class
 * All application-specific errors should extend from this class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: ErrorDetails,
    isOperational: boolean = true
  ) {
    super(message);
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.isOperational = isOperational;
  }

  /**
   * Convert error to JSON-serializable format
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Convert to API response format
   */
  toApiResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      },
      metadata: {
        timestamp: this.timestamp.toISOString()
      }
    };
  }
}

/**
 * Validation error for request/data validation failures
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    details?: ErrorDetails
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { field, value, ...details }
    );
    
    this.field = field;
    this.value = value;
  }

  static fromZodError(zodError: { errors: Array<{ path: string[]; message: string; code: string }> }) {
    const errors: ValidationFieldError[] = zodError.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      constraints: [err.code],
      value: undefined
    }));

    return new ValidationError(
      'Validation failed',
      undefined,
      undefined,
      { errors }
    );
  }
}

/**
 * API error for external API failures
 */
export class ApiError extends AppError {
  public readonly endpoint?: string;
  public readonly method?: string;
  public readonly responseData?: unknown;

  constructor(
    message: string,
    code: string = 'API_ERROR',
    statusCode: number = 500,
    endpoint?: string,
    method?: string,
    responseData?: unknown,
    details?: ErrorDetails
  ) {
    super(
      message,
      code,
      statusCode,
      { endpoint, method, responseData, ...details }
    );
    
    this.endpoint = endpoint;
    this.method = method;
    this.responseData = responseData;
  }

  static fromResponse(
    response: Response,
    endpoint: string,
    method: string,
    responseData?: unknown
  ) {
    const statusCode = response.status;
    const statusText = response.statusText;
    
    let code = 'API_ERROR';
    let message = `API request failed: ${statusText}`;
    
    // Map common HTTP status codes to specific error codes
    switch (statusCode) {
      case 400:
        code = 'BAD_REQUEST';
        message = 'Bad request to external API';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        message = 'Unauthorized API request';
        break;
      case 403:
        code = 'FORBIDDEN';
        message = 'Forbidden API request';
        break;
      case 404:
        code = 'NOT_FOUND';
        message = 'API endpoint not found';
        break;
      case 429:
        code = 'RATE_LIMITED';
        message = 'API rate limit exceeded';
        break;
      case 503:
        code = 'SERVICE_UNAVAILABLE';
        message = 'External service unavailable';
        break;
    }
    
    return new ApiError(
      message,
      code,
      statusCode,
      endpoint,
      method,
      responseData
    );
  }
}

/**
 * Streaming error for SSE/WebSocket failures
 */
export class StreamingError extends AppError {
  public readonly streamType: 'sse' | 'websocket';
  public readonly streamId?: string;
  public readonly reconnectAttempt?: number;

  constructor(
    message: string,
    streamType: 'sse' | 'websocket',
    code: string = 'STREAMING_ERROR',
    streamId?: string,
    reconnectAttempt?: number,
    details?: NetworkErrorDetails
  ) {
    super(
      message,
      code,
      500,
      { streamType, streamId, reconnectAttempt, ...details }
    );
    
    this.streamType = streamType;
    this.streamId = streamId;
    this.reconnectAttempt = reconnectAttempt;
  }

  static connectionFailed(
    streamType: 'sse' | 'websocket',
    streamId?: string,
    reason?: string
  ) {
    return new StreamingError(
      `${streamType.toUpperCase()} connection failed${reason ? `: ${reason}` : ''}`,
      streamType,
      'CONNECTION_FAILED',
      streamId
    );
  }

  static parseError(
    streamType: 'sse' | 'websocket',
    streamId?: string,
    data?: unknown
  ) {
    return new StreamingError(
      `Failed to parse ${streamType.toUpperCase()} data`,
      streamType,
      'PARSE_ERROR',
      streamId,
      undefined,
      { data }
    );
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    details?: ErrorDetails
  ) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    resource?: string,
    action?: string,
    details?: ErrorDetails
  ) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      { resource, action, ...details }
    );
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  public readonly resource?: string;
  public readonly id?: string;

  constructor(
    resource?: string,
    id?: string,
    details?: ErrorDetails
  ) {
    const message = resource
      ? `${resource}${id ? ` with id ${id}` : ''} not found`
      : 'Resource not found';
    
    super(message, 'NOT_FOUND', 404, { resource, id, ...details });
    
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfter?: number;

  constructor(
    limit: number,
    windowMs: number,
    retryAfter?: number,
    details?: ErrorDetails
  ) {
    const retryAfterSeconds = retryAfter ? Math.ceil(retryAfter / 1000) : null;
    const message = `Rate limit exceeded. Limit: ${limit} requests per ${windowMs / 1000}s${
      retryAfterSeconds ? `. Retry after ${retryAfterSeconds}s` : ''
    }`;
    
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { limit, windowMs, retryAfter, ...details });
    
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfter = retryAfter;
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AppError {
  public readonly configKey?: string;

  constructor(
    message: string,
    configKey?: string,
    details?: ErrorDetails
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      500,
      { configKey, ...details },
      false // Not operational - indicates programmer error
    );
    
    this.configKey = configKey;
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name, stack: error.stack },
      false // Unknown errors are not operational
    );
  }
  
  return new AppError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    { originalError: String(error) },
    false // Unknown errors are not operational
  );
}

/**
 * Serialized error interface
 */
export interface SerializedError {
  name?: string;
  message?: string;
  code?: string;
  statusCode?: number;
  details?: ErrorDetails;
  timestamp?: Date | string;
  stack?: string;
  error?: string;
  originalError?: string;
}

/**
 * Error serializer for logging
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof AppError) {
    return error.toJSON();
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  
  return {
    error: String(error)
  };
}