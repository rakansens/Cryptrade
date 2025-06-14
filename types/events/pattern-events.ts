import { z } from 'zod';

/**
 * Pattern Events
 * 
 * イベント: パターン追加、削除、スタイル更新
 */

// Pattern Data Schema (simplified version of the full PatternData)
export const PatternDataSchema = z.object({
  type: z.string().min(1, 'Pattern type is required'),
  visualization: z.object({
    lines: z.array(z.object({
      id: z.string(),
      points: z.array(z.object({ time: z.number(), value: z.number() })),
      type: z.string().optional(),
      style: z.object({
        color: z.string().optional(),
        lineWidth: z.number().optional(),
        lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
      }).optional(),
    })).optional(),
    zones: z.array(z.object({
      id: z.string(),
      points: z.array(z.object({ time: z.number(), value: z.number() })),
      style: z.object({
        fillColor: z.string().optional(),
        opacity: z.number().optional(),
      }).optional(),
    })).optional(),
    markers: z.array(z.object({
      time: z.number(),
      value: z.number(),
      text: z.string(),
      style: z.object({
        color: z.string().optional(),
        shape: z.string().optional(),
      }).optional(),
    })).optional(),
  }).optional(),
  metrics: z.object({
    entryPrice: z.number().optional(),
    targetPrice: z.number().optional(),
    stopLoss: z.number().optional(),
    riskReward: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  tradingImplication: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type PatternData = z.infer<typeof PatternDataSchema>;

// Pattern Style Schema
export const PatternStyleSchema = z.object({
  baseStyle: z.object({
    color: z.string().optional(),
    lineWidth: z.number().min(1).max(10).optional(),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  }).optional(),
});

export type PatternStyle = z.infer<typeof PatternStyleSchema>;

// Line Style Schema
export const LineStyleSchema = z.object({
  lineId: z.string(),
  style: z.object({
    color: z.string().optional(),
    lineWidth: z.number().min(1).max(10).optional(),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  }),
});

export type LineStyle = z.infer<typeof LineStyleSchema>;

// Add Pattern Event
export const AddPatternEventSchema = z.object({
  id: z.string().min(1, 'Pattern ID is required'),
  pattern: PatternDataSchema,
});

export type AddPatternEvent = z.infer<typeof AddPatternEventSchema>;

// Remove Pattern Event
export const RemovePatternEventSchema = z.object({
  id: z.string().min(1, 'Pattern ID is required'),
});

export type RemovePatternEvent = z.infer<typeof RemovePatternEventSchema>;

// Update Pattern Style Event
export const UpdatePatternStyleEventSchema = z.object({
  patternId: z.string().min(1, 'Pattern ID is required'),
  patternStyle: PatternStyleSchema.optional(),
  lineStyles: z.array(LineStyleSchema).optional(),
  immediate: z.boolean().optional(),
});

export type UpdatePatternStyleEvent = z.infer<typeof UpdatePatternStyleEventSchema>;

// Pattern Event Union Type
export const PatternEventSchema = z.discriminatedUnion('eventType', [
  z.object({ eventType: z.literal('chart:addPattern'), data: AddPatternEventSchema }),
  z.object({ eventType: z.literal('chart:removePattern'), data: RemovePatternEventSchema }),
  z.object({ eventType: z.literal('chart:updatePatternStyle'), data: UpdatePatternStyleEventSchema }),
]);

export type PatternEvent = z.infer<typeof PatternEventSchema>;

// Validation function for pattern events
export function validatePatternEvent(eventType: string, payload: unknown) {
  const event = { eventType, data: payload };
  return PatternEventSchema.safeParse(event);
}