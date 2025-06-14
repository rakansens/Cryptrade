/**
 * Common API Response Types
 * 
 * This file consolidates all API response type definitions to ensure consistency
 * across the application and reduce duplication.
 */

/**
 * Response metadata common to all API responses
 */
export interface ResponseMetadata {
  timestamp: number;
  requestId?: string;
  version?: string;
  processingTime?: number;
}

/**
 * Standard API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | string | number | boolean | unknown[];
  stack?: string;
}

/**
 * Base API response wrapper for all endpoints
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata: ResponseMetadata;
}

/**
 * Streaming response format for SSE/EventSource endpoints
 */
export interface StreamingResponse<T = unknown> {
  event: string;
  data: T;
  timestamp: number;
  id?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Batch operation response
 */
export interface BatchResponse<T = unknown> extends ApiResponse {
  results: Array<{
    index: number;
    success: boolean;
    data?: T;
    error?: ApiError;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * WebSocket message format
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  correlationId?: string;
}

/**
 * Server-Sent Event (SSE) format
 */
export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Helper function to create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  metadata?: Partial<ResponseMetadata>
): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

/**
 * Helper function to create an error response
 */
export function createErrorResponse(
  error: string | Error | ApiError,
  metadata?: Partial<ResponseMetadata>
): ApiResponse {
  const apiError: ApiError = 
    typeof error === 'string' 
      ? { code: 'UNKNOWN_ERROR', message: error }
      : error instanceof Error
      ? { code: 'INTERNAL_ERROR', message: error.message, stack: error.stack }
      : error;

  return {
    success: false,
    error: apiError,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

/**
 * Helper function to create a streaming response
 */
export function createStreamingResponse<T>(
  event: string,
  data: T,
  id?: string
): StreamingResponse<T> {
  return {
    event,
    data,
    timestamp: Date.now(),
    id,
  };
}

/**
 * Type guard to check if a response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if a response has an error
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiResponse & { error: ApiError } {
  return response.success === false && response.error !== undefined;
}