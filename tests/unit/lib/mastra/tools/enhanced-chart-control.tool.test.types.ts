/**
 * Type definitions for enhanced-chart-control.tool.test.ts
 */

import type { generateText } from 'ai';

// Mock response type for generateText
export interface MockGenerateTextResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
  response: Record<string, unknown>;
}

// Enhanced chart control context type
export interface EnhancedChartControlContext {
  symbol: string;
  interval: string;
  userRequest: string;
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
  currentDrawingMode?: string;
  currentDrawings?: unknown[];
}

// Enhanced chart control result type
export interface EnhancedChartControlResult {
  success: boolean;
  tool?: string;
  result?: unknown;
  analysis?: unknown;
  response?: string;
  confidence?: number;
  context?: {
    symbol: string;
    interval: string;
    analysisDepth: string;
  };
  error?: string;
}

// Type for mocked execute function
export type MockEnhancedChartControlExecute = (params: {
  context: EnhancedChartControlContext;
  runtimeContext?: unknown;
}) => Promise<EnhancedChartControlResult>;

// Helper function to create mock response
export function createMockTextResponse(
  text: string,
  options: Partial<MockGenerateTextResponse> = {}
): Awaited<ReturnType<typeof generateText>> {
  const mockResponse: MockGenerateTextResponse = {
    text,
    usage: { promptTokens: 100, completionTokens: 50 },
    finishReason: 'stop',
    response: {},
    ...options
  };
  
  return mockResponse as Awaited<ReturnType<typeof generateText>>;
}