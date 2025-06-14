/**
 * Orchestrator Agent Utilities
 * 
 * オーケストレーターエージェントのユーティリティ関数
 */

import { logger } from '@/lib/utils/logger';
import { AgentResponse, IntentType } from './orchestrator.types';
import type { 
  AgentResponseData, 
  AgentResponseMetadata
} from '@/types/orchestrator.types';
import { INTENT_KEYWORDS } from '@/types/orchestrator.types';

/**
 * エージェント応答のフォーマット
 */
export function formatAgentResponse(
  intent: IntentType,
  response: string,
  data?: AgentResponseData,
  metadata?: Partial<AgentResponseMetadata>
): AgentResponse {
  return {
    intent,
    confidence: 1.0,
    response,
    data,
    metadata: {
      processedBy: 'orchestrator',
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

/**
 * エラー応答の生成
 */
export function createErrorResponse(
  error: Error,
  intent: IntentType = 'unknown'
): AgentResponse {
  logger.error('[Orchestrator] Error response created', {
    error: error.message,
    intent,
  });

  return formatAgentResponse(
    intent,
    'エラーが発生しました。もう一度お試しください。',
    { error: error.message },
    { processedBy: 'orchestrator-error-handler' }
  );
}

/**
 * レスポンスの検証
 */
export function validateResponse(response: unknown): response is AgentResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  const r = response as Record<string, unknown>;
  
  return (
    'intent' in r &&
    typeof r.intent === 'string' &&
    'response' in r &&
    typeof r.response === 'string' &&
    (!('confidence' in r) || typeof r.confidence === 'number') &&
    (!('data' in r) || r.data !== undefined) &&
    (!('metadata' in r) || (typeof r.metadata === 'object' && r.metadata !== null))
  );
}

/**
 * インテント信頼度の計算
 */
export function calculateIntentConfidence(
  query: string,
  detectedIntent: IntentType
): number {
  const queryLower = query.toLowerCase();
  
  // 明確なキーワードがある場合は高信頼度
  const patterns = INTENT_KEYWORDS[detectedIntent] || [];
  const hasPattern = patterns.some(pattern => queryLower.includes(pattern));
  
  if (hasPattern) {
    return 0.9 + Math.random() * 0.1; // 0.9-1.0
  }
  
  // パターンが見つからない場合は中程度の信頼度
  return 0.6 + Math.random() * 0.3; // 0.6-0.9
}

/**
 * メモリコンテキストの要約
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function summarizeMemoryContext(messages: ChatMessage[], maxLength = 500): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  const recentMessages = messages.slice(-5); // Last 5 messages
  const summary = recentMessages
    .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}`)
    .join('\n');

  if (summary.length > maxLength) {
    return summary.substring(0, maxLength) + '...';
  }

  return summary;
}