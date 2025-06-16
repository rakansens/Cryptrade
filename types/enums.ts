/**
 * Central enum definitions for the Cryptrade project.
 *
 * These enums were consolidated from various modules to
 * ensure a single source of truth across the codebase.
 */

// Proposal related enums
export enum ProposalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

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

// Analysis related enums (mapped from Prisma)
export const AnalysisType = {
  SUPPORT: 'support',
  RESISTANCE: 'resistance',
  TRENDLINE: 'trendline',
  PATTERN: 'pattern',
  FIBONACCI: 'fibonacci',
  VOLUME: 'volume',
} as const;
export type AnalysisType = typeof AnalysisType[keyof typeof AnalysisType];
