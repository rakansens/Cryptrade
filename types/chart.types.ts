/**
 * Type definitions for chart drawing and rendering
 */

import type { Time, SeriesDataItemTypeMap, ISeriesApi, SeriesType } from 'lightweight-charts';

// ===== Drawing Types =====

export type DrawingType = 
  | 'horizontal' 
  | 'vertical' 
  | 'trendline' 
  | 'rectangle' 
  | 'fibonacci'
  | 'channel'
  | 'pitchfork'
  | 'text'
  | 'arrow';

export interface DrawingPoint {
  time: Time;
  value: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabels?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ChartDrawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  interactive: boolean;
  metadata?: DrawingMetadata;
}

export interface DrawingMetadata {
  label?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

// ===== Fibonacci Types =====

export interface FibonacciLevel {
  level: number;
  label: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export const DEFAULT_FIBONACCI_LEVELS: FibonacciLevel[] = [
  { level: 0, label: '0%' },
  { level: 0.236, label: '23.6%' },
  { level: 0.382, label: '38.2%' },
  { level: 0.5, label: '50%' },
  { level: 0.618, label: '61.8%' },
  { level: 0.786, label: '78.6%' },
  { level: 1, label: '100%' },
  { level: 1.618, label: '161.8%' },
  { level: 2.618, label: '261.8%' },
];

// ===== Series Data Types =====

export type CandlestickData = SeriesDataItemTypeMap['Candlestick'];
export type LineData = SeriesDataItemTypeMap['Line'];
export type AreaData = SeriesDataItemTypeMap['Area'];
export type BarData = SeriesDataItemTypeMap['Bar'];
export type HistogramData = SeriesDataItemTypeMap['Histogram'];

export type ChartSeriesData = 
  | CandlestickData
  | LineData
  | AreaData
  | BarData
  | HistogramData;

// ===== Trend Line Types =====

export interface TrendLinePoint {
  time: Time;
  value: number;
}

export interface TrendLineData {
  start: TrendLinePoint;
  end: TrendLinePoint;
  extrapolate?: boolean;
  showPriceLabels?: boolean;
}

// ===== Rectangle Types =====

export interface RectangleData {
  topLeft: DrawingPoint;
  bottomRight: DrawingPoint;
  fillColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
}

// ===== Text Annotation Types =====

export interface TextAnnotation {
  position: DrawingPoint;
  text: string;
  style: TextStyle;
  anchor?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface TextStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
}

// ===== Drawing Event Types =====

export interface DrawingEvent {
  type: 'create' | 'update' | 'delete' | 'select' | 'deselect';
  drawing: ChartDrawing;
  timestamp: number;
}

export interface DrawingInteractionEvent {
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'dblclick';
  drawing: ChartDrawing;
  point: DrawingPoint;
  originalEvent: MouseEvent;
}

// ===== Renderer Types =====

export interface DrawingRendererOptions {
  enableInteraction?: boolean;
  enableSnapping?: boolean;
  snapThreshold?: number;
  enableMagnet?: boolean;
  magnetThreshold?: number;
  defaultStyle?: Partial<DrawingStyle>;
}

export interface DrawingHandle {
  id: string;
  drawingId: string;
  type: 'start' | 'end' | 'control' | 'resize';
  position: DrawingPoint;
  visible: boolean;
  active: boolean;
}

// ===== Type Guards =====

export function isHorizontalDrawing(drawing: ChartDrawing): boolean {
  return drawing.type === 'horizontal';
}

export function isVerticalDrawing(drawing: ChartDrawing): boolean {
  return drawing.type === 'vertical';
}

export function isTrendlineDrawing(drawing: ChartDrawing): boolean {
  return drawing.type === 'trendline';
}

export function isFibonacciDrawing(drawing: ChartDrawing): boolean {
  return drawing.type === 'fibonacci';
}

export function hasMetadata(drawing: ChartDrawing): drawing is ChartDrawing & { metadata: DrawingMetadata } {
  return drawing.metadata !== undefined;
}

// ===== Utility Types =====

export interface DrawingBounds {
  minTime: Time;
  maxTime: Time;
  minValue: number;
  maxValue: number;
}

export interface DrawingStatistics {
  totalCount: number;
  visibleCount: number;
  byType: Record<DrawingType, number>;
  bounds: DrawingBounds;
}

// ===== Series Helper Types =====

export type ChartSeriesApi = ISeriesApi<SeriesType>;

export interface SeriesDataPoint {
  time: Time;
  value: number;
}