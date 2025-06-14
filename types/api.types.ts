/**
 * API type definitions
 * These types define the structure of API requests and responses
 */

// ===== Common Types =====

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: ApiMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiMetadata {
  timestamp: number;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

// ===== Chat API Types =====

export interface CreateSessionRequest {
  userId?: string;
  title?: string;
}

export interface CreateSessionResponse {
  session: {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
  };
}

export interface GetSessionsRequest {
  userId?: string;
  pagination?: PaginationParams;
}

export interface GetSessionsResponse {
  sessions: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    lastActiveAt: number;
    messageCount: number;
  }>;
  pagination?: PaginationMeta;
}

export interface AddMessageRequest {
  content: string;
  role: 'user' | 'assistant';
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: unknown; // Will be replaced with specific type
  entryProposalGroup?: unknown; // Will be replaced with specific type
  isTyping?: boolean;
}

export interface AddMessageResponse {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
    type?: 'text' | 'proposal' | 'entry';
    proposalGroup?: unknown;
    entryProposalGroup?: unknown;
    isTyping?: boolean;
  };
}

export interface UpdateSessionTitleRequest {
  title: string;
}

export interface UpdateSessionTitleResponse {
  session: {
    id: string;
    title: string;
    updatedAt: number;
  };
}

// ===== Analysis API Types =====

export interface CreateAnalysisRequest {
  sessionId: string;
  symbol: string;
  timeframe: string;
  indicators: string[];
  parameters?: Record<string, unknown>;
}

export interface CreateAnalysisResponse {
  analysis: {
    id: string;
    sessionId: string;
    symbol: string;
    timeframe: string;
    status: 'pending' | 'completed' | 'failed';
    result?: unknown; // Will be replaced with specific type
    createdAt: number;
  };
}

export interface GetAnalysisHistoryRequest {
  sessionId?: string;
  symbol?: string;
  timeframe?: string;
  status?: 'pending' | 'completed' | 'failed';
  pagination?: PaginationParams;
}

export interface GetAnalysisHistoryResponse {
  analyses: Array<{
    id: string;
    sessionId: string;
    symbol: string;
    timeframe: string;
    status: 'pending' | 'completed' | 'failed';
    result?: unknown;
    createdAt: number;
    updatedAt: number;
  }>;
  pagination?: PaginationMeta;
}

// ===== Memory API Types =====

export interface AddMemoryRequest {
  content: string;
  role: 'user' | 'assistant';
  metadata?: Record<string, unknown>;
}

export interface AddMemoryResponse {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SearchMemoryRequest {
  query: string;
  limit?: number;
  timeRange?: {
    start: string;
    end: string;
  };
  role?: 'user' | 'assistant';
}

export interface SearchMemoryResponse {
  results: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  totalCount: number;
}

// ===== Chart Drawing API Types =====

export interface SaveChartDrawingRequest {
  sessionId: string;
  symbol: string;
  timeframe: string;
  drawingData: unknown; // Will be replaced with specific type
}

export interface SaveChartDrawingResponse {
  drawing: {
    id: string;
    sessionId: string;
    symbol: string;
    timeframe: string;
    drawingData: unknown;
    createdAt: number;
    updatedAt: number;
  };
}

export interface GetChartDrawingsRequest {
  sessionId?: string;
  symbol?: string;
  timeframe?: string;
  pagination?: PaginationParams;
}

export interface GetChartDrawingsResponse {
  drawings: Array<{
    id: string;
    sessionId: string;
    symbol: string;
    timeframe: string;
    drawingData: unknown;
    createdAt: number;
    updatedAt: number;
  }>;
  pagination?: PaginationMeta;
}

// ===== Trade API Types =====

export interface CreateTradeRequest {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTradeResponse {
  trade: {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    status: 'open' | 'closed' | 'cancelled';
    stopLoss?: number;
    takeProfit?: number;
    entryTime: string;
    metadata?: Record<string, unknown>;
  };
}

export interface UpdateTradeRequest {
  exitPrice?: number;
  exitTime?: string;
  status?: 'open' | 'closed' | 'cancelled';
  profitLoss?: number;
  commission?: number;
  notes?: string;
}

export interface UpdateTradeResponse {
  trade: {
    id: string;
    status: 'open' | 'closed' | 'cancelled';
    exitPrice?: number;
    exitTime?: string;
    profitLoss?: number;
    profitLossPercentage?: number;
    updatedAt: string;
  };
}

// ===== Alert API Types =====

export interface CreateAlertRequest {
  symbol: string;
  name: string;
  conditions: unknown; // Will be replaced with specific type
  isActive?: boolean;
  expiresAt?: string;
}

export interface CreateAlertResponse {
  alert: {
    id: string;
    symbol: string;
    name: string;
    conditions: unknown;
    isActive: boolean;
    triggerCount: number;
    createdAt: string;
    expiresAt?: string;
  };
}

export interface GetAlertsRequest {
  symbol?: string;
  isActive?: boolean;
  includeExpired?: boolean;
  pagination?: PaginationParams;
}

export interface GetAlertsResponse {
  alerts: Array<{
    id: string;
    symbol: string;
    name: string;
    conditions: unknown;
    isActive: boolean;
    triggerCount: number;
    lastTriggered?: string;
    createdAt: string;
    expiresAt?: string;
  }>;
  pagination?: PaginationMeta;
}

// ===== Pattern API Types =====

export interface DetectPatternRequest {
  sessionId: string;
  symbol: string;
  timeframe: string;
  patternType: string;
  startTime: number;
  endTime: number;
  parameters?: Record<string, unknown>;
}

export interface DetectPatternResponse {
  pattern: {
    id: string;
    sessionId: string;
    symbol: string;
    timeframe: string;
    type: string;
    confidence: number;
    metadata: unknown;
    detectedAt: string;
  };
}

// ===== WebSocket Event Types =====

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: number;
}

export type WebSocketEventType = 
  | 'price_update'
  | 'trade_executed'
  | 'alert_triggered'
  | 'analysis_completed'
  | 'pattern_detected'
  | 'connection_status';

export interface PriceUpdatePayload {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export interface TradeExecutedPayload {
  tradeId: string;
  symbol: string;
  direction: 'long' | 'short';
  price: number;
  quantity: number;
  timestamp: string;
}

export interface AlertTriggeredPayload {
  alertId: string;
  symbol: string;
  name: string;
  triggeredCondition: string;
  currentValue: number;
  timestamp: string;
}

// ===== Request/Response Utilities =====

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestConfig {
  method: ApiMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryCondition?: (error: ApiError) => boolean;
  };
}

// ===== Type Guards =====

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  );
}

export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    ('data' in response || 'error' in response)
  );
}

export function isPaginationParams(params: unknown): params is PaginationParams {
  if (typeof params !== 'object' || params === null) return false;
  const p = params as Record<string, unknown>;
  
  return (
    (p.page === undefined || typeof p.page === 'number') &&
    (p.limit === undefined || typeof p.limit === 'number') &&
    (p.cursor === undefined || typeof p.cursor === 'string')
  );
}