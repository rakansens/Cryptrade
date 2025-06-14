import { logger } from '@/lib/utils/logger';
import { ChartDrawingSchema, PatternDataSchema } from '@/lib/validation/chart-drawing.schema';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';
import { ChartDrawingAPI } from '@/lib/api/chart-drawing-api';

const STORAGE_KEYS = {
  DRAWINGS: 'cryptrade_chart_drawings',
  PATTERNS: 'cryptrade_chart_patterns',
  TIMEFRAME_STATE: 'cryptrade_timeframe_state'
} as const;

import type { TimeframeState } from '@/lib/api/chart-drawing-api';

interface PersistenceConfig {
  useDatabase: boolean;
  sessionId?: string;
  fallbackToLocal: boolean;
}

/**
 * Chart Persistence Manager with Database Support
 * 
 * Handles saving and loading chart drawings and patterns to/from database or localStorage
 * with proper validation, error handling, and automatic fallback
 * 
 * Database is enabled by default!
 */
export class ChartPersistenceManager {
  private static config: PersistenceConfig = {
    useDatabase: true, // Database enabled by default!
    fallbackToLocal: true,
  };

  /**
   * Configure persistence settings
   */
  static configure(config: Partial<PersistenceConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[ChartPersistence] Configuration updated', this.config);
  }

  /**
   * Enable database persistence
   */
  static async enableDatabase(sessionId?: string): Promise<void> {
    this.config.useDatabase = true;
    this.config.sessionId = sessionId;
    
    // Migrate existing localStorage data to database
    if (this.config.fallbackToLocal) {
      try {
        const localDrawings = this.loadDrawingsFromLocal();
        const localPatterns = this.loadPatternsFromLocal();
        
        if (localDrawings.length > 0 || localPatterns.length > 0) {
          // TODO: Implement migration API endpoint
          logger.info('[ChartPersistence] Migration to database pending API implementation');
          
          // Clear localStorage after successful migration
          this.clearLocalStorage();
        }
      } catch (error) {
        logger.error('[ChartPersistence] Failed to migrate to database', { error });
      }
    }
  }

  /**
   * Disable database persistence
   */
  static disableDatabase(): void {
    this.config.useDatabase = false;
    this.config.sessionId = undefined;
  }

