import { Decimal } from '@prisma/client/runtime/library';
import type { 
  AnalysisRecord as DbAnalysisRecord,
  TouchEvent as DbTouchEvent
} from '@prisma/client';
import type { AnalysisRecord } from '@/types/analysis-history';
import { convertDbAnalysisRecordCore } from './db-conversions-shared';

/**
 * Convert database analysis record to client format (Server version with Prisma types)
 */
export function convertDbAnalysisRecord(
  dbRecord: DbAnalysisRecord & {
    touchEvents?: DbTouchEvent[];
  }
): AnalysisRecord {
  // Prisma型を共通型に変換してコア関数を呼び出す
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
 */
export function serializeDecimal(value: Decimal): number {
  return Number(value.toString());
}

/**
 * Prepare data for chart drawing creation
 */
export function prepareChartDrawingData(drawing: any): any {
  const { id, sessionId, type, points, style, price, time, levels, metadata, visible, interactive } = drawing;
  
  return {
    id,
    sessionId,
    type,
    points: points || [],
    style: style || {},
    price: price !== undefined ? new Decimal(price) : undefined,
    time: time !== undefined ? BigInt(time) : undefined,
    levels: levels || undefined,
    metadata: metadata || undefined,
    visible: visible !== undefined ? visible : true,
    interactive: interactive !== undefined ? interactive : true,
  };
}

/**
 * Prepare data for pattern analysis creation
 */
export function preparePatternAnalysisData(pattern: any) {
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
    confidence: new Decimal(confidence),
    visualization: visualization || {},
    metrics: metrics || {},
    description,
    tradingImplication,
  };
}