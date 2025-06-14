/**
 * Enhanced Zod schemas with strict typing
 */

import { z } from 'zod';

// ===== Base Schemas =====

export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const TimestampSchema = z.union([
  z.string().datetime(),
  z.number().positive(),
  z.date(),
]).transform((val) => {
  if (typeof val === 'string') return new Date(val).getTime();
  if (val instanceof Date) return val.getTime();
  return val;
});

export const PriceSchema = z.number().positive('Price must be positive').finite();

export const PercentageSchema = z.number().min(0).max(100);

export const CurrencyAmountSchema = z.number().finite().transform(val => 
  Math.round(val * 100) / 100 // Round to 2 decimal places
);

// ===== Chat Schemas =====

export const ChatRoleSchema = z.enum(['user', 'assistant']);

export const ChatMessageTypeSchema = z.enum(['text', 'proposal', 'entry']);

export const ProposalSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['buy', 'sell']),
  price: PriceSchema,
  stopLoss: PriceSchema.optional(),
  takeProfit: PriceSchema.optional(),
  reason: z.string().min(1).max(1000),
  confidence: PercentageSchema,
});

export const ProposalGroupSchema = z.object({
  id: UUIDSchema,
  proposals: z.array(ProposalSchema).min(1),
  timestamp: TimestampSchema,
});

export const EntryProposalSchema = z.object({
  id: UUIDSchema,
  entryType: z.enum(['market', 'limit', 'stop']),
  direction: z.enum(['long', 'short']),
  entryPrice: PriceSchema,
  stopLoss: PriceSchema,
  takeProfit: PriceSchema,
  riskRewardRatio: z.number().positive().finite(),
  positionSize: z.number().positive().finite(),
  reasoning: z.string().min(1).max(2000),
});

export const EntryProposalGroupSchema = z.object({
  id: UUIDSchema,
  entries: z.array(EntryProposalSchema).min(1),
  timestamp: TimestampSchema,
});

export const ChatMessageMetadataSchema = z.object({
  type: ChatMessageTypeSchema.optional(),
  proposalGroup: ProposalGroupSchema.optional(),
  entryProposalGroup: EntryProposalGroupSchema.optional(),
  isTyping: z.boolean().optional(),
}).strict();

export const ChatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  role: ChatRoleSchema,
  type: ChatMessageTypeSchema.optional(),
  proposalGroup: ProposalGroupSchema.optional(),
  entryProposalGroup: EntryProposalGroupSchema.optional(),
  isTyping: z.boolean().optional(),
});

// ===== Analysis Schemas =====

export const IndicatorResultSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().finite(),
  signal: z.enum(['bullish', 'bearish', 'neutral']),
  confidence: PercentageSchema,
});

export const PatternResultSchema = z.object({
  type: z.string().min(1).max(100),
  confidence: PercentageSchema,
  priceTarget: PriceSchema.optional(),
  stopLoss: PriceSchema.optional(),
});

export const SignalSchema = z.object({
  type: z.enum(['buy', 'sell', 'hold']),
  strength: PercentageSchema,
  reason: z.string().min(1).max(500),
});

export const AnalysisSummarySchema = z.object({
  overallSentiment: z.enum(['bullish', 'bearish', 'neutral']),
  recommendedAction: z.string().min(1).max(500),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export const AnalysisResultMetadataSchema = z.object({
  indicators: z.array(IndicatorResultSchema),
  patterns: z.array(PatternResultSchema),
  signals: z.array(SignalSchema),
  summary: AnalysisSummarySchema,
}).strict();

// ===== Pattern Schemas =====

export const CoordinatePointSchema = z.object({
  time: TimestampSchema,
  price: PriceSchema,
  label: z.string().max(50).optional(),
});

export const PatternCoordinatesSchema = z.object({
  startPoint: CoordinatePointSchema,
  endPoint: CoordinatePointSchema,
  keyPoints: z.array(CoordinatePointSchema),
});

export const PatternMeasurementsSchema = z.object({
  height: z.number().positive().finite(),
  width: z.number().positive().finite(),
  angle: z.number().finite(),
  retracement: PercentageSchema.optional(),
});

export const PatternValidationSchema = z.object({
  isValid: z.boolean(),
  confidence: PercentageSchema,
  violations: z.array(z.string().max(200)),
});

export const PatternMetadataSchema = z.object({
  coordinates: PatternCoordinatesSchema,
  measurements: PatternMeasurementsSchema,
  validation: PatternValidationSchema,
}).strict();

// ===== Trade Schemas =====

export const MarketConditionsSchema = z.object({
  trend: z.enum(['uptrend', 'downtrend', 'sideways']),
  volatility: z.enum(['low', 'medium', 'high']),
  volume: z.enum(['low', 'average', 'high']),
  momentum: z.number().min(-100).max(100),
});

export const TradeMetadataSchema = z.object({
  strategy: z.string().min(1).max(100),
  indicators: z.array(z.string().max(50)).max(20),
  marketConditions: MarketConditionsSchema,
  notes: z.string().max(2000).optional(),
}).strict();

export const TradePerformanceMetricsSchema = z.object({
  winRate: PercentageSchema,
  profitFactor: z.number().finite(),
  sharpeRatio: z.number().finite(),
  maxDrawdown: PercentageSchema,
  averageWin: CurrencyAmountSchema,
  averageLoss: CurrencyAmountSchema,
  expectancy: CurrencyAmountSchema,
});

// ===== Alert Schemas =====

export const IndicatorCrossoverSchema = z.object({
  indicator1: z.string().min(1).max(50),
  indicator2: z.string().min(1).max(50),
  direction: z.enum(['above', 'below']),
});

export const AlertConditionsSchema = z.object({
  priceAbove: PriceSchema.optional(),
  priceBelow: PriceSchema.optional(),
  volumeAbove: z.number().positive().optional(),
  indicatorCrossover: IndicatorCrossoverSchema.optional(),
  patternDetected: z.string().max(100).optional(),
}).refine(
  (data) => Object.values(data).some(v => v !== undefined),
  { message: 'At least one alert condition must be specified' }
);

export const AlertMetadataSchema = z.object({
  triggerCount: z.number().int().nonnegative(),
  lastTriggered: z.string().datetime().optional(),
  snoozeUntil: z.string().datetime().optional(),
  customSound: z.string().max(200).optional(),
}).strict();

// ===== Chart Drawing Schemas =====

export const DrawingTypeSchema = z.enum([
  'line',
  'horizontalLine',
  'verticalLine',
  'rectangle',
  'circle',
  'fibonacciRetracement',
  'text',
  'arrow',
]);

export const DrawingPointSchema = z.object({
  time: TimestampSchema,
  price: PriceSchema,
});

export const DrawingPropertiesSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  lineWidth: z.number().int().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  fillColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  text: z.string().max(200).optional(),
  fontSize: z.number().int().min(8).max(72).optional(),
  fontFamily: z.string().max(50).optional(),
  arrowDirection: z.enum(['up', 'down', 'left', 'right']).optional(),
});

