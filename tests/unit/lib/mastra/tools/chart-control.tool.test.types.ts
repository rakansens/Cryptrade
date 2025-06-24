/**
 * Type definitions for chart-control.tool.test.ts
 */

import type { generateText } from 'ai';
import type { ChartAnalysis } from '@/types/chart-control.types';

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

// Mock AI analysis result structure
export interface MockAIAnalysisResult {
  operations: Array<{
    type: 'symbol_change' | 'timeframe_change' | 'chart_operation' | 
          'indicator_control' | 'drawing_operation' | 'analysis_operation' | 
          'undo_redo' | 'style_update';
    action: string;
    parameters: Record<string, unknown>;
    priority: number;
    description: string;
  }>;
  reasoning: string;
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  userIntent: string;
}

// Chart control tool context type
export interface ChartControlContext {
  userRequest: string;
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
  currentState?: {
    symbol?: string;
    timeframe?: string;
    activeIndicators?: string[];
    drawingMode?: string;
  };
}

// Chart control tool execution result
export interface ChartControlResult {
  success: boolean;
  operations: Array<{
    type: string;
    action: string;
    parameters: Record<string, unknown>;
    description?: string;
    priority?: number;
    clientEvent?: {
      event: string;
      data?: Record<string, unknown>;
    };
  }>;
  response?: string;
  reasoning?: string;
  metadata?: {
    confidence: number;
    complexity: string;
    userIntent?: string;
  };
  error?: string;
}

// Mock chart analysis result
export interface MockChartAnalysis extends Partial<ChartAnalysis> {
  currentPrice?: {
    price: number;
    timestamp: number;
  };
  technicalAnalysis?: {
    trend?: {
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: number;
      confidence: number;
    };
    momentum?: {
      rsi?: number;
    };
    volatility?: {
      volatilityLevel: 'low' | 'medium' | 'high';
    };
    supportResistance?: {
      supports: number[];
      resistances: number[];
    };
  };
  recommendations?: {
    trendlineDrawing?: Array<{
      type: string;
      description: string;
      points: Array<{ time: number; price: number }>;
      style?: {
        color: string;
        lineWidth: number;
        lineStyle: string;
      };
      priority?: number;
    }>;
    analysis?: string;
    nextAction?: string;
  };
}

// Type for mocked execute function
export type MockChartControlExecute = (params: {
  context: ChartControlContext;
  runtimeContext?: unknown;
}) => Promise<ChartControlResult>;