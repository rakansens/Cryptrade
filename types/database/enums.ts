/**
 * Database Enum Mappings
 * 
 * This file maps Prisma schema enums to TypeScript enums/types
 * to ensure consistency between database and application code
 */

// AnalysisType moved to '../enums' for reuse across modules
export { AnalysisType } from '../enums';

// TouchResult - Maps to Prisma enum
export const TouchResult = {
  BOUNCE: 'bounce',
  BREAK: 'break',
  TEST: 'test',
} as const;

export type TouchResult = typeof TouchResult[keyof typeof TouchResult];

// MessageRole - Maps to Prisma enum
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

// DrawingType - Maps to Prisma enum
export const DrawingType = {
  TRENDLINE: 'trendline',
  FIBONACCI: 'fibonacci',
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  PATTERN: 'pattern',
} as const;

export type DrawingType = typeof DrawingType[keyof typeof DrawingType];

// PatternType - Maps to Prisma enum
export const PatternType = {
  HEAD_AND_SHOULDERS: 'headAndShoulders',
  INVERSE_HEAD_AND_SHOULDERS: 'inverseHeadAndShoulders',
  DOUBLE_TOP: 'doubleTop',
  DOUBLE_BOTTOM: 'doubleBottom',
  TRIPLE_TOP: 'tripleTop',
  TRIPLE_BOTTOM: 'tripleBottom',
  ASCENDING_TRIANGLE: 'ascendingTriangle',
  DESCENDING_TRIANGLE: 'descendingTriangle',
  SYMMETRICAL_TRIANGLE: 'symmetricalTriangle',
  WEDGE: 'wedge',
  FLAG: 'flag',
  PENNANT: 'pennant',
  CHANNEL: 'channel',
  RECTANGLE: 'rectangle',
  CUP: 'cup',
  CUP_AND_HANDLE: 'cupAndHandle',
} as const;

export type PatternType = typeof PatternType[keyof typeof PatternType];

// TradingImplication - Maps to Prisma enum
export const TradingImplication = {
  BULLISH: 'bullish',
  BEARISH: 'bearish',
  NEUTRAL: 'neutral',
} as const;

export type TradingImplication = typeof TradingImplication[keyof typeof TradingImplication];

// LogLevel - Maps to Prisma enum
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

// IndicatorType - Maps to Prisma enum
export const IndicatorType = {
  RSI: 'rsi',
  MACD: 'macd',
  MA: 'ma',
  BOLLINGER: 'bollinger',
} as const;

export type IndicatorType = typeof IndicatorType[keyof typeof IndicatorType];

// Helper functions to convert between formats
export function toDbEnum<T extends string>(value: string, enumObj: Record<string, T>): T {
  const enumValues = Object.values(enumObj);
  if (enumValues.includes(value as T)) {
    return value as T;
  }
  throw new Error(`Invalid enum value: ${value}`);
}

export function fromDbEnum<T extends string>(value: T): T {
  return value;
}