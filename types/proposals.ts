/**
 * Consolidated Proposal Type Definitions
 * 
 * This file consolidates all proposal-related type definitions that were previously
 * scattered across multiple files. It provides a single source of truth for all
 * proposal types in the application.
 */

// ====================================
// Base Types and Enums
// ====================================

/**
 * Status of a proposal
 */
export enum ProposalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

/**
 * Types of proposals supported
 */
export enum ProposalType {
  TRENDLINE = 'trendline',
  HORIZONTAL_LINE = 'horizontalLine',
  VERTICAL_LINE = 'verticalLine',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  TEXT = 'text',
  FIBONACCI = 'fibonacci',
  PATTERN = 'pattern',
  ENTRY = 'entry',
  SUPPORT_RESISTANCE = 'support_resistance',
}

/**
 * Trading direction for entry proposals
 */
export type TradingDirection = 'long' | 'short';

/**
 * Trading strategy types
 */
export type TradingStrategy = 'scalping' | 'dayTrading' | 'swingTrading' | 'position';

/**
 * Market bias indicators
 */
export type MarketBias = 'bullish' | 'bearish' | 'neutral';

// ====================================
// Drawing Proposals
// ====================================

/**
 * Confidence factors for technical analysis
 */
export interface ConfidenceFactors {
  touchPoints: number;
  priceRespect: number;
  volumeConfirmation: number;
  recentRelevance: number;
  patternQuality?: number;
  timeframeAlignment?: number;
}

/**
 * Volume analysis data
 */
export interface VolumeAnalysis {
  averageVolume: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  significantVolumeBars: Array<{
    timestamp: number;
    volume: number;
    priceAction: 'bullish' | 'bearish';
  }>;
}

/**
 * Pattern detection data
 */
export interface Pattern {
  type: string;
  confidence: number;
  points: Array<{ x: number; y: number }>;
  description?: string;
}

/**
 * ML prediction data
 */
export interface MLPrediction {
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  timeHorizon: string;
  supportLevels: number[];
  resistanceLevels: number[];
}

/**
 * Main drawing proposal interface
 */
export interface DrawingProposal {
  id: string;
  type: ProposalType;
  analysisType: 'trendline' | 'fibonacci' | 'pattern' | 'horizontal' | 'vertical' | 'support' | 'resistance';
  coordinates: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    additionalPoints?: Array<{ x: number; y: number }>;
  };
  confidence: number;
  reasoning: string;
  confidenceFactors?: ConfidenceFactors;
  priority: 'high' | 'medium' | 'low';
  status: ProposalStatus;
  createdAt: number;
  expiresAt?: number;
  metadata?: {
    touchPoints?: number;
    angle?: number;
    strength?: number;
    pattern?: Pattern;
    volumeAnalysis?: VolumeAnalysis;
    mlPrediction?: MLPrediction;
    [key: string]: string | number | boolean | Pattern | VolumeAnalysis | MLPrediction | undefined;
  };
}

/**
 * Extended drawing proposal with additional fields
 */
export interface ExtendedDrawingProposal extends DrawingProposal {
  validationScore?: number;
  relatedProposals?: string[];
  userFeedback?: {
    approved?: boolean;
    rating?: number;
    comment?: string;
  };
}

// ====================================
// Entry/Trading Proposals
// ====================================

/**
 * Risk management parameters
 */
export interface RiskParameters {
  stopLoss: number;
  stopLossPercent: number;
  takeProfitTargets: Array<{
    price: number;
    percentage: number;
  }>;
  riskRewardRatio: number;
  positionSizePercent: number;
  maxRiskPercent: number;
}

/**
 * Entry conditions and triggers
 */
export interface EntryConditions {
  trigger: 'market' | 'limit' | 'stop' | 'breakout' | 'bounce';
  confirmationRequired?: Array<{
    indicator: string;
    condition: string;
    value?: number;
    description: string;
  }>;
  invalidationPrice?: number;
  timeLimit?: {
    hours: number;
    expiresAt: number;
  };
}

