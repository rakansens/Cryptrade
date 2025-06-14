/**
 * Trading Types - Entry Proposals and Risk Management
 * 
 * This file defines types for trade entry proposals, risk management,
 * and trading strategies used in the Cryptrade platform.
 */

import { z, ZodIssue } from 'zod';

// =============================================================================
// ZOD SCHEMAS - Trading types
// =============================================================================

// Trading strategy types
export const TradingStrategyTypeSchema = z.enum([
  'scalping',      // 数分～数時間の短期トレード
  'dayTrading',    // 1日以内に決済
  'swingTrading',  // 数日～数週間保有
  'position',      // 長期保有
]);

// Entry trigger types
export const EntryTriggerTypeSchema = z.enum([
  'market',        // 成行注文
  'limit',         // 指値注文
  'breakout',      // ブレイクアウト時
  'bounce',        // 反発時
  'pattern',       // パターン完成時
  'indicator',     // インジケーターシグナル
]);

// Trading direction
export const TradingDirectionSchema = z.enum(['long', 'short']);

// Risk parameters
export const RiskParametersSchema = z.object({
  stopLoss: z.number().positive().describe('ストップロス価格'),
  stopLossPercent: z.number().min(0).max(100).describe('エントリー価格からのSL%'),
  takeProfitTargets: z.array(z.object({
    price: z.number().positive(),
    percentage: z.number().min(0).max(100).describe('ポジションの何%を決済'),
  })).describe('段階的利確目標'),
  riskRewardRatio: z.number().positive().describe('リスクリワード比'),
  positionSizePercent: z.number().min(0).max(100).describe('資金に対するポジションサイズ%'),
  maxLossAmount: z.number().positive().optional().describe('最大損失額'),
});

// Entry conditions
export const EntryConditionsSchema = z.object({
  trigger: EntryTriggerTypeSchema,
  priceLevel: z.number().positive().optional().describe('トリガー価格（指値/逆指値）'),
  confirmationRequired: z.array(z.object({
    type: z.enum(['volume', 'candleClose', 'indicatorCross', 'timeframe']),
    description: z.string(),
  })).optional(),
  validUntil: z.number().optional().describe('有効期限（Unix timestamp）'),
  timeframeAlignment: z.string().optional().describe('エントリー時間枠（例: 4h, 1d）'),
});

// Market context for entry
export const MarketContextSchema = z.object({
  currentPrice: z.number().positive(),
  trend: z.enum(['bullish', 'bearish', 'neutral']),
  volatility: z.enum(['low', 'normal', 'high']),
  volume: z.enum(['low', 'average', 'high']),
  keyLevels: z.object({
    nearestSupport: z.number().positive().optional(),
    nearestResistance: z.number().positive().optional(),
    dailyHigh: z.number().positive().optional(),
    dailyLow: z.number().positive().optional(),
  }),
});

// Entry reasoning
export const EntryReasoningSchema = z.object({
  primary: z.string().describe('主な理由'),
  technicalFactors: z.array(z.object({
    factor: z.string(),
    weight: z.number().min(0).max(1),
    description: z.string(),
  })),
  fundamentalFactors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
    description: z.string(),
  })).optional(),
  risks: z.array(z.string()).describe('主なリスク要因'),
});

// Entry proposal schema
export const EntryProposalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  direction: TradingDirectionSchema,
  strategy: TradingStrategyTypeSchema,
  
  // Entry details
  entryPrice: z.number().positive().describe('エントリー推奨価格'),
  entryZone: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }).optional().describe('エントリー価格帯'),
  
  // Risk management
  riskParameters: RiskParametersSchema,
  
  // Entry conditions
  conditions: EntryConditionsSchema,
  
  // Market context
  marketContext: MarketContextSchema,
  
  // Analysis
  confidence: z.number().min(0).max(1),
  reasoning: EntryReasoningSchema,
  
  // Related analyses
  relatedPatterns: z.array(z.string()).optional().describe('関連パターンID'),
  relatedDrawings: z.array(z.string()).optional().describe('関連描画ID'),
  
  // Metadata
  createdAt: z.number(),
  expiresAt: z.number().optional(),
  priority: z.enum(['high', 'medium', 'low']),
});

