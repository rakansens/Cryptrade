import { z } from 'zod';

// =============================================================================
// DRAWING DATA SCHEMAS
// =============================================================================

export const DrawingPointSchema = z.object({
  time: z.number(),
  value: z.number(),
  type: z.string().optional(),
  label: z.string().optional(),
});

export const DrawingStyleSchema = z.object({
  color: z.string().optional(),
  lineWidth: z.number().optional(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  showLabels: z.boolean().optional(),
});

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

export const MetricsSchema = z.object({
  target_level: z.number().optional(),
  stop_loss: z.number().optional(),
  breakout_level: z.number().optional(),
  patternType: z.string().optional(),
  tradingImplication: z.enum(['bullish', 'bearish', 'neutral']).optional(),
  lines: z.array(z.any()).optional(),
  areas: z.array(z.any()).optional(),
});

export const ValidatedDrawingSchema = z.object({
  type: z.enum(['pattern', 'trendline', 'fibonacci', 'horizontal', 'vertical']),
  points: z.array(DrawingPointSchema).min(1),
  style: DrawingStyleSchema.optional(),
  price: z.number().optional(),
  time: z.number().optional(),
  levels: z.array(z.number()).optional(),
  metadata: MetricsSchema.optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type PatternVisualization = z.infer<typeof PatternVisualizationSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type ValidatedDrawing = z.infer<typeof ValidatedDrawingSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate drawing data with enhanced error handling
 */
export function validateDrawingData(data: unknown): ValidatedDrawing {
  try {
    return ValidatedDrawingSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Drawing Validation] Failed:', error.errors);
      throw new Error(`Invalid drawing data: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Safe parse drawing data without throwing
 */
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