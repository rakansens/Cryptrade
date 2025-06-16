import type { 
  AnalysisRecord,
  ProposalData,
  SentimentData,
  TrackingData
} from '@/types/analysis-history';

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
 * Convert database analysis record to client format
 */
export function convertDbAnalysisRecord(
  dbRecord: DbAnalysisRecord
): AnalysisRecord {
  // Parse JSON fields
  const proposalData = dbRecord.proposalData as ProposalData | null;
  const trackingData = dbRecord.trackingData as TrackingData | null;
  const performanceData = dbRecord.performanceData as any;

  // Extract price from proposalData if available
  let price = 0;
  if (proposalData) {
    if ('price' in proposalData && typeof proposalData.price === 'number') {
      price = proposalData.price;
    } else if ('levels' in proposalData && Array.isArray(proposalData.levels) && proposalData.levels.length > 0) {
      price = proposalData.levels[0];
    } else if ('startPrice' in proposalData && typeof proposalData.startPrice === 'number') {
      price = proposalData.startPrice;
    }
  }

  // Extract sentiment data from proposalData if it has sentiment fields
  let sentimentData: SentimentData | undefined;
  if (proposalData && 'sentiment' in proposalData) {
    sentimentData = proposalData.sentiment as SentimentData;
  }

  // Convert touch events
  const touches = dbRecord.touchEvents?.map(event => ({
    id: event.id,
    timestamp: Number(event.timestamp),
    price: Number(event.price.toString()),
    result: event.result as 'breakout' | 'bounce',
    volume: event.volume ? Number(event.volume.toString()) : undefined,
    strength: Number(event.strength.toString()),
  })) || [];

  // Build tracking data
  const finalTrackingData: TrackingData = trackingData || {
    status: 'active' as const,
    startTime: Number(dbRecord.timestamp.toString()),
    touches: touches.map(t => ({
      time: t.timestamp,
      price: t.price,
      result: t.result === 'breakout' ? 'break' : t.result as 'bounce' | 'break' | 'test',
      volume: t.volume,
      strength: t.strength
    }))
  };

  // Extract confidence from performanceData if available
  let confidence: number | undefined;
  if (performanceData?.confidence !== undefined) {
    confidence = typeof performanceData.confidence === 'number' 
      ? performanceData.confidence 
      : parseFloat(performanceData.confidence);
  } else if (proposalData && 'confidence' in proposalData) {
    confidence = typeof proposalData.confidence === 'number'
      ? proposalData.confidence
      : parseFloat(proposalData.confidence as string);
  }

  return {
    id: dbRecord.id,
    proposalId: dbRecord.proposalId || '',
    sessionId: dbRecord.sessionId || '',
    symbol: dbRecord.symbol,
    interval: dbRecord.interval,
    type: dbRecord.type as 'support' | 'resistance' | 'pattern' | 'trendline' | 'fibonacci',
    timestamp: Number(dbRecord.timestamp),
    proposal: {
      price,
      confidence: confidence || 0.5,
      drawingData: proposalData?.drawingData || {
        type: dbRecord.type as any,
        points: [],
      },
      mlPrediction: proposalData?.mlPrediction,
      sentiment: sentimentData,
    },
    tracking: finalTrackingData,
    performance: performanceData ? {
      accuracy: performanceData.accuracy,
      profitLoss: performanceData.profitLoss,
      holdDuration: performanceData.holdDuration,
      actualBounces: performanceData.actualBounces,
      predictedBounces: performanceData.predictedBounces,
    } : undefined,
    dbMeta: {
      version: 1,
      synced: dbRecord.synced,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    },
  };
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