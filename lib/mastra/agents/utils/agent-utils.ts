/**
 * Agent utility functions
 * エージェント関連のユーティリティ関数を提供
 * 
 * Changes:
 * - Created new file to provide handleAgentError function
 * - Added error handling utilities for agent operations
 */

import { logger } from '@/lib/utils/logger';

/**
 * エージェントエラーをハンドリングする関数
 * @param error - 発生したエラー
 * @param context - エラーのコンテキスト情報
 * @returns フォーマットされたエラーメッセージ
 */
export function handleAgentError(error: unknown, context?: any): string {
  let errorMessage = 'An unknown error occurred';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message);
  }
  
  const fullMessage = context ? `${context.operation || 'Agent operation'}: ${errorMessage}` : errorMessage;
  
  logger.error(`Agent error: ${fullMessage}`, {
    error,
    context,
    stack: error instanceof Error ? error.stack : undefined
  });
  
  return fullMessage;
}

/**
 * エージェント操作が安全に実行できるかチェック
 * @param agentName - エージェント名
 * @returns 実行可能かどうか
 */
export function isAgentOperationSafe(agentName: string): boolean {
  // 基本的なバリデーション
  if (!agentName || typeof agentName !== 'string') {
    return false;
  }
  
  // 将来的により詳細なチェックを追加可能
  return true;
}

/**
 * エージェントのレスポンスをフォーマット
 * @param response - エージェントからのレスポンス
 * @returns フォーマットされたレスポンス
 */
export function formatAgentResponse(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }
  
  if (response && typeof response === 'object' && 'content' in response) {
    return String(response.content);
  }
  
  return JSON.stringify(response, null, 2);
}