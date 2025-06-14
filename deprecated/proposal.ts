import { z } from 'zod';
import { ValidatedDrawingSchema } from './drawing';

// =============================================================================
// PROPOSAL SCHEMAS
// =============================================================================

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

export const ProposalSchema = z.object({
  id: z.string(),
  type: z.enum(['pattern', 'trendline', 'fibonacci', 'horizontalLine', 'verticalLine', 'rectangle', 'circle', 'text']),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  drawingData: ValidatedDrawingSchema,
  symbol: z.string(),
  interval: z.string(),
  reasoning: z.string(),
  targets: z.array(z.number()).optional(),
  stopLoss: z.number().optional(),
  mlPrediction: MLPredictionSchema.optional(),
});

export const ProposalGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  proposals: z.array(ProposalSchema),
  createdAt: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
});

export const ProposalMessageSchema = z.object({
  id: z.string(),
  role: z.literal('assistant'),
  content: z.string(),
  type: z.literal('proposal'),
  proposalGroup: ProposalGroupSchema,
  timestamp: z.number(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type MLPrediction = z.infer<typeof MLPredictionSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposalGroup = z.infer<typeof ProposalGroupSchema>;
export type ProposalMessage = z.infer<typeof ProposalMessageSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate proposal at runtime
 */
export function validateProposal(data: unknown): Proposal {
  try {
    return ProposalSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Proposal Validation] Failed:', error.errors);
      throw new Error(`Invalid proposal: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ProposalGroup Validation] Failed:', error.errors);
      throw new Error(`Invalid proposal group: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate proposal message at runtime
 */
export function validateProposalMessage(data: unknown): ProposalMessage {
  try {
    return ProposalMessageSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ProposalMessage Validation] Failed:', error.errors);
      throw new Error(`Invalid proposal message: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}