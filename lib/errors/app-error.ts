/**
 * Custom application error class
 * Provides structured error handling with status codes and error codes
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: any): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400, details);
  }

  /**
   * Create an authentication error
   */
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 'UNAUTHORIZED', 401);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 'FORBIDDEN', 403);
  }

  /**
   * Create a not found error
   */
  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 'NOT_FOUND', 404);
  }

  /**
   * Create a conflict error
   */
  static conflict(message: string): AppError {
    return new AppError(message, 'CONFLICT', 409);
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(retryAfter?: number): AppError {
    return new AppError(
      'Too many requests',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfter }
    );
  }

  /**
   * Create an internal server error
   */
  static internal(message: string = 'Internal server error', details?: any): AppError {
    return new AppError(message, 'INTERNAL_ERROR', 500, details, false);
  }

  /**
   * Create a bad gateway error
   */
  static badGateway(message: string = 'Bad gateway'): AppError {
    return new AppError(message, 'BAD_GATEWAY', 502);
  }

  /**
   * Create a service unavailable error
   */
  static serviceUnavailable(message: string = 'Service unavailable'): AppError {
    return new AppError(message, 'SERVICE_UNAVAILABLE', 503);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Business logic errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ORDER_FAILED: 'ORDER_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXCHANGE_ERROR: 'EXCHANGE_ERROR',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];