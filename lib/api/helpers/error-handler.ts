import { NextResponse } from 'next/server';
import { applyCorsHeaders, applySecurityHeaders } from '@/lib/api/middleware';
import { logger } from '@/lib/utils/logger';
import type { ChatResponse } from '@/lib/api/helpers/response-builder';

/**
 * カスタムバリデーションエラー
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 統一されたエラーレスポンスを作成する
 */
export function createErrorResponse(
  error: string | Error,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // エラーログを出力
  if (status >= 500) {
    logger.error('[API Error]', {
      error: errorMessage,
      status,
      details,
    });
  } else {
    logger.warn('[API Warning]', {
      error: errorMessage,
      status,
      details,
    });
  }
  
  // Build error object based on details structure
  let errorObject: any;
  
  // If details contains the full error structure (from toJSON), use it
  if (details && 'message' in details) {
    errorObject = {
      message: details['message'] || errorMessage,
      ...(details['retryable'] !== undefined && { retryable: details['retryable'] }),
      ...(details['statusCode'] !== undefined && { statusCode: details['statusCode'] }),
      ...(details['context'] !== undefined && { context: details['context'] }),
      ...(details['code'] !== undefined && { code: details['code'] }),
      ...(details['data'] !== undefined && details['data']),
    };
  } else {
    // Otherwise, return simple error message
    errorObject = errorMessage;
  }
  
  const response = NextResponse.json(
    {
      error: errorObject,
      message: status === 500 
        ? 'リクエストの処理中にエラーが発生しました。' 
        : errorMessage,
      timestamp: new Date().toISOString(),
      ...(details && Object.keys(details).length > 0 && 
         !('message' in details) && { details }),
    },
    { status }
  );
  
  return applyCorsHeaders(applySecurityHeaders(response));
}

/**
 * エラーハンドラー関数
 */
export function errorHandler(error: Error | string, status?: number) {
  return createErrorResponse(error, status);
}

/**
 * Orchestratorエラー用のフォールバックレスポンスを作成する
 */
export function createOrchestratorErrorResponse(
  _error: Error | string,
  sessionId?: string
): Partial<ChatResponse> {
  return {
    message: 'システムで一時的な問題が発生しました。しばらく時間をおいて再度お試しください。',
    selectedAgent: 'error',
    analysis: {
      intent: 'error',
      confidence: 0,
      reasoning: 'System error occurred',
      analysisDepth: 'basic' as const,
      isProposalMode: false,
    },
    execution: {
      success: false,
      executionTime: 0,
      memoryContext: 'none',
    },
    data: null,
    metadata: {
      sessionId: sessionId || 'error-session',
      timestamp: new Date().toISOString(),
      a2aEnabled: true,
      agentType: 'error',
    } as any // Error details are in the data field, not metadata
  };
}