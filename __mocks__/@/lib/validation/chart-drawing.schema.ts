// Updated Mock for chart drawing schema - Matches test expectations
// Modified to align with test structure using time/value points
import { z } from 'zod';

// Drawing Point Schema - matches test expectations with time/value
export const DrawingPointSchema = z.object({
  time: z.number().int().positive(),
  value: z.number()
});

// Drawing Style Schema - matches test expectations
export const DrawingStyleSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),
  lineWidth: z.number().int().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  showLabels: z.boolean().optional().default(false)
});

// Chart Drawing Schema - matches test structure exactly
export const ChartDrawingSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']),
  points: z.array(DrawingPointSchema).min(1).max(10),
  style: DrawingStyleSchema,
  visible: z.boolean(),
  interactive: z.boolean(),
  metadata: z.record(z.any()).optional()
});

// Pattern Data Schema - includes all fields tests expect
export const PatternDataSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  symbol: z.string().min(1), 
  interval: z.string().min(1),
  startTime: z.number(),
  endTime: z.number(),
  visualization: z.record(z.any()),
  tradingImplication: z.string(),
  confidence: z.number().min(0).max(1),
  metrics: z.object({
    target: z.number().optional(),
    stopLoss: z.number().optional(),
    breakoutLevel: z.number().optional()
  }).optional()
});

// Drawing Mode Schema
export const DrawingModeSchema = z.enum(['none', 'trendline', 'fibonacci', 'horizontal', 'vertical']);

// Drawing Type Schema  
export const DrawingTypeSchema = z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']);

// Validation helper functions
export function validateDrawing(drawing: unknown) {
  return ChartDrawingSchema.parse(drawing);
}

export function validateDrawingPoints(points: unknown[]) {
  return z.array(DrawingPointSchema).parse(points);
}

export function isValidDrawing(drawing: unknown): drawing is z.infer<typeof ChartDrawingSchema> {
  return ChartDrawingSchema.safeParse(drawing).success;
}

// Type exports
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export type PatternData = z.infer<typeof PatternDataSchema>;
export type DrawingMode = z.infer<typeof DrawingModeSchema>;
export type DrawingType = z.infer<typeof DrawingTypeSchema>;

export default {
  DrawingPointSchema,
  DrawingStyleSchema,
  ChartDrawingSchema,
  PatternDataSchema,
  DrawingModeSchema,
  DrawingTypeSchema,
  validateDrawing,
  validateDrawingPoints,
  isValidDrawing
};