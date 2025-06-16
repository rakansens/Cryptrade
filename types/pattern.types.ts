/**
 * Type definitions for pattern-related functionality
 */

import type { LineStyle, LineWidth } from 'lightweight-charts';

// ===== Pattern Types =====

export interface PatternRenderVisualization {
  type: 'triangle' | 'channel' | 'wedge' | 'pennant' | 'flag';
  points: PatternPoint[];
  lines?: PatternLine[];
  channels?: PatternChannel[];
  labels?: PatternLabel[];
}

export interface PatternPoint {
  time: number;
  value: number;
  type?: 'high' | 'low' | 'close' | 'open';
}

export interface PatternLine {
  point1: PatternPoint;
  point2: PatternPoint;
  color?: string;
  width?: LineWidth;
  style?: LineStyle;
}

export interface PatternChannel {
  upperLine: PatternLine;
  lowerLine: PatternLine;
  fillColor?: string;
  fillOpacity?: number;
}

export interface PatternLabel {
  point: PatternPoint;
  text: string;
  color?: string;
  fontSize?: number;
}

export interface PatternMetrics {
  height?: number;
  width?: number;
  angle?: number;
  retracement?: number;
  volume?: number;
  priceChange?: number;
  duration?: number;
  confidence?: number;
  strength?: number;
  breakoutProbability?: number;
  stopLoss?: number;
  entryPrice?: number;
  targetPrice?: number;
  riskReward?: number;
  breakoutLevel?: number;
  targetLevel?: number;
  supportLevel?: number;
  resistanceLevel?: number;
}

export interface PatternState {
  id: string;
  type: string;
  visualization: PatternRenderVisualization;
  metrics?: PatternMetrics;
  timestamp: number;
}

// ===== Pattern Renderer Types =====

export interface PatternRendererState {
  patterns: Map<string, RenderedPattern>;
  metricLinesDetails?: MetricLineDetail[];
}

export interface RenderedPattern {
  id: string;
  type: string;
  lines: string[]; // Line IDs
  markers?: string[]; // Marker IDs
  metricLines?: string[]; // Metric line IDs
}

export interface MetricLineDetail {
  id: string;
  lineCount: number;
}

export interface PatternRenderer {
  renderPattern(
    id: string,
    visualization: PatternRenderVisualization,
    patternType: string,
    metrics?: PatternMetrics
  ): void;
  
  removePattern(id: string): void;
  
  removeAllPatterns(): void;
  
  debugGetState(): PatternRendererState;
  
  updateTimeScale(timeScale: unknown): void;
}

// ===== Pattern Debug Types =====

export interface PatternDebugState {
  count: number;
  ids: string[];
  timestamp: string;
}

// ===== Type Guards =====

// Export PatternVisualization as alias for PatternRenderVisualization
export type PatternVisualization = PatternRenderVisualization;

export function isPatternVisualization(value: unknown): value is PatternRenderVisualization {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj['type'] === 'string' &&
    ['triangle', 'channel', 'wedge', 'pennant', 'flag'].includes(obj['type'] as string) &&
    Array.isArray(obj['points'])
  );
}

export function isPatternMetrics(value: unknown): value is PatternMetrics {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return Object.values(obj).some(v => typeof v === 'number');
}

export function isPatternRenderer(value: unknown): value is PatternRenderer {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj['renderPattern'] === 'function' &&
    typeof obj['removePattern'] === 'function' &&
    typeof obj['removeAllPatterns'] === 'function'
  );
}
