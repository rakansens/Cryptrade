import { z } from 'zod';

/**
 * Agent間共通ペイロード定義
 * 
 * 全エージェント間でのデータ受け渡しに使用する型安全スキーマ
 * レイテンシ悪化防止のため、maxTokens/maxBytesを制限
 */

// 基本ペイロード制限
export const PAYLOAD_LIMITS = {
  MAX_TOKENS: 2000,        // GPT-4のコンテキスト制限考慮
  MAX_BYTES: 50 * 1024,    // 50KB制限
  MAX_ARRAY_LENGTH: 100,   // 配列要素数制限
} as const;

// 基本メタデータ
const BaseMetadata = z.object({
  correlationId: z.string().uuid('Correlation ID must be UUID'),
  timestamp: z.number().int().positive(),
  agentId: z.string().min(1).max(50),
  version: z.string().default('1.0.0'),
});

// 市場データペイロード
export const MarketDataPayload = z.object({
  ...BaseMetadata.shape,
  symbol: z.string().regex(/^[A-Z]{2,10}USDT?$/i, 'Invalid symbol format'),
  currentPrice: z.number().positive(),
  priceChangePercent24h: z.number(),
  volume24h: z.number().nonnegative(),
  trend: z.enum(['bullish', 'bearish', 'neutral']),
  volatility: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1).default(0.8),
});

// 会話ペイロード
export const ConversationPayload = z.object({
  ...BaseMetadata.shape,
  userQuery: z.string()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query too long')
    .transform(s => s.trim()),
  intent: z.enum(['greeting', 'casual_chat', 'price_inquiry', 'market_analysis', 'trading_advice']),
  response: z.string().max(1000, 'Response too long'),
  tokensUsed: z.number().int().nonnegative().max(PAYLOAD_LIMITS.MAX_TOKENS),
});

// リスク評価ペイロード
export const RiskAssessmentPayload = z.object({
  ...BaseMetadata.shape,
  symbol: z.string().regex(/^[A-Z]{2,10}USDT?$/i),
  riskLevel: z.enum(['low', 'medium', 'high']),
  factors: z.array(z.string().max(100)).max(PAYLOAD_LIMITS.MAX_ARRAY_LENGTH),
  score: z.number().min(0).max(1),
  recommendation: z.string().max(200),
});

// Orchestrator → Agent間ペイロード
export const OrchestratorCommand = z.object({
  ...BaseMetadata.shape,
  targetAgent: z.enum(['market-data', 'trading-strategy', 'risk-management', 'chart-analysis', 'backtest', 'ui-action']),
  command: z.string().min(1).max(200),
  parameters: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  ])).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  timeoutMs: z.number().int().positive().max(30000).default(10000),
});

// Agent → Orchestrator間レスポンス
export const AgentResponse = z.object({
  ...BaseMetadata.shape,
  success: z.boolean(),
  data: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({}),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown())
  ]).optional(),
  error: z.string().optional(),
  executionTimeMs: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
});

// エラーハンドリング用
export const ErrorPayload = z.object({
  ...BaseMetadata.shape,
  errorCode: z.string(),
  message: z.string().max(300),
  stackTrace: z.string().optional(),
  retryable: z.boolean().default(false),
});

// コスト監視用
export const CostMetrics = z.object({
  ...BaseMetadata.shape,
  model: z.string(),
  tokensInput: z.number().int().nonnegative(),
  tokensOutput: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().multipleOf(0.0001), // 0.01セント単位
  latencyMs: z.number().int().nonnegative(),
});

// 型エクスポート
export type MarketDataPayload = z.infer<typeof MarketDataPayload>;
export type ConversationPayload = z.infer<typeof ConversationPayload>;
export type RiskAssessmentPayload = z.infer<typeof RiskAssessmentPayload>;
export type OrchestratorCommand = z.infer<typeof OrchestratorCommand>;
export type AgentResponse = z.infer<typeof AgentResponse>;
export type ErrorPayload = z.infer<typeof ErrorPayload>;
export type CostMetrics = z.infer<typeof CostMetrics>;

// ペイロードサイズ検証ヘルパー
export function validatePayloadSize<T>(data: T, schema: z.ZodSchema<T>): T {
  const serialized = JSON.stringify(data);
  
  if (serialized.length > PAYLOAD_LIMITS.MAX_BYTES) {
    throw new Error(`Payload too large: ${serialized.length} bytes > ${PAYLOAD_LIMITS.MAX_BYTES}`);
  }
  
  return schema.parse(data);
}

// correlationId生成ヘルパー
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}