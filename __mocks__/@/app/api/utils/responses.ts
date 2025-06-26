// Mock for app/api/utils/responses.ts
// Fixed: Match actual structure with unified response patterns

import { NextResponse } from 'next/server';

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
  if (error instanceof Error) {
    return createApiErrorResponse(error, 500);
  }
  return createApiErrorResponse(defaultMessage, 500);
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