/**
 * Client-side database conversion utilities
 * 
 * This file provides client-safe exports without Prisma dependencies
 */

import type { AnalysisRecord } from '@/types/analysis-history';
import {
  convertDbAnalysisRecord as convertDbAnalysisRecordUnified,
  serializeBigInt as serializeBigIntUnified,
  serializeDecimal as serializeDecimalUnified,
  prepareChartDrawingDataClient,
  preparePatternAnalysisDataClient,
  clientConverters,
} from './db-conversions-unified';

// Client-safe type definitions (without Prisma dependencies)
export type DbAnalysisRecord = {
  id: string;
  proposalId: string | null;
  sessionId: string | null;
  symbol: string;
  interval: string;
  type: string;
  timestamp: bigint;
  proposalData: unknown;
  trackingData: unknown;
  performanceData: unknown;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
  touchEvents?: DbTouchEvent[];
};

export type DbTouchEvent = {
  id: string;
  timestamp: bigint;
  price: { toString(): string };
  result: string;
  volume: { toString(): string } | null;
  strength: { toString(): string };
};

/**
 * Convert database analysis record to client format (Client version without Prisma)
 * @deprecated Use the unified version directly
 */
export function convertDbAnalysisRecord(
  dbRecord: DbAnalysisRecord
): AnalysisRecord {
  return convertDbAnalysisRecordUnified(dbRecord, clientConverters);
}

/**
 * Convert BigInt to string for JSON serialization
 * @deprecated Use the unified version directly
 */
export const serializeBigInt = serializeBigIntUnified;

/**
 * Convert Decimal to number for JSON serialization
 * @deprecated Use the unified version directly
 */
export const serializeDecimal = serializeDecimalUnified;

/**
 * Prepare data for chart drawing creation
 * @deprecated Use the unified version directly
 */
export const prepareChartDrawingData = prepareChartDrawingDataClient;

/**
 * Prepare data for pattern analysis creation
 * @deprecated Use the unified version directly
 */
export const preparePatternAnalysisData = preparePatternAnalysisDataClient;

// Re-export unified utilities for new code
export {
  convertDbAnalysisRecord as convertDbAnalysisRecordUnified,
  serializeBigInt as serializeBigIntUnified,
  serializeDecimal as serializeDecimalUnified,
  prepareChartDrawingDataClient as prepareChartDrawingDataUnified,
  preparePatternAnalysisDataClient as preparePatternAnalysisDataUnified,
  safeToNumber,
  safeToBigInt,
  prepareForJson,
  type DecimalLike,
} from './db-conversions-unified';