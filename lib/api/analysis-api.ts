/**
 * Client-side API functions for analysis operations
 * These functions call the API routes instead of directly using Prisma
 */

import { logger } from '@/lib/utils/logger';
import type { 
  AnalysisRecord, 
  TouchEvent,
  ProposalData,
  SentimentData,
  TrackingData
} from '@/types/analysis-history';
import type { DatabaseRecord } from '@/lib/api/types';

export class AnalysisAPI {
  /**
   * Save an analysis record
   */
  static async saveAnalysis(record: {
    sessionId?: string;
    symbol: string;
    interval: string;
    type: 'support' | 'resistance' | 'pattern' | 'trendline' | 'fibonacci' | 'volume';
    proposalData?: ProposalData;
    sentimentData?: SentimentData;
    trackingData?: TrackingData;
  }): Promise<string> {
    try {
      const response = await fetch('/api/analysis/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error(`Failed to save analysis: ${response.statusText}`);
      }

      const { recordId } = await response.json();
      return recordId;
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to save analysis', { error });
      throw error;
    }
  }

  /**
   * Record a touch event
   */
  static async recordTouchEvent(
    recordId: string,
    event: Omit<TouchEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const response = await fetch(`/api/analysis/records/${recordId}/touch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Failed to record touch event: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to record touch event', { error, recordId });
      throw error;
    }
  }

  /**
   * Get session analyses
   */
  static async getSessionAnalyses(sessionId: string): Promise<AnalysisRecord[]> {
    try {
      const response = await fetch(`/api/analysis/sessions/${sessionId}/records`);

      if (!response.ok) {
        throw new Error(`Failed to get session analyses: ${response.statusText}`);
      }

      const { records } = await response.json();
      return records;
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to get session analyses', { error, sessionId });
      return [];
    }
  }

  /**
   * Get active analyses
   */
  static async getActiveAnalyses(symbol?: string): Promise<AnalysisRecord[]> {
    try {
      const url = symbol 
        ? `/api/analysis/active?symbol=${encodeURIComponent(symbol)}`
        : '/api/analysis/active';
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to get active analyses: ${response.statusText}`);
      }

      const { records } = await response.json();
      return records;
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to get active analyses', { error, symbol });
      return [];
    }
  }

  /**
   * Convert DB record to client format
   */
  static convertToAnalysisRecord(dbRecord: DatabaseRecord & {
    sessionId: string;
    symbol: string;
    interval: string;
    type: 'support' | 'resistance' | 'pattern' | 'trendline' | 'fibonacci' | 'volume';
    timestamp: string;
    price: string;
    proposalData?: ProposalData;
    sentimentData?: SentimentData;
    trackingData?: TrackingData;
    touchEvents?: Array<{
      id: string;
      timestamp: string;
      price: string;
      result: 'breakout' | 'bounce';
      volume?: string;
      strength: string;
    }>;
    confidence?: string;
  }): AnalysisRecord {
    return {
      id: dbRecord.id,
      sessionId: dbRecord.sessionId,
      symbol: dbRecord.symbol,
      interval: dbRecord.interval,
      type: dbRecord.type,
      timestamp: new Date(dbRecord.timestamp).getTime(),
      price: parseFloat(dbRecord.price),
      proposalData: dbRecord.proposalData,
      sentimentData: dbRecord.sentimentData,
      trackingData: dbRecord.trackingData || {
        touches: dbRecord.touchEvents?.map((event) => ({
          id: event.id,
          timestamp: new Date(event.timestamp).getTime(),
          price: parseFloat(event.price),
          result: event.result,
          volume: event.volume ? parseFloat(event.volume) : undefined,
          strength: parseFloat(event.strength),
        })) || [],
        performance: {
          accuracy: 0,
          avgStrength: 0,
          totalTouches: 0,
          successRate: 0,
        },
      },
      confidence: dbRecord.confidence ? parseFloat(dbRecord.confidence) : undefined,
      dbMeta: {
        synced: true,
        lastSync: Date.now(),
      },
    };
  }
}