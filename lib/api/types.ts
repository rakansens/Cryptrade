import { NextRequest } from 'next/server';
import type { ProposalGroup } from '@/types/proposals';

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ResponseMetadata {
  timestamp: number;
  requestId?: string;
  duration?: number;
  [key: string]: unknown;
}

// Streaming Types
export interface StreamEvent<T = unknown> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
}

export type StreamHandler<T = unknown> = (
  stream: ReadableStreamDefaultReader<Uint8Array>,
  context: StreamContext
) => AsyncGenerator<StreamEvent<T>, void, unknown>;

export interface StreamContext {
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Request Types
export interface ApiRequest<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: T;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// Handler Types
export type ApiHandler<_TRequest = unknown, TResponse = unknown> = (
  req: NextRequest,
  context?: ApiHandlerContext
) => Promise<Response | ApiResponse<TResponse>>;

export interface ApiHandlerContext {
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
  headers?: Headers;
  [key: string]: unknown;
}

// Error Boundary Types
export interface ErrorDetails {
  code: string;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Cache Types
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Rate Limit Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Retry Types
export type RetryCondition = (error: Error | ApiError, attempt: number) => boolean;

// Re-export proposal types for convenience
export { ProposalGroup };

// Legacy Proposal interface for backward compatibility
export interface Proposal {
  id: string;
  type: string;
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  reasoning?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  // Extended properties for compatibility
  entryZone?: {
    min: number;
    max: number;
  };
  riskParameters?: {
    stopLoss: number;
    stopLossPercent: number;
    takeProfitTargets: Array<{
      price: number;
      percentage: number;
    }>;
    riskRewardRatio: number;
    positionSizePercent: number;
    maxRiskPercent: number;
  };
}

export interface ProposalMetadata {
  analysis?: string;
  indicators?: Record<string, unknown>;
  patterns?: string[];
  [key: string]: unknown;
}

// Orchestrator Result Types
export interface OrchestratorResult {
  success: boolean;
  proposalGroup?: ProposalGroup;
  error?: ApiError;
  metadata?: Record<string, unknown>;
  analysis: {
    intent: string;
    confidence: number;
    reasoning: string;
    analysisDepth: string;
    isProposalMode: boolean;
    proposalType?: string | undefined;
  };
  executionTime: number;
  memoryContext?: string | undefined;
  executionResult?: ExecutionResult;
}

// Tool Result Types
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  result?: {
    proposalGroup?: ProposalGroup;
    [key: string]: unknown;
  };
}

// Execution Result Types
export interface ExecutionResult {
  success?: boolean;
  data?: unknown;
  error?: ApiError;
  toolResults?: ToolResult[];
  metadata?: Record<string, unknown>;
  response?: string;
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: ProposalGroup;
  executionResult?: ExecutionResult;
  steps?: Array<{
    toolResults?: ToolResult[];
    [key: string]: unknown;
  }>;
}

// Analysis Types
export interface AnalysisRecord {
  id: string;
  timestamp: number;
  symbol: string;
  analysis: string;
  proposals?: Proposal[];
  metadata?: Record<string, unknown>;
}

// Conversation Memory Types
export interface ConversationMemory {
  id: string;
  timestamp: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: Record<string, unknown>;
}

// Database Record Types
export interface DatabaseRecord {
  id: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

// Validation Types
export type ValidationResult<T = unknown> = 
  | { valid: true; data: T }
  | { valid: false; error: string };

// Utility Types
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;