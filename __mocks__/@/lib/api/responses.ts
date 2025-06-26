// Mock for lib/api/helpers/response-builder.ts
// Fixed: Match actual createSuccessResponse implementation

import { NextResponse } from 'next/server';

/**
 * 成功レスポンスを作成する（実際の実装に合わせた）
 * データを直接返す（ラッピングなし）
 */
export function createSuccessResponse<T = unknown>(data: T): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * エラーレスポンスを作成する
 */
export function createErrorResponse(
  error: string | Error,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return NextResponse.json(
    {
      error: errorMessage,
      message: status === 500
        ? 'リクエストの処理中にエラーが発生しました。'
        : errorMessage,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
    { status }
  );
}

// Deprecated legacy functions for backward compatibility
export const createApiSuccessResponse = (data: any, status: number = 200) => {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const createApiErrorResponse = (message: string, status: number = 500) => {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Additional response utilities
export const createNotFoundResponse = (message: string = 'Not found') => {
  return createErrorResponse(message, 404);
};

export const createBadRequestResponse = (message: string = 'Bad request') => {
  return createErrorResponse(message, 400);
};

export const createUnauthorizedResponse = (message: string = 'Unauthorized') => {
  return createErrorResponse(message, 401);
};