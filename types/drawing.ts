// Drawing related types with Zod schemas for runtime validation
// 更新: 2025-06-11 - showLabels を必須から任意 (default false) に変更し、ChartDrawing バリデーションの "Required" エラーを修正

import { z } from 'zod';

// =============================================================================
// ZOD SCHEMAS - Single source of truth for drawing types
// =============================================================================

// Drawing point schema - enforces value property (not price)
export const DrawingPointSchema = z.object({
  time: z.number().describe('Unix timestamp in seconds'),
  value: z.number().describe('Price value at this point'),
});

// Drawing style schema
export const DrawingStyleSchema = z.object({
  color: z.string(), // Accept any string for flexibility (can be hex, rgb, hsl, named colors)
  lineWidth: z.number().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  showLabels: z.boolean().optional().default(false),
});

// Drawing type enum - Note: 'pattern' is a special type that may need different handling
export const DrawingTypeSchema = z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']);

// Base drawing data schema
const BaseDrawingDataSchema = z.object({
  id: z.string().optional(),
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1),
  style: DrawingStyleSchema.optional(),
  price: z.number().optional().describe('For horizontal lines only'),
  time: z.number().optional().describe('For vertical lines only'),
  levels: z.array(z.number()).optional().describe('For fibonacci retracements'),
  metadata: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  ])).optional(),
});

// Drawing data schema with validation - used in proposals and events
export const DrawingDataSchema = BaseDrawingDataSchema.refine((data) => {
  // Type-specific validations
  if (data.type === 'trendline' && data.points.length < 2) {
    return false;
  }
  if (data.type === 'fibonacci' && data.points.length < 2) {
    return false;
  }
  if (data.type === 'horizontal' && !data.price && (!data.points[0] || data.points[0].value === undefined)) {
    return false;
  }
  if (data.type === 'vertical' && !data.time && (!data.points[0] || data.points[0].time === undefined)) {
    return false;
  }
  if (data.type === 'pattern' && (!data.metadata || !data.metadata.patternType)) {
    return false;
  }
  return true;
}, {
  message: 'Drawing data validation failed: insufficient points or missing required fields for drawing type',
});

// Chart drawing schema - extended version for store
export const ChartDrawingSchema = BaseDrawingDataSchema.extend({
  id: z.string(), // Required in store
  style: DrawingStyleSchema, // Required in store
  visible: z.boolean(),
  interactive: z.boolean(),
}).refine((data) => {
  // Same type-specific validations
  if (data.type === 'trendline' && data.points.length < 2) {
    return false;
  }
  if (data.type === 'fibonacci' && data.points.length < 2) {
    return false;
  }
  if (data.type === 'horizontal' && !data.price && (!data.points[0] || data.points[0].value === undefined)) {
    return false;
  }
  if (data.type === 'vertical' && !data.time && (!data.points[0] || data.points[0].time === undefined)) {
    return false;
  }
  if (data.type === 'pattern' && (!data.metadata || !data.metadata.patternType)) {
    return false;
  }
  return true;
}, {
  message: 'Chart drawing validation failed: insufficient points or missing required fields for drawing type',
});

// Drawing mode schema
export const DrawingModeSchema = z.enum(['none', 'trendline', 'fibonacci', 'horizontal', 'vertical']);

// =============================================================================
// TYPE EXPORTS - Generated from Zod schemas
// =============================================================================

export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type DrawingType = z.infer<typeof DrawingTypeSchema>;
export type DrawingData = z.infer<typeof DrawingDataSchema>;
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export type DrawingMode = z.infer<typeof DrawingModeSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate drawing data at runtime
 */
export function validateDrawingData(data: unknown): DrawingData {
  console.log('[Drawing Validation] Input data type:', typeof data);
  console.log('[Drawing Validation] Input data keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
  
  try {
    const result = DrawingDataSchema.parse(data);
    console.log('[Drawing Validation] Success - type:', result.type, 'points:', result.points?.length);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Drawing Validation] Failed:', {
        inputDataType: typeof data,
        inputDataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
        errors: error.errors.map(e => ({ 
          path: e.path, 
          message: e.message, 
          received: 'received' in e ? e.received : 'unknown' 
        }))
      });
      throw new Error(`Invalid drawing data: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate chart drawing at runtime
 */
export function validateChartDrawing(data: unknown): ChartDrawing {
  try {
    return ChartDrawingSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Chart Drawing Validation] Failed:', error.errors);
      console.error('[Chart Drawing Validation] Input data:', data);
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid chart drawing: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Safe parse drawing data (returns null on error)
 */
export function safeParseDrawingData(data: unknown): DrawingData | null {
  const result = DrawingDataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('[Drawing Parse] Failed:', result.error.errors);
  return null;
}