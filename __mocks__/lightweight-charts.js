// Mock for lightweight-charts library
const mockTimeScale = {
  fitContent: jest.fn(),
  scrollToPosition: jest.fn(),
  setVisibleRange: jest.fn(),
  getVisibleRange: jest.fn(),
  subscribeVisibleTimeRangeChange: jest.fn(() => jest.fn()),
  unsubscribeVisibleTimeRangeChange: jest.fn(),
};

const mockPriceScale = {
  applyOptions: jest.fn(),
};

const mockSeries = {
  setData: jest.fn(),
  update: jest.fn(),
  applyOptions: jest.fn(),
  priceScale: jest.fn(() => mockPriceScale),
  createPriceLine: jest.fn(),
  removePriceLine: jest.fn(),
  setMarkers: jest.fn(),
  priceFormatter: jest.fn(),
  coordinateToPrice: jest.fn(),
  priceToCoordinate: jest.fn(),
};

const mockChart = {
  addCandlestickSeries: jest.fn(() => mockSeries),
  addLineSeries: jest.fn(() => mockSeries),
  addHistogramSeries: jest.fn(() => mockSeries),
  addAreaSeries: jest.fn(() => mockSeries),
  addBarSeries: jest.fn(() => mockSeries),
  removeSeries: jest.fn(),
  applyOptions: jest.fn(),
  timeScale: jest.fn(() => mockTimeScale),
  priceScale: jest.fn(() => mockPriceScale),
  subscribeCrosshairMove: jest.fn(() => jest.fn()),
  unsubscribeCrosshairMove: jest.fn(),
  subscribeClick: jest.fn(() => jest.fn()),
  unsubscribeClick: jest.fn(),
  remove: jest.fn(),
  resize: jest.fn(),
  takeScreenshot: jest.fn(),
};

const createChart = jest.fn(() => mockChart);

const CrosshairMode = {
  Normal: 0,
  Magnet: 1,
};

const ColorType = {
  Solid: 'solid',
  VerticalGradient: 'gradient',
};

const LineStyle = {
  Solid: 0,
  Dotted: 1,
  Dashed: 2,
  LargeDashed: 3,
  SparseDotted: 4,
};

const PriceScaleMode = {
  Normal: 0,
  Logarithmic: 1,
  Percentage: 2,
  IndexedTo100: 3,
};

module.exports = {
  createChart,
  CrosshairMode,
  ColorType,
  LineStyle,
  PriceScaleMode,
  isBusinessDay: jest.fn((time) => true),
  isUTCTimestamp: jest.fn((time) => typeof time === 'number'),
};