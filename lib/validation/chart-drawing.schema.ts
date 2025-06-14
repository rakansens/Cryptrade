import { z } from 'zod';

// Drawing Point Schema
export const DrawingPointSchema = z.object({
  time: z.number().int().positive(),
  value: z.number()
});

// Drawing Style Schema
export const DrawingStyleSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  lineWidth: z.number().int().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  showLabels: z.boolean()
});

// Drawing Type Schema
export const DrawingTypeSchema = z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']);

// Chart Drawing Schema
export const ChartDrawingSchema = z.object({
  id: z.string().min(1),
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1).max(10), // Most drawings need 1-2 points
  style: DrawingStyleSchema.partial().optional(),
  price: z.number().optional(),
  time: z.number().optional(),
  levels: z.array(z.number()).optional(),
  visible: z.boolean().optional().default(true),
  interactive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  ])).optional()
});

// Pattern Type Schema
export const PatternTypeSchema = z.enum([
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
  id: z.string().min(1),
  type: PatternTypeSchema,
  symbol: z.string().min(1),
  interval: z.string().min(1),
  startTime: z.number().positive(),
  endTime: z.number().positive(),
  visualization: PatternVisualizationSchema,
  metrics: PatternMetricsSchema.optional(),
  description: z.string().optional(),
  tradingImplication: TradingImplicationSchema,
  confidence: z.number().min(0).max(1)
});

// Drawing Mode Schema
export const DrawingModeSchema = z.enum(['none', 'trendline', 'fibonacci', 'horizontal', 'vertical']);

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