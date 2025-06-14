/**
 * Orchestrator Type Definitions
 * 
 * Comprehensive type definitions for the orchestrator system
 */

import { z } from 'zod';
import type { A2AMessage, AgentContext, ProposalGroup } from './agent-network.types';

// Intent types
export const IntentTypeSchema = z.enum([
  'price_inquiry',
  'trading_analysis',
  'ui_control',
  'pattern_detection',
  'entry_proposal',
  'general_conversation',
  'unknown',
]);

export type IntentType = z.infer<typeof IntentTypeSchema>;

// Tool result type
export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Agent response metadata
export interface AgentResponseMetadata {
  processedBy: string;
  timestamp: string;
  latency?: number;
  toolsUsed?: string[];
  correlationId?: string;
  sourceAgent?: string;
  targetAgent?: string;
}

// Agent response data types
export interface PriceInquiryData {
  symbol: string;
  currentPrice: number;
  priceChangePercent24h: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  marketCap?: number;
  timestamp: number;
}

export interface TradingAnalysisData {
  proposalGroup?: ProposalGroup;
  analysis?: {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    indicators: Record<string, unknown>;
    recommendation: string;
  };
}

export interface UIControlData {
  action: string;
  target?: string;
  parameters?: Record<string, unknown>;
  success: boolean;
  message?: string;
}

export interface PatternDetectionData {
  proposalGroup?: ProposalGroup;
  patterns?: Array<{
    type: string;
    confidence: number;
    parameters: Record<string, unknown>;
  }>;
}

export interface EntryProposalData {
  proposalGroup?: ProposalGroup;
  entries?: Array<{
    id: string;
    type: 'long' | 'short';
    price: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    confidence: number;
  }>;
}

export interface ErrorData {
  error: string;
  code?: string | number;
  details?: unknown;
}

export type AgentResponseData = 
  | PriceInquiryData 
  | TradingAnalysisData 
  | UIControlData 
  | PatternDetectionData 
  | EntryProposalData 
  | ErrorData 
  | ProposalGroup
  | ToolResult[]
  | Record<string, unknown>
  | unknown;

// Agent response schema
export const AgentResponseSchema = z.object({
  intent: IntentTypeSchema,
  confidence: z.number().min(0).max(1),
  response: z.string(),
  data: z.unknown().optional(),
  metadata: z.object({
    processedBy: z.string(),
    timestamp: z.string(),
    latency: z.number().optional(),
    toolsUsed: z.array(z.string()).optional(),
    correlationId: z.string().optional(),
    sourceAgent: z.string().optional(),
    targetAgent: z.string().optional(),
  }).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Typed Agent Response
export interface TypedAgentResponse<T extends AgentResponseData = AgentResponseData> extends Omit<AgentResponse, 'data'> {
  data?: T;
}

// Orchestrator context
export interface OrchestratorContext extends AgentContext {
  sessionId?: string;
  userId?: string;
  memoryContext?: string;
  previousIntent?: IntentType;
  conversationMode?: 'casual' | 'professional' | 'technical';
  emotionalTone?: 'positive' | 'neutral' | 'negative';
  relationshipLevel?: 'new' | 'regular' | 'trusted';
  isProposalMode?: boolean;
  proposalType?: 'entry' | 'trendline' | 'pattern' | 'fibonacci' | 'support_resistance';
  isEntryProposal?: boolean;
  extractedSymbol?: string;
  interval?: string;
}

// Error types
export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public intent: IntentType = 'unknown',
    public details?: unknown
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

// Handler function type
export type OrchestratorHandler = (
  query: string,
  context: OrchestratorContext
) => Promise<AgentResponse>;

// Handler registry type
export type HandlerRegistry = Record<IntentType, OrchestratorHandler>;

// Message formatting options
export interface MessageFormattingOptions {
  includeMetadata?: boolean;
  includeToolResults?: boolean;
  formatAsMarkdown?: boolean;
}

// Type guards
export function isPriceInquiryData(data: unknown): data is PriceInquiryData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'symbol' in data &&
    'currentPrice' in data &&
    typeof (data as PriceInquiryData).currentPrice === 'number'
  );
}

export function isTradingAnalysisData(data: unknown): data is TradingAnalysisData {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('proposalGroup' in data || 'analysis' in data)
  );
}

export function isUIControlData(data: unknown): data is UIControlData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'action' in data &&
    'success' in data &&
    typeof (data as UIControlData).success === 'boolean'
  );
}

export function isPatternDetectionData(data: unknown): data is PatternDetectionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('proposalGroup' in data || 'patterns' in data)
  );
}

export function isEntryProposalData(data: unknown): data is EntryProposalData {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('proposalGroup' in data || 'entries' in data)
  );
}

export function isErrorData(data: unknown): data is ErrorData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ErrorData).error === 'string'
  );
}

// Message types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncHandler<T = void> = () => Promise<T>;

// Execution result type
export interface OrchestratorExecutionResult {
  response?: AgentResponse;
  a2aMessage?: A2AMessage;
  toolResults?: ToolResult[];
  proposalGroup?: ProposalGroup;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

// Runtime context type
export interface OrchestratorRuntimeContext {
  userTier?: 'free' | 'premium';
  userLevel?: 'beginner' | 'intermediate' | 'expert';
  marketStatus?: 'open' | 'closed';
  queryComplexity?: 'simple' | 'complex';
  isProposalMode?: boolean;
}

// Execution result type
export interface OrchestratorExecutionResponse {
  analysis: {
    intent: IntentType;
    confidence: number;
    requiresProposal?: boolean;
    extractedSymbol?: string;
    extractedInterval?: string;
  };
  executionResult?: OrchestratorExecutionResult;
  executionTime: number;
  success: boolean;
  memoryContext?: string;
}

// Constants
export const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  price_inquiry: ['価格', 'いくら', 'price', 'cost', 'btc', 'eth', 'bitcoin', 'ethereum'],
  trading_analysis: ['分析', '戦略', 'analysis', 'strategy', 'trade', 'トレード', '取引'],
  ui_control: ['チャート', '描画', 'chart', 'draw', 'display', '表示', '切り替え'],
  pattern_detection: ['パターン', 'pattern', 'trend', 'support', 'resistance', 'トレンド'],
  entry_proposal: ['エントリー', 'entry', 'position', 'buy', 'sell', '買い', '売り'],
  general_conversation: ['こんにちは', 'ありがとう', 'hello', 'thanks', 'おはよう'],
  unknown: [],
};

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_RETRY_ATTEMPTS = 3;
export const HANDLER_TIMEOUT_MS = 30000;