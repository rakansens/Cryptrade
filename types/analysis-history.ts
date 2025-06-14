// Analysis history types for tracking proposal performance

import { z, ZodIssue } from 'zod';
import { DrawingDataSchema } from './drawing';

// =============================================================================
// ZOD SCHEMAS - Analysis history types
// =============================================================================

export const TouchEventSchema = z.object({
  time: z.number().describe('Unix timestamp'),
  price: z.number().describe('Price at touch'),
  result: z.enum(['bounce', 'break', 'test']).describe('Touch result'),
  volume: z.number().optional().describe('Volume at touch'),
  strength: z.number().min(0).max(1).optional().describe('Touch strength 0-1')
});

export const TrackingDataSchema = z.object({
  status: z.enum(['active', 'completed', 'expired', 'cancelled']),
  startTime: z.number().describe('Tracking start timestamp'),
  endTime: z.number().optional().describe('Tracking end timestamp'),
  touches: z.array(TouchEventSchema).default([]),
  duration: z.number().optional().describe('Duration in milliseconds'),
  finalResult: z.enum(['success', 'partial', 'failure']).optional(),
  notes: z.string().optional().describe('Additional notes')
});

export const ProposalDataSchema = z.object({
  price: z.number().optional().describe('Line price for horizontal lines'),
  confidence: z.number().min(0).max(1).describe('Statistical confidence'),
  mlPrediction: z.object({
    successProbability: z.number().min(0).max(1),
    expectedBounces: z.number().int().min(0),
    reasoning: z.array(z.object({
      factor: z.string(),
      impact: z.enum(['positive', 'negative', 'neutral']),
      weight: z.number(),
      description: z.string()
    }))
  }).optional(),
  drawingData: z.lazy(() => DrawingDataSchema).describe('Drawing configuration data')
});

