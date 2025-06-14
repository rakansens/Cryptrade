/**
 * Agent Event Utilities
 * 
 * useAgentEventHandlers で使用される共通ユーティリティ関数
 */

import { logger } from '@/lib/utils/logger';
import { showToast } from '@/components/ui/toast';
import type { PatternRenderer } from './pattern-renderer';
import type { DrawingPoint, DrawingStyle, FibonacciLevel, ChartDrawing, DrawingType } from '@/types/chart.types';

/**
 * エージェントイベントのエラーハンドリング
 */
export function handleAgentError(
  error: unknown,
  context: {
    eventType: string;
    operation: string;
    id?: string;
    payload?: unknown;
  },
  userMessage?: string
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`[Agent Event] ${context.operation} failed`, {
    eventType: context.eventType,
    operation: context.operation,
    id: context.id,
    payload: context.payload,
    error: errorMessage,
    errorStack,
  });

  const defaultMessage = `${context.operation}に失敗しました`;
  showToast(userMessage || defaultMessage, 'error');
}

/**
 * 成功メッセージの表示
 */
export function showAgentSuccess(
  context: {
    eventType: string;
    operation: string;
    id?: string;
  },
  userMessage?: string
) {
  logger.info(`[Agent Event] ${context.operation} completed`, {
    eventType: context.eventType,
    operation: context.operation,
    id: context.id,
  });

  if (userMessage) {
    showToast(userMessage, 'success');
  }
}

/**
 * カーソルスタイルの設定
 */
export function setCursorStyle(cursorType: 'default' | 'crosshair' | 'pointer') {
  if (typeof window !== 'undefined') {
    document.body.style.cursor = cursorType;
  }
}

/**
 * ドローイングキューへの操作追加の共通処理
 */
export async function executeDrawingOperation<T>(
  operation: () => Promise<T> | T,
  context: {
    eventType: string;
    operation: string;
    id?: string;
  }
): Promise<T | null> {
  try {
    const { drawingQueue } = await import('@/lib/utils/drawing-queue');
    
    return await drawingQueue.enqueue(async () => {
      return await operation();
    });
  } catch (error) {
    handleAgentError(error, context);
    return null;
  }
}

/**
 * パターンレンダラーの取得
 */
export function getPatternRenderer(handlers: {
  getPatternRenderer?: () => PatternRenderer | undefined;
  patternRenderer?: PatternRenderer;
}): PatternRenderer | undefined {
  return handlers.getPatternRenderer ? handlers.getPatternRenderer() : handlers.patternRenderer;
}

/**
 * 描画データの準備
 */
export function prepareDrawingData(data: {
  id: string;
  type: string;
  points?: DrawingPoint[];
  style?: Partial<DrawingStyle>;
  price?: number;
  time?: number;
  levels?: FibonacciLevel[];
}): ChartDrawing & { price?: number; time?: number } {
  const { id, type, points, style, price, time, levels } = data;

  const drawing: ChartDrawing & { price?: number; time?: number } = {
    id,
    type: type as DrawingType,
    points: points || (price !== undefined ? [{ time: Date.now() / 1000, value: price }] : []),
    style: {
      color: style?.color || '#2196F3',
      lineWidth: style?.lineWidth || 2,
      lineStyle: style?.lineStyle || 'solid',
      showLabels: style?.showLabels !== undefined ? style.showLabels : true,
      ...style
    } as DrawingStyle,
    visible: true,
    interactive: true,
    metadata: levels ? { levels } : undefined,
  };

  // Handle special cases for horizontal/vertical lines
  if (type === 'horizontal' && price !== undefined) {
    drawing.price = price;
  }
  if (type === 'vertical' && time !== undefined) {
    drawing.time = time;
  }

  return drawing;
}

/**
 * バリデーションエラーのハンドリング
 */
interface ValidationError {
  success: false;
  error: {
    errors: Array<{ message: string; path?: string[] }>;
  };
}

export function handleValidationError(
  validation: ValidationError,
  context: {
    eventType: string;
    operation: string;
    payload: unknown;
  }
) {
  logger.error(`[Agent Event] Invalid ${context.operation} payload`, {
    eventType: context.eventType,
    error: validation.error.errors,
    payload: context.payload,
  });
  showToast('Invalid event data', 'error');
}