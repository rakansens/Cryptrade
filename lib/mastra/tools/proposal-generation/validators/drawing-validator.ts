/**
 * Drawing Validator
 * 
 * 描画データの検証を行う専用モジュール
 * 型安全性を保証し、不正なデータを防ぐ
 */

import { logger } from '@/lib/utils/logger';
import type { DrawingType } from '@/types/drawing';
import { z } from 'zod';

// 描画データスキーマ
const DrawingDataSchema = z.object({
  type: z.string() as z.ZodType<DrawingType>,
  points: z.array(z.object({
    time: z.number().positive(),
    value: z.number().positive(),
  })).min(1),
  style: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    lineWidth: z.number().min(1).max(10).optional(),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    showLabels: z.boolean().optional(),
  }).optional(),
  price: z.number().positive().optional(),
  time: z.number().positive().optional(),
  levels: z.array(z.number()).optional(),
  text: z.string().optional(),
  fontSize: z.number().min(10).max(50).optional(),
});

export type ValidatedDrawingData = z.infer<typeof DrawingDataSchema>;

/**
 * 描画データの検証
 */
export function validateDrawingData(data: unknown): ValidatedDrawingData {
  try {
    const validated = DrawingDataSchema.parse(data);
    
    // 追加の検証
    switch (validated.type) {
      case 'trendline':
        if (validated.points.length !== 2) {
          throw new Error('Trendline must have exactly 2 points');
        }
        break;
        
      case 'fibonacci':
        if (validated.points.length !== 2) {
          throw new Error('Fibonacci must have exactly 2 points');
        }
        if (!validated.levels || validated.levels.length === 0) {
          validated.levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        }
        break;
        
      case 'horizontal':
        if (!validated.price) {
          throw new Error('Horizontal line must have a price');
        }
        break;
        
      case 'vertical':
        if (!validated.time) {
          throw new Error('Vertical line must have a time');
        }
        break;
        
      case 'text':
        if (!validated.text || validated.text.trim() === '') {
          throw new Error('Text annotation must have text content');
        }
        if (validated.points.length !== 1) {
          throw new Error('Text annotation must have exactly 1 point');
        }
        break;
    }
    
    // デフォルトスタイルの適用
    if (!validated.style) {
      validated.style = getDefaultStyle(validated.type);
    }
    
    return validated;
  } catch (error) {
    logger.error('[DrawingValidator] Validation failed', { error, data });
    throw error;
  }
}

/**
 * 提案の検証
 */
export function validateDrawingProposal(proposal: Record<string, unknown>): Record<string, unknown> {
  // 基本的な必須フィールドチェック
  if (!proposal.id || !proposal.type || !proposal.drawingData) {
    throw new Error('Missing required proposal fields');
  }
  
  // 描画データの検証
  proposal.drawingData = validateDrawingData(proposal.drawingData);
  
  // 信頼度の範囲チェック
  if (typeof proposal.confidence === 'number') {
    proposal.confidence = Math.max(0, Math.min(1, proposal.confidence));
  }
  
  // 優先度の検証
  if (!['high', 'medium', 'low'].includes(proposal.priority)) {
    proposal.priority = 'low';
  }
  
  return proposal;
}

/**
 * デフォルトスタイルの取得
 */
function getDefaultStyle(type: DrawingType): ValidatedDrawingData['style'] {
  switch (type) {
    case 'trendline':
      return {
        color: '#888888',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true,
      };
      
    case 'fibonacci':
      return {
        color: '#ff9800',
        lineWidth: 1,
        lineStyle: 'dashed',
        showLabels: true,
      };
      
    case 'horizontal':
    case 'vertical':
      return {
        color: '#ffff00',
        lineWidth: 1,
        lineStyle: 'solid',
        showLabels: false,
      };
      
    case 'text':
      return {
        color: '#ffffff',
      };
      
    default:
      return {
        color: '#888888',
        lineWidth: 1,
        lineStyle: 'solid',
      };
  }
}

/**
 * 時間値の検証
 */
export function validateTimeValue(time: number): boolean {
  // Unix timestamp in seconds
  const minTime = 1000000000; // ~2001年
  const maxTime = 2000000000; // ~2033年
  
  return time >= minTime && time <= maxTime;
}

/**
 * 価格値の検証
 */
export function validatePriceValue(price: number, symbol: string): boolean {
  // 仮想通貨の妥当な価格範囲
  const ranges: Record<string, { min: number; max: number }> = {
    BTCUSDT: { min: 1, max: 1000000 },
    ETHUSDT: { min: 0.1, max: 100000 },
    // デフォルト
    DEFAULT: { min: 0.00001, max: 10000000 },
  };
  
  const range = ranges[symbol] || ranges.DEFAULT;
  return price >= range.min && price <= range.max;
}

/**
 * ポイント配列の検証
 */
export function validatePoints(
  points: Array<{ time: number; value: number }>,
  expectedCount?: number
): boolean {
  if (expectedCount !== undefined && points.length !== expectedCount) {
    return false;
  }
  
  return points.every(point => 
    validateTimeValue(point.time) && 
    point.value > 0
  );
}

/**
 * スタイルの検証
 */
export function validateStyle(style: Record<string, unknown>): boolean {
  if (!style) return true;
  
  // 色の検証
  if (style.color && !/^#[0-9a-fA-F]{6}$/.test(style.color)) {
    return false;
  }
  
  // 線幅の検証
  if (style.lineWidth && (style.lineWidth < 1 || style.lineWidth > 10)) {
    return false;
  }
  
  // 線スタイルの検証
  if (style.lineStyle && !['solid', 'dashed', 'dotted'].includes(style.lineStyle)) {
    return false;
  }
  
  return true;
}