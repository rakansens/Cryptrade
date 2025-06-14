/**
 * Proposal Generation Types
 * 
 * 提案生成ツールの型定義
 * 型安全性を保証
 */

import { z } from 'zod';
import type { PriceData as CandlestickData } from '@/types/market';
import type { DrawingType } from '@/types/drawing';

// ========================================
// Input/Output Schemas
// ========================================

/**
 * ツール入力スキーマ
 */
export const ProposalGenerationInputSchema = z.object({
  symbol: z.string().describe('Trading symbol (e.g., BTCUSDT)'),
  interval: z.string().describe('Time interval (e.g., 1m, 5m, 15m, 1h)'),
  analysisType: z.enum(['trendline', 'support-resistance', 'fibonacci', 'pattern', 'all'])
    .describe('Type of analysis to perform'),
  maxProposals: z.number().optional().default(5).describe('Maximum number of proposals to generate'),
  sinceTimestamp: z.number().optional().describe('Unix time(sec) to start fetching klines from'),
  excludeIds: z.array(z.string()).optional().describe('Proposal IDs to exclude to avoid duplicates'),
});

export type ProposalGenerationInput = z.infer<typeof ProposalGenerationInputSchema>;

/**
 * 提案グループスキーマ
 */
export const ProposalGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  createdAt: z.number(),
  proposals: z.array(z.object({
    id: z.string(),
    type: z.string() as z.ZodType<DrawingType>,
    confidence: z.number().min(0).max(1),
    description: z.string(),
    drawingData: z.object({
      type: z.string() as z.ZodType<DrawingType>,
      points: z.array(z.object({
        time: z.number(),
        value: z.number(),
      })),
      style: z.object({
        color: z.string().optional(),
        lineWidth: z.number().optional(),
        lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
      }).optional(),
      price: z.number().optional(),
      time: z.number().optional(),
      levels: z.array(z.number()).optional(),
    }),
    symbol: z.string(),
    interval: z.string(),
    reasoning: z.string(),
    createdAt: z.number(),
    title: z.string(),
    targets: z.array(z.number()).optional(),
    stopLoss: z.number().optional(),
    direction: z.enum(['up', 'down', 'neutral']).optional(),
    reason: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    metadata: z.object({
      patterns: z.array(z.string()).optional(),
      indicators: z.record(z.string(), z.unknown()).optional(),
      timeframe_alignment: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    technicalContext: z.object({
      marketCondition: z.enum(['trending', 'ranging', 'volatile']).optional(),
      volumeProfile: z.enum(['high', 'normal', 'low']).optional(),
      momentum: z.enum(['bullish', 'bearish', 'neutral']).optional(),
    }).optional(),
    statistics: z.object({
      points: z.number(),
      touches: z.number(),
      outliers: z.number(),
      r_squared: z.number(),
      angle: z.number(),
      duration_hours: z.number(),
      price_change_percent: z.number(),
    }).optional(),
    mlPrediction: z.object({
      successProbability: z.number(),
      expectedBounces: z.number(),
      direction: z.enum(['up', 'down']),
      reasoning: z.array(z.string()),
    }).optional(),
  })),
});

export type ProposalGroup = z.infer<typeof ProposalGroupSchema>;

/**
 * ツール出力スキーマ
 */
export const ProposalGenerationOutputSchema = z.object({
  success: z.boolean(),
  proposalGroup: ProposalGroupSchema.optional(),
  error: z.string().optional(),
});

export type ProposalGenerationOutput = z.infer<typeof ProposalGenerationOutputSchema>;

// ========================================
// Internal Types
// ========================================

/**
 * ピーク/トラフ検出結果
 */
export interface PeakTroughPoint {
  index: number;
  time: number;
  value: number;
  volumeWeight: number;
  type: 'peak' | 'trough';
}

/**
 * トレンドライン候補
 */
export interface TrendlineCandidate {
  start: PeakTroughPoint;
  end: PeakTroughPoint;
  score: number;
  type: 'uptrend' | 'downtrend';
}

/**
 * 信頼度計算要因
 */
export interface ConfidenceFactors {
  baseConfidence: number;
  touchPoints: number;
  volumeStrength: number;
  timeSpan: number;
  recentActivity: boolean;
  patternAlignment: boolean;
  multiTimeframeConfirmation: boolean;
  rSquared?: number;
  angle?: number;
  outliers?: number;
}

/**
 * ボリューム分析結果
 */
export interface VolumeAnalysis {
  averageVolume: number;
  volumeRatio: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  significantVolumeBars: number;
}

/**
 * マルチタイムフレーム分析結果
 */
export interface MultiTimeframeAnalysis {
  higherTimeframe: {
    trend: 'bullish' | 'bearish' | 'neutral';
    support: number[];
    resistance: number[];
  };
  alignment: boolean;
  conflictingSignals: boolean;
}

/**
 * 市場状態
 */
export interface MarketCondition {
  type: 'trending' | 'ranging' | 'volatile';
  strength: number;
  direction?: 'bullish' | 'bearish';
}

/**
 * パターン検出結果
 */
export interface DetectedPattern {
  type: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  keyPoints: Array<{ time: number; value: number }>;
  implication: 'bullish' | 'bearish' | 'neutral';
}

// ========================================
// Generator Interfaces
// ========================================

/**
 * 提案ジェネレーターの共通インターフェース
 */
export interface IProposalGenerator {
  /**
   * 提案を生成
   */
  generate(
    data: CandlestickData[],
    params: GeneratorParams
  ): Promise<ProposalGroup['proposals']>;
  
  /**
   * ジェネレーターの名前
   */
  readonly name: string;
  
  /**
   * サポートする分析タイプ
   */
  readonly analysisType: ProposalGenerationInput['analysisType'];
}

/**
 * ジェネレーターパラメータ
 */
export interface GeneratorParams {
  symbol: string;
  interval: string;
  maxProposals: number;
  excludeIds?: string[];
  marketCondition?: MarketCondition;
  multiTimeframeAnalysis?: MultiTimeframeAnalysis;
}

// ========================================
// Validation Helpers
// ========================================

/**
 * 提案グループの検証
 */
export function validateProposalGroup(group: unknown): ProposalGroup {
  return ProposalGroupSchema.parse(group);
}

/**
 * 入力パラメータの検証
 */
export function validateInput(input: unknown): ProposalGenerationInput {
  return ProposalGenerationInputSchema.parse(input);
}

// ========================================
// Type Guards
// ========================================

export function isPeakTroughPoint(obj: unknown): obj is PeakTroughPoint {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.index === 'number' &&
    typeof obj.time === 'number' &&
    typeof obj.value === 'number' &&
    typeof obj.volumeWeight === 'number' &&
    (obj.type === 'peak' || obj.type === 'trough')
  );
}

export function isMarketCondition(obj: unknown): obj is MarketCondition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ['trending', 'ranging', 'volatile'].includes(obj.type) &&
    typeof obj.strength === 'number'
  );
}