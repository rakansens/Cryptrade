import { z } from 'zod';

/**
 * Drawing Events
 * 
 * イベント: 描画開始、追加、削除、スタイル更新、undo/redo操作
 */

// Drawing Style Schema
export const DrawingStyleSchema = z.object({
  color: z.string().optional(),
  lineWidth: z.number().min(1).max(10).optional(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  showLabels: z.boolean().optional(),
});

export type DrawingStyle = z.infer<typeof DrawingStyleSchema>;

// Drawing Point Schema
export const DrawingPointSchema = z.object({
  time: z.number(),
  value: z.number(),
});

export type DrawingPoint = z.infer<typeof DrawingPointSchema>;

// Start Drawing Event
export const StartDrawingEventSchema = z.object({
  type: z.string().min(1, 'Drawing type is required'),
  style: DrawingStyleSchema.optional(),
});

export type StartDrawingEvent = z.infer<typeof StartDrawingEventSchema>;

// Add Drawing Event
export const AddDrawingEventSchema = z.object({
  id: z.string().min(1, 'Drawing ID is required'),
  type: z.string().min(1, 'Drawing type is required'),
  points: z.array(DrawingPointSchema).optional(),
  style: DrawingStyleSchema.optional(),
  price: z.number().optional(), // For horizontal lines
  time: z.number().optional(),  // For vertical lines
  levels: z.array(z.number()).optional(),   // For fibonacci/support-resistance levels
});

export type AddDrawingEvent = z.infer<typeof AddDrawingEventSchema>;

// Delete Drawing Event
export const DeleteDrawingEventSchema = z.object({
  id: z.string().min(1, 'Drawing ID is required'),
});

export type DeleteDrawingEvent = z.infer<typeof DeleteDrawingEventSchema>;

// Clear All Drawings Event
export const ClearAllDrawingsEventSchema = z.object({});

export type ClearAllDrawingsEvent = z.infer<typeof ClearAllDrawingsEventSchema>;

// Undo Event
export const UndoEventSchema = z.object({
  steps: z.number().min(1).max(10).default(1),
});

export type UndoEvent = z.infer<typeof UndoEventSchema>;

// Redo Event
export const RedoEventSchema = z.object({
  steps: z.number().min(1).max(10).default(1),
});

export type RedoEvent = z.infer<typeof RedoEventSchema>;

// Undo Last Drawing Event
export const UndoLastDrawingEventSchema = z.object({});

export type UndoLastDrawingEvent = z.infer<typeof UndoLastDrawingEventSchema>;

// Redo Last Drawing Event
export const RedoLastDrawingEventSchema = z.object({});

export type RedoLastDrawingEvent = z.infer<typeof RedoLastDrawingEventSchema>;

// Update Drawing Style Event
export const UpdateDrawingStyleEventSchema = z.object({
  drawingId: z.string().min(1, 'Drawing ID is required'),
  style: DrawingStyleSchema,
  immediate: z.boolean().optional(),
});

export type UpdateDrawingStyleEvent = z.infer<typeof UpdateDrawingStyleEventSchema>;

// Update All Styles Event
export const UpdateAllStylesEventSchema = z.object({
  type: z.string().min(1, 'Drawing type is required'),
  style: DrawingStyleSchema,
});

export type UpdateAllStylesEvent = z.infer<typeof UpdateAllStylesEventSchema>;

// Update Drawing Color Event
export const UpdateDrawingColorEventSchema = z.object({
  id: z.string().min(1, 'Drawing ID is required'),
  color: z.string().min(1, 'Color is required'),
});

export type UpdateDrawingColorEvent = z.infer<typeof UpdateDrawingColorEventSchema>;

// Update Drawing Line Width Event
export const UpdateDrawingLineWidthEventSchema = z.object({
  id: z.string().min(1, 'Drawing ID is required'),
  lineWidth: z.number().min(1).max(10),
});

export type UpdateDrawingLineWidthEvent = z.infer<typeof UpdateDrawingLineWidthEventSchema>;

// Drawing Event Union Type
export const DrawingEventSchema = z.discriminatedUnion('eventType', [
  z.object({ eventType: z.literal('chart:startDrawing'), data: StartDrawingEventSchema }),
  z.object({ eventType: z.literal('chart:addDrawing'), data: AddDrawingEventSchema }),
  z.object({ eventType: z.literal('chart:deleteDrawing'), data: DeleteDrawingEventSchema }),
  z.object({ eventType: z.literal('chart:clearAllDrawings'), data: ClearAllDrawingsEventSchema }),
  z.object({ eventType: z.literal('chart:undo'), data: UndoEventSchema }),
  z.object({ eventType: z.literal('chart:redo'), data: RedoEventSchema }),
  z.object({ eventType: z.literal('chart:undoLastDrawing'), data: UndoLastDrawingEventSchema }),
  z.object({ eventType: z.literal('chart:redoLastDrawing'), data: RedoLastDrawingEventSchema }),
  z.object({ eventType: z.literal('chart:updateDrawingStyle'), data: UpdateDrawingStyleEventSchema }),
  z.object({ eventType: z.literal('chart:updateAllStyles'), data: UpdateAllStylesEventSchema }),
  z.object({ eventType: z.literal('chart:updateDrawingColor'), data: UpdateDrawingColorEventSchema }),
  z.object({ eventType: z.literal('chart:updateDrawingLineWidth'), data: UpdateDrawingLineWidthEventSchema }),
]);

export type DrawingEvent = z.infer<typeof DrawingEventSchema>;

// Validation function for drawing events
export function validateDrawingEvent(eventType: string, payload: unknown) {
  const event = { eventType, data: payload };
  return DrawingEventSchema.safeParse(event);
}