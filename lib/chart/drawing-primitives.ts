import type { IChartApi, ISeriesApi, Time, SeriesType, LineData, PriceLineOptions } from 'lightweight-charts';
import type { ChartDrawing, DrawingPoint, DrawingStyle } from '@/types/chart.types';
import { logger } from '@/lib/utils/logger';
import { ChartAnalyzer } from '@/lib/chart/analyzer';

/**
 * Chart Drawing Primitives
 * 
 * Lightweight Charts integration for drawing tools
 * Handles rendering of trend lines, Fibonacci retracements, and other drawing objects
 */

export interface DrawingPrimitive {
  id: string;
  type: string;
  series?: ISeriesApi<SeriesType>;
  priceLine?: PriceLineOptions;
  remove: () => void;
  update: (updates: Partial<ChartDrawing>) => void;
  setVisible: (visible: boolean) => void;
}

export class ChartDrawingManager extends EventTarget {
  private chart: IChartApi;
  private primitives: Map<string, DrawingPrimitive> = new Map();
  private mainSeries: ISeriesApi<SeriesType>;

  constructor(chart: IChartApi, mainSeries: ISeriesApi<SeriesType>) {
    super();
    this.chart = chart;
    this.mainSeries = mainSeries;
  }

  /**
   * Add a drawing to the chart
   */
  addDrawing(drawing: ChartDrawing): DrawingPrimitive | null {
    try {
      let primitive: DrawingPrimitive | null = null;

      switch (drawing.type) {
        case 'trendline':
          primitive = this.createTrendLine(drawing);
          break;
        case 'horizontal':
          primitive = this.createHorizontalLine(drawing);
          break;
        case 'vertical':
          primitive = this.createVerticalLine(drawing);
          break;
        case 'fibonacci':
          primitive = this.createFibonacciRetracement(drawing);
          break;
        default:
          logger.warn('[Drawing Manager] Unknown drawing type', { type: drawing.type });
          return null;
      }

      if (primitive) {
        this.primitives.set(drawing.id, primitive);
        logger.info('[Drawing Manager] Drawing added', { id: drawing.id, type: drawing.type });
        
        // Dispatch confirmation event
        window.dispatchEvent(new CustomEvent('chart:drawingAdded', {
          detail: { id: drawing.id, type: drawing.type }
        }));
      }

      return primitive;
    } catch (error) {
      logger.error('[Drawing Manager] Failed to add drawing', { 
        id: drawing.id, 
        type: drawing.type, 
        error 
      });
      return null;
    }
  }

  /**
   * Remove a drawing from the chart
   */
  removeDrawing(id: string): boolean {
    const primitive = this.primitives.get(id);
    if (primitive) {
      primitive.remove();
      this.primitives.delete(id);
      logger.info('[Drawing Manager] Drawing removed', { id });
      
      // Dispatch confirmation event
      window.dispatchEvent(new CustomEvent('chart:drawingDeleted', {
        detail: { id }
      }));
      
      return true;
    }
    return false;
  }