export const AnalysisRecordSchema = z.object({
  // Primary identifiers
  id: z.string().describe('Unique record ID'),
  proposalId: z.string().describe('Original proposal ID'),
  sessionId: z.string().describe('Chat session ID'),
  
  // Metadata
  timestamp: z.number().describe('Record creation timestamp'),
  symbol: z.string().describe('Trading pair (e.g., BTCUSDT)'),
  interval: z.string().describe('Timeframe (e.g., 1h, 4h)'),
  type: z.enum(['support', 'resistance', 'trendline', 'pattern', 'fibonacci']),
  
  // Proposal information
  proposal: ProposalDataSchema,
  
  // Tracking data
  tracking: TrackingDataSchema,
  
  // Performance metrics (calculated)
  performance: z.object({
    accuracy: z.number().min(0).max(1).optional().describe('Prediction accuracy'),
    profitLoss: z.number().optional().describe('P&L if traded'),
    holdDuration: z.number().optional().describe('How long line held'),
    actualBounces: z.number().int().min(0).optional(),
    predictedBounces: z.number().int().min(0).optional()
  }).optional(),
  
  // Database metadata (for future DB implementation)
  dbMeta: z.object({
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    version: z.number().default(1),
    synced: z.boolean().default(false).describe('Whether synced to DB')
  }).optional()
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type TouchEvent = z.infer<typeof TouchEventSchema>;
export type TrackingData = z.infer<typeof TrackingDataSchema>;
export type ProposalData = z.infer<typeof ProposalDataSchema>;
export type AnalysisRecord = z.infer<typeof AnalysisRecordSchema>;

// =============================================================================
// ANALYSIS PERFORMANCE METRICS
// =============================================================================

export interface PerformanceMetrics {
  // Overall statistics
  totalRecords: number;
  activeRecords: number;
  completedRecords: number;
  
  // Accuracy metrics
  overallAccuracy: number;
  accuracyByType: Record<string, number>;
  accuracyBySymbol: Record<string, number>;
  
  // Prediction vs Reality
  avgPredictedSuccess: number;
  avgActualSuccess: number;
  
  // ML performance
  mlPredictions: {
    highConfidence: { predicted: number; actual: number; count: number };
    mediumConfidence: { predicted: number; actual: number; count: number };
    lowConfidence: { predicted: number; actual: number; count: number };
  };
  
  // Trends
  last7Days: number;
  last30Days: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateAnalysisRecord(data: unknown): AnalysisRecord {
  try {
    return AnalysisRecordSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Analysis History] Validation failed:', error.errors);
      throw new Error(
        `Invalid analysis record: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}

export function validateTouchEvent(data: unknown): TouchEvent {
  try {
    return TouchEventSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('[Touch Event] Validation failed:', error.errors);
      throw new Error(
        `Invalid touch event: ${error.errors.map((e: ZodIssue) => e.message).join(', ')}`
      );
    }
    throw error;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function calculateAccuracy(record: AnalysisRecord): number {
  if (!record.tracking.touches.length || !record.proposal.mlPrediction) {
    return 0;
  }
  
  const predicted = record.proposal.mlPrediction.successProbability;
  const bounces = record.tracking.touches.filter(t => t.result === 'bounce').length;
  const actual = bounces > 0 ? 1 : 0;
  
  // Simple accuracy calculation
  return 1 - Math.abs(predicted - actual);
}

export function calculatePerformanceMetrics(records: AnalysisRecord[]): PerformanceMetrics {
  const completed = records.filter(r => r.tracking.status === 'completed');
  const withMLPrediction = completed.filter(r => r.proposal.mlPrediction);
  
  const overallAccuracy = completed.length > 0
    ? completed.reduce((sum, r) => sum + calculateAccuracy(r), 0) / completed.length
    : 0;
  
  return {
    totalRecords: records.length,
    activeRecords: records.filter(r => r.tracking.status === 'active').length,
    completedRecords: completed.length,
    overallAccuracy,
    accuracyByType: {},
    accuracyBySymbol: {},
    avgPredictedSuccess: withMLPrediction.length > 0
      ? withMLPrediction.reduce((sum, r) => sum + r.proposal.mlPrediction!.successProbability, 0) / withMLPrediction.length
      : 0,
    avgActualSuccess: completed.length > 0
      ? completed.filter(r => r.tracking.touches.some(t => t.result === 'bounce')).length / completed.length
      : 0,
    mlPredictions: {
      highConfidence: { predicted: 0, actual: 0, count: 0 },
      mediumConfidence: { predicted: 0, actual: 0, count: 0 },
      lowConfidence: { predicted: 0, actual: 0, count: 0 }
    },
    last7Days: 0,
    last30Days: 0,
    improvementTrend: 'stable'
  };
}

// =============================================================================
// DB MIGRATION PREPARATION
// =============================================================================

/**
 * Database schema for future implementation
 * 
 * TABLE: analysis_records
 * - id: VARCHAR(255) PRIMARY KEY
 * - proposal_id: VARCHAR(255) NOT NULL
 * - session_id: VARCHAR(255) NOT NULL
 * - user_id: VARCHAR(255) -- for multi-user support
 * - timestamp: BIGINT NOT NULL
 * - symbol: VARCHAR(20) NOT NULL
 * - interval: VARCHAR(10) NOT NULL
 * - type: ENUM('support', 'resistance', 'trendline', 'pattern', 'fibonacci')
 * - proposal_data: JSON NOT NULL
 * - tracking_data: JSON NOT NULL
 * - performance_data: JSON
 * - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 * - version: INT DEFAULT 1
 * 
 * TABLE: touch_events
 * - id: VARCHAR(255) PRIMARY KEY
 * - record_id: VARCHAR(255) REFERENCES analysis_records(id)
 * - timestamp: BIGINT NOT NULL
 * - price: DECIMAL(20, 8) NOT NULL
 * - result: ENUM('bounce', 'break', 'test')
 * - volume: DECIMAL(20, 8)
 * - strength: DECIMAL(3, 2)
 * - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * 
 * INDEX: idx_analysis_records_symbol_timestamp
 * INDEX: idx_analysis_records_type_status
 * INDEX: idx_touch_events_record_timestamp
 */

export const DB_MIGRATION_TODO = `
TODO: Database Implementation
============================

1. Create Supabase tables:
   - analysis_records
   - touch_events
   
2. Implement data layer:
   - lib/db/analysis-history.ts
   - CRUD operations with Supabase client
   
3. Add sync functionality:
   - Background sync from Zustand to DB
   - Conflict resolution
   - Offline support
   
4. Migration script:
   - Export existing Zustand data
   - Import to database
   - Maintain data integrity
   
5. Performance optimization:
   - Pagination for large datasets
   - Efficient querying
   - Caching strategies
`;