// Mock for schema/drawing.ts
// 更新: 2025-06-26 - テスト環境でのschema/drawing.tsモック

import { z } from 'zod';

// Mock DrawingPointSchema with extend method
export const DrawingPointSchema = z.object({
  time: z.number(),
  value: z.number(),
}).extend({
  type: z.string().optional(),
  label: z.string().optional(),
});

// Mock DrawingStyleSchema
export const DrawingStyleSchema = z.object({
  color: z.string(),
  lineWidth: z.number(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  showLabels: z.boolean().optional(),
});

// Mock PatternVisualizationSchema
export const PatternVisualizationSchema = z.object({
  keyPoints: z.array(DrawingPointSchema).min(1),
  lines: z.array(z.object({
    from: z.number(),
    to: z.number(),
    type: z.string(),
    style: DrawingStyleSchema.optional(),
  })).optional(),
  areas: z.array(z.any()).optional(),
});

// Mock MetricsSchema
export const MetricsSchema = z.object({
  target_level: z.number().optional(),
  stop_loss: z.number().optional(),
  breakout_level: z.number().optional(),
  patternType: z.string().optional(),
  tradingImplication: z.enum(['bullish', 'bearish', 'neutral']).optional(),
  lines: z.array(z.any()).optional(),
  areas: z.array(z.any()).optional(),
});

// Mock DrawingTypeSchema (from types/drawing)
export const DrawingTypeSchema = z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']);

// Mock ValidatedDrawingSchema
export const ValidatedDrawingSchema = z.object({
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1),
  style: DrawingStyleSchema.optional(),
  price: z.number().optional(),
  time: z.number().optional(),
  levels: z.array(z.number()).optional(),
  metadata: MetricsSchema.optional(),
});

// Type exports
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type PatternVisualization = z.infer<typeof PatternVisualizationSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type ValidatedDrawing = z.infer<typeof ValidatedDrawingSchema>;

// Mock validation helpers
export function validateDrawingData(data: unknown): ValidatedDrawing {
  return ValidatedDrawingSchema.parse(data);
}

export function safeValidateDrawingData(data: unknown): { success: true; data: ValidatedDrawing } | { success: false; error: string } {
  const result = ValidatedDrawingSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  };
}