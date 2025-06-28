/**
 * Shared database conversion utilities
 * 
 * 環境に依存しない共通の変換ロジック
 * server版とclient版で共有される処理を統合
 */

import type { 
  AnalysisRecord,
  ProposalData,
  SentimentData,
  TrackingData
} from '@/types/analysis-history';

/**
 * 共通の変換ロジック
 */
export function convertDbAnalysisRecordCore(
  dbRecord: {
    id: string;
    proposalId: string | null;
    sessionId: string | null;
    symbol: string;
    interval: string;
    type: string;
    timestamp: bigint | number;
    proposalData: unknown;
    trackingData: unknown;
    performanceData: unknown;
    synced: boolean;
    createdAt: Date;
    updatedAt: Date;
    touchEvents?: Array<{
      id: string;
      timestamp: bigint | number;
      price: { toString(): string } | number;
      result: string;
      volume?: { toString(): string } | number | null;
      strength: { toString(): string } | number;
    }>;
  }
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
    price: typeof event.price === 'number' ? event.price : Number(event.price.toString()),
    result: event.result as 'breakout' | 'bounce',
    volume: event.volume ? 
      (typeof event.volume === 'number' ? event.volume : Number(event.volume.toString())) : 
      undefined,
    strength: typeof event.strength === 'number' ? event.strength : Number(event.strength.toString()),
  })) || [];

  // Build tracking data with all possible fields
  const finalTrackingData: TrackingData = {
    status: trackingData?.status || 'active' as const,
    startTime: trackingData?.startTime || Number(dbRecord.timestamp.toString()),
    touches: touches.map(t => ({
      time: t.timestamp,
      price: t.price,
      result: t.result === 'breakout' ? 'break' : t.result as 'bounce' | 'break' | 'test',
      volume: t.volume,
      strength: t.strength
    })),
    // Optional fields from client version
    ...(trackingData?.endTime && { endTime: trackingData.endTime }),
    ...(trackingData?.duration && { duration: trackingData.duration }),
    ...(trackingData?.finalResult && { finalResult: trackingData.finalResult as 'success' | 'partial' | 'failure' }),
    ...(trackingData?.notes && { notes: trackingData.notes }),
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