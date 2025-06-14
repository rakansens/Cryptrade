import { prisma } from '@/lib/db/prisma';
import type { ChartDrawing as PrismaChartDrawing, PatternAnalysis, DrawingType } from '@prisma/client';
import { logger } from '@/lib/utils/logger';
import { ChartDrawing, PatternData, DrawingPoint, DrawingStyle, PatternVisualization, PatternMetrics } from '@/lib/validation/chart-drawing.schema';

// Check if we're running in the browser
const isBrowser = typeof window !== 'undefined';

export class ChartDrawingDatabaseService {
  /**
   * Save drawings to database
   */
  static async saveDrawings(
    drawings: ChartDrawing[],
    sessionId?: string
  ): Promise<void> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return;
    }
    
    try {
      // Delete existing drawings for this session first
      if (sessionId) {
        await prisma.chartDrawing.deleteMany({
          where: { sessionId },
        });
      }

      // Insert new drawings
      if (drawings.length > 0) {
        await prisma.chartDrawing.createMany({
          data: drawings.map(drawing => ({
            id: drawing.id,
            sessionId,
            type: drawing.type as DrawingType,
            points: drawing.points,
            style: drawing.style,
            price: drawing.price ? drawing.price : null,
            time: drawing.time ? BigInt(drawing.time) : null,
            levels: drawing.levels || null,
            metadata: drawing.metadata || null,
            visible: drawing.visible ?? true,
            interactive: drawing.interactive ?? true,
          })),
        });
      }

      logger.info('[ChartDrawingDB] Drawings saved', { 
        count: drawings.length, 
        sessionId 
      });
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to save drawings', { error });
      throw error;
    }
  }

  /**
   * Load drawings from database
   */
  static async loadDrawings(sessionId?: string): Promise<ChartDrawing[]> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return [];
    }
    
    try {
      // Ensure database connection is initialized
      await prisma.$connect();
      
      const dbDrawings = await prisma.chartDrawing.findMany({
        where: sessionId ? { sessionId } : {},
        orderBy: { createdAt: 'asc' },
      });

      return dbDrawings.map(drawing => this.convertToChartDrawing(drawing));
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to load drawings', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  /**
   * Save a single drawing
   */
  static async saveDrawing(
    drawing: ChartDrawing,
    sessionId?: string
  ): Promise<PrismaChartDrawing | null> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return null;
    }
    
    try {
      const dbDrawing = await prisma.chartDrawing.upsert({
        where: { id: drawing.id },
        update: {
          type: drawing.type as DrawingType,
          points: drawing.points,
          style: drawing.style,
          price: drawing.price ? drawing.price : null,
          time: drawing.time ? BigInt(drawing.time) : null,
          levels: drawing.levels || null,
          metadata: drawing.metadata || null,
          visible: drawing.visible ?? true,
          interactive: drawing.interactive ?? true,
        },
        create: {
          id: drawing.id,
          sessionId,
          type: drawing.type as DrawingType,
          points: drawing.points,
          style: drawing.style,
          price: drawing.price ? drawing.price : null,
          time: drawing.time ? BigInt(drawing.time) : null,
          levels: drawing.levels || null,
          metadata: drawing.metadata || null,
          visible: drawing.visible ?? true,
          interactive: drawing.interactive ?? true,
        },
      });

      logger.info('[ChartDrawingDB] Drawing saved', { 
        drawingId: drawing.id,
        type: drawing.type 
      });
      
      return dbDrawing;
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to save drawing', { error });
      throw error;
    }
  }

  /**
   * Delete a drawing
   */
  static async deleteDrawing(drawingId: string): Promise<void> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return;
    }
    
    try {
      await prisma.chartDrawing.delete({
        where: { id: drawingId },
      });
      
      logger.info('[ChartDrawingDB] Drawing deleted', { drawingId });
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to delete drawing', { error });
      throw error;
    }
  }

  /**
   * Save pattern analysis
   */
  static async savePattern(
    pattern: PatternData,
    sessionId?: string
  ): Promise<PatternAnalysis | null> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return null;
    }
    
    try {
      const dbPattern = await prisma.patternAnalysis.create({
        data: {
          sessionId,
          type: pattern.type,
          symbol: pattern.symbol,
          interval: pattern.interval,
          startTime: BigInt(pattern.startTime),
          endTime: BigInt(pattern.endTime),
          confidence: pattern.confidence,
          visualization: pattern.visualization,
          metrics: pattern.metrics || {},
          description: pattern.description,
          tradingImplication: pattern.tradingImplication,
        },
      });

      logger.info('[ChartDrawingDB] Pattern saved', { 
        patternId: dbPattern.id,
        type: pattern.type 
      });
      
      return dbPattern;
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to save pattern', { error });
      throw error;
    }
  }

  /**
   * Load patterns from database
   */
  static async loadPatterns(sessionId?: string): Promise<PatternData[]> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return [];
    }
    
    try {
      // Ensure database connection is initialized
      await prisma.$connect();
      
      const dbPatterns = await prisma.patternAnalysis.findMany({
        where: sessionId ? { sessionId } : {},
        orderBy: { createdAt: 'desc' },
      });

      return dbPatterns.map(pattern => this.convertToPatternData(pattern));
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to load patterns', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  /**
   * Delete a pattern
   */
  static async deletePattern(patternId: string): Promise<void> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return;
    }
    
    try {
      await prisma.patternAnalysis.delete({
        where: { id: patternId },
      });
      
      logger.info('[ChartDrawingDB] Pattern deleted', { patternId });
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to delete pattern', { error });
      throw error;
    }
  }

  /**
   * Convert database drawing to ChartDrawing format
   */
  static convertToChartDrawing(dbDrawing: PrismaChartDrawing): ChartDrawing {
    return {
      id: dbDrawing.id,
      type: dbDrawing.type,
      points: dbDrawing.points as DrawingPoint[],
      style: dbDrawing.style as Partial<DrawingStyle> | undefined,
      price: dbDrawing.price?.toNumber(),
      time: dbDrawing.time ? Number(dbDrawing.time) : undefined,
      levels: dbDrawing.levels as number[] | undefined,
      metadata: dbDrawing.metadata as Record<string, string | number | boolean | (string | number | boolean)[] | Record<string, string | number | boolean>> | undefined,
      visible: dbDrawing.visible,
      interactive: dbDrawing.interactive,
    };
  }

  /**
   * Convert database pattern to PatternData format
   */
  static convertToPatternData(dbPattern: PatternAnalysis): PatternData {
    return {
      id: dbPattern.id,
      type: dbPattern.type,
      symbol: dbPattern.symbol,
      interval: dbPattern.interval,
      startTime: Number(dbPattern.startTime),
      endTime: Number(dbPattern.endTime),
      confidence: dbPattern.confidence.toNumber(),
      visualization: dbPattern.visualization as PatternVisualization,
      metrics: dbPattern.metrics as PatternMetrics | undefined,
      description: dbPattern.description || undefined,
      tradingImplication: dbPattern.tradingImplication,
    };
  }

  /**
   * Migrate localStorage data to database
   */
  static async migrateFromLocalStorage(
    drawings: ChartDrawing[],
    patterns: PatternData[],
    sessionId?: string
  ): Promise<void> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return;
    }
    
    logger.info('[ChartDrawingDB] Starting migration from localStorage');
    
    try {
      // Migrate drawings
      if (drawings.length > 0) {
        await this.saveDrawings(drawings, sessionId);
      }

      // Migrate patterns
      for (const pattern of patterns) {
        await this.savePattern(pattern, sessionId);
      }

      logger.info('[ChartDrawingDB] Migration completed', {
        drawingCount: drawings.length,
        patternCount: patterns.length,
      });
    } catch (error) {
      logger.error('[ChartDrawingDB] Migration failed', { error });
      throw error;
    }
  }

  /**
   * Get timeframe-specific drawings
   */
  static async getTimeframeDrawings(
    symbol: string,
    timeframe: string,
    sessionId?: string
  ): Promise<ChartDrawing[]> {
    // Prisma doesn't work in the browser
    if (isBrowser) {
      logger.warn('[ChartDrawingDB] Cannot use database in browser environment');
      return [];
    }
    
    try {
      const dbDrawings = await prisma.chartDrawing.findMany({
        where: {
          sessionId,
          metadata: {
            path: ['symbol'],
            equals: symbol,
          },
        },
      });

      // Filter by timeframe in metadata
      const filteredDrawings = dbDrawings.filter(drawing => {
        const metadata = drawing.metadata as Record<string, unknown> | null;
        return metadata?.timeframe === timeframe;
      });

      return filteredDrawings.map(drawing => this.convertToChartDrawing(drawing));
    } catch (error) {
      logger.error('[ChartDrawingDB] Failed to get timeframe drawings', { error });
      return [];
    }
  }
}