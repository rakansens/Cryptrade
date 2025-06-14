import { z } from 'zod';

/**
 * UI / ChartControl Events
 * 
 * イベント: インジケーター切り替え、シンボル変更、時間軸変更、描画モード設定、自動分析
 */

// Toggle Indicator Event
export const ToggleIndicatorEventSchema = z.object({
  indicator: z.string().min(1, 'Indicator name is required'),
  enabled: z.boolean(),
});

export type ToggleIndicatorEvent = z.infer<typeof ToggleIndicatorEventSchema>;

// Update Indicator Setting Event
export const UpdateIndicatorSettingEventSchema = z.object({
  indicator: z.string().min(1, 'Indicator name is required'),
  key: z.string().min(1, 'Setting key is required'),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]),
});

export type UpdateIndicatorSettingEvent = z.infer<typeof UpdateIndicatorSettingEventSchema>;

// Change Symbol Event
export const ChangeSymbolEventSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
});

export type ChangeSymbolEvent = z.infer<typeof ChangeSymbolEventSchema>;

// Change Timeframe Event
export const ChangeTimeframeEventSchema = z.object({
  timeframe: z.string().min(1, 'Timeframe is required'),
});

export type ChangeTimeframeEvent = z.infer<typeof ChangeTimeframeEventSchema>;

// Set Drawing Mode Event
export const SetDrawingModeEventSchema = z.object({
  mode: z.string(),
});

export type SetDrawingModeEvent = z.infer<typeof SetDrawingModeEventSchema>;

// Auto Analysis Event
export const AutoAnalysisEventSchema = z.object({
  type: z.enum(['trend', 'support_resistance']),
  config: z.object({
    includePatterns: z.boolean().optional(),
    sensitivity: z.enum(['low', 'medium', 'high']).optional(),
    timeRange: z.number().optional(),
  }).optional(),
});

export type AutoAnalysisEvent = z.infer<typeof AutoAnalysisEventSchema>;

// UI Event Union Type
export const UIEventSchema = z.discriminatedUnion('eventType', [
  z.object({ eventType: z.literal('ui:toggleIndicator'), data: ToggleIndicatorEventSchema }),
  z.object({ eventType: z.literal('ui:updateIndicatorSetting'), data: UpdateIndicatorSettingEventSchema }),
  z.object({ eventType: z.literal('ui:changeSymbol'), data: ChangeSymbolEventSchema }),
  z.object({ eventType: z.literal('ui:changeTimeframe'), data: ChangeTimeframeEventSchema }),
  z.object({ eventType: z.literal('chart:setDrawingMode'), data: SetDrawingModeEventSchema }),
  z.object({ eventType: z.literal('chart:autoAnalysis'), data: AutoAnalysisEventSchema }),
]);

export type UIEvent = z.infer<typeof UIEventSchema>;

// Validation function for UI events
export function validateUIEvent(eventType: string, payload: unknown) {
  const event = { eventType, data: payload };
  return UIEventSchema.safeParse(event);
}