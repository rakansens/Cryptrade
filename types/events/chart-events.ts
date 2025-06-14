import { z } from 'zod';

// Basic schemas for common types
const ChartPointSchema = z.object({
  time: z.number(),
  value: z.number(),
});

const DrawingStyleSchema = z.object({
  color: z.string().optional(),
  lineWidth: z.number().optional(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  showLabels: z.boolean().optional(),
});

const DrawingTypeSchema = z.enum([
  'trendline',
  'horizontal',
  'vertical',
  'fibonacci',
  'rectangle',
  'ellipse',
  'pattern',
  'none'
]);

// Event payload schemas
export const ChartEventSchemas = {
  // Drawing events
  addDrawing: z.object({
    id: z.string(),
    type: DrawingTypeSchema,
    points: z.array(ChartPointSchema).min(1),
    style: DrawingStyleSchema.optional(),
    price: z.number().optional(), // for horizontal lines
    time: z.number().optional(), // for vertical lines
    levels: z.array(z.number()).optional(), // for fibonacci
  }),

  deleteDrawing: z.object({
    id: z.string(),
  }),

  updateDrawingStyle: z.object({
    drawingId: z.string().optional(), // New format
    id: z.string().optional(), // Legacy support
    style: DrawingStyleSchema,
    immediate: z.boolean().optional(),
  }).refine(data => data.drawingId || data.id, {
    message: "Either 'drawingId' or 'id' must be provided"
  }).transform(data => ({
    drawingId: data.drawingId || data.id || '',
    style: data.style,
    immediate: data.immediate,
  })),

  // Pattern events
  addPattern: z.object({
    id: z.string(),
    pattern: z.object({
      type: z.string(),
      visualization: z.object({
        keyPoints: z.array(z.object({
          time: z.number(),
          value: z.number(),
          type: z.string().optional(),
          label: z.string().optional(),
        })).min(1),
        lines: z.array(z.object({
          from: z.number(),
          to: z.number(),
          type: z.string(),
          style: DrawingStyleSchema.optional(),
        })).optional(),
        areas: z.array(z.object({
          id: z.string(),
          points: z.array(z.object({ time: z.number(), value: z.number() })),
          style: z.object({
            fillColor: z.string().optional(),
            opacity: z.number().optional(),
          }).optional(),
        })).optional(),
      }),
      metrics: z.object({
        target_level: z.number().optional(),
        stop_loss: z.number().optional(),
        breakout_level: z.number().optional(),
      }).optional(),
      trading_implication: z.enum(['bullish', 'bearish', 'neutral']).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
  }),

  updatePatternStyle: z.object({
    patternId: z.string(),
    patternStyle: z.object({
      baseStyle: DrawingStyleSchema.optional(),
    }).optional(),
    lineStyles: z.record(z.string(), DrawingStyleSchema).optional(),
    immediate: z.boolean().optional(),
  }),

  // Pattern removal event
  removePattern: z.object({
    id: z.string(),
  }),

  // Enhanced drawing events with metadata
  addDrawingWithMetadata: z.object({
    id: z.string(),
    type: DrawingTypeSchema,
    points: z.array(ChartPointSchema).min(1),
    style: DrawingStyleSchema.optional(),
    price: z.number().optional(),
    time: z.number().optional(),
    levels: z.array(z.number()).optional(),
    metadata: z.object({
      symbol: z.string().optional(),
      interval: z.string().optional(),
      proposalId: z.string().optional(),
      proposalGroup: z.string().optional(),
      approvedAt: z.string().optional(),
    }).optional(),
  }),

  // Chart control events
  fitContent: z.object({}).optional(),
  
  zoomIn: z.object({
    factor: z.number().optional(),
  }).optional(),
  
  zoomOut: z.object({
    factor: z.number().optional(),
  }).optional(),
} as const;

// Type exports
export type ChartEventType = keyof typeof ChartEventSchemas;
export type ChartEventPayload<T extends ChartEventType> = z.infer<typeof ChartEventSchemas[T]>;

// Validation utilities
export function validateChartEvent<T extends ChartEventType>(
  eventType: T,
  payload: unknown
): { success: true; data: ChartEventPayload<T> } | { success: false; error: z.ZodError } {
  const schema = ChartEventSchemas[eventType];
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
    return { success: true, data: result.data as ChartEventPayload<T> };
  } else {
    return { success: false, error: result.error };
  }
}

// Helper to create validated events
export function createChartEvent<T extends ChartEventType>(
  eventType: T,
  payload: ChartEventPayload<T>
): CustomEvent {
  const validation = validateChartEvent(eventType, payload);
  if (!validation.success) {
    throw new Error(`Invalid payload for ${eventType}: ${validation.error.message}`);
  }
  
  return new CustomEvent(`chart:${eventType}`, {
    detail: validation.data,
  });
}

// Re-export common schemas for use in other files
export { ChartPointSchema, DrawingStyleSchema, DrawingTypeSchema };