/**
 * Type definitions for UI events and custom events
 */

// ===== Chart Event Types =====

export interface DrawingPoint {
  time: number;
  value?: number;
  price?: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabels: boolean;
}

export interface DrawingData {
  id?: string;
  points: DrawingPoint[];
  style?: DrawingStyle;
  metadata?: Record<string, unknown>;
}

export interface DrawTrendlineEventDetail {
  points?: DrawingPoint[];
  multiple?: boolean;
  drawings?: DrawingData[];
  style?: DrawingStyle;
}

export interface SymbolChangeEventDetail {
  symbol: string;
}

export interface TimeframeChangeEventDetail {
  timeframe: string;
}

export interface IndicatorToggleEventDetail {
  indicator: string;
  enabled: boolean;
}

export interface DrawingAddedEventDetail {
  drawing: {
    id: string;
    type: string;
    points: DrawingPoint[];
    style: DrawingStyle;
  };
}

// ===== Custom Event Map =====

export interface CustomEventMap {
  'symbol:change': CustomEvent<SymbolChangeEventDetail>;
  'timeframe:change': CustomEvent<TimeframeChangeEventDetail>;
  'indicator:toggle': CustomEvent<IndicatorToggleEventDetail>;
  'draw:trendline': CustomEvent<DrawTrendlineEventDetail>;
  'drawing:added': CustomEvent<DrawingAddedEventDetail>;
}

// ===== Event Helper Types =====

export type CustomEventListener<K extends keyof CustomEventMap> = (
  event: CustomEventMap[K]
) => void;

export function createCustomEvent<K extends keyof CustomEventMap>(
  type: K,
  detail: CustomEventMap[K]['detail']
): CustomEventMap[K] {
  return new CustomEvent(type, { detail }) as CustomEventMap[K];
}

export function addEventListener<K extends keyof CustomEventMap>(
  type: K,
  listener: CustomEventListener<K>,
  options?: AddEventListenerOptions
): void {
  window.addEventListener(type, listener as EventListener, options);
}

export function removeEventListener<K extends keyof CustomEventMap>(
  type: K,
  listener: CustomEventListener<K>,
  options?: EventListenerOptions
): void {
  window.removeEventListener(type, listener as EventListener, options);
}

export function dispatchCustomEvent<K extends keyof CustomEventMap>(
  type: K,
  detail: CustomEventMap[K]['detail']
): void {
  window.dispatchEvent(createCustomEvent(type, detail));
}

// ===== Type Guards =====

export function isDrawingPoint(value: unknown): value is DrawingPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj['time'] === 'number' &&
    (obj['value'] === undefined || typeof obj['value'] === 'number') &&
    (obj['price'] === undefined || typeof obj['price'] === 'number')
  );
}

export function isDrawingData(value: unknown): value is DrawingData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj['points']) &&
    (obj['points'] as unknown[]).every(isDrawingPoint)
  );
}

// ===== Window Type Extension =====

declare global {
  interface WindowEventMap extends CustomEventMap {}
}