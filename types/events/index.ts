/**
 * Unified Event Type Definitions
 * 
 * This file consolidates all event-related type definitions to ensure consistency
 * across the application and reduce duplication.
 */

/**
 * Base event interface that all events must extend
 */
export interface BaseEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  correlationId?: string;
  source?: string;
}

/**
 * UI Event for user interface interactions
 */
export interface UIEvent extends BaseEvent {
  event: string;
  data: unknown;
  userId?: string;
  deviceId?: string;
}

/**
 * System event for internal system operations
 */
export interface SystemEvent extends BaseEvent {
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Market event for market data updates
 */
export interface MarketEvent extends BaseEvent {
  symbol: string;
  exchange: string;
  data: unknown;
}

/**
 * Trading event for trading-related activities
 */
export interface TradingEvent extends BaseEvent {
  action: 'signal' | 'order' | 'execution' | 'cancellation';
  symbol: string;
  details: unknown;
}

/**
 * Chart event for chart-related interactions
 */
export interface ChartEvent extends BaseEvent {
  chartId: string;
  action: string;
  payload: unknown;
}

/**
 * Analysis event for AI/ML analysis results
 */
export interface AnalysisEvent extends BaseEvent {
  analysisType: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  result?: unknown;
  progress?: number;
  error?: string;
}

/**
 * WebSocket event wrapper
 */
export interface WebSocketEvent extends BaseEvent {
  connection: 'open' | 'close' | 'error' | 'message';
  url?: string;
  data?: unknown;
  error?: string;
}

/**
 * Event metadata for tracking and debugging
 */
export interface EventMetadata {
  version: string;
  environment: string;
  userAgent?: string;
  ipAddress?: string;
  traceId?: string;
}

/**
 * Enhanced event with metadata
 */
export interface EnhancedEvent<T extends BaseEvent = BaseEvent> {
  event: T;
  metadata: EventMetadata;
}

/**
 * Event handler type
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void | Promise<void>;

/**
 * Event subscription interface
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  filter?: (event: BaseEvent) => boolean;
  once?: boolean;
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  emit<T extends BaseEvent>(event: T): void;
  on<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): EventSubscription;
  off(subscriptionId: string): void;
  once<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): EventSubscription;
}

/**
 * Helper function to create a base event
 */
export function createBaseEvent(type: string, overrides?: Partial<BaseEvent>): BaseEvent {
  return {
    type,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Helper function to create a UI event
 */
export function createUIEvent(
  event: string,
  data: unknown,
  overrides?: Partial<UIEvent>
): UIEvent {
  return {
    ...createBaseEvent('ui', overrides),
    event,
    data,
    ...overrides,
  };
}

/**
 * Helper function to create a system event
 */
export function createSystemEvent(
  severity: SystemEvent['severity'],
  component: string,
  message: string,
  metadata?: Record<string, unknown>
): SystemEvent {
  return {
    ...createBaseEvent('system'),
    severity,
    component,
    message,
    metadata,
  };
}

/**
 * Type guard to check if an event is a UI event
 */
export function isUIEvent(event: BaseEvent): event is UIEvent {
  return event.type === 'ui' && 'event' in event && 'data' in event;
}

/**
 * Type guard to check if an event is a system event
 */
export function isSystemEvent(event: BaseEvent): event is SystemEvent {
  return event.type === 'system' && 'severity' in event && 'component' in event;
}

/**
 * Type guard to check if an event is a market event
 */
export function isMarketEvent(event: BaseEvent): event is MarketEvent {
  return event.type === 'market' && 'symbol' in event && 'exchange' in event;
}

/**
 * Type guard to check if an event is an analysis event
 */
export function isAnalysisEvent(event: BaseEvent): event is AnalysisEvent {
  return event.type === 'analysis' && 'analysisType' in event && 'status' in event;
}

/**
 * Re-export chart event types for compatibility
 */
export * from './chart-events';