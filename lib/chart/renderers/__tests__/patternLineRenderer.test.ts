import { renderPatternLines, PatternLineRendererDeps } from '../patternLineRenderer';
import { logger } from '@/lib/utils/logger';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';

// Mock dependencies
jest.mock('@/lib/utils/logger');

describe('renderPatternLines', () => {
  let mockChart: jest.Mocked<IChartApi>;
  let mockLineSeries: jest.Mocked<ISeriesApi<SeriesType>>;
  let globalAllSeries: Map<string, { patternId: string; series: ISeriesApi<SeriesType>; type: string; createdAt: number }>;
  let mockGetLineColor: jest.Mock;
  let mockConvertLineStyle: jest.Mock;
  let deps: PatternLineRendererDeps;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock line series
    mockLineSeries = {
      setData: jest.fn(),
    } as any;

    // Mock chart
    mockChart = {
      addLineSeries: jest.fn().mockReturnValue(mockLineSeries),
    } as any;

    // Initialize mocks
    mockGetLineColor = jest.fn().mockReturnValue('#FF0000');
    mockConvertLineStyle = jest.fn().mockReturnValue(0); // LineStyle.Solid

    // Initialize global series map
    globalAllSeries = new Map();

    // Create dependencies
    deps = {
      chart: mockChart,
      getLineColor: mockGetLineColor,
      convertLineStyle: mockConvertLineStyle,
      globalAllSeries,
    };
  });

  describe('successful rendering', () => {
    it('should render lines with valid visualization data', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
          { time: 1641002400000, value: 49500 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
            style: {
              color: '#00FF00',
              lineWidth: 3,
              lineStyle: 'dashed',
            },
          },
          {
            from: 1,
            to: 2,
            type: 'resistance',
          },
        ],
      };

      const result = renderPatternLines('pattern-1', visualization, deps);

      expect(result).toHaveLength(2);
      expect(mockChart.addLineSeries).toHaveBeenCalledTimes(2);

      // First line
      expect(mockChart.addLineSeries).toHaveBeenNthCalledWith(1, {
        color: '#00FF00',
        lineWidth: 3,
        lineStyle: 0, // converted from 'dashed'
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Second line (uses defaults)
      expect(mockChart.addLineSeries).toHaveBeenNthCalledWith(2, {
        color: '#FF0000', // from getLineColor
        lineWidth: 2, // default
        lineStyle: 0, // converted from 'solid'
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Verify data was set
      expect(mockLineSeries.setData).toHaveBeenCalledTimes(2);
      const firstLineData = mockLineSeries.setData.mock.calls[0][0];
      expect(firstLineData).toEqual([
        { time: 1640995200000, value: 50000 },
        { time: 1640998800000, value: 51000 },
      ]);

      // Verify global series tracking
      expect(globalAllSeries.size).toBe(2);
      const entries = Array.from(globalAllSeries.entries());
      expect(entries[0][0]).toMatch(/^pattern-1_line_0_\d+$/);
      expect(entries[0][1]).toEqual({
        patternId: 'pattern-1',
        series: mockLineSeries,
        type: 'line',
        createdAt: expect.any(Number),
      });
    });

    it('should handle reverse time order correctly', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640998800000, value: 51000 }, // Later time
          { time: 1640995200000, value: 50000 }, // Earlier time
        ],
        lines: [
          {
            from: 0, // Later time point
            to: 1,   // Earlier time point
            type: 'trendline',
          },
        ],
      };

      renderPatternLines('pattern-2', visualization, deps);

      const setDataCall = mockLineSeries.setData.mock.calls[0][0];
      // Should be ordered with earlier time first
      expect(setDataCall[0].time).toBe(1640995200000);
      expect(setDataCall[1].time).toBe(1640998800000);
    });

    it('should use default line style when not specified', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
        ],
      };

      renderPatternLines('pattern-3', visualization, deps);

      expect(mockGetLineColor).toHaveBeenCalledWith('support');
      expect(mockConvertLineStyle).toHaveBeenCalledWith('solid');
      expect(mockChart.addLineSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#FF0000', // from mockGetLineColor
          lineWidth: 2, // default
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should return empty array when no lines are provided', () => {
      const visualization: PatternVisualization = {
        keyPoints: [{ time: 1640995200000, value: 50000 }],
        lines: [],
      };

      const result = renderPatternLines('pattern-4', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addLineSeries).not.toHaveBeenCalled();
    });

    it('should return empty array when lines is undefined', () => {
      const visualization: PatternVisualization = {
        keyPoints: [{ time: 1640995200000, value: 50000 }],
      };

      const result = renderPatternLines('pattern-5', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('[PatternLineRenderer] Start', {
        id: 'pattern-5',
        linesCount: 0,
      });
    });

    it('should skip lines with missing endpoints', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 5, // Invalid index
            type: 'support',
          },
          {
            from: 0,
            to: 1, // Valid indices
            type: 'resistance',
          },
        ],
      };

      const result = renderPatternLines('pattern-6', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockChart.addLineSeries).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('[PatternLineRenderer] Missing endpoints', {
        id: 'pattern-6',
        lineIndex: 0,
      });
    });

    it('should handle errors in individual line creation', () => {
      mockChart.addLineSeries
        .mockImplementationOnce(() => {
          throw new Error('Failed to create series');
        })
        .mockReturnValueOnce(mockLineSeries);

      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
          {
            from: 1,
            to: 0,
            type: 'resistance',
          },
        ],
      };

      const result = renderPatternLines('pattern-7', visualization, deps);

      expect(result).toHaveLength(1); // Only second line should succeed
      expect(logger.error).toHaveBeenCalledWith('[PatternLineRenderer] Failed to create line', {
        id: 'pattern-7',
        lineIndex: 0,
        error: 'Error: Failed to create series',
      });
    });

    it('should use existing lines as fallback when error occurs', () => {
      // Pre-populate globalAllSeries with existing lines
      const existingSeries1 = {} as ISeriesApi<SeriesType>;
      const existingSeries2 = {} as ISeriesApi<SeriesType>;
      
      globalAllSeries.set('pattern-8_line_0_123456', {
        patternId: 'pattern-8',
        series: existingSeries1,
        type: 'line',
        createdAt: 123456,
      });
      
      globalAllSeries.set('pattern-8_line_1_123457', {
        patternId: 'pattern-8',
        series: existingSeries2,
        type: 'line',
        createdAt: 123457,
      });

      // Mock error scenario
      const visualization: PatternVisualization = null as any;

      const result = renderPatternLines('pattern-8', visualization, deps);

      expect(result).toEqual([existingSeries1, existingSeries2]);
      expect(logger.warn).toHaveBeenCalledWith('[PatternLineRenderer] Using existing lines as fallback', {
        id: 'pattern-8',
        existingCount: 2,
      });
    });

    it('should return empty array in development mode when no fallback available', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const visualization: PatternVisualization = null as any;

      const result = renderPatternLines('pattern-9', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith('[PatternLineRenderer] Returning empty array in development');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production mode when no fallback available', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const visualization: PatternVisualization = null as any;

      expect(() => renderPatternLines('pattern-10', visualization, deps)).toThrow(
        'Failed to render pattern lines:'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('line style conversion', () => {
    it('should convert different line styles correctly', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
            style: {
              lineStyle: 'dotted',
            },
          },
        ],
      };

      renderPatternLines('pattern-11', visualization, deps);

      expect(mockConvertLineStyle).toHaveBeenCalledWith('dotted');
    });

    it('should handle custom line widths', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'trendline',
            style: {
              lineWidth: 4,
            },
          },
        ],
      };

      renderPatternLines('pattern-12', visualization, deps);

      expect(mockChart.addLineSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          lineWidth: 4,
        })
      );
    });
  });

  describe('logging', () => {
    it('should log start and completion information', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
        ],
      };

      renderPatternLines('pattern-13', visualization, deps);

      expect(logger.info).toHaveBeenCalledWith('[PatternLineRenderer] Start', {
        id: 'pattern-13',
        linesCount: 1,
      });

      expect(logger.info).toHaveBeenCalledWith('[PatternLineRenderer] Done', {
        id: 'pattern-13',
        created: 1,
      });
    });

    it('should log detailed error information', () => {
      const error = new Error('Test error');
      error.stack = 'Test stack trace';
      
      mockChart.addLineSeries.mockImplementation(() => {
        throw error;
      });

      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
        ],
      };

      try {
        renderPatternLines('pattern-14', visualization, deps);
      } catch (e) {
        // Expected in production mode
      }

      expect(logger.error).toHaveBeenCalledWith('[PatternLineRenderer] Error', {
        id: 'pattern-14',
        error: {
          message: 'Test error',
          stack: 'Test stack trace',
        },
      });
    });
  });

  describe('global series management', () => {
    it('should not affect other pattern lines in globalAllSeries', () => {
      // Add lines from different patterns
      globalAllSeries.set('other-pattern_line_0_111111', {
        patternId: 'other-pattern',
        series: {} as any,
        type: 'line',
        createdAt: 111111,
      });

      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
        ],
      };

      renderPatternLines('pattern-15', visualization, deps);

      expect(globalAllSeries.size).toBe(2);
      expect(globalAllSeries.has('other-pattern_line_0_111111')).toBe(true);
    });

    it('should generate unique keys for lines', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000 },
          { time: 1640998800000, value: 51000 },
        ],
        lines: [
          {
            from: 0,
            to: 1,
            type: 'support',
          },
          {
            from: 1,
            to: 0,
            type: 'resistance',
          },
        ],
      };

      renderPatternLines('pattern-16', visualization, deps);

      const keys = Array.from(globalAllSeries.keys());
      expect(keys[0]).not.toEqual(keys[1]);
      expect(keys[0]).toMatch(/^pattern-16_line_0_\d+$/);
      expect(keys[1]).toMatch(/^pattern-16_line_1_\d+$/);
    });
  });
});