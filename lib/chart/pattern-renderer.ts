// Pattern rendering for chart

import type { IChartApi, ISeriesApi, SeriesMarker, Time, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';
import { logger } from '@/lib/utils/logger';
import { renderKeyPointMarkers } from '@/lib/chart/renderers/keyPointMarkerRenderer';
import { renderPatternLines } from '@/lib/chart/renderers/patternLineRenderer';
import { renderPatternAreas } from '@/lib/chart/renderers/patternAreaRenderer';
import { renderMetricLines } from '@/lib/chart/renderers/patternMetricRenderer';
import { GlobalStateManager } from './GlobalStateManager';

// Global instance counter for debugging
let instanceCounter = 0;

// Global state manager instance shared across renderers
const defaultStateManager = new GlobalStateManager<ISeriesApi<SeriesType>>();

export class PatternRenderer {
  private chart: IChartApi;
  private mainSeries: ISeriesApi<SeriesType>;
  private patternSeries: Map<string, ISeriesApi<SeriesType>[]> = new Map();
  private markers: Map<string, SeriesMarker<Time>[]> = new Map();
  private metricLines: Map<string, ISeriesApi<SeriesType>[]> = new Map();
  private instanceId: number;
  private stateManager: GlobalStateManager<ISeriesApi<SeriesType>>;

  constructor(
    chart: IChartApi,
    mainSeries: ISeriesApi<SeriesType>,
    stateManager: GlobalStateManager<ISeriesApi<SeriesType>> = defaultStateManager
  ) {
    this.chart = chart;
    this.mainSeries = mainSeries;
    this.instanceId = ++instanceCounter;
    this.stateManager = stateManager;
    
    logger.info('[PatternRenderer] Creating new instance', {
      instanceId: this.instanceId,
      totalInstances: instanceCounter
    });
    
    // Debug: Expose instance globally
    if (typeof window !== 'undefined') {
      interface WindowWithDebug extends Window {
  __debugPatternRenderer?: PatternRenderer;
  __debugPatternRenderers?: Array<{
    instanceId: number;
    renderer: PatternRenderer;
    createdAt: string;
  }>;
}
      const windowWithDebug = window as WindowWithDebug;
      windowWithDebug.__debugPatternRenderer = this;
      windowWithDebug.__debugPatternRenderers = windowWithDebug.__debugPatternRenderers || [];
      windowWithDebug.__debugPatternRenderers.push({
        instanceId: this.instanceId,
        renderer: this,
        createdAt: new Date().toISOString()
      });
      logger.info('[PatternRenderer] Instance exposed for debugging', {
        instanceId: this.instanceId,
        totalInstances: windowWithDebug.__debugPatternRenderers.length
      });
    }
  }
  
  /**
   * Render a pattern on the chart
   */
  renderPattern(
    id: string,
    visualization: PatternVisualization,
    patternType: string,
    metrics?: {
      target_level?: number;
      stop_loss?: number;
      breakout_level?: number;
    }
  ): void {
    try {
      // Validate visualization object
      if (!visualization) {
        throw new Error('Visualization object is null or undefined');
      }
      
      if (!visualization.keyPoints || !Array.isArray(visualization.keyPoints)) {
        throw new Error('Visualization keyPoints is missing or not an array');
      }
      
      logger.info('[PatternRenderer] Starting pattern render', {
        instanceId: this.instanceId,
        id,
        patternType,
        keyPointsCount: visualization.keyPoints.length,
        hasLines: !!visualization.lines,
        hasAreas: !!visualization.areas,
        visualizationStructure: {
          keyPoints: visualization.keyPoints.length,
          lines: visualization.lines?.length || 0,
          areas: visualization.areas?.length || 0
        }
      });
      
      // 1. Add markers for key points
      this.addKeyPointMarkers(id, visualization);
      
      // 2. Draw connecting lines
      if (visualization.lines && visualization.lines.length > 0) {
        this.drawPatternLines(id, visualization);
      }
      
      // 3. Add area highlights
      if (visualization.areas && visualization.areas.length > 0) {
        renderPatternAreas(id, visualization);
      }
      
      // 4. Add metric lines (target, stop loss, breakout)
      if (metrics) {
        const baseStyle = visualization.lines?.[0]?.style;
        renderMetricLines(id, visualization, metrics, baseStyle, {
          chart: this.chart,
          convertLineStyle: this.convertLineStyle.bind(this),
          globalAllSeries: this.stateManager.allSeriesMap,
          globalMetricLines: this.stateManager.metricLinesMap,
          metricLinesStore: this.metricLines,
          instanceId: this.instanceId,
        });
      }
      
      logger.info('[PatternRenderer] Pattern rendered successfully', { id, patternType });
    } catch (error) {
      logger.error('[PatternRenderer] Failed to render pattern', { 
        id, 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error),
        patternType,
        visualization: visualization ? {
          hasKeyPoints: !!visualization.keyPoints,
          keyPointsIsArray: Array.isArray(visualization.keyPoints),
          keyPointsCount: visualization.keyPoints?.length || 0,
          hasLines: !!visualization.lines,
          linesCount: visualization.lines?.length || 0,
          hasAreas: !!visualization.areas,
          areasCount: visualization.areas?.length || 0,
          keys: Object.keys(visualization)
        } : 'null'
      });
      throw error; // Re-throw to propagate the error
    }
  }
  
  /**
   * Add markers for key points
   */
  private addKeyPointMarkers(id: string, visualization: PatternVisualization): void {
    // 新実装: 切り出したユーティリティ呼び出し
    renderKeyPointMarkers(id, visualization, this.mainSeries, this.markers);
  }
  
  /**
   * Draw pattern lines
   */
  private drawPatternLines(id: string, visualization: PatternVisualization): void {
    try {
      logger.info('[PatternRenderer] Drawing pattern lines', {
        id,
        linesCount: visualization.lines?.length || 0
      });

      if (!visualization.lines || visualization.lines.length === 0) {
        logger.info('[PatternRenderer] No lines to render', { id });
        return;
      }

      const lineSeries = renderPatternLines(id, visualization, {
        chart: this.chart,
        getLineColor: this.getLineColor.bind(this),
        convertLineStyle: this.convertLineStyle.bind(this),
        globalAllSeries: this.stateManager.allSeriesMap,
      });

      if (lineSeries.length > 0) {
        this.patternSeries.set(id, lineSeries);
        logger.info('[PatternRenderer] Lines created successfully', {
          id,
          linesCreated: lineSeries.length
        });
      }
    } catch (error) {
      logger.error('[PatternRenderer] Failed to draw pattern lines', {
        id,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Draw pattern areas (filled regions)
   */
  private drawPatternAreas(id: string, visualization: PatternVisualization): void {
    // For areas, we can use area series or background rectangles
    // This is a simplified implementation using semi-transparent lines
    
    visualization.areas?.forEach((area) => {
      if (area.points.length < 3) return;
      
      // Get the boundary points
      const points = area.points.map(idx => visualization.keyPoints[idx]).filter(Boolean);
      if (points.length < 3) return;
      
      // Find min/max values for the area
      const minValue = Math.min(...points.map(p => p.value));
      const maxValue = Math.max(...points.map(p => p.value));
      const minTime = Math.min(...points.map(p => p.time));
      const maxTime = Math.max(...points.map(p => p.time));
      
      // Skip area rendering for now to avoid the red vertical bar issue
      // TODO: Implement proper area highlighting using a different approach
      logger.info('[PatternRenderer] Skipping area rendering to avoid visual artifacts');
    });
  }
  
  
  /**
   * Remove a pattern from the chart
   */
  removePattern(id: string): void {
    logger.info('[PatternRenderer] removePattern called', { 
      instanceId: this.instanceId,
      id,
      hasMarkers: this.markers.has(id),
      hasPatternSeries: this.patternSeries.has(id),
      hasMetricLines: this.metricLines.has(id),
      allStoredIds: {
        markerIds: Array.from(this.markers.keys()),
        patternSeriesIds: Array.from(this.patternSeries.keys()),
        metricLineIds: Array.from(this.metricLines.keys())
      }
    });
    
    try {
      // Remove markers
      const patternMarkers = this.markers.get(id) || [];
      if (patternMarkers.length > 0) {
        logger.info('[PatternRenderer] Removing markers', { id, count: patternMarkers.length });
        const allMarkers = this.mainSeries.markers() || [];
        const filteredMarkers = allMarkers.filter(
          marker => !patternMarkers.some(pm => pm.time === marker.time && pm.text === marker.text)
        );
        this.mainSeries.setMarkers(filteredMarkers);
        this.markers.delete(id);
      }
      
      // Remove line series
      const series = this.patternSeries.get(id) || [];
      if (series.length > 0) {
        logger.info('[PatternRenderer] Removing line series', { id, count: series.length });
        series.forEach(s => {
          try {
            this.chart.removeSeries(s);
          } catch (e) {
            logger.warn('[PatternRenderer] Failed to remove line series', { error: String(e) });
          }
        });
        this.patternSeries.delete(id);
      }
      
      // Remove metric lines - try instance map first, then global map
      let metricSeries = this.metricLines.get(id) || [];
      let fromGlobal = false;

      // If not found in instance map, try global map
      if (metricSeries.length === 0) {
        const globalEntry = this.stateManager.metricLinesMap.get(id);
        if (globalEntry) {
          metricSeries = globalEntry.series;
          fromGlobal = true;
          logger.info('[PatternRenderer] Found metric lines in global map', {
            id,
            instanceId: this.instanceId,
            originalInstanceId: globalEntry.instanceId,
            age: Date.now() - globalEntry.createdAt
          });
        }
      }
      
      // If still not found, try to find by partial ID match (for cases where ID format changed)
      if (metricSeries.length === 0 && id.includes('pattern')) {
        logger.info('[PatternRenderer] Trying fuzzy ID matching for metric lines');
        
        // Extract the unique part of the ID (usually the timestamp and proposal ID)
        const idParts = id.split('_');
        const uniquePart = idParts.slice(-2).join('_'); // Get last two parts
        
        // Search in both maps
        for (const [key, value] of this.stateManager.metricLinesMap.entries()) {
          if (key.includes(uniquePart) || (key.includes('pattern') && key.endsWith(idParts[idParts.length - 1]))) {
            logger.info('[PatternRenderer] Found metric lines with fuzzy match', { 
              requestedId: id, 
              foundId: key,
              uniquePart
            });
            metricSeries = value.series;
            fromGlobal = true;
            // Update the ID in our removal process
            id = key;
            break;
          }
        }
      }
      
      logger.info('[PatternRenderer] Checking metric lines', {
        id,
        hasMetricLines: this.metricLines.has(id),
        hasGlobalMetricLines: this.stateManager.metricLinesMap.has(id),
        metricLineCount: metricSeries.length,
        fromGlobal,
        allMetricLineIds: Array.from(this.metricLines.keys()),
        allGlobalIds: Array.from(this.stateManager.metricLinesMap.keys()),
        mapSize: this.metricLines.size,
        globalMapSize: this.stateManager.metricLinesMap.size,
        idType: typeof id,
        idValue: id
      });
      
      if (metricSeries.length > 0) {
        logger.info('[PatternRenderer] Removing metric lines', { 
          id, 
          count: metricSeries.length,
          fromGlobal 
        });
        
        let successCount = 0;
        metricSeries.forEach((s, index) => {
          try {
            logger.info(`[PatternRenderer] Removing metric line ${index + 1}/${metricSeries.length}`);
            this.chart.removeSeries(s);
            successCount++;
            logger.info(`[PatternRenderer] Successfully removed metric line ${index + 1}`);
          } catch (e) {
            logger.error('[PatternRenderer] Failed to remove metric series', { 
              error: String(e), 
              index,
              seriesInfo: s
            });
          }
        });
        
        // Clean up from both maps - check all possible variations of the ID
        this.metricLines.delete(id);
        this.stateManager.metricLinesMap.delete(id);
        
        // Also try to clean up any similar IDs
        const idParts = id.split('_');
        const uniquePart = idParts.slice(-2).join('_');
        
        // Clean up any entries that might match
        for (const key of Array.from(this.stateManager.metricLinesMap.keys())) {
          if (key.includes(uniquePart) || (key.includes('pattern') && key.endsWith(idParts[idParts.length - 1]))) {
            logger.info('[PatternRenderer] Also removing similar ID from global map', { key });
            this.stateManager.metricLinesMap.delete(key);
          }
        }
        
        logger.info('[PatternRenderer] Deleted metric lines from maps', { 
          id,
          successCount,
          totalCount: metricSeries.length,
          remainingInstanceKeys: Array.from(this.metricLines.keys()),
          remainingGlobalKeys: Array.from(this.stateManager.metricLinesMap.keys())
        });
      } else {
        logger.warn('[PatternRenderer] No metric lines found for pattern', {
          id,
          instanceKeys: Array.from(this.metricLines.keys()),
          globalKeys: Array.from(this.stateManager.metricLinesMap.keys())
        });
        
        // Last resort: try to remove all metric lines that might be related
        if (id.includes('pattern')) {
          logger.info('[PatternRenderer] Attempting to clean up any orphaned metric lines');
          const idParts = id.split('_');
          const timestamp = idParts.find(part => /^\d{13}$/.test(part)); // Find timestamp
          
          for (const [key, value] of this.stateManager.metricLinesMap.entries()) {
            if (timestamp && key.includes(timestamp)) {
              logger.info('[PatternRenderer] Removing orphaned metric lines', { key });
              try {
                value.series.forEach(s => this.chart.removeSeries(s));
                this.stateManager.metricLinesMap.delete(key);
              } catch (e) {
                logger.error('[PatternRenderer] Failed to remove orphaned series', { key, error: String(e) });
              }
            }
          }
        }
      }
      
      // Final cleanup: use globalAllSeries to find any remaining series
      logger.info('[PatternRenderer] Checking globalAllSeries for cleanup');
      const remainingSeries: string[] = [];
      for (const [seriesId, seriesInfo] of this.stateManager.allSeriesMap.entries()) {
        if (seriesInfo.patternId === id || 
            (id.includes('pattern') && seriesInfo.patternId.includes(id.split('_').slice(-1)[0]))) {
          remainingSeries.push(seriesId);
          try {
            logger.info('[PatternRenderer] Removing series from globalAllSeries', { 
              seriesId, 
              patternId: seriesInfo.patternId,
              type: seriesInfo.type,
              hasChart: !!this.chart,
              hasSeries: !!seriesInfo.series,
              globalAllSeriesSize: this.stateManager.allSeriesMap.size
            });
            
            // Remove from chart first
            if (this.chart && seriesInfo.series) {
              try {
                this.chart.removeSeries(seriesInfo.series);
              } catch (chartError) {
                logger.warn('[PatternRenderer] Failed to remove series from chart', { 
                  seriesId, 
                  error: String(chartError) 
                });
              }
            }
            
            // Then remove from global map
            if (this.stateManager.allSeriesMap.has(seriesId)) {
              this.stateManager.allSeriesMap.delete(seriesId);
            } else {
              logger.warn('[PatternRenderer] Series not found in globalAllSeries', { seriesId });
            }
          } catch (e) {
            logger.error('[PatternRenderer] Failed to remove series from globalAllSeries', { 
              seriesId, 
              error: String(e),
              errorMessage: e instanceof Error ? e.message : 'Unknown error',
              errorStack: e instanceof Error ? e.stack : undefined
            });
          }
        }
      }
      
      if (remainingSeries.length > 0) {
        logger.info('[PatternRenderer] Cleaned up remaining series from globalAllSeries', {
          count: remainingSeries.length,
          seriesIds: remainingSeries
        });
      }

      // Final cleanup of manager state
      this.stateManager.cleanup(id);

      logger.info('[PatternRenderer] Pattern removed successfully', { id });
    } catch (error) {
      logger.error('[PatternRenderer] Error removing pattern', { id, error: String(error) });
      throw error;
    }
  }
  
  /**
   * Debug method to inspect current state
   */
  debugGetState(): {
    instanceId: number;
    markers: string[];
    patternSeries: string[];
    metricLines: string[];
    metricLinesDetails: Array<{ id: string; lineCount: number }>;
    globalMetricLines: string[];
    globalMetricLinesDetails: Array<{ id: string; lineCount: number; instanceId: number; age: number }>;
    globalAllSeries: string[];
    globalAllSeriesDetails: Array<{ id: string; patternId: string; type: string; age: number }>;
  } {
    return {
      instanceId: this.instanceId,
      markers: Array.from(this.markers.keys()),
      patternSeries: Array.from(this.patternSeries.keys()),
      metricLines: Array.from(this.metricLines.keys()),
      metricLinesDetails: Array.from(this.metricLines.entries()).map(([id, lines]) => ({
        id,
        lineCount: lines.length
      })),
      globalMetricLines: Array.from(this.stateManager.metricLinesMap.keys()),
      globalMetricLinesDetails: Array.from(this.stateManager.metricLinesMap.entries()).map(([id, entry]) => ({
        id,
        lineCount: entry.series.length,
        instanceId: entry.instanceId,
        age: Date.now() - entry.createdAt
      })),
      globalAllSeries: Array.from(this.stateManager.allSeriesMap.keys()),
      globalAllSeriesDetails: Array.from(this.stateManager.allSeriesMap.entries()).map(([id, entry]) => ({
        id,
        patternId: entry.patternId,
        type: entry.type,
        age: Date.now() - entry.createdAt
      }))
    };
  }
  
  /**
   * Debug method to force remove all metric lines
   */
  debugRemoveAllMetricLines(): void {
    logger.warn('[PatternRenderer] DEBUG: Force removing all metric lines');
    this.metricLines.forEach((lines, id) => {
      logger.info(`[PatternRenderer] DEBUG: Removing ${lines.length} lines for pattern ${id}`);
      lines.forEach((line, index) => {
        try {
          this.chart.removeSeries(line);
          logger.info(`[PatternRenderer] DEBUG: Removed line ${index + 1} for pattern ${id}`);
        } catch (e) {
          logger.error(`[PatternRenderer] DEBUG: Failed to remove line ${index + 1} for pattern ${id}`, e);
        }
      });
    });
    this.metricLines.clear();
    logger.info('[PatternRenderer] DEBUG: All metric lines cleared');
  }
  
  /**
   * Get line color based on type
   */
  private getLineColor(type: string): string {
    const colors: Record<string, string> = {
      outline: '#888888',
      neckline: '#ff0000',
      support: '#00ff00',
      resistance: '#ff0000',
      target: '#00aaff',
    };
    return colors[type] || '#888888';
  }
  
  /**
   * Convert line style
   */
  private convertLineStyle(style: string): number {
    switch (style) {
      case 'dashed': return 1;
      case 'dotted': return 2;
      default: return 0; // solid
    }
  }
  
  /**
   * Draw metric lines (target, stop loss, breakout)
   */
  private drawMetricLines(
    id: string,
    visualization: PatternVisualization,
    metrics: {
      target_level?: number;
      stop_loss?: number;
      breakout_level?: number;
    },
    baseStyle?: {
      color?: string;
      lineWidth?: number;
      lineStyle?: string;
    }
  ): void {
    const metricLines: ISeriesApi<SeriesType>[] = [];
    
    // Get time range from keyPoints
    if (!visualization.keyPoints || visualization.keyPoints.length === 0) return;
    
    const times = visualization.keyPoints.map(p => p.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Extend the lines beyond the pattern for better visibility
    const timeExtension = (maxTime - minTime) * 0.5;
    const startTime = minTime - timeExtension;
    const endTime = maxTime + timeExtension;
    
    // Target level (green dashed line)
    if (metrics.target_level) {
      const targetSeries = this.chart.addLineSeries({
        color: baseStyle?.color || '#4CAF50',
        lineWidth: baseStyle?.lineWidth ?? 2,
        lineStyle: this.convertLineStyle(baseStyle?.lineStyle || 'dashed'),
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        title: `目標: $${metrics.target_level.toLocaleString()}`,
      });
      
      targetSeries.setData([
        { time: startTime as Time, value: metrics.target_level },
        { time: endTime as Time, value: metrics.target_level },
      ]);
      
      // Don't add markers - just use the line with title
      // The lastValueVisible will show the price
      
      metricLines.push(targetSeries);
      
      // Track in global series map
      const targetSeriesId = `${id}_metric_target_${Date.now()}`;
      this.stateManager.allSeriesMap.set(targetSeriesId, {
        patternId: id,
        series: targetSeries,
        type: 'metric',
        createdAt: Date.now()
      });
    }
    
    // Stop loss level (red dashed line)
    if (metrics.stop_loss) {
      const stopLossSeries = this.chart.addLineSeries({
        color: baseStyle?.color || '#F44336',
        lineWidth: baseStyle?.lineWidth ?? 2,
        lineStyle: this.convertLineStyle(baseStyle?.lineStyle || 'dashed'),
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        title: `SL: $${metrics.stop_loss.toLocaleString()}`,
      });
      
      stopLossSeries.setData([
        { time: startTime as Time, value: metrics.stop_loss },
        { time: endTime as Time, value: metrics.stop_loss },
      ]);
      
      // Don't add markers - just use the line with title
      // The lastValueVisible will show the price
      
      metricLines.push(stopLossSeries);
      
      // Track in global series map
      const stopLossSeriesId = `${id}_metric_stoploss_${Date.now()}`;
      this.stateManager.allSeriesMap.set(stopLossSeriesId, {
        patternId: id,
        series: stopLossSeries,
        type: 'metric',
        createdAt: Date.now()
      });
    }
    
    // Breakout level (orange dotted line)
    if (metrics.breakout_level) {
      const breakoutSeries = this.chart.addLineSeries({
        color: baseStyle?.color || '#FF9800',
        lineWidth: baseStyle?.lineWidth ?? 2,
        lineStyle: this.convertLineStyle(baseStyle?.lineStyle || 'dotted'),
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        title: `BO: $${metrics.breakout_level.toLocaleString()}`,
      });
      
      breakoutSeries.setData([
        { time: startTime as Time, value: metrics.breakout_level },
        { time: endTime as Time, value: metrics.breakout_level },
      ]);
      
      // Don't add markers - just use the line with title
      // The lastValueVisible will show the price
      
      metricLines.push(breakoutSeries);
      
      // Track in global series map
      const breakoutSeriesId = `${id}_metric_breakout_${Date.now()}`;
      this.stateManager.allSeriesMap.set(breakoutSeriesId, {
        patternId: id,
        series: breakoutSeries,
        type: 'metric',
        createdAt: Date.now()
      });
    }
    
    // Store metric lines for later removal
    if (metricLines.length > 0) {
      // Store in both instance map and global map
      this.metricLines.set(id, metricLines);
      this.stateManager.metricLinesMap.set(id, {
        series: metricLines,
        instanceId: this.instanceId,
        createdAt: Date.now()
      });
      
      logger.info('[PatternRenderer] Metric lines stored in maps', {
        instanceId: this.instanceId,
        id,
        count: metricLines.length,
        targetLevel: metrics.target_level,
        stopLoss: metrics.stop_loss,
        breakoutLevel: metrics.breakout_level,
        allPatternIds: Array.from(this.metricLines.keys()),
        mapSize: this.metricLines.size,
        globalMapSize: this.stateManager.metricLinesMap.size,
        globalPatternIds: Array.from(this.stateManager.metricLinesMap.keys())
      });
      
      // Debug: Verify the lines were actually stored
      const storedLines = this.metricLines.get(id);
      const globalStoredLines = this.stateManager.metricLinesMap.get(id);
      logger.info('[PatternRenderer] Verification - metric lines retrieved:', {
        id,
        retrieved: !!storedLines,
        retrievedCount: storedLines?.length || 0,
        globalRetrieved: !!globalStoredLines,
        globalRetrievedCount: globalStoredLines?.series.length || 0
      });
    } else {
      logger.warn('[PatternRenderer] No metric lines created for pattern', { id, metrics });
    }
  }
  
  /**
   * Add opacity to color
   */
  private addOpacity(color: string, opacity: number): string {
    // Convert hex to rgba
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  }
}