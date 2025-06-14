/**
 * Client-side API functions for chart drawing operations
 */

import { logger } from '@/lib/utils/logger';
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
   * Load drawings from database
   */
  static async loadDrawings(sessionId: string): Promise<ChartDrawing[]> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/drawings`);

      if (!response.ok) {
        throw new Error(`Failed to load drawings: ${response.statusText}`);
      }

      const { drawings } = await response.json();
      return drawings;
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to load drawings', { error });
      return [];
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
   * Load patterns from database
   */
  static async loadPatterns(sessionId: string): Promise<PatternData[]> {
    try {
      const response = await fetch(`/api/chart/sessions/${sessionId}/patterns`);

      if (!response.ok) {
        throw new Error(`Failed to load patterns: ${response.statusText}`);
      }

      const { patterns } = await response.json();
      return patterns;
    } catch (error) {
      logger.error('[ChartDrawingAPI] Failed to load patterns', { error });
      return [];
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
      return null;
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