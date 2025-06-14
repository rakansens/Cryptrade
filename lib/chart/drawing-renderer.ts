import { IChartApi, IPriceLine, ISeriesApi, SeriesType, LineWidth, LineStyle } from 'lightweight-charts';
import { useDrawingStore as useChartStoreBase, type ChartDrawing } from '@/store/chart';
import type { ChartSeriesApi, DrawingPoint, FibonacciLevel } from '@/types/chart.types';
import { DEFAULT_FIBONACCI_LEVELS } from '@/types/chart.types';

export class DrawingRenderer {
  private priceLines: Map<string, IPriceLine> = new Map();
  private trendLines: Map<string, ISeriesApi<SeriesType>> = new Map();
  private fibonacciSets: Map<string, IPriceLine[]> = new Map();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private chart: IChartApi,
    private mainSeries: ISeriesApi<SeriesType>
  ) {
    this.initializeSubscription();
  }

  private initializeSubscription() {
    // Subscribe to drawing changes with throttling for performance
    let timeoutId: NodeJS.Timeout | null = null;
    
    this.unsubscribe = useChartStoreBase.subscribe(
      (state) => state.drawings,
      (drawings) => {
        // Throttle updates to prevent excessive re-renders
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          this.renderDrawings(drawings);
        }, 50); // 50ms throttle
      }
    );

    // Initial render
    const initialDrawings = useChartStoreBase.getState().drawings;
    this.renderDrawings(initialDrawings);
  }

  private renderDrawings(drawings: ChartDrawing[]) {
    console.log('[DrawingRenderer] renderDrawings called with', drawings.length, 'drawings');
    drawings.forEach(drawing => {
      console.log('[DrawingRenderer] Drawing:', drawing.id, drawing.type, drawing.points);
    });
    
    // Remove deleted drawings
    const currentIds = new Set(drawings.map(d => d.id));
    
    // Remove deleted horizontal lines
    for (const [id, priceLine] of this.priceLines.entries()) {
      if (!currentIds.has(id)) {
        this.mainSeries.removePriceLine(priceLine);
        this.priceLines.delete(id);
      }
    }
    
    // Remove deleted trend lines
    for (const [id, series] of this.trendLines.entries()) {
      if (!currentIds.has(id)) {
        this.chart.removeSeries(series);
        this.trendLines.delete(id);
      }
    }
    
    // Remove deleted fibonacci sets
    for (const [id, priceLines] of this.fibonacciSets.entries()) {
      if (!currentIds.has(id)) {
        priceLines.forEach(priceLine => this.mainSeries.removePriceLine(priceLine));
        this.fibonacciSets.delete(id);
      }
    }

    // Add or update drawings
    drawings.forEach(drawing => {
      switch (drawing.type) {
        case 'horizontal':
          this.renderHorizontalLine(drawing);
          break;
        case 'trendline':
          this.renderTrendLine(drawing);
          break;
        case 'fibonacci':
          this.renderFibonacci(drawing);
          break;
        // Vertical lines can be added later
      }
    });
  }

  private renderHorizontalLine(drawing: ChartDrawing) {
    const existingLine = this.priceLines.get(drawing.id);
    
    if (existingLine) {
      // Update existing line
      existingLine.applyOptions({
        price: drawing.points[0].value,
        color: drawing.style.color,
        lineWidth: drawing.style.lineWidth as LineWidth,
        lineStyle: this.convertLineStyle(drawing.style.lineStyle),
        title: drawing.style.showLabels ? `${drawing.points[0].value.toFixed(2)}` : '',
      });
    } else {
      // Create new line
      const priceLine = this.mainSeries.createPriceLine({
        price: drawing.points[0].value,
        color: drawing.style.color,
        lineWidth: drawing.style.lineWidth as LineWidth,
        lineStyle: this.convertLineStyle(drawing.style.lineStyle),
        title: drawing.style.showLabels ? `${drawing.points[0].value.toFixed(2)}` : '',
        axisLabelVisible: true,
      });
      
      this.priceLines.set(drawing.id, priceLine);
    }
  }

  private convertLineStyle(style: string): LineStyle {
    switch (style) {
      case 'solid': return LineStyle.Solid;
      case 'dashed': return LineStyle.Dashed;
      case 'dotted': return LineStyle.Dotted;
      default: return LineStyle.Solid;
    }
  }

  private renderTrendLine(drawing: ChartDrawing) {
    console.log('[DrawingRenderer] renderTrendLine called for:', drawing.id, 'with points:', drawing.points);
    const existingSeries = this.trendLines.get(drawing.id);
    
    if (existingSeries) {
      // Update existing trend line
      existingSeries.applyOptions({
        color: drawing.style.color,
        lineWidth: drawing.style.lineWidth as LineWidth,
        lineStyle: this.convertLineStyle(drawing.style.lineStyle),
      });
      
      if (drawing.points.length >= 2) {
        existingSeries.setData([
          { time: drawing.points[0].time, value: drawing.points[0].value },
          { time: drawing.points[1].time, value: drawing.points[1].value }
        ]);
      }
    } else if (drawing.points.length >= 2) {
      // Create new trend line
      const series = this.chart.addLineSeries({
        color: drawing.style.color,
        lineWidth: drawing.style.lineWidth as LineWidth,
        lineStyle: this.convertLineStyle(drawing.style.lineStyle),
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      
      const lineData = [
        { time: drawing.points[0].time, value: drawing.points[0].value },
        { time: drawing.points[1].time, value: drawing.points[1].value }
      ];
      console.log('[DrawingRenderer] Setting trendline data:', lineData);
      series.setData(lineData);
      
      this.trendLines.set(drawing.id, series);
      console.log('[DrawingRenderer] Trendline created and stored:', drawing.id);
    }
  }

  private renderFibonacci(drawing: ChartDrawing) {
    const existingLines = this.fibonacciSets.get(drawing.id);
    
    if (drawing.points.length < 2) return;
    
    const startPrice = drawing.points[0].value;
    const endPrice = drawing.points[1].value;
    const diff = endPrice - startPrice;
    
    // Fibonacci levels
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 1];
    const levelColors = ['#FF0000', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'];
    
    if (existingLines) {
      // Update existing fibonacci lines
      existingLines.forEach((line, index) => {
        const level = levels[index];
        const price = startPrice + (diff * level);
        
        line.applyOptions({
          price,
          color: drawing.style.color || levelColors[index],
          lineWidth: drawing.style.lineWidth as LineWidth,
          lineStyle: this.convertLineStyle(drawing.style.lineStyle),
          title: `${(level * 100).toFixed(1)}%`,
        });
      });
    } else {
      // Create new fibonacci lines
      const priceLines: IPriceLine[] = [];
      
      levels.forEach((level, index) => {
        const price = startPrice + (diff * level);
        
        const priceLine = this.mainSeries.createPriceLine({
          price,
          color: drawing.style.color || levelColors[index],
          lineWidth: drawing.style.lineWidth as LineWidth,
          lineStyle: this.convertLineStyle(drawing.style.lineStyle),
          title: `${(level * 100).toFixed(1)}%`,
          axisLabelVisible: true,
        });
        
        priceLines.push(priceLine);
      });
      
      this.fibonacciSets.set(drawing.id, priceLines);
    }
  }

  cleanup() {
    // Remove all price lines
    for (const priceLine of this.priceLines.values()) {
      this.mainSeries.removePriceLine(priceLine);
    }
    this.priceLines.clear();
    
    // Remove all trend lines
    for (const series of this.trendLines.values()) {
      this.chart.removeSeries(series);
    }
    this.trendLines.clear();
    
    // Remove all fibonacci lines
    for (const priceLines of this.fibonacciSets.values()) {
      priceLines.forEach(priceLine => this.mainSeries.removePriceLine(priceLine));
    }
    this.fibonacciSets.clear();

    // Unsubscribe from store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Feature flag check
export function isDrawingRendererEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_DRAWING_RENDERER === 'true';
}