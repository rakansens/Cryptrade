/**
 * @deprecated This file is deprecated. Use types from './proposals' instead.
 * 
 * All proposal type definitions have been consolidated into a single file:
 * import { DrawingProposal, ProposalGroup, ... } from './proposals'
 * 
 * This file is kept for backward compatibility but will be removed in a future version.
 */

import { DrawingData, DrawingDataSchema } from './drawing';
import { z, ZodIssue } from 'zod';

// =============================================================================
// ZOD SCHEMAS - Single source of truth for proposal types
// =============================================================================

// Proposal status schema
export const ProposalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);

// Proposal type schema - Note: using different naming for UI display
export const ProposalTypeSchema = z.enum([
  'trendline',
  'horizontalLine',
  'verticalLine',
  'rectangle',
  'circle',
  'text',
  'fibonacci',
  'pattern',
  'entry' // New: エントリー提案タイプ
]);

// Confidence factors schema
export const ConfidenceFactorsSchema = z.object({
  touchPoints: z.number().min(0).max(1),
  volumeWeight: z.number().min(0).max(1),
  timeframeConfluence: z.number().min(0).max(1),
  patternConfirmation: z.number().min(0).max(1),
  statisticalFit: z.number().min(0).max(1),
});

// Timeframe confirmation schema
export const TimeframeConfirmationSchema = z.object({
  current: z.string(),
  higher: z.array(z.string()),
  confirmed: z.boolean(),
});

// Volume analysis schema
export const VolumeAnalysisSchema = z.object({
  averageVolume: z.number().min(0),
  volumeAtTouches: z.array(z.number()),
  volumeWeightedScore: z.number().min(0).max(1),
});

// Pattern schema
export const PatternSchema = z.object({
  type: z.string(),
  location: z.enum(['start', 'end', 'touches']),
  strength: z.number().min(0).max(1),
});

// Statistics schema
export const StatisticsSchema = z.object({
  rSquared: z.number().min(0).max(1),
  standardDeviation: z.number().min(0),
  outliers: z.number().int().min(0),
});

// Drawing proposal schema
export const DrawingProposalSchema = z.object({
  id: z.string(),
  type: ProposalTypeSchema,
  title: z.string(),
  description: z.string(),
  reason: z.string(),
  drawingData: DrawingDataSchema,
  confidence: z.number().min(0).max(1),
  priority: z.enum(['high', 'medium', 'low']),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
  touches: z.number().int().min(0).optional(),
  
  // Enhanced accuracy fields
  confidenceFactors: ConfidenceFactorsSchema.optional(),
  timeframeConfirmation: TimeframeConfirmationSchema.optional(),
  volumeAnalysis: VolumeAnalysisSchema.optional(),
  patterns: z.array(PatternSchema).optional(),
  statistics: StatisticsSchema.optional(),
});

// Proposal group schema
export const ProposalGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  proposals: z.array(DrawingProposalSchema),
  createdAt: z.number(),
  status: ProposalStatusSchema,
});

// Proposal message schema
export const ProposalMessageSchema = z.object({
  id: z.string(),
  role: z.literal('assistant'),
  content: z.string(),
  type: z.literal('proposal'),
  proposalGroup: ProposalGroupSchema,
  timestamp: z.number(),
});

// Proposal action event schema
export const ProposalActionEventSchema = z.object({
  type: z.enum(['proposal:approve', 'proposal:reject', 'proposal:approve-all', 'proposal:reject-all']),
  proposalId: z.string().optional(),
  groupId: z.string(),
  timestamp: z.number(),
});

// Proposal generation params schema
export const ProposalGenerationParamsSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  analysisType: z.enum(['trendline', 'support-resistance', 'fibonacci', 'pattern', 'all']),
  maxProposals: z.number().int().positive().optional(),
  timeRange: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
});

// Proposal response schema
export const ProposalResponseSchema = z.object({
  success: z.boolean(),
  proposalGroup: ProposalGroupSchema.optional(),
  error: z.string().optional(),
});

// =============================================================================
// TYPE EXPORTS - Generated from Zod schemas
// =============================================================================

export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
export type ProposalType = z.infer<typeof ProposalTypeSchema>;
export type ConfidenceFactors = z.infer<typeof ConfidenceFactorsSchema>;
export type TimeframeConfirmation = z.infer<typeof TimeframeConfirmationSchema>;
export type VolumeAnalysis = z.infer<typeof VolumeAnalysisSchema>;
export type Pattern = z.infer<typeof PatternSchema>;
export type Statistics = z.infer<typeof StatisticsSchema>;
export type DrawingProposal = z.infer<typeof DrawingProposalSchema>;
export type ProposalGroup = z.infer<typeof ProposalGroupSchema>;
export type ProposalMessage = z.infer<typeof ProposalMessageSchema>;
export type ProposalActionEvent = z.infer<typeof ProposalActionEventSchema>;
export type ProposalGenerationParams = z.infer<typeof ProposalGenerationParamsSchema>;
export type ProposalResponse = z.infer<typeof ProposalResponseSchema>;

// =============================================================================
// ADDITIONAL TYPES FOR USE-PROPOSAL-MANAGEMENT
// =============================================================================

// Map of approved drawing IDs by message and proposal
export type ApprovedDrawingIds = Map<string, Map<string, string>>;

// Drawing type for tracking
export type DrawingType = 'pattern' | 'drawing';

// ML Prediction type (missing from original schema)
export const MLPredictionSchema = z.object({
  successProbability: z.number().min(0).max(1),
  expectedBounces: z.number().int().min(0),
  direction: z.enum(['up', 'down', 'neutral']),
  reasoning: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
    weight: z.number().min(0).max(1),
    description: z.string(),
  })),
});

export type MLPrediction = z.infer<typeof MLPredictionSchema>;

// Extended proposal with additional fields used in use-proposal-management
export const ExtendedProposalSchema = DrawingProposalSchema.extend({
  symbol: z.string(),
  interval: z.string(),
  reasoning: z.string(),
  targets: z.array(z.number()).optional(),
  stopLoss: z.number().optional(),
  mlPrediction: MLPredictionSchema.optional(),
});

export type ExtendedProposal = z.infer<typeof ExtendedProposalSchema>;

// Enhanced proposal action event with full payload
export const EnhancedProposalActionEventSchema = z.object({
  type: z.literal('ui:proposal-action'),
  timestamp: z.number(),
  payload: z.object({
    action: z.enum(['approve', 'reject']),
    proposalId: z.string(),
    proposalGroupId: z.string(),
    drawingId: z.string().optional(),
    symbol: z.string().optional(),
    interval: z.string().optional(),
  }),
});

export type EnhancedProposalActionEvent = z.infer<typeof EnhancedProposalActionEventSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate drawing proposal at runtime
 */
export function validateDrawingProposal(data: unknown): DrawingProposal {
  try {
    return DrawingProposalSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Proposal Validation] Failed:', error.errors);
      throw new Error(
        `Invalid proposal data: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      )
    }
    throw error;
  }
}

/**
 * Validate proposal group at runtime
 */
export function validateProposalGroup(data: unknown): ProposalGroup {
  try {
    return ProposalGroupSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[ProposalGroup Validation] Failed:', error.errors);
      throw new Error(
        `Invalid proposal group: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      )
    }
    throw error;
  }
}

/**
 * Safe parse proposal response
 */
export function safeParseProposalResponse(data: unknown): ProposalResponse | null {
  const result = ProposalResponseSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('[Proposal Response Parse] Failed:', result.error.errors);
  return null;
}