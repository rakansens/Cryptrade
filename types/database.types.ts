/**
 * Database type definitions
 * These types provide strict typing for JSON fields and database entities
 */

// ===== Chat Types =====

export interface ChatMessageMetadata {
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: EntryProposalGroup;
  isTyping?: boolean;
}

export interface ProposalGroup {
  id: string;
  proposals: Proposal[];
  timestamp: number;
}

export interface Proposal {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number;
}

export interface EntryProposalGroup {
  id: string;
  entries: EntryProposal[];
  timestamp: number;
}

export interface EntryProposal {
  id: string;
  entryType: 'market' | 'limit' | 'stop';
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSize: number;
  reasoning: string;
}

// ===== Analysis Types =====

export interface AnalysisResultMetadata {
  indicators: IndicatorResult[];
  patterns: PatternResult[];
  signals: Signal[];
  summary: AnalysisSummary;
}

export interface IndicatorResult {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface PatternResult {
  type: string;
  confidence: number;
  priceTarget?: number;
  stopLoss?: number;
}

export interface Signal {
  type: 'buy' | 'sell' | 'hold';
  strength: number;
  reason: string;
}

export interface AnalysisSummary {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  recommendedAction: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// ===== Pattern Analysis Types =====

export interface PatternMetadata {
  coordinates: PatternCoordinates;
  measurements: PatternMeasurements;
  validation: PatternValidation;
}

export interface PatternCoordinates {
  startPoint: { time: number; price: number };
  endPoint: { time: number; price: number };
  keyPoints: Array<{ time: number; price: number; label?: string }>;
}

export interface PatternMeasurements {
  height: number;
  width: number;
  angle: number;
  retracement?: number;
}

export interface PatternValidation {
  isValid: boolean;
  confidence: number;
  violations: string[];
}

// ===== Trade Types =====

export interface TradeMetadata {
  strategy: string;
  indicators: string[];
  marketConditions: MarketConditions;
  notes?: string;
}

export interface MarketConditions {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  volume: 'low' | 'average' | 'high';
  momentum: number;
}

export interface TradePerformanceMetrics {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
}

// ===== Alert Types =====

export interface AlertConditions {
  priceAbove?: number;
  priceBelow?: number;
  volumeAbove?: number;
  indicatorCrossover?: {
    indicator1: string;
    indicator2: string;
    direction: 'above' | 'below';
  };
  patternDetected?: string;
}

export interface AlertMetadata {
  triggerCount: number;
  lastTriggered?: string;
  snoozeUntil?: string;
  customSound?: string;
}

// ===== System Log Types =====

export interface SystemLogMetadata {
  errorCode?: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  performance?: {
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

// ===== Database Statistics Types =====

export interface DbStats {
  sessions: number;
  messages: number;
  users: number;
  drawings: number;
  analyses: number;
}

// ===== Chart Drawing Types =====

export interface ChartDrawingData {
  type: DrawingType;
  points: DrawingPoint[];
  properties: DrawingProperties;
  indicators?: ChartIndicator[];
}

export type DrawingType = 
  | 'line' 
  | 'horizontalLine' 
  | 'verticalLine' 
  | 'rectangle' 
  | 'circle' 
  | 'fibonacciRetracement' 
  | 'text' 
  | 'arrow';

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface DrawingProperties {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
}

export interface ChartIndicator {
  type: string;
  parameters: Record<string, number | string>;
  visible: boolean;
  color?: string;
}

// ===== Trade Execution Types =====

export interface TradeExecutionDetails {
  slippage: number;
  commission: number;
  executionTime: number;
  orderType: 'market' | 'limit' | 'stop' | 'stopLimit';
  fillPrice: number;
  partialFills?: Array<{
    quantity: number;
    price: number;
    timestamp: string;
  }>;
}

// ===== Type Guards =====

export function isChatMessageMetadata(data: unknown): data is ChatMessageMetadata {
  if (typeof data !== 'object' || data === null) return false;
  const metadata = data as Record<string, unknown>;
  
  if (metadata.type && !['text', 'proposal', 'entry'].includes(metadata.type as string)) {
    return false;
  }
  
  return true;
}

export function isProposalGroup(data: unknown): data is ProposalGroup {
  if (typeof data !== 'object' || data === null) return false;
  const group = data as Record<string, unknown>;
  
  return (
    typeof group.id === 'string' &&
    Array.isArray(group.proposals) &&
    typeof group.timestamp === 'number'
  );
}

export function isAnalysisResultMetadata(data: unknown): data is AnalysisResultMetadata {
  if (typeof data !== 'object' || data === null) return false;
  const metadata = data as Record<string, unknown>;
  
  return (
    Array.isArray(metadata.indicators) &&
    Array.isArray(metadata.patterns) &&
    Array.isArray(metadata.signals) &&
    typeof metadata.summary === 'object'
  );
}

export function isPatternMetadata(data: unknown): data is PatternMetadata {
  if (typeof data !== 'object' || data === null) return false;
  const metadata = data as Record<string, unknown>;
  
  return (
    typeof metadata.coordinates === 'object' &&
    typeof metadata.measurements === 'object' &&
    typeof metadata.validation === 'object'
  );
}

export function isTradeMetadata(data: unknown): data is TradeMetadata {
  if (typeof data !== 'object' || data === null) return false;
  const metadata = data as Record<string, unknown>;
  
  return (
    typeof metadata.strategy === 'string' &&
    Array.isArray(metadata.indicators) &&
    typeof metadata.marketConditions === 'object'
  );
}

export function isAlertConditions(data: unknown): data is AlertConditions {
  if (typeof data !== 'object' || data === null) return false;
  const conditions = data as Record<string, unknown>;
  
  // At least one condition should be present
  return (
    conditions.priceAbove !== undefined ||
    conditions.priceBelow !== undefined ||
    conditions.volumeAbove !== undefined ||
    conditions.indicatorCrossover !== undefined ||
    conditions.patternDetected !== undefined
  );
}

export function isChartDrawingData(data: unknown): data is ChartDrawingData {
  if (typeof data !== 'object' || data === null) return false;
  const drawing = data as Record<string, unknown>;
  
  return (
    typeof drawing.type === 'string' &&
    Array.isArray(drawing.points) &&
    typeof drawing.properties === 'object'
  );
}