// Trade setup (simplified version for quick display)
export const TradeSetupSchema = z.object({
  entry: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.array(z.number().positive()),
  riskReward: z.number().positive(),
  confidence: z.number().min(0).max(1),
});

// Entry proposal group (similar to DrawingProposalGroup)
export const EntryProposalGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  proposals: z.array(EntryProposalSchema),
  summary: z.object({
    bestEntry: z.string().optional().describe('最も推奨されるエントリーID'),
    averageConfidence: z.number().min(0).max(1),
    marketBias: z.enum(['bullish', 'bearish', 'neutral']),
  }),
  createdAt: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
});

// Position size calculation input
export const PositionSizeInputSchema = z.object({
  accountBalance: z.number().positive(),
  riskPercentage: z.number().min(0).max(100),
  entryPrice: z.number().positive(),
  stopLossPrice: z.number().positive(),
  leverage: z.number().min(1).optional().default(1),
});

// Position size calculation output
export const PositionSizeOutputSchema = z.object({
  positionSize: z.number().positive().describe('ポジションサイズ（数量）'),
  positionValue: z.number().positive().describe('ポジション価値（金額）'),
  riskAmount: z.number().positive().describe('リスク金額'),
  stopLossDistance: z.number().positive().describe('SLまでの価格差'),
  stopLossPercent: z.number().positive().describe('SLまでの%'),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type TradingStrategyType = z.infer<typeof TradingStrategyTypeSchema>;
export type EntryTriggerType = z.infer<typeof EntryTriggerTypeSchema>;
export type TradingDirection = z.infer<typeof TradingDirectionSchema>;
export type RiskParameters = z.infer<typeof RiskParametersSchema>;
export type EntryConditions = z.infer<typeof EntryConditionsSchema>;
export type MarketContext = z.infer<typeof MarketContextSchema>;
export type EntryReasoning = z.infer<typeof EntryReasoningSchema>;
export type EntryProposal = z.infer<typeof EntryProposalSchema>;
export type TradeSetup = z.infer<typeof TradeSetupSchema>;
export type EntryProposalGroup = z.infer<typeof EntryProposalGroupSchema>;
export type PositionSizeInput = z.infer<typeof PositionSizeInputSchema>;
export type PositionSizeOutput = z.infer<typeof PositionSizeOutputSchema>;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate position size based on risk parameters
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeOutput {
  const { accountBalance, riskPercentage, entryPrice, stopLossPrice, leverage } = input;
  
  const riskAmount = accountBalance * (riskPercentage / 100);
  const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
  const stopLossPercent = (stopLossDistance / entryPrice) * 100;
  
  // Position size = Risk Amount / Stop Loss Distance
  const positionSize = riskAmount / stopLossDistance;
  const positionValue = positionSize * entryPrice / leverage;
  
  return {
    positionSize,
    positionValue,
    riskAmount,
    stopLossDistance,
    stopLossPercent,
  };
}

/**
 * Calculate risk/reward ratio
 */
export function calculateRiskReward(entry: number, stopLoss: number, takeProfit: number): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  return reward / risk;
}

/**
 * Validate entry proposal
 */
export function validateEntryProposal(data: unknown): EntryProposal {
  try {
    return EntryProposalSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Entry Proposal Validation] Failed:', error.errors);
      throw new Error(
        `Invalid entry proposal: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Create a simple trade setup from entry proposal
 */
export function createTradeSetup(proposal: EntryProposal): TradeSetup {
  const takeProfitPrices = proposal.riskParameters.takeProfitTargets.map(
    (tp: RiskParameters['takeProfitTargets'][number]) => tp.price
  );
  
  return {
    entry: proposal.entryPrice,
    stopLoss: proposal.riskParameters.stopLoss,
    takeProfit: takeProfitPrices,
    riskReward: proposal.riskParameters.riskRewardRatio,
    confidence: proposal.confidence,
  };
}