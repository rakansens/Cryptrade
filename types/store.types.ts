/**
 * Type definitions for store system
 */

// ===== Common Store Types =====

export interface StoreMetadata {
  version: number;
  lastUpdated?: number;
  migratedFrom?: number;
}

export interface StoreMigration<T> {
  version: number;
  migrate: (persistedState: unknown, fromVersion: number) => T;
}

// ===== Chart Pattern Types =====

export interface PatternCoordinate {
  time: number;
  price: number;
}

export interface PatternLine {
  start: PatternCoordinate;
  end: PatternCoordinate;
  type?: 'support' | 'resistance' | 'trend' | 'breakout';
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface PatternVisualization {
  type: string;
  lines: PatternLine[];
  zones?: PatternZone[];
  labels?: PatternLabel[];
  keyPoints?: PatternCoordinate[];
}

export interface PatternZone {
  start: PatternCoordinate;
  end: PatternCoordinate;
  color: string;
  opacity: number;
  label?: string;
}

export interface PatternLabel {
  position: PatternCoordinate;
  text: string;
  style?: {
    color?: string;
    fontSize?: number;
    backgroundColor?: string;
  };
}

export interface PatternMetrics {
  height: number;
  width: number;
  angle?: number;
  retracement?: number;
  volume?: number;
  priceChange?: number;
  duration?: number;
}

// ===== Proposal Types =====

export interface TradingProposal {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  reason: string;
  confidence: number;
  timestamp: number;
}

export interface ProposalGroup {
  id: string;
  proposals: TradingProposal[];
  summary?: string;
  totalConfidence?: number;
  timestamp: number;
}

export interface EntryProposal {
  id: string;
  entryType: 'market' | 'limit' | 'stop';
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  positionSize: number;
  reasoning: string;
  confidence: number;
}

export interface EntryProposalGroup {
  id: string;
  entries: EntryProposal[];
  marketContext?: string;
  riskAssessment?: string;
  timestamp: number;
}

// ===== Indicator Types =====

export type IndicatorValue = number | Record<string, number> | null;

export interface IndicatorConfig {
  enabled: boolean;
  parameters: Record<string, number | string | boolean>;
  style?: {
    color?: string;
    lineWidth?: number;
    opacity?: number;
  };
}

// ===== Analysis Types =====

export interface AnalysisMetadata {
  timestamp: number;
  duration?: number;
  model?: string;
  version?: string;
  confidence?: number;
}

export interface AnalysisResult {
  id: string;
  type: string;
  data: unknown;
  metadata: AnalysisMetadata;
}

// ===== Migration Helpers =====

export function createMigration<T>(
  version: number,
  migrator: (state: unknown) => T
): StoreMigration<T> {
  return {
    version,
    migrate: (persistedState, fromVersion) => {
      console.log(`Migrating store from version ${fromVersion} to ${version}`);
      return migrator(persistedState);
    }
  };
}

export function isValidPersistedState<T>(
  state: unknown,
  validator: (s: unknown) => s is T
): state is T {
  return state !== null && 
         state !== undefined && 
         typeof state === 'object' &&
         validator(state);
}

// ===== Type Guards =====

export function isPatternVisualization(value: unknown): value is PatternVisualization {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.type === 'string' &&
    Array.isArray(obj.lines)
  );
}

export function isProposalGroup(value: unknown): value is ProposalGroup {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    Array.isArray(obj.proposals) &&
    typeof obj.timestamp === 'number'
  );
}

export function isEntryProposalGroup(value: unknown): value is EntryProposalGroup {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    Array.isArray(obj.entries) &&
    typeof obj.timestamp === 'number'
  );
}