  /**
   * Update an existing drawing
   */
  updateDrawing(id: string, updates: Partial<ChartDrawing>): boolean {
    try {
      const primitive = this.primitives.get(id);
      if (primitive) {
        primitive.update(updates);
        logger.info('[Drawing Manager] Drawing updated', { id, updates });
        return true;
      }
      logger.warn('[Drawing Manager] Drawing not found for update', { id });
      return false;
    } catch (error) {
      logger.error('[Drawing Manager] Failed to update drawing', { 
        id, 
        updates,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear all drawings
   */
  clearAll(): void {
    for (const [id, primitive] of this.primitives) {
      primitive.remove();
    }
    this.primitives.clear();
    logger.info('[Drawing Manager] All drawings cleared');
  }

  /**
   * Get all drawing IDs
   */
  getDrawingIds(): string[] {
    return Array.from(this.primitives.keys());
  }

  /**
   * Set visibility for a drawing
   */
  setDrawingVisible(id: string, visible: boolean): boolean {
    const primitive = this.primitives.get(id);
    if (primitive) {
      primitive.setVisible(visible);
      return true;
    }
    return false;
  }

  /**
   * Convenience methods for specific drawing types
   */
  addTrendline(point1: DrawingPoint, point2: DrawingPoint, style: DrawingStyle, id?: string): string {
    const drawingId = id || `trendline_${Date.now()}`;
    const drawing: ChartDrawing = {
      id: drawingId,
      type: 'trendline',
      points: [point1, point2],
      style,
      visible: true,
      interactive: true
    };
    
    const primitive = this.addDrawing(drawing);
    if (!primitive) {
      throw new Error('Failed to create trendline');
    }
    
    return drawingId;
  }

  addHorizontalLine(value: number, style: DrawingStyle, id?: string): string {
    const drawingId = id || `horizontal_${Date.now()}`;
    const drawing: ChartDrawing = {
      id: drawingId,
      type: 'horizontal',
      points: [{ time: Date.now() / 1000, value }],
      style,
      visible: true,
      interactive: true
    };
    
    const primitive = this.addDrawing(drawing);
    if (!primitive) {
      throw new Error('Failed to create horizontal line');
    }
    
    return drawingId;
  }

  addVerticalLine(time: number, style: DrawingStyle, id?: string): string {
    const drawingId = id || `vertical_${Date.now()}`;
    const drawing: ChartDrawing = {
      id: drawingId,
      type: 'vertical',
      points: [{ time: time, value: 0 }],
      style,
      visible: true,
      interactive: true
    };
    
    const primitive = this.addDrawing(drawing);
    if (!primitive) {
      throw new Error('Failed to create vertical line');
    }
    
    return drawingId;
  }

  addFibonacci(point1: DrawingPoint, point2: DrawingPoint, style: DrawingStyle, id?: string): string {
    const drawingId = id || `fibonacci_${Date.now()}`;
    const drawing: ChartDrawing = {
      id: drawingId,
      type: 'fibonacci',
      points: [point1, point2],
      style,
      visible: true,
      interactive: true
    };
    
    const primitive = this.addDrawing(drawing);
    if (!primitive) {
      throw new Error('Failed to create fibonacci');
    }
    
    return drawingId;
  }

  /**
   * Create trend line using line series
   */
  private createTrendLine(drawing: ChartDrawing): DrawingPrimitive {
    if (drawing.points.length < 2) {
      throw new Error('Trend line requires at least 2 points');
    }

    const [point1, point2] = drawing.points;
    
    // Create line series for trend line
    const lineSeries = this.chart.addLineSeries({
      color: drawing.style.color,
      lineWidth: drawing.style.lineWidth,
      lineStyle: this.convertLineStyle(drawing.style.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Calculate line data points
    const lineData = this.calculateTrendLineData(point1, point2) as LineData[];
    lineSeries.setData(lineData);

    return {
      id: drawing.id,
      type: 'trendline',
      series: lineSeries,
      remove: () => {
        this.chart.removeSeries(lineSeries);
      },
      update: (updates) => {
        if (updates.points && updates.points.length >= 2) {
          const newLineData = this.calculateTrendLineData(updates.points[0], updates.points[1]);
          lineSeries.setData(newLineData);
        }
        if (updates.style) {
          const options: Partial<{
            color: string;
            lineWidth: number;
            lineStyle: number;
          }> = {};
          
          // Only include defined properties
          if (updates.style.color !== undefined) {
            options.color = updates.style.color;
          }
          if (updates.style.lineWidth !== undefined) {
            options.lineWidth = updates.style.lineWidth;
          }
          if (updates.style.lineStyle !== undefined) {
            options.lineStyle = this.convertLineStyle(updates.style.lineStyle);
          }
          
          // Only apply options if there are properties to update
          if (Object.keys(options).length > 0) {
            try {
              lineSeries.applyOptions(options);
              logger.info('[Drawing Manager] Line series style updated', { id: drawing.id, options });
            } catch (error) {
              logger.error('[Drawing Manager] Failed to apply line series options', { 
                id: drawing.id,
                options,
                error: error instanceof Error ? error.message : String(error)
              });
              throw error;
            }
          }
        }
      },
      setVisible: (visible) => {
        lineSeries.applyOptions({ visible });
      },
    };
  }

  /**
   * Create horizontal line using price line
   */
  private createHorizontalLine(drawing: ChartDrawing): DrawingPrimitive {
    const price = drawing.points[0]?.value || (drawing as ChartDrawing & { price?: number }).price;
    if (price === undefined) {
      throw new Error('Horizontal line requires price');
    }

    const priceLine = this.mainSeries.createPriceLine({
      price: price,
      color: drawing.style.color,
      lineWidth: drawing.style.lineWidth,
      lineStyle: this.convertPriceLineStyle(drawing.style.lineStyle),
      axisLabelVisible: drawing.style.showLabels,
      title: drawing.style.showLabels ? `$${price.toFixed(2)}` : '',
    });

    return {
      id: drawing.id,
      type: 'horizontal',
      priceLine: priceLine,
      remove: () => {
        this.mainSeries.removePriceLine(priceLine);
      },
      update: (updates) => {
        // Price lines cannot be updated directly in lightweight-charts
        // For now, log a warning
        if (updates.style) {
          logger.warn('[Drawing Manager] Price line style updates not supported', { 
            id: drawing.id,
            updates: updates.style 
          });
        }
        if (updates.points && updates.points[0]) {
          logger.warn('[Drawing Manager] Price line position updates not supported', { 
            id: drawing.id,
            newPrice: updates.points[0].value 
          });
        }
      },
      setVisible: (visible) => {
        // Lightweight Charts doesn't support hiding price lines directly
        // Would need to remove/add as workaround
      },
    };
  }

  /**
   * Create vertical line using time-based marker
   */
  private createVerticalLine(drawing: ChartDrawing): DrawingPrimitive {
    const time = drawing.points[0]?.time || (drawing as ChartDrawing & { time?: number }).time;
    if (time === undefined) {
      throw new Error('Vertical line requires time');
    }

    // Create a line series with single vertical line data
    const lineSeries = this.chart.addLineSeries({
      color: drawing.style.color,
      lineWidth: drawing.style.lineWidth,
      lineStyle: this.convertLineStyle(drawing.style.lineStyle),
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Get current price range to draw full height line
    const timeScale = this.chart.timeScale();
    const priceScale = this.chart.priceScale('right');
    
    // Create vertical line data (simplified approach)
    const lineData = [
      { time: time as Time, value: 0 },
    ];
    lineSeries.setData(lineData);

    return {
      id: drawing.id,
      type: 'vertical',
      series: lineSeries,
      remove: () => {
        this.chart.removeSeries(lineSeries);
      },
      update: (updates) => {
        if (updates.points && updates.points[0]) {
          const newData = [{ time: updates.points[0].time as Time, value: 0 }];
          lineSeries.setData(newData);
        }
        if (updates.style) {
          const options: Partial<{
            color: string;
            lineWidth: number;
            lineStyle: number;
          }> = {};
          
          // Only include defined properties
          if (updates.style.color !== undefined) {
            options.color = updates.style.color;
          }
          if (updates.style.lineWidth !== undefined) {
            options.lineWidth = updates.style.lineWidth;
          }
          if (updates.style.lineStyle !== undefined) {
            options.lineStyle = this.convertLineStyle(updates.style.lineStyle);
          }
          
          // Only apply options if there are properties to update
          if (Object.keys(options).length > 0) {
            try {
              lineSeries.applyOptions(options);
              logger.info('[Drawing Manager] Line series style updated', { id: drawing.id, options });
            } catch (error) {
              logger.error('[Drawing Manager] Failed to apply line series options', { 
                id: drawing.id,
                options,
                error: error instanceof Error ? error.message : String(error)
              });
              throw error;
            }
          }
        }
      },
      setVisible: (visible) => {
        lineSeries.applyOptions({ visible });
      },
    };
  }

  /**
   * Create Fibonacci retracement levels
   */
  private createFibonacciRetracement(drawing: ChartDrawing): DrawingPrimitive {
    if (drawing.points.length < 2) {
      throw new Error('Fibonacci retracement requires 2 points');
    }

    const [startPoint, endPoint] = drawing.points;
    const levels = (drawing.metadata?.levels as number[] | undefined) || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    
    const priceRange = endPoint.value - startPoint.value;
    const fibLines: ReturnType<ISeriesApi<SeriesType>['createPriceLine']>[] = [];

    // Create horizontal lines for each Fibonacci level
    levels.forEach((level) => {
      const price = startPoint.value + (priceRange * level);
      const priceLine = this.mainSeries.createPriceLine({
        price: price,
        color: drawing.style.color,
        lineWidth: drawing.style.lineWidth,
        lineStyle: this.convertPriceLineStyle(drawing.style.lineStyle),
        axisLabelVisible: drawing.style.showLabels,
        title: drawing.style.showLabels ? `${(level * 100).toFixed(1)}%` : '',
      });
      fibLines.push(priceLine);
    });

    return {
      id: drawing.id,
      type: 'fibonacci',
      remove: () => {
        fibLines.forEach(line => this.mainSeries.removePriceLine(line));
      },
      update: (updates) => {
        // Fibonacci levels would need full recreation for updates
        if (updates.points && updates.points.length >= 2) {
          // Remove existing lines and recreate
          fibLines.forEach(line => this.mainSeries.removePriceLine(line));
          // Would recreate with new points
        }
      },
      setVisible: (visible) => {
        // Price lines visibility workaround needed
      },
    };
  }

  /**
   * Calculate trend line data points
   */
  private calculateTrendLineData(point1: DrawingPoint, point2: DrawingPoint): LineData[] {
    const slope = (point2.value - point1.value) / (point2.time - point1.time);
    const timeRange = point2.time - point1.time;
    const extendRange = timeRange * 0.5; // Extend line 50% beyond points

    const startTime = point1.time - extendRange;
    const endTime = point2.time + extendRange;
    
    // Only use start and end points for a straight line
    return [
      {
        time: startTime as Time,
        value: point1.value + slope * (startTime - point1.time),
      },
      {
        time: endTime as Time,
        value: point2.value + slope * (endTime - point2.time),
      },
    ];
  }

  /**
   * Convert drawing line style to Lightweight Charts format
   */
  private convertLineStyle(style: DrawingStyle['lineStyle']) {
    switch (style) {
      case 'dashed':
        return 1; // LightweightCharts.LineStyle.Dashed
      case 'dotted':
        return 2; // LightweightCharts.LineStyle.Dotted
      case 'solid':
      default:
        return 0; // LightweightCharts.LineStyle.Solid
    }
  }

  /**
   * Convert drawing line style to price line format
   */
  private convertPriceLineStyle(style: DrawingStyle['lineStyle']) {
    switch (style) {
      case 'dashed':
        return 1; // LightweightCharts.LineStyle.Dashed
      case 'dotted':
        return 2; // LightweightCharts.LineStyle.Dotted
      case 'solid':
      default:
        return 0; // LightweightCharts.LineStyle.Solid
    }
  }
}

// Re-export ChartAnalyzer for backward compatibility
export { ChartAnalyzer };