import { Agent } from '@mastra/core';
import { z } from 'zod';
import type { ProposalGroup as ImportedProposalGroup } from './proposals';

/**
 * Agent Network Type Definitions
 * 
 * Comprehensive type definitions for the agent-to-agent communication system
 */

// Base Message Types
export type MessageType = 'request' | 'response' | 'notification' | 'error';

// JSON-RPC Error Codes
export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000
}

// Message Error Type
export interface MessageError {
  code: JsonRpcErrorCode | number;
  message: string;
  data?: unknown;
}

// Tool Result Type
export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: MessageError;
}

// Step Type for agent execution
export interface ExecutionStep {
  stepIndex: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  text?: string;
  error?: MessageError;
}

// Tool Call Type
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// Market Data Result Type
export interface MarketDataResult {
  symbol: string;
  currentPrice: number;
  priceChangePercent24h: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  marketCap?: number;
  timestamp: number;
}

// Use ProposalGroup from proposals types
export type ProposalGroup = ImportedProposalGroup;

// Tool Result Specific Types
export interface ProposalGenerationResult {
  success: boolean;
  proposalGroup?: ProposalGroup;
  error?: MessageError;
}

export interface EntryProposalGenerationResult extends ProposalGenerationResult {
  strategyPreference?: string;
  riskPercentage?: number;
}

// Agent Context Types
export interface BaseAgentContext {
  correlationId?: string;
  timestamp?: number;
  sourceAgent?: string;
  memoryContext?: Record<string, unknown>;
}

export interface ProposalContext extends BaseAgentContext {
  isProposalMode: boolean;
  proposalType?: 'entry' | 'trendline' | 'pattern' | 'fibonacci' | 'support_resistance';
  isEntryProposal?: boolean;
  extractedSymbol?: string;
  interval?: string;
  analysisType?: string;
  maxProposals?: number;
  strategyPreference?: string;
  riskPercentage?: number;
}

export interface ConversationalContext extends BaseAgentContext {
  conversationMode?: 'casual' | 'professional' | 'educational';
  emotionalTone?: 'neutral' | 'positive' | 'empathetic' | 'enthusiastic';
  relationshipLevel?: 'new' | 'regular' | 'expert';
  recentTopics?: string[];
}

export interface PriceInquiryContext extends BaseAgentContext {
  symbol?: string;
  includeDetails?: boolean;
  comparisonSymbols?: string[];
}

export type AgentContext = ProposalContext | ConversationalContext | PriceInquiryContext | BaseAgentContext;

// Message Parameters Types
export interface ProcessQueryParams {
  query: string;
  context?: AgentContext;
}

export interface HealthCheckParams {
  includeStats?: boolean;
}

export interface TransmitParams {
  targetAgent: string;
  message: string;
  params?: Record<string, unknown>;
  broadcast?: boolean;
}

export type MessageParams = ProcessQueryParams | HealthCheckParams | TransmitParams | Record<string, unknown>;

// A2A Message Schema
export const A2AMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'response', 'notification', 'error']),
  source: z.string(),
  target: z.string().optional(),
  method: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  timestamp: z.number(),
  correlationId: z.string().optional(),
  steps: z.array(z.unknown()).optional(),
  toolResults: z.array(z.unknown()).optional(),
  proposalGroup: z.unknown().optional(),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// Typed A2A Message with specific result types
export interface TypedA2AMessage<T = unknown> extends Omit<A2AMessage, 'result' | 'steps' | 'toolResults' | 'proposalGroup'> {
  result?: T;
  steps?: ExecutionStep[];
  toolResults?: ToolResult[];
  proposalGroup?: ProposalGroup;
}

// Agent Network Configuration
export interface AgentNetworkConfig {
  maxHops: number;
  timeout: number;
  enableLogging: boolean;
  enableMetrics: boolean;
}

// Agent Registration Info
export interface RegisteredAgent {
  id: string;
  agent: Agent<unknown, unknown>;
  capabilities: string[];
  description: string;
  isActive: boolean;
  lastSeen: Date;
  messageCount: number;
}

// Generate Options Type
export interface AgentGenerateOptions extends Record<string, unknown> {
  maxSteps?: number;
  toolChoice?: 'auto' | 'required' | 'none';
  temperature?: number;
  maxTokens?: number;
}

// Agent Response Types
export interface AgentTextResponse {
  text: string;
}

export interface AgentToolResponse extends AgentTextResponse {
  steps: ExecutionStep[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export type AgentResponse = AgentTextResponse | AgentToolResponse | string;

// Network Statistics
export interface NetworkStats {
  totalAgents: number;
  activeAgents: number;
  totalMessages: number;
  queueSize: number;
  averageMessages: number;
  lastActivity: number;
}

// Agent Filter Function
export type AgentFilter = (agent: RegisteredAgent) => boolean;

// Method Names
export type AgentMethod = 
  | 'process_query'
  | 'health_check'
  | 'get_capabilities'
  | 'get_status'
  | 'execute_tool'
  | string;

// Supported Symbols
export const SUPPORTED_SYMBOLS = [
  'BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'XRP', 
  'DOT', 'LINK', 'UNI', 'AVAX', 'MATIC', 'LTC'
] as const;

export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];

// Agent IDs
export const AGENT_IDS = {
  PRICE_INQUIRY: 'priceInquiryAgent',
  TRADING_ANALYSIS: 'tradingAnalysisAgent',
  UI_CONTROL: 'uiControlAgent',
  ORCHESTRATOR: 'orchestratorAgent',
  CONVERSATIONAL: 'conversationalAgent',
  ROUTER: 'agent-router'
} as const;

export type AgentId = typeof AGENT_IDS[keyof typeof AGENT_IDS];

// Type Guards
export function isToolResponse(response: AgentResponse): response is AgentToolResponse {
  return typeof response === 'object' && 
         response !== null && 
         'steps' in response &&
         Array.isArray(response.steps);
}

export function isTextResponse(response: AgentResponse): response is AgentTextResponse {
  return typeof response === 'object' && 
         response !== null && 
         'text' in response &&
         !('steps' in response);
}

export function isProposalContext(context: AgentContext): context is ProposalContext {
  return 'isProposalMode' in context && context.isProposalMode === true;
}

export function isConversationalContext(context: AgentContext): context is ConversationalContext {
  return 'conversationMode' in context || 'emotionalTone' in context;
}

export function isPriceInquiryContext(context: AgentContext): context is PriceInquiryContext {
  return 'symbol' in context && !('isProposalMode' in context);
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncResult<T> = Promise<T | null>;