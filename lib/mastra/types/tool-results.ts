/**
 * Tool Result Types for Mastra Agent System
 * 
 * 型安全なツール結果の処理
 */

// Parameter types for UI operations
export type UIOperationParameter = string | number | boolean | null | undefined | UIOperationParameter[] | { [key: string]: UIOperationParameter };

export interface UIControlOperation {
  type: string;
  action: string;
  parameters?: Record<string, UIOperationParameter>;
  description?: string;
  executionMode?: 'immediate' | 'deferred';
  clientEvent?: {
    event: string;
    data: Record<string, UIOperationParameter>;
  };
}

export interface ChartControlToolResult {
  success: boolean;
  operations: UIControlOperation[];
  response: string;
  reasoning?: string;
  metadata?: {
    confidence: number;
    complexity: string;
    aiEnhanced: boolean;
  };
}

// Base tool result types
export interface BaseToolResult {
  success: boolean;
  response?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MarketDataToolResult extends BaseToolResult {
  data?: {
    symbol: string;
    price: number;
    change24h: number;
    volume: number;
    timestamp: number;
  };
}

export interface AnalysisToolResult extends BaseToolResult {
  analysis?: {
    summary: string;
    confidence: number;
    recommendations?: string[];
    risks?: string[];
  };
}

export interface MemoryToolResult extends BaseToolResult {
  memories?: Array<{
    id: string;
    content: string;
    timestamp: number;
    relevance: number;
  }>;
}

export type SpecificToolResult = ChartControlToolResult | MarketDataToolResult | AnalysisToolResult | MemoryToolResult | BaseToolResult;

export interface ToolResult {
  toolName: string;
  result?: SpecificToolResult;
}

export interface AgentStep {
  toolResults?: ToolResult[];
  stepId?: string;
  timestamp?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  // Direct properties
  operations?: UIControlOperation[];
  
  // Nested in data
  data?: {
    operations?: UIControlOperation[];
    metadata?: Record<string, unknown>;
  };
  
  // Nested in result
  result?: {
    operations?: UIControlOperation[];
    metadata?: Record<string, unknown>;
  };
  
  // Nested in executionResult
  executionResult?: {
    data?: {
      operations?: UIControlOperation[];
      metadata?: Record<string, unknown>;
    };
    success?: boolean;
    error?: string;
  };
  
  // Tool results
  toolResults?: ToolResult[];
  
  // Steps with tool results
  steps?: AgentStep[];
  
  // Common metadata
  agentId?: string;
  timestamp?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Extract operations from various result structures
 */
export function extractOperations(agentResult: AgentResult): UIControlOperation[] {
  // Direct toolResults
  const fromToolResults = agentResult?.toolResults?.flatMap((tr) =>
    Array.isArray(tr?.result?.operations) ? tr.result.operations : []
  ) || [];
  
  // Steps → toolResults
  const fromSteps = agentResult?.steps?.flatMap((step) =>
    step?.toolResults?.flatMap((tr) =>
      Array.isArray(tr?.result?.operations) ? tr.result.operations : []
    ) || []
  ) || [];
  
  // Priority order for extraction
  return Array.isArray(agentResult.operations) 
    ? agentResult.operations
    : Array.isArray(agentResult.data?.operations)
    ? agentResult.data.operations
    : Array.isArray(agentResult.result?.operations)
    ? agentResult.result.operations
    : Array.isArray(agentResult.executionResult?.data?.operations)
    ? agentResult.executionResult.data.operations
    : fromToolResults.length > 0
    ? fromToolResults
    : fromSteps.length > 0
    ? fromSteps
    : [];
}