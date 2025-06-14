/**
 * Orchestrator Agent Types
 * 
 * オーケストレーターエージェントで使用する型定義
 */

import { z } from 'zod';

// Intent types
export const IntentType = z.enum([
  'price_inquiry',
  'trading_analysis',
  'ui_control',
  'pattern_detection',
  'entry_proposal',
  'general_conversation',
  'unknown',
]);

export type IntentType = z.infer<typeof IntentType>;

// Agent response schema
export const AgentResponseSchema = z.object({
  intent: IntentType,
  confidence: z.number().min(0).max(1),
  response: z.string(),
  data: z.unknown().optional(),
  metadata: z.object({
    processedBy: z.string(),
    timestamp: z.string(),
    latency: z.number().optional(),
    toolsUsed: z.array(z.string()).optional(),
  }).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Orchestrator context
export interface OrchestratorContext {
  sessionId?: string;
  userId?: string;
  memoryContext?: string;
  previousIntent?: IntentType;
  conversationMode?: 'casual' | 'professional' | 'technical';
  emotionalTone?: 'positive' | 'neutral' | 'negative';
  relationshipLevel?: 'new' | 'regular' | 'trusted';
}