/**
 * Market context at entry
 */
export interface MarketContext {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  volatility: 'low' | 'medium' | 'high';
  momentum: 'strong' | 'moderate' | 'weak';
  volume: 'increasing' | 'decreasing' | 'stable';
  keyLevels: {
    support: number[];
    resistance: number[];
  };
}

/**
 * Entry reasoning and analysis
 */
export interface EntryReasoning {
  primary: string;
  technicalFactors: Array<{
    indicator: string;
    signal: string;
    weight: number;
    description: string;
  }>;
  risks: string[];
  alternativeScenarios?: Array<{
    condition: string;
    action: string;
  }>;
}

/**
 * Entry proposal for trading
 */
export interface EntryProposal {
  id: string;
  type: 'entry';
  direction: TradingDirection;
  entryPrice: number;
  entryZone?: {
    min: number;
    max: number;
  };
  strategy: TradingStrategy;
  timeframe: string;
  symbol: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  riskParameters: RiskParameters;
  conditions: EntryConditions;
  marketContext: MarketContext;
  reasoning: EntryReasoning;
  status: ProposalStatus;
  createdAt: number;
  expiresAt?: number;
  metadata?: {
    relatedDrawings?: string[];
    backtestResults?: Record<string, unknown>;
    [key: string]: string | number | boolean | string[] | Record<string, unknown> | undefined;
  };
}

// ====================================
// Proposal Groups
// ====================================

/**
 * Group of drawing proposals
 */
