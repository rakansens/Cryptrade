/**
 * Client-side API functions for chart drawing operations
 */

import { logger } from '@/lib/utils/logger';
import { apiCache, createKey } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { env } from '@/config/env';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';

export interface TimeframeState {
  symbol: string;
  timeframe: string;
  timestamp: number;
}

export class ChartDrawingAPI {
  /**
   * Save drawings to database
   */
  static async saveDrawings(sessionId: string, drawings: ChartDrawing[]): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/drawings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drawings }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save drawings: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to save drawings', { error });
      throw error;
    }
  }

  /**
   * Load drawings from database with retry and caching
   */
  static async loadDrawings(sessionId: string): Promise<ChartDrawing[]> {
    const cacheKey = createKey('chart_drawings', { sessionId });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<ChartDrawing[]>(cacheKey, { 
      ttl: 300000, // 5分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[ChartDrawingAPI] Returning cached drawings', { sessionId });
      return cached;
    }
    
    try {
      const drawings = await withRetry(async () => {
        const response = await fetch(`/api/chart/sessions/${sessionId}/drawings`);

        if (!response.ok) {
          throw new Error(`Failed to load drawings: ${response.statusText}`);
        }

        const { drawings } = await response.json();
        return drawings as ChartDrawing[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ChartDrawingAPI] Retrying loadDrawings', { error: error.message, attempt, sessionId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, drawings, { useLocalStorage: true });
      
      return drawings;
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to load drawings after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<ChartDrawing[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[ChartDrawingAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ChartDrawingAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to load drawings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save patterns to database
   */
  static async savePatterns(sessionId: string, patterns: PatternData[]): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patterns }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save patterns: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to save patterns', { error });
      throw error;
    }
  }

  /**
   * Load patterns from database with retry and caching
   */
  static async loadPatterns(sessionId: string): Promise<PatternData[]> {
    const cacheKey = createKey('chart_patterns', { sessionId });
    
    // キャッシュから取得を試みる
    const cached = apiCache.get<PatternData[]>(cacheKey, { 
      ttl: 300000, // 5分
      useLocalStorage: true 
    });
    
    if (cached) {
      logger.debug('[ChartDrawingAPI] Returning cached patterns', { sessionId });
      return cached;
    }
    
    try {
      const patterns = await withRetry(async () => {
        const response = await fetch(`/api/chart/sessions/${sessionId}/patterns`);

        if (!response.ok) {
          throw new Error(`Failed to load patterns: ${response.statusText}`);
        }

        const { patterns } = await response.json();
        return patterns as PatternData[];
      }, {
        maxAttempts: 3,
        onRetry: (error, attempt) => {
          logger.warn('[ChartDrawingAPI] Retrying loadPatterns', { error: error.message, attempt, sessionId });
        }
      });
      
      // キャッシュに保存
      apiCache.set(cacheKey, patterns, { useLocalStorage: true });
      
      return patterns;
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to load patterns after retries', { error, sessionId });
      
      // キャッシュから古いデータを取得（フォールバック）
      const staleCache = apiCache.get<PatternData[]>(cacheKey, { 
        ttl: Infinity, // TTLを無視
        useLocalStorage: true 
      });
      
      if (staleCache) {
        logger.warn('[ChartDrawingAPI] Using stale cache due to API failure', { sessionId });
        return staleCache;
      }
      
      // 開発環境では空配列を返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        logger.warn('[ChartDrawingAPI] Returning empty array in development mode');
        return [];
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to load patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save timeframe state
   */
  static async saveTimeframeState(sessionId: string, state: TimeframeState): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/timeframe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state),
      });

      if (!response.ok) {
        throw new Error(`Failed to save timeframe state: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to save timeframe state', { error });
      throw error;
    }
  }

  /**
   * Load timeframe state
   */
  static async loadTimeframeState(sessionId: string): Promise<TimeframeState | null> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/timeframe`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to load timeframe state: ${response.statusText}`);
      }

      const { state } = await response.json();
      return state;
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to load timeframe state', { error });
      
      // 開発環境ではnullを返す（後方互換性のため）
      if (env.NODE_ENV === 'development') {
        return null;
      }
      
      // 本番環境ではエラーを投げる
      throw new Error(`Failed to load timeframe state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a specific drawing
   */
  static async deleteDrawing(sessionId: string, drawingId: string): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/drawings/${drawingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete drawing: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to delete drawing', { error });
      throw error;
    }
  }

  /**
   * Delete a specific pattern
   */
  static async deletePattern(sessionId: string, patternId: string): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/patterns/${patternId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete pattern: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to delete pattern', { error });
      throw error;
    }
  }

  /**
   * Migrate data from localStorage to database
   */
  static async migrateFromLocalStorage(data: {
    drawings: ChartDrawing[];
    patterns: PatternData[];
    sessionId?: string;
  }): Promise<void> {
    try {
      const response = await fetch('/api/chart/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to migrate data: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to migrate from localStorage', { error });
      throw error;
    }
  }

  /**
   * Clear all data for a session
   */
  static async clearSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to clear session: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to clear session', { error });
      throw error;
    }
  }
}