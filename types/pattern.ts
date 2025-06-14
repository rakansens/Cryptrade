// Pattern recognition types with Zod schemas

import { z } from 'zod';

// =============================================================================
// ZOD SCHEMAS - Pattern recognition types
// =============================================================================

// Pattern types
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
  'flag',
  'pennant',
  'wedge',
  'cup',
  'cupAndHandle',
]);

// Key point for pattern
export const PatternKeyPointSchema = z.object({
  time: z.number().describe('Unix timestamp in seconds'),
  value: z.number().describe('Price value'),
  type: z.enum(['peak', 'trough', 'neckline', 'breakout', 'target']),
  label: z.string().optional(),
});

// Pattern line connection
export const PatternLineSchema = z.object({
  from: z.number().describe('Index of from point'),
  to: z.number().describe('Index of to point'),
  type: z.enum(['outline', 'neckline', 'support', 'resistance', 'target']),
  style: z.object({
    color: z.string().optional(),
    lineWidth: z.number().optional(),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  }).optional(),
});

// Pattern area/zone
export const PatternAreaSchema = z.object({
  points: z.array(z.number()).describe('Indices of points forming the area'),
  style: z.object({
    fillColor: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    borderColor: z.string().optional(),
  }).optional(),
});

// Pattern visualization data
export const PatternVisualizationSchema = z.object({
  keyPoints: z.array(PatternKeyPointSchema),
  lines: z.array(PatternLineSchema).optional(),
  areas: z.array(PatternAreaSchema).optional(),
  labels: z.array(z.object({
    point: z.number().describe('Index of point to attach label'),
    text: z.string(),
    position: z.enum(['above', 'below', 'left', 'right']).optional(),
  })).optional(),
});

// Pattern analysis result
export const PatternAnalysisSchema = z.object({
  type: PatternTypeSchema,
  startTime: z.number(),
  endTime: z.number(),
  confidence: z.number().min(0).max(1),
  visualization: PatternVisualizationSchema,
  metrics: z.object({
    formation_period: z.number().describe('Number of candles'),
    symmetry: z.number().min(0).max(1).optional(),
    volume_pattern: z.enum(['increasing', 'decreasing', 'neutral']).optional(),
    breakout_level: z.number().optional(),
    target_level: z.number().optional(),
    stop_loss: z.number().optional(),
  }),
  description: z.string(),
  trading_implication: z.enum(['bullish', 'bearish', 'neutral']),
});

// Pattern detection parameters
export const PatternDetectionParamsSchema = z.object({
  lookbackPeriod: z.number().int().positive().default(100),
  minConfidence: z.number().min(0).max(1).default(0.7),
  patternTypes: z.array(PatternTypeSchema).optional(),
  includePartialPatterns: z.boolean().default(false),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PatternType = z.infer<typeof PatternTypeSchema>;
export type PatternKeyPoint = z.infer<typeof PatternKeyPointSchema>;
export type PatternLine = z.infer<typeof PatternLineSchema>;
export type PatternArea = z.infer<typeof PatternAreaSchema>;
export type PatternVisualization = z.infer<typeof PatternVisualizationSchema>;
export type PatternAnalysis = z.infer<typeof PatternAnalysisSchema>;
export type PatternDetectionParams = z.infer<typeof PatternDetectionParamsSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validatePatternAnalysis(data: unknown): PatternAnalysis {
  try {
    return PatternAnalysisSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Pattern Validation] Failed:', error.errors);
      throw new Error(
        `Invalid pattern data: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}