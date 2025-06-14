/**
 * All Event Types Registry
 * 
 * 統一されたイベントタイプ定義
 * SSE、CustomEvent、UIイベントすべてに対応
 */

import { z } from 'zod';

// ========================================
// 1. Drawing Events
// ========================================
export const DrawingEventTypes = {
  'draw:trendline': z.object({
    points: z.array(z.object({
      time: z.number(),
      value: z.number(),
    })).length(2),
    style: z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
      lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    }).optional(),
  }),
  
  'draw:fibonacci': z.object({
    points: z.array(z.object({
      time: z.number(),
      value: z.number(),
    })).length(2),
    levels: z.array(z.number()).optional(),
  }),
  
  'draw:horizontal': z.object({
    price: z.number(),
    style: z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
    }).optional(),
  }),
  
  'draw:vertical': z.object({
    time: z.number(),
    style: z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
    }).optional(),
  }),
} as const;

// ========================================
// 2. Chart Control Events
// ========================================
export const ChartControlEventTypes = {
  'chart:fitContent': z.object({}).optional(),
  
  'chart:startDrawing': z.object({
    type: z.enum(['trendline', 'horizontal', 'vertical', 'fibonacci', 'rectangle', 'ellipse', 'pattern']),
    style: z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
    }).optional(),
  }),
  
  'chart:addDrawing': z.object({
    id: z.string(),
    type: z.string(),
    points: z.array(z.object({
      time: z.number(),
      value: z.number(),
    })),
    style: z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
      lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
      showLabels: z.boolean().optional(),
    }).optional(),
  }),
  
  'chart:deleteDrawing': z.object({
    id: z.string(),
  }),
  
  'chart:clearAllDrawings': z.object({}).optional(),
  
  'chart:setDrawingMode': z.object({
    mode: z.enum(['none', 'trendline', 'horizontal', 'vertical', 'fibonacci', 'rectangle', 'ellipse']),
  }),
  
  'chart:undo': z.object({
    steps: z.number().default(1),
  }).optional(),
  
  'chart:redo': z.object({
    steps: z.number().default(1),
  }).optional(),
  
  'chart:zoomIn': z.object({
    factor: z.number().optional(),
  }).optional(),
  
  'chart:zoomOut': z.object({
    factor: z.number().optional(),
  }).optional(),
} as const;

// ========================================
// 3. UI Control Events
// ========================================
export const UIControlEventTypes = {
  'ui:changeSymbol': z.object({
    symbol: z.string(),
  }),
  
  'ui:changeTimeframe': z.object({
    timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']),
  }),
  
  'ui:toggleIndicator': z.object({
    indicator: z.enum(['ma', 'ema', 'boll', 'rsi', 'macd', 'volume']),
    enabled: z.boolean(),
  }),
  
  'ui:updateIndicatorSetting': z.object({
    indicator: z.string(),
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
} as const;

// ========================================
// 4. Proposal Events
// ========================================
export const ProposalEventTypes = {
  'proposal:approve': z.object({
    proposalId: z.string(),
    groupId: z.string().optional(),
  }),
  
  'proposal:reject': z.object({
    proposalId: z.string(),
    groupId: z.string().optional(),
    reason: z.string().optional(),
  }),
  
  'proposal:approve-all': z.object({
    groupId: z.string(),
  }),
  
  'proposal:reject-all': z.object({
    groupId: z.string(),
    reason: z.string().optional(),
  }),
} as const;

// ========================================
// 5. Pattern Events
// ========================================
export const PatternEventTypes = {
  'chart:addPattern': z.object({
    id: z.string(),
    pattern: z.object({
      type: z.string(),
      visualization: z.object({
        lines: z.array(z.object({
          time: z.number(),
          value: z.number(),
        })).optional(),
        zones: z.array(z.object({
          id: z.string(),
          points: z.array(z.object({ time: z.number(), value: z.number() })),
        })).optional(),
        markers: z.array(z.object({
          time: z.number(),
          value: z.number(),
          text: z.string(),
        })).optional(),
      }),
      metrics: z.object({
        target_level: z.number().optional(),
        stop_loss: z.number().optional(),
        breakout_level: z.number().optional(),
      }).optional(),
    }),
  }),
  
  'chart:removePattern': z.object({
    id: z.string(),
  }),
  
  'chart:updatePatternStyle': z.object({
    patternId: z.string(),
    patternStyle: z.object({
      color: z.string().optional(),
      fillColor: z.string().optional(),
      opacity: z.number().optional(),
    }).optional(),
    lineStyles: z.record(z.string(), z.object({
      color: z.string().optional(),
      lineWidth: z.number().optional(),
      lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    })).optional(),
    immediate: z.boolean().optional(),
  }),
} as const;

// ========================================
// 6. System Events
// ========================================
export const SystemEventTypes = {
  'ping': z.object({
    timestamp: z.number().optional(),
  }).optional(),
  
  'ui-event': z.object({
    event: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
  
  'error': z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.union([
      z.string(),
      z.record(z.string(), z.unknown())
    ]).optional(),
  }),
} as const;

// ========================================
// All Event Types Union
// ========================================
export const AllEventTypes = {
  ...DrawingEventTypes,
  ...ChartControlEventTypes,
  ...UIControlEventTypes,
  ...ProposalEventTypes,
  ...PatternEventTypes,
  ...SystemEventTypes,
} as const;

// Type definitions
export type EventTypeName = keyof typeof AllEventTypes;
export type EventPayload<T extends EventTypeName> = z.infer<typeof AllEventTypes[T]>;

// ========================================
// Validation Utilities
// ========================================
export function validateEventPayload<T extends EventTypeName>(
  eventType: T,
  payload: unknown
): { success: true; data: EventPayload<T> } | { success: false; error: z.ZodError } {
  const schema = AllEventTypes[eventType];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([{
        code: 'custom',
        message: `Unknown event type: ${eventType}`,
        path: [],
      }]),
    };
  }
  
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data as EventPayload<T> };
  } else {
    return { success: false, error: result.error };
  }
}

