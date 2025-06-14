import { logger } from '@/lib/utils/logger';

/**
 * Agent Error Types
 */
export enum AgentErrorType {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  
  // Agent errors
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',
  AGENT_INVALID_RESPONSE = 'AGENT_INVALID_RESPONSE',
  
  // Tool errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_VALIDATION_FAILED = 'TOOL_VALIDATION_FAILED',
  
  // Data errors
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_OUTPUT = 'INVALID_OUTPUT',
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  
  // System errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Agent Error Context
 */
export interface AgentErrorContext {
  agentId?: string;
  toolName?: string;
  method?: string;
  correlationId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * Unified Agent Error Class
 * 
 * エージェントシステム全体で使用する統一エラークラス
 * - 構造化されたエラー情報
 * - リトライ可能性の判定
 * - エラーコンテキストの保持
 * - ログ統合
 */
export class AgentError extends Error {
  public readonly type: AgentErrorType;
  public readonly context: AgentErrorContext;
  public readonly originalError?: Error;
  public readonly timestamp: number;

  constructor(
    type: AgentErrorType,
    message: string,
    context?: AgentErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AgentError';
    this.type = type;
    this.timestamp = Date.now();
    this.context = {
      ...context,
      timestamp: this.timestamp,
    };
    this.originalError = originalError;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AgentError.prototype);

    // Log error creation
    logger.error('[AgentError] Error created', {
      type: this.type,
      message: this.message,
      context: this.context,
      hasOriginalError: !!originalError,
      stack: this.stack,
    });
  }

  /**
   * エラーがリトライ可能かどうか
   */
  isRetryable(): boolean {
    // Context-based override
    if (this.context.retryable !== undefined) {
      return this.context.retryable;
    }

    // Type-based determination
    switch (this.type) {
      case AgentErrorType.NETWORK_ERROR:
      case AgentErrorType.TIMEOUT_ERROR:
      case AgentErrorType.RATE_LIMIT_EXCEEDED:
        return true;
      
      case AgentErrorType.CIRCUIT_OPEN:
      case AgentErrorType.INVALID_INPUT:
      case AgentErrorType.CONFIGURATION_ERROR:
      case AgentErrorType.TOOL_NOT_FOUND:
      case AgentErrorType.AGENT_NOT_FOUND:
        return false;
      
      default:
        return false;
    }
  }

  /**
   * リトライまでの待機時間（ミリ秒）
   */
  getRetryDelay(): number {
    if (this.context.retryAfter) {
      return this.context.retryAfter;
    }

    switch (this.type) {
      case AgentErrorType.RATE_LIMIT_EXCEEDED:
        return 60000; // 1 minute
      case AgentErrorType.NETWORK_ERROR:
        return 5000; // 5 seconds
      case AgentErrorType.TIMEOUT_ERROR:
        return 10000; // 10 seconds
      default:
        return 5000; // Default 5 seconds
    }
  }

  /**
   * エラーの詳細情報を取得
   */
  getDetails(): Record<string, unknown> {
    return {
      type: this.type,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      retryable: this.isRetryable(),
      retryDelay: this.isRetryable() ? this.getRetryDelay() : null,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
      } : null,
    };
  }

  /**
   * エラーをJSON形式で出力
   */
  toJSON(): Record<string, unknown> {
    return this.getDetails();
  }

  /**
   * ユーザー向けのエラーメッセージを生成
   */
  getUserMessage(): string {
    switch (this.type) {
      case AgentErrorType.NETWORK_ERROR:
        return '通信エラーが発生しました。しばらくしてから再度お試しください。';
      case AgentErrorType.TIMEOUT_ERROR:
        return '処理がタイムアウトしました。しばらくしてから再度お試しください。';
      case AgentErrorType.CIRCUIT_OPEN:
        return 'サービスが一時的に利用できません。しばらくしてから再度お試しください。';
      case AgentErrorType.RATE_LIMIT_EXCEEDED:
        return 'リクエスト数が上限に達しました。しばらくしてから再度お試しください。';
      case AgentErrorType.INVALID_INPUT:
        return '入力データが正しくありません。内容を確認して再度お試しください。';
      case AgentErrorType.AGENT_NOT_FOUND:
        return '指定されたエージェントが見つかりません。';
      case AgentErrorType.TOOL_NOT_FOUND:
        return '指定されたツールが見つかりません。';
      default:
        return 'エラーが発生しました。しばらくしてから再度お試しください。';
    }
  }

  /**
   * 静的ファクトリメソッド
   */
  static networkError(message: string, context?: AgentErrorContext, originalError?: Error): AgentError {
    return new AgentError(AgentErrorType.NETWORK_ERROR, message, context, originalError);
  }

  static timeoutError(message: string, context?: AgentErrorContext): AgentError {
    return new AgentError(AgentErrorType.TIMEOUT_ERROR, message, context);
  }

  static circuitOpen(message: string, context?: AgentErrorContext): AgentError {
    return new AgentError(AgentErrorType.CIRCUIT_OPEN, message, context);
  }

  static agentNotFound(agentId: string, context?: AgentErrorContext): AgentError {
    return new AgentError(
      AgentErrorType.AGENT_NOT_FOUND,
      `Agent not found: ${agentId}`,
      { ...context, agentId }
    );
  }

  static agentExecutionFailed(agentId: string, message: string, context?: AgentErrorContext, originalError?: Error): AgentError {
    return new AgentError(
      AgentErrorType.AGENT_EXECUTION_FAILED,
      message,
      { ...context, agentId },
      originalError
    );
  }

  static toolNotFound(toolName: string, context?: AgentErrorContext): AgentError {
    return new AgentError(
      AgentErrorType.TOOL_NOT_FOUND,
      `Tool not found: ${toolName}`,
      { ...context, toolName }
    );
  }

  static toolExecutionFailed(toolName: string, message: string, context?: AgentErrorContext, originalError?: Error): AgentError {
    return new AgentError(
      AgentErrorType.TOOL_EXECUTION_FAILED,
      message,
      { ...context, toolName },
      originalError
    );
  }

  static invalidInput(message: string, context?: AgentErrorContext): AgentError {
    return new AgentError(AgentErrorType.INVALID_INPUT, message, context);
  }

  static rateLimitExceeded(retryAfter?: number, context?: AgentErrorContext): AgentError {
    return new AgentError(
      AgentErrorType.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { ...context, retryAfter, retryable: true }
    );
  }

  static internalError(message: string, context?: AgentErrorContext, originalError?: Error): AgentError {
    return new AgentError(
      AgentErrorType.INTERNAL_ERROR,
      message,
      context,
      originalError
    );
  }
}

// Export error type guards
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

export function isRetryableError(error: unknown): boolean {
  if (isAgentError(error)) {
    return error.isRetryable();
  }
  // Check for common retryable errors
  if (error?.code) {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    return retryableCodes.includes(error.code);
  }
  return false;
}