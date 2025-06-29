import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/errors/app-error';

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  request?: NextRequest
): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString();
  const path = request?.url ? new URL(request.url).pathname : undefined;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      path,
      errors: error.errors,
    });

    return NextResponse.json<ErrorResponse>(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
          timestamp,
          path,
        },
      },
      { status: 400 }
    );
  }

  // Handle AppError (custom application errors)
  if (error instanceof AppError) {
    logger.error('Application error', {
      path,
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return NextResponse.json<ErrorResponse>(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          timestamp,
          path,
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle standard errors
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Unauthorized')) {
      logger.warn('Unauthorized access attempt', { path });
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
            timestamp,
            path,
          },
        },
        { status: 401 }
      );
    }

    if (error.message.includes('Not found')) {
      logger.warn('Resource not found', { path });
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            message: 'Resource not found',
            code: 'NOT_FOUND',
            timestamp,
            path,
          },
        },
        { status: 404 }
      );
    }

    // Generic error
    logger.error('Unhandled error', {
      path,
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json<ErrorResponse>(
      {
        error: {
          message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
          code: 'INTERNAL_ERROR',
          timestamp,
          path,
        },
      },
      { status: statusCode }
    );
  }

  // Handle unknown errors
  logger.error('Unknown error type', {
    path,
    error: String(error),
  });

  return NextResponse.json<ErrorResponse>(
    {
      error: {
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        timestamp,
        path,
      },
    },
    { status: 500 }
  );
}

/**
 * Error handler middleware wrapper
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse<ErrorResponse>> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Find NextRequest in args
      const request = args.find((arg): arg is NextRequest => 
        arg && typeof arg === 'object' && 'url' in arg && 'method' in arg
      );
      
      return createErrorResponse(error, 500, request) as any;
    }
  };
}

/**
 * Async handler wrapper with error handling
 */
export function asyncHandler<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return withErrorHandler(handler);
}

/**
 * Extract error details for logging
 */
export function extractErrorDetails(error: unknown): Record<string, any> {
  if (error instanceof ZodError) {
    return {
      type: 'validation',
      errors: error.errors,
    };
  }

  if (error instanceof AppError) {
    return {
      type: 'application',
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      type: 'error',
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: 'unknown',
    value: String(error),
  };
}