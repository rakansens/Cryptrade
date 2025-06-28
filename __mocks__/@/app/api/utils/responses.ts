// Mock for app/api/utils/responses.ts
// Fixed: Match actual structure with unified response patterns

import { NextResponse } from 'next/server';
import { z } from 'zod';

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
 * Create a standardized error response (Mock)
 * Unified with lib/api/helpers/error-handler.ts
 */
export function createApiErrorResponse(
  error: string | Error,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return NextResponse.json<ApiErrorResponse>(
    {
      error: errorMessage,
      message: status === 500
        ? 'リクエストの処理中にエラーが発生しました。'
        : errorMessage,
      timestamp: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

/**
 * Create a standardized success response (Mock)
 * Unified with lib/api/helpers/response-builder.ts
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
 * Handle common errors in API routes (Mock)
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
    return createApiErrorResponse(error, 500);
  }
  
  return createApiErrorResponse(defaultMessage, 500);
}

/**
 * Parse and validate request body (Mock)
 * Matches the real implementation behavior
 */
export async function parseRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ApiErrorResponse> }> {
  try {
    // Check Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        data: null,
        error: createApiErrorResponse('Invalid Content-Type', 415),
      };
    }
    
    // Get request body text to check size
    const bodyText = await request.text();
    
    // Check JSON size (10MB limit)
    if (bodyText.length > 10 * 1024 * 1024) {
      return {
        data: null,
        error: createApiErrorResponse('Request too large', 413),
      };
    }
    
    // Parse JSON
    const body = JSON.parse(bodyText);
    
    // Actually perform validation using the provided schema
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
    
    // Handle any other errors
    const errorMessage = error instanceof Error ? error.message : 'Invalid input';
    const status = errorMessage.includes('too large') ? 413 : 
                   errorMessage.includes('Content-Type') ? 415 : 500;
    
    return {
      data: null,
      error: createApiErrorResponse(errorMessage, status),
    };
  }
}

// Additional response utilities
export const createNotFoundResponse = (message: string = 'Not found') => {
  return createApiErrorResponse(message, 404);
};

export const createBadRequestResponse = (message: string = 'Bad request') => {
  return createApiErrorResponse(message, 400);
};

export const createUnauthorizedResponse = (message: string = 'Unauthorized') => {
  return createApiErrorResponse(message, 401);
};