export interface DrawingProposalGroup {
  id: string;
  title: string;
  description: string;
  proposals: DrawingProposal[];
  groupType: 'analysis' | 'pattern' | 'levels' | 'mixed';
  summary?: {
    totalProposals: number;
    averageConfidence: number;
    priorityBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
  };
  createdAt: number;
  metadata?: {
    timeframe?: string;
    symbol?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

/**
 * Group of entry proposals
 */
export interface EntryProposalGroup {
  id: string;
  title: string;
  description: string;
  proposals: EntryProposal[];
  groupType: 'entry';
  summary?: {
    marketBias: MarketBias;
    averageConfidence: number;
    totalProposals: number;
    strategyBreakdown: {
      [key in TradingStrategy]?: number;
    };
  };
  createdAt: number;
  metadata?: {
    analysisDepth?: 'basic' | 'advanced' | 'comprehensive';
    [key: string]: string | undefined;
  };
}

// ====================================
// Unified Proposal Interface
// ====================================

/**
 * Base interface for all proposals
 */
export interface BaseProposal {
  id: string;
  type: ProposalType;
  createdAt: number;
  status: ProposalStatus;
}

/**
 * Unified proposal wrapper for API responses
 */
export interface UnifiedProposal {
  type: ProposalType;
  data: DrawingProposalGroup | EntryProposalGroup;
  metadata?: {
    priority?: 'high' | 'medium' | 'low';
    expiresAt?: number;
    source?: string;
  };
}

/**
 * Unified API response
 */
export interface UnifiedProposalResponse {
  message: string;
  proposal?: UnifiedProposal;
  proposals?: UnifiedProposal[];
  metadata: {
    sessionId: string;
    timestamp: string;
    intent: string;
    confidence: number;
  };
}

// ====================================
// UI Events and Actions
// ====================================

/**
 * Proposal action events
 */
export interface ProposalActionEvent {
  type: 'approve' | 'reject' | 'modify' | 'expire';
  proposalId: string;
  timestamp: number;
  userId?: string;
  reason?: string;
}

/**
 * Proposal message in chat
 */
export interface ProposalMessage {
  id: string;
  type: 'proposal';
  content: string;
  proposalGroup?: DrawingProposalGroup | EntryProposalGroup;
  proposals?: UnifiedProposal[];
  timestamp: number;
  metadata?: {
    agentType?: string;
    analysisDepth?: string;
    [key: string]: string | undefined;
  };
}

// ====================================
// Type Guards
// ====================================

/**
 * Check if proposal is a drawing proposal
 */
export function isDrawingProposal(proposal: unknown): proposal is DrawingProposal {
  return proposal && 
    typeof proposal === 'object' && 
    'coordinates' in proposal &&
    'analysisType' in proposal;
}

/**
 * Check if proposal is an entry proposal
 */
export function isEntryProposal(proposal: unknown): proposal is EntryProposal {
  return proposal && 
    typeof proposal === 'object' && 
    proposal.type === 'entry' &&
    'direction' in proposal &&
    'entryPrice' in proposal;
}

/**
 * Check if unified proposal contains entry data
 */
export function isEntryProposalGroup(proposal: UnifiedProposal): proposal is UnifiedProposal & { data: EntryProposalGroup } {
  return proposal.type === 'entry';
}

/**
 * Check if unified proposal contains drawing data
 */
export function isDrawingProposalGroup(proposal: UnifiedProposal): proposal is UnifiedProposal & { data: DrawingProposalGroup } {
  return ['trendline', 'pattern', 'fibonacci', 'support_resistance'].includes(proposal.type);
}

// ====================================
// Conversion Utilities
// ====================================

/**
 * Convert legacy proposal formats to unified format
 */
export function toUnifiedProposal(
  data: DrawingProposalGroup | EntryProposalGroup,
  type?: ProposalType
): UnifiedProposal {
  // Auto-detect type if not provided
  if (!type) {
    if ('proposals' in data && data.proposals[0]) {
      if ('entryPrice' in data.proposals[0]) {
        type = ProposalType.ENTRY;
      } else if ('analysisType' in data.proposals[0]) {
        const analysisType = (data.proposals[0] as DrawingProposal).analysisType;
        switch (analysisType) {
          case 'trendline': type = ProposalType.TRENDLINE; break;
          case 'pattern': type = ProposalType.PATTERN; break;
          case 'fibonacci': type = ProposalType.FIBONACCI; break;
          default: type = ProposalType.TRENDLINE;
        }
      }
    }
    type = type || ProposalType.TRENDLINE;
  }

  return {
    type,
    data,
    metadata: {
      priority: determinePriority(data),
      source: 'ai-analysis',
    },
  };
}

/**
 * Determine proposal priority based on confidence
 */
function determinePriority(data: DrawingProposalGroup | EntryProposalGroup): 'high' | 'medium' | 'low' {
  const avgConfidence = data.proposals.reduce((sum, p) => sum + (p.confidence || 0), 0) / data.proposals.length;
  
  if (avgConfidence >= 0.8) return 'high';
  if (avgConfidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Extract all proposals from an API response
 */
export function extractUnifiedProposals(response: unknown): UnifiedProposal[] {
  const proposals: UnifiedProposal[] = [];

  if (!response || typeof response !== 'object') {
    return proposals;
  }

  const responseObj = response as Record<string, unknown>;

  // Check for proposalGroup (drawing proposals)
  if (responseObj['proposalGroup']) {
    proposals.push(
      toUnifiedProposal(responseObj['proposalGroup'] as DrawingProposalGroup)
    );
  }

  // Check for entryProposalGroup
  if (responseObj['entryProposalGroup']) {
    proposals.push(
      toUnifiedProposal(
        responseObj['entryProposalGroup'] as EntryProposalGroup,
        ProposalType.ENTRY
      )
    );
  }

  // Check for unified proposals array
  if (responseObj['proposals'] && Array.isArray(responseObj['proposals'])) {
    (responseObj['proposals'] as UnifiedProposal[]).forEach((p: UnifiedProposal) => {
      if (p.data) {
        proposals.push(p);
      }
    });
  }

  return proposals;
}

// ====================================
// Re-exports for backward compatibility
// ====================================

// Legacy naming support (to be deprecated)
export type Proposal = DrawingProposal;
export type ProposalGroup = DrawingProposalGroup;