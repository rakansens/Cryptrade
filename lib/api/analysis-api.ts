/**
 * Client-side API functions for analysis operations
 * These functions call the API routes instead of directly using Prisma
 */

import { logger } from '@/lib/utils/logger';
import { apiCache } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import type { 
  AnalysisRecord, 
  TouchEvent,
  ProposalData,
  TrackingData,
  SentimentData
} from '@/types/analysis-history';
import { convertDbAnalysisRecord } from '@/lib/utils/db-conversions';

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
   * Get session analyses with retry and caching
   */
  static async getSessionAnalyses(sessionId: string): Promise<AnalysisRecord[]> {
    const cacheKey = apiCache.createKey('analysis_session', { sessionId });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<AnalysisRecord[]>(cacheKey, { 
      ttl: 120000, // 2分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[AnalysisAPI] Returning cached session analyses', { sessionId });
      return cached;
    }
    
    try {
      const records = await withRetry(async () => {
        const response = await fetch(`/api/analysis/sessions/${sessionId}/records`);

        if (!response.ok) {
          throw new Error(`Failed to get session analyses: ${response.statusText}`);
        }

        const { records } = await response.json();
        return records as AnalysisRecord[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[AnalysisAPI] Retrying getSessionAnalyses', { error: error.message, attempt, sessionId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, records, { useLocalStorage: true });
      
      return records;
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to get session analyses after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<AnalysisRecord[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[AnalysisAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[AnalysisAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to get session analyses for ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active analyses with retry and caching
   */
  static async getActiveAnalyses(symbol?: string): Promise<AnalysisRecord[]> {
    const cacheKey = apiCache.createKey('analysis_active', { symbol: symbol || 'all' });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<AnalysisRecord[]>(cacheKey, { 
      ttl: 60000, // 1分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[AnalysisAPI] Returning cached active analyses', { symbol });
      return cached;
    }
    
    try {
      const records = await withRetry(async () => {
        const url = symbol 
          ? `/api/analysis/active?symbol=${encodeURIComponent(symbol)}`
          : '/api/analysis/active';
        
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to get active analyses: ${response.statusText}`);
        }

        const { records } = await response.json();
        return records as AnalysisRecord[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[AnalysisAPI] Retrying getActiveAnalyses', { error: error.message, attempt, symbol });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, records, { useLocalStorage: true });
      
      return records;
    } catch (error) {
      logger.error('[AnalysisAPI] Failed to get active analyses after retries', { error, symbol });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<AnalysisRecord[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[AnalysisAPI] Using stale cache due to API failure', { symbol });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[AnalysisAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to get active analyses${symbol ? ` for ${symbol}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert DB record to client format
   */
  static convertToAnalysisRecord(dbRecord: unknown): AnalysisRecord {
    return convertDbAnalysisRecord(dbRecord as Parameters<typeof convertDbAnalysisRecord>[0]);
  }
}