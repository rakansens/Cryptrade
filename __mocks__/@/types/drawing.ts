// Updated mock for @/types/drawing - Chart Drawing Schema Types
// Modified to match test expectations with proper Zod schemas

import { z } from 'zod';

// Drawing Point Schema
export const DrawingPointSchema = z.object({
  time: z.number().int().positive(),
  value: z.number()
});

// Drawing Style Schema  
export const DrawingStyleSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),
  lineWidth: z.number().int().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  showLabels: z.boolean().optional().default(false)
});

// Drawing Type Schema
export const DrawingTypeSchema = z.enum(['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern']);

// Drawing Mode Schema
export const DrawingModeSchema = z.enum(['none', 'trendline', 'fibonacci', 'horizontal', 'vertical']);

// Chart Drawing Schema
export const ChartDrawingSchema = z.object({
  id: z.string().min(1),
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1).max(10),
  style: DrawingStyleSchema,
  visible: z.boolean(),
  interactive: z.boolean(),
  metadata: z.record(z.any()).optional()
});

// Pattern Data Schema
export const PatternDataSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  symbol: z.string().min(1),
  interval: z.string().min(1),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  visualization: z.record(z.any()),
  tradingImplication: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metrics: z.object({
    target: z.number().optional(),
    stopLoss: z.number().optional(),
    breakoutLevel: z.number().optional()
  }).optional()
});

// Type Exports
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;
export type DrawingType = z.infer<typeof DrawingTypeSchema>;
export type DrawingMode = z.infer<typeof DrawingModeSchema>;
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export type PatternData = z.infer<typeof PatternDataSchema>;

// Validation interfaces for backward compatibility
export interface DrawingValidationResult {
  isValid: boolean;
  errors?: string[];
}

// Mock validation function for backward compatibility
export const validateChartDrawing = jest.fn().mockReturnValue({
  isValid: true,
  errors: []
});

export default {
  DrawingPointSchema,
  DrawingStyleSchema,
  DrawingTypeSchema,
  DrawingModeSchema,
  ChartDrawingSchema,
  PatternDataSchema,
  validateChartDrawing
};