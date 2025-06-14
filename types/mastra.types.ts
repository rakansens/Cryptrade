/**
 * Type definitions for Mastra tools and agents
 */

// ===== Chart State Types =====

export interface ChartState {
  symbol?: string;
  timeframe?: string;
  activeIndicators?: string[];
  drawingMode?: string;
  existingDrawings?: ChartDrawing[];
}

export interface ChartDrawing {
  id: string;
  type: string;
}

// ===== Chart Analysis Types =====

export interface ChartAnalysisResult {
  chartData?: ChartData;
  analysis?: ChartAnalysis;
  recommendedActions?: RecommendedAction[];
}

export interface ChartData {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  currentPrice: number;
  priceRange: PriceRange;
  volumeInfo: VolumeInfo;
  timeRange: TimeRange;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceRange {
  high: number;
  low: number;
  average: number;
  volatility: number;
}

export interface VolumeInfo {
  average: number;
  current: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

export interface ChartAnalysis {
  supportLevels: PriceLevel[];
  resistanceLevels: PriceLevel[];
  trendLines: TrendLine[];
  patterns: ChartPattern[];
  indicators: IndicatorValue[];
}

export interface PriceLevel {
  price: number;
  strength: number;
  touches: number;
  type: 'support' | 'resistance';
}

export interface TrendLine {
  startPoint: ChartPoint;
  endPoint: ChartPoint;
  slope: number;
  strength: number;
  type: 'support' | 'resistance' | 'neutral';
}

export interface ChartPoint {
  time: number;
  price: number;
}

export interface ChartPattern {
  type: string;
  confidence: number;
  points: ChartPoint[];
  description: string;
}

export interface IndicatorValue {
  name: string;
  value: number | Record<string, number>;
  signal?: 'buy' | 'sell' | 'neutral';
}

export interface RecommendedAction {
  type: string;
  priority: number;
  description: string;
  parameters?: Record<string, unknown>;
}

// ===== Operation Types =====

export type OperationType = 
  | 'symbol_change' 
  | 'timeframe_change' 
  | 'chart_operation' 
  | 'indicator_control' 
  | 'drawing_operation' 
  | 'analysis_operation'
  | 'batch_operation';

export type ExecutionMode = 'immediate' | 'deferred' | 'sequential';

export interface ChartOperation {
  type: OperationType;
  action: string;
  parameters: ChartOperationParameters;
  description: string;
  clientEvent?: ClientEvent;
  executionMode?: ExecutionMode;
  repeatCount?: number;
}

export interface ChartOperationParameters {
  symbol?: string;
  timeframe?: string;
  indicatorName?: string;
  enabled?: boolean;
  drawingType?: string;
  points?: ChartPoint[];
  [key: string]: unknown; // Allow additional parameters
}

export interface ClientEvent {
  event: string;
  data: ClientEventData;
}

export interface ClientEventData {
  action?: string;
  symbol?: string;
  timeframe?: string;
  indicator?: string;
  enabled?: boolean;
  type?: string;
  [key: string]: unknown;
}

// ===== Number Extraction Types =====

export interface NumberExtractionResult {
  count: number;
  type: 'explicit' | 'implicit';
}

// ===== AI Analysis Types =====

export interface AIAnalysisResult {
  operations: ChartOperation[];
  reasoning: string;
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  userIntent: string;
  requiresMultiple: boolean;
}

// ===== Tool Response Types =====

export interface EnhancedChartControlResponse {
  success: boolean;
  operations: ChartOperation[];
  response: string;
  reasoning: string;
  metadata: ResponseMetadata;
  error?: string;
}

export interface ResponseMetadata {
  confidence: number;
  complexity: 'simple' | 'moderate' | 'complex';
  aiEnhanced: boolean;
  multipleOperations: boolean;
  chartDataUsed?: boolean;
}

// ===== Message Types =====

export interface ConversationMessage {
  role: string;
  content: string;
}

// ===== Type Guards =====

export function isChartData(data: unknown): data is ChartData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.symbol === 'string' &&
    typeof obj.timeframe === 'string' &&
    Array.isArray(obj.candles) &&
    typeof obj.currentPrice === 'number'
  );
}

export function isChartOperation(op: unknown): op is ChartOperation {
  if (typeof op !== 'object' || op === null) return false;
  const obj = op as Record<string, unknown>;
  
  return (
    typeof obj.type === 'string' &&
    typeof obj.action === 'string' &&
    typeof obj.parameters === 'object' &&
    typeof obj.description === 'string'
  );
}

export function isAIAnalysisResult(result: unknown): result is AIAnalysisResult {
  if (typeof result !== 'object' || result === null) return false;
  const obj = result as Record<string, unknown>;
  
  return (
    Array.isArray(obj.operations) &&
    typeof obj.reasoning === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.userIntent === 'string'
  );
}