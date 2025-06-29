/**
 * Server-side database conversion utilities
 * 
 * This file provides server-specific exports with Prisma support
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { 
  AnalysisRecord as DbAnalysisRecord,
  TouchEvent as DbTouchEvent
} from '@prisma/client';
import type { AnalysisRecord } from '@/types/analysis-history';
import {
  convertDbAnalysisRecord as convertDbAnalysisRecordUnified,
  serializeBigInt as serializeBigIntUnified,
  serializeDecimal as serializeDecimalUnified,
  createDataPreparers,
  type DbConverters,
} from './db-conversions-unified';

/**
 * Server-specific converters for Prisma Decimal type
 */
export const serverConverters: DbConverters = {
  createDecimal: (value) => new Decimal(value),
  isDecimal: (value) => value instanceof Decimal,
};

/**
 * Create server-side data preparers with Prisma support
 */
const {
  prepareChartDrawingData: prepareChartDrawingDataServer,
  preparePatternAnalysisData: preparePatternAnalysisDataServer,
} = createDataPreparers(serverConverters);

/**
 * Convert database analysis record to client format (Server version with Prisma types)
 * @deprecated Use the unified version directly
 */
export function convertDbAnalysisRecord(
  dbRecord: DbAnalysisRecord & {
    touchEvents?: DbTouchEvent[];
  }
): AnalysisRecord {
  return convertDbAnalysisRecordUnified(dbRecord, serverConverters);
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
export const prepareChartDrawingData = prepareChartDrawingDataServer;

/**
 * Prepare data for pattern analysis creation
 * @deprecated Use the unified version directly
 */
export const preparePatternAnalysisData = preparePatternAnalysisDataServer;

// Re-export unified utilities for new code
export {
  convertDbAnalysisRecord as convertDbAnalysisRecordUnified,
  serializeBigInt as serializeBigIntUnified,
  serializeDecimal as serializeDecimalUnified,
  prepareChartDrawingDataServer as prepareChartDrawingDataUnified,
  preparePatternAnalysisDataServer as preparePatternAnalysisDataUnified,
  safeToNumber,
  safeToBigInt,
  prepareForJson,
  type DecimalLike,
} from './db-conversions-unified';

// Re-export Prisma types for convenience
export type { DbAnalysisRecord, DbTouchEvent };