import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  timestamp?: string;
}

/**
 * Create a standardized error response
 */
export function createApiErrorResponse(
  error: string | Error,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Log error
  if (status >= 500) {
    logger.error('[API Error]', {
      error: errorMessage,
      status,
      details,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    logger.warn('[API Warning]', {
      error: errorMessage,
      status,
      details,
    });
  }
  
  return NextResponse.json<ApiErrorResponse>(
    {
      error: errorMessage,
      message: status === 500 
        ? 'An error occurred while processing your request.' 
        : errorMessage,
      timestamp: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

/**
 * Create a standardized success response
 */
export function createApiSuccessResponse<T = unknown>(
  data?: T,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json<ApiSuccessResponse<T>>(
    {
      success: true,
      ...(data !== undefined && { data }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Handle common errors in API routes
 */
export function handleApiError(error: unknown, defaultMessage: string): NextResponse<ApiErrorResponse> {
  if (error instanceof z.ZodError) {
    return createApiErrorResponse(
      'Invalid request data',
      400,
      error.flatten()
    );
  }
  
  if (error instanceof Error) {
    // Check for common database errors
    if (error.message.includes('P2002')) {
      return createApiErrorResponse('Resource already exists', 409);
    }
    if (error.message.includes('P2025')) {
      return createApiErrorResponse('Resource not found', 404);
    }
    
    return createApiErrorResponse(error, 500);
  }
  
  return createApiErrorResponse(defaultMessage, 500);
}

/**
 * Validate request method
 */
export function validateMethod(
  request: Request,
  allowedMethods: string[]
): NextResponse<ApiErrorResponse> | null {
  if (!allowedMethods.includes(request.method)) {
    return createApiErrorResponse(
      `Method ${request.method} not allowed`,
      405
    );
  }
  return null;
}

/**
 * Parse and validate query parameters
 */
export function parseQueryParams<T>(
  request: Request,
  schema: z.ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse<ApiErrorResponse> } {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  try {
    const data = schema.parse(params);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: createApiErrorResponse(
          'Invalid query parameters',
          400,
          error.flatten()
        ),
      };
    }
    throw error;
  }
}

/**
 * Parse and validate request body
 */
export async function parseRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: createApiErrorResponse(
          'Invalid request data',
          400,
          error.flatten()
        ),
      };
    }
    if (error instanceof SyntaxError) {
      return {
        data: null,
        error: createApiErrorResponse('Invalid JSON in request body', 400),
      };
    }
    throw error;
  }
}