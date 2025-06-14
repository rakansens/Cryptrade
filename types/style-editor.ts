// Style editor types with enhanced Zod schemas for runtime validation

import { z, ZodIssue } from 'zod';
import { DrawingStyleSchema } from './drawing';

// =============================================================================
// ZOD SCHEMAS - Enhanced style editing
// =============================================================================

// Extended line style options (simplified)
export const ExtendedLineStyleSchema = z.enum([
  'solid',
  'dashed',
  'dotted',
]);

// Line cap style
export const LineCapStyleSchema = z.enum([
  'butt',
  'round',
  'square',
]);

// Line join style
export const LineJoinStyleSchema = z.enum([
  'miter',
  'round',
  'bevel',
]);

// Arrow head style for line ends
export const ArrowStyleSchema = z.object({
  enabled: z.boolean(),
  size: z.number().min(0).max(20),
  style: z.enum(['triangle', 'arrow', 'circle', 'square']),
});

// Enhanced color with opacity
export const ColorWithOpacitySchema = z.object({
  color: z.string(), // Accept any string for flexibility (can be hex, rgb, hsl, named colors)
  opacity: z.number().min(0).max(1).default(1),
});

// Text style for labels
export const TextStyleSchema = z.object({
  fontSize: z.number().min(8).max(32),
  fontFamily: z.enum(['sans-serif', 'serif', 'monospace']),
  fontWeight: z.enum(['normal', 'bold', 'light']),
  color: z.string(), // Accept any string for flexibility
  backgroundColor: z.string().optional(), // Accept any string for flexibility
  padding: z.number().min(0).max(20).optional(),
});

// Enhanced drawing style schema
export const EnhancedDrawingStyleSchema = DrawingStyleSchema.extend({
  // Line properties
  lineStyle: ExtendedLineStyleSchema,
  lineCap: LineCapStyleSchema.default('round'),
  lineJoin: LineJoinStyleSchema.default('round'),
  dashArray: z.array(z.number()).optional().describe('Custom dash pattern'),
  
  // Arrow properties
  startArrow: ArrowStyleSchema.optional(),
  endArrow: ArrowStyleSchema.optional(),
  
  // Fill properties (for areas/zones)
  fillColor: ColorWithOpacitySchema.optional(),
  
  // Text properties
  textStyle: TextStyleSchema.optional(),
  
  // Shadow properties
  shadow: z.object({
    enabled: z.boolean(),
    color: z.string(), // Accept any string for flexibility
    blur: z.number().min(0).max(20),
    offsetX: z.number().min(-10).max(10),
    offsetY: z.number().min(-10).max(10),
  }).optional(),
  
  // Animation properties
  animated: z.boolean().default(false),
  animationDuration: z.number().min(0).max(5000).optional(),
});

// Pattern-specific style enhancements
export const PatternStyleSchema = z.object({
  // Base style for all lines (when not individually specified)
  baseStyle: DrawingStyleSchema.optional(),
  
  // Metric line styles
  targetLineStyle: DrawingStyleSchema.optional(),
  stopLossLineStyle: DrawingStyleSchema.optional(),
  breakoutLineStyle: DrawingStyleSchema.optional(),
  
  // Pattern visualization
  patternFillOpacity: z.number().min(0).max(1).default(0.1),
  highlightKeyPoints: z.boolean().default(true),
  keyPointSize: z.number().min(3).max(15).default(8),
  
  // Labels
  showMetricLabels: z.boolean().default(true),
  metricLabelPosition: z.enum(['left', 'right', 'center']).default('right'),
});

// Style preset schema
export const StylePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['default', 'professional', 'colorful', 'minimal', 'custom']),
  style: EnhancedDrawingStyleSchema,
  patternStyle: PatternStyleSchema.optional(),
});

// Style update event schema
export const StyleUpdateEventSchema = z.object({
  drawingId: z.string(),
  style: EnhancedDrawingStyleSchema.partial(),
  immediate: z.boolean().default(true).describe('Apply immediately without animation'),
});

// Pattern style update event schema
export const PatternStyleUpdateEventSchema = z.object({
  patternId: z.string(),
  patternStyle: PatternStyleSchema.partial(),
  lineStyles: z.record(z.string(), EnhancedDrawingStyleSchema.partial()).optional(),
  immediate: z.boolean().default(true),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ExtendedLineStyle = z.infer<typeof ExtendedLineStyleSchema>;
export type LineCapStyle = z.infer<typeof LineCapStyleSchema>;
export type LineJoinStyle = z.infer<typeof LineJoinStyleSchema>;
export type ArrowStyle = z.infer<typeof ArrowStyleSchema>;
export type ColorWithOpacity = z.infer<typeof ColorWithOpacitySchema>;
export type TextStyle = z.infer<typeof TextStyleSchema>;
export type EnhancedDrawingStyle = z.infer<typeof EnhancedDrawingStyleSchema>;
export type PatternStyle = z.infer<typeof PatternStyleSchema>;
export type StylePreset = z.infer<typeof StylePresetSchema>;
export type StyleUpdateEvent = z.infer<typeof StyleUpdateEventSchema>;
export type PatternStyleUpdateEvent = z.infer<typeof PatternStyleUpdateEventSchema>;

// =============================================================================
// DEFAULT PRESETS
// =============================================================================

export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'default',
    name: 'デフォルト',
    category: 'default',
    style: {
      color: '#22c55e',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true,
      lineCap: 'round',
      lineJoin: 'round',
      animated: false,
    },
  },
  {
    id: 'professional',
    name: 'プロフェッショナル',
    category: 'professional',
    style: {
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true,
      lineCap: 'round',
      lineJoin: 'round',
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 4,
        offsetX: 1,
        offsetY: 1,
      },
      animated: false,
    },
  },
  {
    id: 'minimal',
    name: 'ミニマル',
    category: 'minimal',
    style: {
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 'solid',
      showLabels: false,
      lineCap: 'butt',
      lineJoin: 'miter',
      animated: false,
    },
  },
  {
    id: 'colorful',
    name: 'カラフル',
    category: 'colorful',
    style: {
      color: '#f59e0b',
      lineWidth: 3,
      lineStyle: 'solid',
      showLabels: true,
      lineCap: 'round',
      lineJoin: 'round',
      animated: true,
      animationDuration: 300,
    },
  },
];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateStyleUpdate(data: unknown): StyleUpdateEvent {
  try {
    return StyleUpdateEventSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Style Update Validation] Failed:', error.errors);
      throw new Error(
        `Invalid style update: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}

export function validatePatternStyleUpdate(data: unknown): PatternStyleUpdateEvent {
  try {
    return PatternStyleUpdateEventSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Pattern Style Update Validation] Failed:', error.errors);
      throw new Error(
        `Invalid pattern style update: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}