// ========================================
// Event Creation Helpers
// ========================================
export function createTypedEvent<T extends EventTypeName>(
  eventType: T,
  payload?: EventPayload<T>
): CustomEvent {
  // Optional events don't require payload
  if (AllEventTypes[eventType].isOptional() && !payload) {
    return new CustomEvent(eventType, { detail: {} });
  }
  
  const validation = validateEventPayload(eventType, payload);
  if (!validation.success) {
    throw new Error(`Invalid payload for ${eventType}: ${validation.error.message}`);
  }
  
  return new CustomEvent(eventType, {
    detail: validation.data,
  });
}

// ========================================
// Event Type Groups
// ========================================
export const EventGroups = {
  drawing: Object.keys(DrawingEventTypes) as (keyof typeof DrawingEventTypes)[],
  chart: Object.keys(ChartControlEventTypes) as (keyof typeof ChartControlEventTypes)[],
  ui: Object.keys(UIControlEventTypes) as (keyof typeof UIControlEventTypes)[],
  proposal: Object.keys(ProposalEventTypes) as (keyof typeof ProposalEventTypes)[],
  pattern: Object.keys(PatternEventTypes) as (keyof typeof PatternEventTypes)[],
  system: Object.keys(SystemEventTypes) as (keyof typeof SystemEventTypes)[],
} as const;

// Get all event types as array
export const ALL_EVENT_TYPES = Object.keys(AllEventTypes) as EventTypeName[];

// ========================================
// Type Guards
// ========================================
export function isDrawingEvent(eventType: string): eventType is keyof typeof DrawingEventTypes {
  return eventType in DrawingEventTypes;
}

export function isChartEvent(eventType: string): eventType is keyof typeof ChartControlEventTypes {
  return eventType in ChartControlEventTypes;
}

export function isUIEvent(eventType: string): eventType is keyof typeof UIControlEventTypes {
  return eventType in UIControlEventTypes;
}

export function isProposalEvent(eventType: string): eventType is keyof typeof ProposalEventTypes {
  return eventType in ProposalEventTypes;
}

export function isPatternEvent(eventType: string): eventType is keyof typeof PatternEventTypes {
  return eventType in PatternEventTypes;
}

export function isSystemEvent(eventType: string): eventType is keyof typeof SystemEventTypes {
  return eventType in SystemEventTypes;
}

// ========================================
// SSE Event Data Type
// ========================================
export interface SSEEventData<T extends EventTypeName = EventTypeName> {
  event: T;
  data: EventPayload<T>;
  timestamp?: number;
  metadata?: {
    source?: string;
    sessionId?: string;
    correlationId?: string;
  };
}