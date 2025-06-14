// Barrel export for all types
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
export {
  // Enums
  ProposalStatus,
  ProposalType,
  // Drawing proposals
  type DrawingProposal,
  type DrawingProposalGroup,
  type ExtendedDrawingProposal,
  // Entry proposals
  type EntryProposal,
  type EntryProposalGroup,
  type RiskParameters,
  type EntryConditions,
  type MarketContext,
  type EntryReasoning,
  // Unified proposals
  type UnifiedProposal,
  type UnifiedProposalResponse,
  // UI types
  type ProposalMessage,
  type ProposalActionEvent,
  // Type guards
  isDrawingProposal,
  isEntryProposal,
  isEntryProposalGroup,
  isDrawingProposalGroup,
  // Utilities
  toUnifiedProposal,
  extractUnifiedProposals,
  // Legacy support (to be deprecated)
  type ProposalGroup,
  type Proposal
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
  DeepPartial,
  AsyncResult
} from './agent-network.types';

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
  OrchestratorError,
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
  ChatMessage,
  // Type guards
  isPriceInquiryData,
  isTradingAnalysisData,
  isUIControlData,
  isPatternDetectionData,
  isEntryProposalData,
  isErrorData
} from './orchestrator.types';

// Orchestrator constants
export {
  IntentTypeSchema,
  AgentResponseSchema,
  INTENT_KEYWORDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  MAX_RETRY_ATTEMPTS,
  HANDLER_TIMEOUT_MS
} from './orchestrator.types';

// ランタイムで利用する type guard 関数は値として re-export する
export {
  isToolResponse,
  isTextResponse,
  isProposalContext,
  isConversationalContext,
  isPriceInquiryContext,
} from './agent-network.types';