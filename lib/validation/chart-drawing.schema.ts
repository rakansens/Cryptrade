import { z } from 'zod';
import { DrawingPointSchema, DrawingStyleSchema, DrawingTypeSchema, DrawingModeSchema } from '@/types/drawing';

// Chart Drawing Schema
export const ChartDrawingSchema = z.object({
  id: z.string().min(1),
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1).max(10),
  style: DrawingStyleSchema,
  visible: z.boolean(),
  interactive: z.boolean(),
  metadata: z.record(z.string(), z.any()).optional(),
  price: z.number().optional(),
  time: z.number().optional(),
  levels: z.array(z.number()).optional()
});

// Re-import from types/pattern.ts to avoid duplication
import { PatternTypeSchema } from '@/types/pattern';

// Additional pattern types not in main schema (if needed)
export const ExtendedPatternTypeSchema = z.enum([
  'headAndShoulders',
  'inverseHeadAndShoulders',
  'doubleTop',
  'doubleBottom',
  'tripleTop',
  'tripleBottom',
  'ascendingTriangle',
  'descendingTriangle',
  'symmetricalTriangle',
  'wedge',
  'flag',
  'pennant',
  'channel',
  'rectangle',
  'cup',
  'cupAndHandle'
]);

// Trading Implication Schema
export const TradingImplicationSchema = z.enum(['bullish', 'bearish', 'neutral']);

// Pattern Visualization Schema
export const PatternVisualizationSchema = z.object({
  lines: z.array(z.object({
    id: z.string(),
    points: z.array(DrawingPointSchema),
    style: DrawingStyleSchema.partial().optional()
  })).optional(),
  zones: z.array(z.object({
    id: z.string(),
    points: z.array(DrawingPointSchema),
    style: z.object({
      fillColor: z.string().optional(),
      opacity: z.number().min(0).max(1).optional()
    }).optional()
  })).optional(),
  markers: z.array(z.object({
    time: z.number(),
    value: z.number(),
    text: z.string(),
    style: z.object({
      color: z.string().optional(),
      shape: z.string().optional()
    }).optional()
  })).optional()
});

// Pattern Metrics Schema
export const PatternMetricsSchema = z.object({
  entryPrice: z.number().optional(),
  targetPrice: z.number().optional(),
  stopLoss: z.number().optional(),
  riskReward: z.number().optional(),
  confidence: z.number().min(0).max(1).optional()
});

// Pattern Data Schema
export const PatternDataSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  symbol: z.string().optional(),
  interval: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  description: z.string().optional(),
  visualization: z.any(),
  metrics: z.record(z.string(), z.any()).optional(),
  tradingImplication: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

// Validation helpers
export function validateDrawing(drawing: unknown): ChartDrawing {
  return ChartDrawingSchema.parse(drawing);
}

export function validateDrawingPoints(points: unknown[]): DrawingPoint[] {
  return z.array(DrawingPointSchema).parse(points);
}

export function isValidDrawing(drawing: unknown): drawing is ChartDrawing {
  return ChartDrawingSchema.safeParse(drawing).success;
}

// Type exports
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type DrawingType = z.infer<typeof DrawingTypeSchema>;
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export type PatternVisualization = z.infer<typeof PatternVisualizationSchema>;
export type PatternMetrics = z.infer<typeof PatternMetricsSchema>;
export type PatternData = z.infer<typeof PatternDataSchema>;
export type DrawingMode = z.infer<typeof DrawingModeSchema>;