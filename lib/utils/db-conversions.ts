import type { AnalysisRecord } from '@/types/analysis-history';
import { convertDbAnalysisRecordCore } from './db-conversions-shared';

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
 */
export function convertDbAnalysisRecord(
  dbRecord: DbAnalysisRecord
): AnalysisRecord {
  // 共通のコア関数を使用
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
export function serializeDecimal(value: { toString(): string }): number {
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
    price: price !== undefined ? price : undefined,
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
    confidence,
    visualization: visualization || {},
    metrics: metrics || {},
    description,
    tradingImplication,
  };
}