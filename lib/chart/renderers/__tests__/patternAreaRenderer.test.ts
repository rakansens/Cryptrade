import { renderPatternAreas, PatternAreaRendererDeps } from '../patternAreaRenderer';
import { logger } from '@/lib/utils/logger';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';

// Mock dependencies
jest.mock('@/lib/utils/logger');

describe('renderPatternAreas', () => {
  let mockChart: jest.Mocked<IChartApi>;
  let mockHistogramSeries: jest.Mocked<ISeriesApi<SeriesType>>;
  let globalAllSeries: Map<string, { patternId: string; series: ISeriesApi<SeriesType>; type: string; createdAt: number }>;
  let deps: PatternAreaRendererDeps;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock histogram series
    mockHistogramSeries = {
      setData: jest.fn(),
      applyOptions: jest.fn(),
    } as any;

    // Mock chart
    mockChart = {
      addHistogramSeries: jest.fn().mockReturnValue(mockHistogramSeries),
    } as any;

    // Initialize global series map
    globalAllSeries = new Map();

    // Create dependencies
    deps = {
      chart: mockChart,
      globalAllSeries,
    };
  });

  describe('successful rendering', () => {
    it('should render areas with valid visualization data', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
              { time: 1641002400000, value: 50500 },
              { time: 1641006000000, value: 51500 },
            ],
            color: 'rgba(0, 255, 0, 0.2)',
            opacity: 0.3,
          },
        ],
      };

      const result = renderPatternAreas('pattern-1', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledWith({
        color: 'rgba(0, 255, 0, 0.2)',
        priceFormat: {
          type: 'price',
        },
        priceLineVisible: false,
        lastValueVisible: false,
      });

      expect(mockHistogramSeries.setData).toHaveBeenCalled();
      const setDataCall = mockHistogramSeries.setData.mock.calls[0][0];
      expect(setDataCall).toBeInstanceOf(Array);
      expect(setDataCall.length).toBeGreaterThan(0);
      expect(setDataCall[0]).toHaveProperty('time');
      expect(setDataCall[0]).toHaveProperty('value', 1500); // maxValue - minValue = 51500 - 50000

      expect(mockHistogramSeries.applyOptions).toHaveBeenCalledWith({
        priceScaleId: 'right',
        scaleMargins: expect.objectContaining({
          top: expect.any(Number),
          bottom: expect.any(Number),
        }),
      });

      expect(globalAllSeries.size).toBe(1);
      const entry = Array.from(globalAllSeries.entries())[0];
      expect(entry[0]).toMatch(/^pattern-1_area_0_\d+$/);
      expect(entry[1]).toEqual({
        patternId: 'pattern-1',
        series: mockHistogramSeries,
        type: 'area',
        createdAt: expect.any(Number),
      });

      expect(logger.info).toHaveBeenCalledWith('[PatternAreaRenderer] Rendering pattern areas', {
        id: 'pattern-1',
        areaCount: 1,
      });
    });

    it('should handle multiple areas', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
            color: 'rgba(255, 0, 0, 0.2)',
          },
          {
            points: [
              { time: 1641002400000, value: 49000 },
              { time: 1641006000000, value: 50000 },
            ],
            color: 'rgba(0, 0, 255, 0.2)',
          },
        ],
      };

      const result = renderPatternAreas('pattern-2', visualization, deps);

      expect(result).toHaveLength(2);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(2);
      expect(globalAllSeries.size).toBe(2);
    });

    it('should use default values when color and opacity are not provided', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
          },
        ],
      };

      renderPatternAreas('pattern-3', visualization, deps);

      expect(mockChart.addHistogramSeries).toHaveBeenCalledWith({
        color: 'rgba(33, 150, 243, 0.1)',
        priceFormat: {
          type: 'price',
        },
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const setDataCall = mockHistogramSeries.setData.mock.calls[0][0];
      expect(setDataCall[0].color).toMatch(/^rgba\(33, 150, 243, 0\.1\)/);
    });

    it('should limit histogram data points for performance', () => {
      const points = Array.from({ length: 100 }, (_, i) => ({
        time: 1640995200000 + i * 3600000,
        value: 50000 + Math.random() * 1000,
      }));

      const visualization: PatternVisualization = {
        areas: [
          {
            points,
            color: 'rgba(0, 255, 0, 0.2)',
          },
        ],
      };

      renderPatternAreas('pattern-4', visualization, deps);

      const setDataCall = mockHistogramSeries.setData.mock.calls[0][0];
      expect(setDataCall.length).toBeLessThanOrEqual(20);
    });
  });

  describe('edge cases and error handling', () => {
    it('should return empty array when no areas are provided', () => {
      const visualization: PatternVisualization = {
        areas: [],
      };

      const result = renderPatternAreas('pattern-5', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
    });

    it('should return empty array when areas is undefined', () => {
      const visualization: PatternVisualization = {};

      const result = renderPatternAreas('pattern-6', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
    });

    it('should skip areas with insufficient points', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [{ time: 1640995200000, value: 50000 }], // Only 1 point
            color: 'rgba(255, 0, 0, 0.2)',
          },
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
            color: 'rgba(0, 255, 0, 0.2)',
          },
        ],
      };

      const result = renderPatternAreas('pattern-7', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('[PatternAreaRenderer] Insufficient points for area', {
        id: 'pattern-7',
        areaIndex: 0,
        pointCount: 1,
      });
    });

    it('should skip areas with no points', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [],
            color: 'rgba(255, 0, 0, 0.2)',
          },
          {
            points: undefined as any,
            color: 'rgba(0, 255, 0, 0.2)',
          },
        ],
      };

      const result = renderPatternAreas('pattern-8', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in individual area processing', () => {
      mockChart.addHistogramSeries.mockImplementationOnce(() => {
        throw new Error('Failed to create series');
      });

      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
          },
          {
            points: [
              { time: 1641002400000, value: 49000 },
              { time: 1641006000000, value: 50000 },
            ],
          },
        ],
      };

      const result = renderPatternAreas('pattern-9', visualization, deps);

      expect(result).toHaveLength(1); // Only second area should succeed
      expect(logger.error).toHaveBeenCalledWith('[PatternAreaRenderer] Failed to create area', {
        id: 'pattern-9',
        areaIndex: 0,
        error: 'Error: Failed to create series',
      });
    });

    it('should return empty array in development mode on general error', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockChart.addHistogramSeries.mockImplementation(() => {
        throw new Error('Chart API error');
      });

      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
          },
        ],
      };

      const result = renderPatternAreas('pattern-10', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production mode on general error', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Create an error that occurs outside the try-catch for individual areas
      const visualization: PatternVisualization = null as any;

      expect(() => renderPatternAreas('pattern-11', visualization, deps)).toThrow(
        'Failed to render pattern areas:'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('calculation accuracy', () => {
    it('should calculate correct bounds and histogram values', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 48000 },
              { time: 1640998800000, value: 52000 },
              { time: 1641002400000, value: 49000 },
              { time: 1641006000000, value: 51000 },
            ],
            color: 'rgba(0, 255, 0, 0.2)',
            opacity: 0.5,
          },
        ],
      };

      renderPatternAreas('pattern-12', visualization, deps);

      const setDataCall = mockHistogramSeries.setData.mock.calls[0][0];
      
      // Check histogram value (max - min)
      expect(setDataCall[0].value).toBe(4000); // 52000 - 48000
      
      // Check color with opacity
      expect(setDataCall[0].color).toMatch(/^rgba\(0, 255, 0, 0\.2\)80$/); // 0x80 = 128 = 0.5 * 255

      // Check scale margins
      expect(mockHistogramSeries.applyOptions).toHaveBeenCalledWith({
        priceScaleId: 'right',
        scaleMargins: {
          top: 1 - (52000 / 100), // = -519
          bottom: 48000 / 100,     // = 480
        },
      });
    });

    it('should generate correct time distribution for histogram points', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1641081600000, value: 51000 }, // 24 hours later
            ],
            color: 'rgba(0, 0, 255, 0.1)',
          },
        ],
      };

      renderPatternAreas('pattern-13', visualization, deps);

      const setDataCall = mockHistogramSeries.setData.mock.calls[0][0];
      
      // Check time distribution
      const times = setDataCall.map((d: any) => d.time);
      expect(times[0]).toBe(1640995200000);
      expect(times[times.length - 1]).toBe(1641081600000);
      
      // Check intermediate times are evenly distributed
      for (let i = 1; i < times.length - 1; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
        expect(times[i]).toBeLessThan(times[i + 1]);
      }
    });
  });

  describe('logging', () => {
    it('should log appropriate debug information', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [
              { time: 1640995200000, value: 50000 },
              { time: 1640998800000, value: 51000 },
            ],
            color: 'rgba(255, 255, 0, 0.3)',
          },
        ],
      };

      renderPatternAreas('pattern-14', visualization, deps);

      expect(logger.debug).toHaveBeenCalledWith('[PatternAreaRenderer] Created histogram area', {
        id: 'pattern-14',
        areaIndex: 0,
        startTime: new Date(1640995200000).toISOString(),
        endTime: new Date(1640998800000).toISOString(),
        minValue: 50000,
        maxValue: 51000,
      });

      expect(logger.info).toHaveBeenCalledWith('[PatternAreaRenderer] Completed area rendering', {
        id: 'pattern-14',
        created: 1,
      });
    });
  });
});