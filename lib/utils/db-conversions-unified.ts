/**
 * Unified Database Conversion Utilities
 * 
 * Environment-agnostic conversion logic with dependency injection
 * for platform-specific implementations
 */

import type { AnalysisRecord } from '@/types/analysis-history';
import { convertDbAnalysisRecordCore } from './db-conversions-shared';

/**
 * Interface for decimal-like values
 */
export interface DecimalLike {
  toString(): string;
}

/**
 * Interface for environment-specific converters
 */
export interface DbConverters {
  createDecimal: (value: string | number) => any;
  isDecimal: (value: any) => boolean;
}

/**
 * Default converters for client environment
 */
export const clientConverters: DbConverters = {
  createDecimal: (value) => Number(value),
  isDecimal: () => false,
};

/**
 * Convert database analysis record to client format
 * (Unified version that works in both environments)
 */
export function convertDbAnalysisRecord(
  dbRecord: any,
  converters: DbConverters = clientConverters
): AnalysisRecord {
  return convertDbAnalysisRecordCore(dbRecord);
}

/**
 * Convert BigInt to string for JSON serialization
 */
export function serializeBigInt(value: bigint): string {
  return value.toString();
}

/**
 * Convert Decimal to number for JSON serialization
 * Works with any object that has toString() method
 */
export function serializeDecimal(value: DecimalLike | number): number {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value.toString());
}

/**
 * Create converters for data preparation functions
 */
export function createDataPreparers(converters: DbConverters) {
  return {
    /**
     * Prepare data for chart drawing creation
     */
    prepareChartDrawingData(drawing: any): any {
      const { 
        id, 
        sessionId, 
        type, 
        points, 
        style, 
        price, 
        time, 
        levels, 
        metadata, 
        visible, 
        interactive 
      } = drawing;
      
      return {
        id,
        sessionId,
        type,
        points: points || [],
        style: style || {},
        price: price !== undefined ? converters.createDecimal(price) : undefined,
        time: time !== undefined ? BigInt(time) : undefined,
        levels: levels || undefined,
        metadata: metadata || undefined,
        visible: visible !== undefined ? visible : true,
        interactive: interactive !== undefined ? interactive : true,
      };
    },

    /**
     * Prepare data for pattern analysis creation
     */
    preparePatternAnalysisData(pattern: any): any {
      const { 
        id, 
        sessionId, 
        type, 
        symbol, 
        interval, 
        startTime, 
        endTime, 
        confidence,
        visualization,
        metrics,
        description,
        tradingImplication 
      } = pattern;
      
      return {
        id,
        sessionId,
        type,
        symbol,
        interval,
        startTime: BigInt(startTime),
        endTime: BigInt(endTime),
        confidence: converters.createDecimal(confidence),
        visualization: visualization || {},
        metrics: metrics || {},
        description,
        tradingImplication,
      };
    },
  };
}

/**
 * Create client-side data preparers
 */
export const {
  prepareChartDrawingData: prepareChartDrawingDataClient,
  preparePatternAnalysisData: preparePatternAnalysisDataClient,
} = createDataPreparers(clientConverters);

/**
 * Re-export shared conversion function
 */
export { convertDbAnalysisRecordCore } from './db-conversions-shared';

/**
 * Utility type guards
 */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

export function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  );
}

/**
 * Safe conversion utilities
 */
export function safeToNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  if (isDecimalLike(value)) {
    return Number(value.toString());
  }
  if (isBigInt(value)) {
    return Number(value);
  }
  return 0;
}

export function safeToBigInt(value: unknown): bigint {
  if (isBigInt(value)) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return BigInt(value);
  }
  return BigInt(0);
}

/**
 * JSON serialization helpers
 */
export function prepareForJson(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (isBigInt(obj)) {
    return serializeBigInt(obj);
  }
  
  if (isDecimalLike(obj)) {
    return serializeDecimal(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(prepareForJson);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = prepareForJson(value);
    }
    return result;
  }
  
  return obj;
}