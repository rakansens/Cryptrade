import { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/config/env';
import { ValidationError } from './error-handler';
import { logger } from '@/lib/utils/logger';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';

/**
 * A2A通信対応のリクエストスキーマ
 */
const ChatRequestSchema = z.object({
  message: z.string().optional(), // 単一メッセージ (optional for legacy support)
  sessionId: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(), // 旧形式との互換性
  // 動的エージェントプロパティ用のコンテキスト
  runtimeContext: z.object({
    userTier: z.enum(['free', 'premium']).optional(),
    userLevel: z.enum(['beginner', 'intermediate', 'expert']).optional(),
    marketStatus: z.enum(['open', 'closed']).optional(),
    queryComplexity: z.enum(['simple', 'complex']).optional(),
    isProposalMode: z.boolean().optional(),
  }).optional(),
});

/**
 * チャットリクエストの検証結果
 */
export interface ValidatedChatRequest {
  userMessage: string;
  sessionId?: string;
  runtimeContext?: {
    userTier?: 'free' | 'premium';
    userLevel?: 'beginner' | 'intermediate' | 'expert';
    marketStatus?: 'open' | 'closed';
    queryComplexity?: 'simple' | 'complex';
    isProposalMode?: boolean;
  };
}

/**
 * チャットリクエストを検証し、必要な情報を抽出する
 */
export async function validateChatRequest(request: NextRequest): Promise<ValidatedChatRequest> {
  // リクエストボディのパース
  const body = await request.json();
  
  // リクエストボディの検証
  const validationResult = ChatRequestSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid request format',
      validationResult.error.format()
    );
  }

  const { message, sessionId, messages, runtimeContext } = validationResult.data;

  // OpenAI APIキーの検証
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // メッセージ抽出（新形式優先、旧形式フォールバック）
  const userMessage = message || messages?.filter(m => m.role === 'user').pop()?.content;
  if (!userMessage) {
    throw new ValidationError('No user message found');
  }

  logger.info('[Request Validator] Chat request validated', {
    sessionId,
    messageLength: userMessage.length,
    hasRuntimeContext: !!runtimeContext,
  });

  return {
    userMessage,
    sessionId,
    runtimeContext,
  };
}

/**
 * エージェントを安全に登録する
 */
export function registerAgentsSafely(): void {
  try {
    registerAllAgents();
    logger.debug('[Request Validator] Agents registered successfully');
  } catch (registrationError) {
    logger.warn('[Request Validator] Agent registration failed', {
      error: String(registrationError),
    });
  }
}

/**
 * 汎用バリデーションユーティリティ
 *
 * create-sse-handler などがクエリパラメータを検証するために利用する。
 * helpers/request-validator.ts にはチャット専用の validateChatRequest しか無かったため、
 * import エラーが発生していた。
 */
export function validateRequest<T>(data: unknown, schema: z.ZodSchema<T>): T {
  const validation = schema.safeParse(data);
  if (!validation.success) {
    throw new ValidationError('Invalid request parameters', validation.error.format());
  }
  return validation.data;
}