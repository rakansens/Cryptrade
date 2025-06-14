/**
 * Global Error Boundary for API Routes
 * 
 * Provides centralized error handling for all API endpoints
 * with consistent error responses and logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  AppError,
  isAppError,
  isOperationalError,
  toAppError,
  serializeError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ConfigurationError
} from '@/lib/errors';
import { enhancedLogger as logger } from '@/lib/logging';
import { env } from '@/config/env';
import type { ApiHandler, ApiHandlerContext, ErrorDetails } from '@/lib/api/types';


/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    requestId?: string;
    path?: string;
    method?: string;
  };
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get client info from request
 */
function getClientInfo(request: NextRequest) {
  return {
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    referer: request.headers.get('referer') || 'direct'
  };
}

/**
 * Create error response
 */
function createErrorResponse(
  error: AppError,
  requestId: string,
  request: NextRequest
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      // Only include details in development or for operational errors
      ...(env.NODE_ENV === 'development' || error.isOperational
        ? { details: error.details }
        : {})
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId,
      path: request.nextUrl.pathname,
      method: request.method
    }
  };

  // Set appropriate headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Request-Id': requestId
  });

  // Add rate limit headers if applicable
  if (error instanceof RateLimitError) {
    headers.set('X-RateLimit-Limit', error.limit.toString());
    headers.set('X-RateLimit-Window', (error.windowMs / 1000).toString());
    if (error.retryAfter) {
      headers.set('Retry-After', Math.ceil(error.retryAfter / 1000).toString());
    }
  }

  return NextResponse.json(response, {
    status: error.statusCode,
    headers
  });
}

/**
 * Log error with context
 */
function logError(
  error: AppError,
  requestId: string,
  request: NextRequest,
  duration: number
) {
  const clientInfo = getClientInfo(request);
  const errorData = serializeError(error);

  const logContext = {
    requestId,
    path: request.nextUrl.pathname,
    method: request.method,
    statusCode: error.statusCode,
    duration,
    client: clientInfo,
    error: errorData,
    operational: error.isOperational
  };

  // Use appropriate log level based on error type
  if (!error.isOperational || error.statusCode >= 500) {
    logger.error('API Error', error, logContext);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', logContext);
  } else {
    logger.info('Handled Error', logContext);
  }
}

/**
 * Handle uncaught errors
 */
function handleUncaughtError(
  error: unknown,
  requestId: string,
  request: NextRequest
): NextResponse<ErrorResponse> {
  const appError = toAppError(error);
  
  // Always log uncaught errors as critical
  logger.error('Uncaught API Error', error as Error, {
    requestId,
    path: request.nextUrl.pathname,
    method: request.method,
    stack: error instanceof Error ? error.stack : undefined
  });

  // In production, return generic error for non-operational errors
  if (env.NODE_ENV === 'production' && !appError.isOperational) {
    const genericError = new AppError(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
    return createErrorResponse(genericError, requestId, request);
  }

  return createErrorResponse(appError, requestId, request);
}

/**
 * Error boundary wrapper for API handlers
 * 
 * @param handler - The API handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorBoundary<T = unknown>(
  handler: ApiHandler<NextRequest, T>
): ApiHandler<NextRequest, T> {
  return async (request: NextRequest, context?: ApiHandlerContext) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      // Add request ID to headers for tracing
      const response = await handler(request, context);
      
      // Add request ID to successful responses
      response.headers.set('X-Request-Id', requestId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (isAppError(error)) {
        logError(error, requestId, request, duration);
        return createErrorResponse(error, requestId, request);
      }

      return handleUncaughtError(error, requestId, request);
    }
  };
}

/**
 * Async error boundary for streaming responses
 */
export function withStreamingErrorBoundary<T = unknown>(
  handler: ApiHandler<NextRequest, T>
): ApiHandler<NextRequest, T> {
  return async (request: NextRequest, context?: ApiHandlerContext) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      const response = await handler(request, context);
      
      // For streaming responses, we need to wrap the stream
      if (response.body && typeof response.body === 'object' && 'getReader' in response.body) {
        const originalBody = response.body;
        const encoder = new TextEncoder();
        
        const wrappedStream = new ReadableStream({
          async start(controller) {
            const reader = originalBody.getReader();
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
            } catch (error) {
              const duration = Date.now() - startTime;
              const appError = isAppError(error) ? error : toAppError(error);
              
              logError(appError, requestId, request, duration);
              
              // Send error as SSE event
              const errorEvent = `event: error\ndata: ${JSON.stringify({
                code: appError.code,
                message: appError.message
              })}\n\n`;
              
              controller.enqueue(encoder.encode(errorEvent));
              controller.close();
            }
          }
        });

        return new NextResponse(wrappedStream, {
          headers: {
            ...Object.fromEntries(response.headers),
            'X-Request-Id': requestId
          },
          status: response.status
        });
      }

      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (isAppError(error)) {
        logError(error, requestId, request, duration);
        return createErrorResponse(error, requestId, request);
      }

      return handleUncaughtError(error, requestId, request);
    }
  };
}

