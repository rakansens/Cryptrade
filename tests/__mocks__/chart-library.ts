/**
 * Lightweight Charts ライブラリのモック
 */

export class MockPriceLine {
  private _options: any;
  
  constructor(options: any) {
    this._options = options;
  }
  
  applyOptions(options: any) {
    this._options = { ...this._options, ...options };
  }
  
  options() {
    return this._options;
  }
}

export class MockSeries {
  private data: any[] = [];
  private priceLines: Map<string, MockPriceLine> = new Map();
  
  constructor(_type: string) {
    // Type is not used in mock
  }
  
  setData(data: any[]) {
    this.data = data;
  }
  
  update(bar: any) {
    const existingIndex = this.data.findIndex(d => d.time === bar.time);
    if (existingIndex >= 0) {
      this.data[existingIndex] = bar;
    } else {
      this.data.push(bar);
    }
  }
  
  setMarkers(_markers: any[]) {
    // Markers not implemented in mock
  }
  
  createPriceLine(options: any) {
    const priceLine = new MockPriceLine(options);
    if (options.id) {
      this.priceLines.set(options.id, priceLine);
    }
    return priceLine;
  }
  
  removePriceLine(priceLine: MockPriceLine) {
    this.priceLines.forEach((pl, id) => {
      if (pl === priceLine) {
        this.priceLines.delete(id);
      }
    });
  }
  
  coordinateToPrice(coordinate: number) {
    // Simple mock implementation
    return 48000 + (100 - coordinate) * 10;
  }
  
  priceToCoordinate(price: number) {
    // Simple mock implementation
    return 100 - (price - 48000) / 10;
  }
}

export class MockChartApi {
  private series: Map<string, MockSeries> = new Map();
  private _timeScale = {
    scrollPosition: jest.fn().mockReturnValue(0),
    scrollToPosition: jest.fn(),
    getVisibleRange: jest.fn().mockReturnValue({
      from: Date.now() / 1000 - 86400,
      to: Date.now() / 1000
    }),
    setVisibleRange: jest.fn(),
    resetTimeScale: jest.fn(),
    fitContent: jest.fn(),
    subscribeCrosshairMove: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    subscribeVisibleTimeRangeChange: jest.fn(),
    unsubscribeVisibleTimeRangeChange: jest.fn()
  };
  
  addCandlestickSeries(_options?: any) {
    const series = new MockSeries('candlestick');
    this.series.set('candlestick', series);
    return series;
  }
  
  addLineSeries(options?: any) {
    const series = new MockSeries('line');
    const id = options?.id || `line-${this.series.size}`;
    this.series.set(id, series);
    return series;
  }
  
  addHistogramSeries(options?: any) {
    const series = new MockSeries('histogram');
    const id = options?.id || `histogram-${this.series.size}`;
    this.series.set(id, series);
    return series;
  }
  
  removeSeries(series: MockSeries) {
    this.series.forEach((s, key) => {
      if (s === series) {
        this.series.delete(key);
      }
    });
  }
  
  subscribeCrosshairMove(handler: any) {
    return handler;
  }
  
  unsubscribeCrosshairMove(_handler: any) {
    // Mock implementation
  }
  
  subscribeClick(handler: any) {
    return handler;
  }
  
  unsubscribeClick(_handler: any) {
    // Mock implementation
  }
  
  timeScale() {
    return this._timeScale;
  }
  
  applyOptions(_options: any) {
    // Mock implementation
  }
  
  resize(_width: number, _height: number) {
    // Mock implementation
  }
  
  remove() {
    this.series.clear();
  }
}

export const createChart = jest.fn((_container: HTMLElement, _options?: any) => {
  return new MockChartApi();
});

export const CrosshairMode = {
  Normal: 0,
  Magnet: 1
};

export const LineStyle = {
  Solid: 0,
  Dotted: 1,
  Dashed: 2,
  LargeDashed: 3,
  SparseDotted: 4
};

export const ColorType = {
  Solid: 'solid',
  VerticalGradient: 'gradient'
};

// Export mock for the module
const mockLightweightCharts = {
  createChart,
  CrosshairMode,
  LineStyle,
  ColorType
};

export default mockLightweightCharts;