export const ChartIndicatorSchema = z.object({
  type: z.string().min(1).max(50),
  parameters: z.record(z.union([z.number(), z.string()])),
  visible: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const ChartDrawingDataSchema = z.object({
  type: DrawingTypeSchema,
  points: z.array(DrawingPointSchema).min(1),
  properties: DrawingPropertiesSchema,
  indicators: z.array(ChartIndicatorSchema).optional(),
}).strict();

// ===== System Log Schemas =====

export const SystemLogMetadataSchema = z.object({
  errorCode: z.string().max(50).optional(),
  stackTrace: z.string().max(10000).optional(),
  context: z.record(z.unknown()).optional(),
  performance: z.object({
    duration: z.number().nonnegative().finite(),
    memoryUsage: z.number().nonnegative().finite(),
    cpuUsage: PercentageSchema,
  }).optional(),
}).strict();

// ===== API Request/Response Schemas =====

export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: UUIDSchema.optional(),
});

export const ApiErrorSchema = z.object({
  code: z.string().min(1).max(50),
  message: z.string().min(1).max(500),
  details: z.record(z.unknown()).optional(),
  statusCode: z.number().int().min(100).max(599),
});

// ===== Validation Helpers =====

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    throw new Error(errorMessage ? `${errorMessage}: ${errors}` : errors);
  }
  return result.data;
}

export function validatePartialWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): Partial<T> {
  const partialSchema = schema.partial();
  return validateWithSchema(partialSchema, data, errorMessage);
}

// ===== Type Exports =====

export type UUID = z.infer<typeof UUIDSchema>;
export type Timestamp = z.infer<typeof TimestampSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type Percentage = z.infer<typeof PercentageSchema>;
export type CurrencyAmount = z.infer<typeof CurrencyAmountSchema>;

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposalGroup = z.infer<typeof ProposalGroupSchema>;
export type EntryProposal = z.infer<typeof EntryProposalSchema>;
export type EntryProposalGroup = z.infer<typeof EntryProposalGroupSchema>;
export type ChatMessageMetadata = z.infer<typeof ChatMessageMetadataSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export type IndicatorResult = z.infer<typeof IndicatorResultSchema>;
export type PatternResult = z.infer<typeof PatternResultSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;
export type AnalysisResultMetadata = z.infer<typeof AnalysisResultMetadataSchema>;

export type CoordinatePoint = z.infer<typeof CoordinatePointSchema>;
export type PatternCoordinates = z.infer<typeof PatternCoordinatesSchema>;
export type PatternMeasurements = z.infer<typeof PatternMeasurementsSchema>;
export type PatternValidation = z.infer<typeof PatternValidationSchema>;
export type PatternMetadata = z.infer<typeof PatternMetadataSchema>;

export type MarketConditions = z.infer<typeof MarketConditionsSchema>;
export type TradeMetadata = z.infer<typeof TradeMetadataSchema>;
export type TradePerformanceMetrics = z.infer<typeof TradePerformanceMetricsSchema>;

export type AlertConditions = z.infer<typeof AlertConditionsSchema>;
export type AlertMetadata = z.infer<typeof AlertMetadataSchema>;

export type DrawingType = z.infer<typeof DrawingTypeSchema>;
export type DrawingPoint = z.infer<typeof DrawingPointSchema>;
export type DrawingProperties = z.infer<typeof DrawingPropertiesSchema>;
export type ChartIndicator = z.infer<typeof ChartIndicatorSchema>;
export type ChartDrawingData = z.infer<typeof ChartDrawingDataSchema>;

export type SystemLogMetadata = z.infer<typeof SystemLogMetadataSchema>;
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;