/**
 * Validation wrapper for request bodies
 */
interface ValidationSchema<T> {
  parse?: (data: unknown) => T;
}

type ValidationFunction<T> = (data: unknown) => Promise<{ valid: boolean; message?: string; field?: string; value?: unknown; details?: Record<string, unknown> }>;

export function withValidation<T = unknown>(
  schema: ValidationSchema<T> | ValidationFunction<T>,
  handler: (data: T, request: NextRequest, context?: ApiHandlerContext) => Promise<NextResponse>
): ApiHandler<NextRequest, unknown> {
  return withErrorBoundary(async (request: NextRequest, context?: ApiHandlerContext) => {
    let body: unknown;
    
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body');
    }

    // Handle Zod schema
    if (schema.parse) {
      try {
        const validatedData = schema.parse(body);
        return await handler(validatedData, request, context);
      } catch (error) {
        throw ValidationError.fromZodError(error);
      }
    }

    // Handle custom validation function
    if (typeof schema === 'function') {
      const validationResult = await schema(body);
      if (!validationResult.valid) {
        throw new ValidationError(
          validationResult.message || 'Validation failed',
          validationResult.field,
          validationResult.value,
          validationResult.details
        );
      }
      return await handler(body, request, context);
    }

    throw new ConfigurationError('Invalid validation schema provided');
  });
}

/**
 * Authentication required wrapper
 */
export function withAuth<T = unknown, TAuth = unknown>(
  authHandler: (request: NextRequest) => Promise<TAuth | null>,
  handler: (request: NextRequest, context?: ApiHandlerContext, auth?: TAuth) => Promise<NextResponse<T>>
): ApiHandler<NextRequest, T> {
  return withErrorBoundary(async (request: NextRequest, context?: ApiHandlerContext) => {
    try {
      const auth = await authHandler(request);
      if (!auth) {
        throw new AuthenticationError();
      }
      return await handler(request, context, auth);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        throw error;
      }
      throw new AuthenticationError('Authentication failed');
    }
  });
}

/**
 * Combined middleware wrapper
 */
export function withMiddleware<T = unknown>(
  middlewares: Array<(request: NextRequest, context?: ApiHandlerContext) => Promise<NextResponse | ApiHandlerContext | void>>,
  handler: ApiHandler<NextRequest, T>
): ApiHandler<NextRequest, T> {
  return withErrorBoundary(async (request: NextRequest, context?: ApiHandlerContext) => {
    // Execute middlewares in sequence
    for (const middleware of middlewares) {
      const result = await middleware(request, context);
      // If middleware returns a response, short-circuit
      if (result instanceof NextResponse) {
        return result;
      }
      // Otherwise, pass result to next middleware/handler
      context = { ...context, ...result };
    }
    
    return await handler(request, context);
  });
}

/**
 * Error recovery wrapper for graceful degradation
 */
export function withFallback<T = unknown>(
  handler: ApiHandler<NextRequest, T>,
  fallbackHandler: (error: AppError, request: NextRequest, context?: ApiHandlerContext) => Promise<NextResponse<T>>
): ApiHandler<NextRequest, T> {
  return async (request: NextRequest, context?: ApiHandlerContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      const appError = isAppError(error) ? error : toAppError(error);
      
      try {
        return await fallbackHandler(appError, request, context);
      } catch (fallbackError) {
        // If fallback also fails, use error boundary
        throw appError;
      }
    }
  };
}

// Re-export error classes for convenience
export * from '@/lib/errors';