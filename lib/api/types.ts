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
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
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

// Proposal Types
export interface ProposalGroup {
  groupId: string;
  timestamp: number;
  symbol: string;
  proposals: Proposal[];
  metadata?: ProposalMetadata;
}

export interface Proposal {
  id: string;
  type: string;
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  reasoning?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
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
}

// Tool Result Types
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Execution Result Types
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: ApiError;
  toolResults?: ToolResult[];
  metadata?: Record<string, unknown>;
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
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;