  /**
   * Save drawings
   */
  static async saveDrawings(drawings: ChartDrawing[]): Promise<void> {
    try {
      // Validate all drawings before saving
      const validDrawings = drawings.map(drawing => ChartDrawingSchema.parse(drawing));
      
      if (this.config.useDatabase) {
        try {
          await ChartDrawingAPI.saveDrawings(
            this.config.sessionId || 'default',
            validDrawings
          );
          logger.info('[ChartPersistence] Drawings saved to database', { 
            count: validDrawings.length 
          });
        } catch (dbError) {
          logger.error('[ChartPersistence] Database save failed', { dbError });
          
          if (this.config.fallbackToLocal) {
            this.saveDrawingsToLocal(validDrawings);
          } else {
            throw dbError;
          }
        }
      } else {
        this.saveDrawingsToLocal(validDrawings);
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to save drawings', { error });
    }
  }

  /**
   * Load drawings
   */
  static async loadDrawings(): Promise<ChartDrawing[]> {
    try {
      if (this.config.useDatabase) {
        try {
          const drawings = await ChartDrawingAPI.loadDrawings(
            this.config.sessionId || 'default'
          );
          logger.info('[ChartPersistence] Drawings loaded from database', { 
            count: drawings.length 
          });
          return drawings;
        } catch (dbError) {
          logger.error('[ChartPersistence] Database load failed', { dbError });
          
          if (this.config.fallbackToLocal) {
            return this.loadDrawingsFromLocal();
          }
          return [];
        }
      } else {
        return this.loadDrawingsFromLocal();
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to load drawings', { error });
      return [];
    }
  }

  /**
   * Save patterns
   */
  static async savePatterns(patterns: PatternData[]): Promise<void> {
    try {
      // Validate all patterns before saving
      const validPatterns = patterns.map(pattern => PatternDataSchema.parse(pattern));
      
      if (this.config.useDatabase) {
        try {
          await ChartDrawingAPI.savePatterns(
            this.config.sessionId || 'default',
            validPatterns
          );
          logger.info('[ChartPersistence] Patterns saved to database', { 
            count: validPatterns.length 
          });
        } catch (dbError) {
          logger.error('[ChartPersistence] Database save failed', { dbError });
          
          if (this.config.fallbackToLocal) {
            this.savePatternsToLocal(validPatterns);
          } else {
            throw dbError;
          }
        }
      } else {
        this.savePatternsToLocal(validPatterns);
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to save patterns', { error });
    }
  }

  /**
   * Load patterns
   */
  static async loadPatterns(): Promise<PatternData[]> {
    try {
      if (this.config.useDatabase) {
        try {
          const patterns = await ChartDrawingAPI.loadPatterns(
            this.config.sessionId || 'default'
          );
          logger.info('[ChartPersistence] Patterns loaded from database', { 
            count: patterns.length 
          });
          return patterns;
        } catch (dbError) {
          logger.error('[ChartPersistence] Database load failed', { dbError });
          
          if (this.config.fallbackToLocal) {
            return this.loadPatternsFromLocal();
          }
          return [];
        }
      } else {
        return this.loadPatternsFromLocal();
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to load patterns', { error });
      return [];
    }
  }

  /**
   * Delete a drawing
   */
  static async deleteDrawing(drawingId: string): Promise<void> {
    try {
      if (this.config.useDatabase) {
        // TODO: Implement delete drawing API endpoint
        logger.warn('[ChartPersistence] Delete drawing API not yet implemented');
      } else {
        const drawings = await this.loadDrawings();
        const filtered = drawings.filter(d => d.id !== drawingId);
        await this.saveDrawings(filtered);
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to delete drawing', { error });
    }
  }

  /**
   * Delete a pattern
   */
  static async deletePattern(patternId: string): Promise<void> {
    try {
      if (this.config.useDatabase) {
        // TODO: Implement delete pattern API endpoint
        logger.warn('[ChartPersistence] Delete pattern API not yet implemented');
      } else {
        const patterns = await this.loadPatterns();
        const filtered = patterns.filter(p => p.id !== patternId);
        await this.savePatterns(filtered);
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to delete pattern', { error });
    }
  }

  /**
   * Save timeframe state
   */
  static async saveTimeframeState(state: TimeframeState): Promise<void> {
    try {
      if (this.config.useDatabase && this.config.sessionId) {
        await ChartDrawingAPI.saveTimeframeState(this.config.sessionId, state);
      } else {
        localStorage.setItem(STORAGE_KEYS.TIMEFRAME_STATE, JSON.stringify(state));
      }
      logger.info('[ChartPersistence] Timeframe state saved', state);
    } catch (error) {
      logger.error('[ChartPersistence] Failed to save timeframe state', { error });
    }
  }

  /**
   * Load timeframe state
   */
  static async loadTimeframeState(): Promise<TimeframeState | null> {
    try {
      if (this.config.useDatabase && this.config.sessionId) {
        return await ChartDrawingAPI.loadTimeframeState(this.config.sessionId);
      } else {
        const stored = localStorage.getItem(STORAGE_KEYS.TIMEFRAME_STATE);
        if (!stored) return null;
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('[ChartPersistence] Failed to load timeframe state', { error });
      return null;
    }
  }

  /**
   * Clear all persisted data
   */
  static async clearAll(): Promise<void> {
    if (this.config.useDatabase && this.config.sessionId) {
      try {
        await ChartDrawingAPI.clearSession(this.config.sessionId);
      } catch (error) {
        logger.error('[ChartPersistence] Failed to clear database', { error });
      }
    }
    
    this.clearLocalStorage();
  }

  // Private helper methods for localStorage operations
  private static saveDrawingsToLocal(drawings: ChartDrawing[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(drawings));
    logger.info('[ChartPersistence] Drawings saved to localStorage', { count: drawings.length });
  }

  private static loadDrawingsFromLocal(): ChartDrawing[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DRAWINGS);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      // Validate each drawing
      const validDrawings: ChartDrawing[] = [];
      for (const drawing of parsed) {
        try {
          const valid = ChartDrawingSchema.parse(drawing);
          validDrawings.push(valid);
        } catch (e) {
          logger.warn('[ChartPersistence] Invalid drawing skipped', { drawing, error: e });
        }
      }

      return validDrawings;
    } catch (error) {
      logger.error('[ChartPersistence] Failed to load drawings from localStorage', { error });
      return [];
    }
  }

  private static savePatternsToLocal(patterns: PatternData[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));
    logger.info('[ChartPersistence] Patterns saved to localStorage', { count: patterns.length });
  }

  private static loadPatternsFromLocal(): PatternData[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PATTERNS);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      // Validate each pattern
      const validPatterns: PatternData[] = [];
      for (const pattern of parsed) {
        try {
          const valid = PatternDataSchema.parse(pattern);
          validPatterns.push(valid);
        } catch (e) {
          logger.warn('[ChartPersistence] Invalid pattern skipped', { pattern, error: e });
        }
      }

      return validPatterns;
    } catch (error) {
      logger.error('[ChartPersistence] Failed to load patterns from localStorage', { error });
      return [];
    }
  }

  private static clearLocalStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.DRAWINGS);
    localStorage.removeItem(STORAGE_KEYS.PATTERNS);
    localStorage.removeItem(STORAGE_KEYS.TIMEFRAME_STATE);
    logger.info('[ChartPersistence] Local storage cleared');
  }

  /**
   * Check if database is enabled
   */
  static isDatabaseEnabled(): boolean {
    return this.config.useDatabase;
  }

  /**
   * Get current session ID
   */
  static getSessionId(): string | undefined {
    return this.config.sessionId;
  }

  /**
   * Set session ID for database operations
   */
  static setSessionId(sessionId: string | undefined): void {
    this.config.sessionId = sessionId;
    logger.info('[ChartPersistence] Session ID updated', { sessionId });
  }

  /**
   * Check if timeframe has changed
   */
  static async hasTimeframeChanged(symbol: string, timeframe: string): Promise<boolean> {
    const currentState = await this.loadTimeframeState();
    
    if (!currentState) {
      return true;
    }
    
    return currentState.symbol !== symbol || currentState.timeframe !== timeframe;
  }
}

// Initialize with database enabled by default
logger.info('[ChartPersistence] Initialized with database enabled by default');