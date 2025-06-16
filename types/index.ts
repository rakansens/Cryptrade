// Barrel export for all types (merge conflict resolved: added runtime type guards and conversation-memory type exports)
export type { 
  ApiMiddleware, 
  RequestCtx, 
  ApiClientConfig, 
  ApiResponse, 
  ApiError,
  MiddlewareConfig
} from './api';

// Note: Logger types should be imported directly from '@/lib/utils/logger' to avoid circular dependencies

// Market domain types (unified)
export type { 
  ProcessedKline, 
  BinanceTicker24hr,
  PriceData,
  PriceUpdate,
  BinanceTradeMessage,
  BinanceKlineMessage,
  MarketTicker,
  RSIData,
  MACDData,
  MovingAverageData,
  BollingerBandsData,
  BollingerBandsConfig,
  IndicatorOptions
} from './market';

// Drawing types
export type {
  DrawingPoint,
  DrawingStyle,
  DrawingData,
  ChartDrawing,
  DrawingMode
} from './drawing';

// Proposal types (consolidated)
export type {
  // Drawing proposals
  DrawingProposal,
  DrawingProposalGroup,
  ExtendedDrawingProposal,
  // Entry proposals
  EntryProposal,
  EntryProposalGroup,
  RiskParameters,
  EntryConditions,
  MarketContext,
  EntryReasoning,
  // Unified proposals
  UnifiedProposal,
  UnifiedProposalResponse,
  // UI types
  ProposalMessage,
  ProposalActionEvent,
  // Legacy support (to be deprecated)
  ProposalGroup,
  Proposal
} from './proposals';

// Proposal enums and runtime values (exported separately)
export {
  // Enums
  ProposalStatus,
  ProposalType,
} from './enums';

export {
  // Type guards
  isDrawingProposal,
  isEntryProposal,
  isEntryProposalGroup,
  isDrawingProposalGroup,
  // Utilities
  toUnifiedProposal,
  extractUnifiedProposals
} from './proposals';

// Agent Network types
export type {
  // Core types
  A2AMessage,
  TypedA2AMessage,
  AgentNetworkConfig,
  RegisteredAgent,
  NetworkStats,
  // Message types
  MessageType,
  MessageError,
  MessageParams,
  ProcessQueryParams,
  HealthCheckParams,
  TransmitParams,
  // Agent types
  AgentId,
  AgentMethod,
  AgentFilter,
  AgentContext,
  BaseAgentContext,
  ProposalContext,
  ConversationalContext,
  PriceInquiryContext,
  // Response types
  AgentTextResponse,
  AgentToolResponse,
  AgentGenerateOptions,
  // Execution types
  ExecutionStep,
  ToolCall,
  ToolResult,
  // Result types
  MarketDataResult,
  ProposalGenerationResult,
  EntryProposalGenerationResult,
  // Symbol types
  SupportedSymbol,
  // Type guards (types onlyは除外)
  // Utility types
  AsyncResult
} from './agent-network.types';

export type { DeepPartial } from './utilities';

// Constants
export {
  JsonRpcErrorCode,
  SUPPORTED_SYMBOLS,
  AGENT_IDS
} from './agent-network.types';

// Orchestrator types
export type {
  // Core types
  IntentType,
  AgentResponse,
  AgentResponseMetadata,
  OrchestratorContext,
  // Data types
  AgentResponseData,
  PriceInquiryData,
  TradingAnalysisData,
  UIControlData,
  PatternDetectionData,
  EntryProposalData,
  ErrorData,
  // Response types
  TypedAgentResponse,
  OrchestratorExecutionResult,
  OrchestratorRuntimeContext,
  OrchestratorExecutionResponse,
  // Handler types
  OrchestratorHandler,
  HandlerRegistry,
  MessageFormattingOptions,
  // Utility types
  ChatMessage
} from './orchestrator.types';

// Export OrchestratorError class separately
export { OrchestratorError } from './orchestrator.types';

// Orchestrator constants and runtime values
export {
  IntentTypeSchema,
  AgentResponseSchema,
  INTENT_KEYWORDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  MAX_RETRY_ATTEMPTS,
  HANDLER_TIMEOUT_MS,
  // Type guards
  isPriceInquiryData,
  isTradingAnalysisData,
  isUIControlData,
  isPatternDetectionData,
  isEntryProposalData,
  isErrorData
} from './orchestrator.types';

// ランタイムで利用する type guard 関数は値として再エクスポート
export {
  isToolResponse,
  isTextResponse,
  isProposalContext,
  isConversationalContext,
  isPriceInquiryContext
} from './agent-network.types';

// Conversation Memory types
export type {
  ConversationMessage,
  ConversationSession,
  ConversationMessageMetadata
} from './conversation-memory';

// Generic event types
export type { PublishableEvent } from './events';
