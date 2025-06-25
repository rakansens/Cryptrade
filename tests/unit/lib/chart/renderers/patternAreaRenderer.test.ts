// Mock dependencies before imports
jest.mock('@/lib/utils/logger');

import { renderPatternAreas, PatternAreaRendererDeps } from '@/lib/chart/renderers/patternAreaRenderer';
import { logger } from '@/lib/utils/logger';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import type { PatternVisualization } from '@/types/pattern';

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
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
          { time: 1641002400000, value: 50500, type: 'peak' },
          { time: 1641006000000, value: 51500, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1, 2, 3], // indices into keyPoints array
            style: {
              fillColor: 'rgba(0, 255, 0, 0.2)',
              opacity: 0.3,
            },
          },
        ],
      };

      const result = renderPatternAreas('pattern-1', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledWith({
        color: 'rgba(0, 255, 0, 0.2)',
        priceFormat: {
          type: 'price',
        },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      expect(mockHistogramSeries.setData).toHaveBeenCalled();
      expect(mockHistogramSeries.applyOptions).toHaveBeenCalled();
      expect(globalAllSeries.size).toBe(1);
    });

    it('should render empty array for no areas', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
        ],
      };

      const result = renderPatternAreas('pattern-empty', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
      expect(globalAllSeries.size).toBe(0);
    });

    it('should render empty array for empty areas array', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
        ],
        areas: [],
      };

      const result = renderPatternAreas('pattern-no-areas', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
      expect(globalAllSeries.size).toBe(0);
    });

    it('should render multiple areas', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
          { time: 1641002400000, value: 49000, type: 'peak' },
          { time: 1641006000000, value: 50000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1], // indices into keyPoints array
            style: {
              fillColor: 'rgba(255, 0, 0, 0.2)',
            },
          },
          {
            points: [2, 3], // indices into keyPoints array
            style: {
              fillColor: 'rgba(0, 0, 255, 0.2)',
            },
          },
        ],
      };

      const result = renderPatternAreas('pattern-2', visualization, deps);

      expect(result).toHaveLength(2);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(2);
      expect(globalAllSeries.size).toBe(2);
    });

    it('should handle areas with missing style properties', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1], // indices into keyPoints array
          },
        ],
      };

      const result = renderPatternAreas('pattern-3', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledWith({
        color: 'rgba(33, 150, 243, 0.1)', // Default color
        priceFormat: {
          type: 'price',
        },
        priceLineVisible: false,
        lastValueVisible: false,
      });
    });

    it('should calculate histogram data based on area points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
          { time: 1641002400000, value: 50500, type: 'peak' },
          { time: 1641006000000, value: 51500, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1, 2, 3], // indices into keyPoints array
            style: {
              fillColor: 'rgba(0, 255, 0, 0.5)',
              opacity: 0.5,
            },
          },
        ],
      };

      renderPatternAreas('pattern-4', visualization, deps);

      const histogramData = mockHistogramSeries.setData.mock.calls[0]?.[0];
      expect(histogramData).toBeDefined();
      expect(histogramData?.length).toBeGreaterThan(0);
      expect(histogramData?.length).toBeLessThanOrEqual(20); // Max limit
      
      // Check histogram data structure
      histogramData?.forEach((point: any) => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('value');
        expect(point).toHaveProperty('color');
        expect(typeof point.time).toBe('number');
        expect(typeof point.value).toBe('number');
        expect(typeof point.color).toBe('string');
      });
    });
  });

  describe('error handling', () => {
    it('should skip areas with insufficient points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
        ],
        areas: [
          {
            points: [0], // Only 1 point - insufficient
          },
        ],
      };

      const result = renderPatternAreas('pattern-insufficient', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Insufficient points for area',
        expect.objectContaining({
          id: 'pattern-insufficient',
          areaIndex: 0,
          pointCount: 1,
        })
      );
    });

    it('should skip areas with no points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
        ],
        areas: [
          {
            points: [], // Empty points array
          },
        ],
      };

      const result = renderPatternAreas('pattern-no-points', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
    });

    it('should skip areas with null points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
        ],
        areas: [
          {
            points: null as any, // Invalid null points
          },
        ],
      };

      const result = renderPatternAreas('pattern-null-points', visualization, deps);

      expect(result).toEqual([]);
      expect(mockChart.addHistogramSeries).not.toHaveBeenCalled();
    });

    it('should handle areas with out of bounds indices', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1, 5, 10], // indices 5 and 10 are out of bounds
          },
        ],
      };

      const result = renderPatternAreas('pattern-out-of-bounds', visualization, deps);

      // Should still render with valid points (0 and 1)
      expect(result).toHaveLength(1);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(1);
    });

    it('should continue rendering other areas if one fails', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
          { time: 1641002400000, value: 50500, type: 'peak' },
          { time: 1641006000000, value: 51500, type: 'trough' },
        ],
        areas: [
          {
            points: [0], // Invalid - only 1 point
          },
          {
            points: [1, 2], // Valid
          },
          {
            points: [2, 3], // Valid
          },
        ],
      };

      const result = renderPatternAreas('pattern-partial-fail', visualization, deps);

      // Should render the 2 valid areas
      expect(result).toHaveLength(2);
      expect(mockChart.addHistogramSeries).toHaveBeenCalledTimes(2);
      expect(globalAllSeries.size).toBe(2);
    });

    it('should handle chart.addHistogramSeries error', () => {
      mockChart.addHistogramSeries.mockImplementationOnce(() => {
        throw new Error('Chart error');
      });

      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1],
          },
        ],
      };

      const result = renderPatternAreas('pattern-chart-error', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Failed to create area',
        expect.objectContaining({
          id: 'pattern-chart-error',
          areaIndex: 0,
          error: 'Error: Chart error',
        })
      );
    });

    it('should handle histogram series setData error', () => {
      mockHistogramSeries.setData.mockImplementationOnce(() => {
        throw new Error('SetData error');
      });

      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1],
          },
        ],
      };

      const result = renderPatternAreas('pattern-setdata-error', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Failed to create area',
        expect.objectContaining({
          id: 'pattern-setdata-error',
          areaIndex: 0,
          error: 'Error: SetData error',
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle areas with same value points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 50000, type: 'trough' }, // Same value
          { time: 1641002400000, value: 50000, type: 'peak' }, // Same value
          { time: 1641006000000, value: 50000, type: 'trough' }, // Same value
        ],
        areas: [
          {
            points: [0, 1, 2, 3],
          },
        ],
      };

      const result = renderPatternAreas('pattern-same-values', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockHistogramSeries.setData).toHaveBeenCalled();
      
      const histogramData = mockHistogramSeries.setData.mock.calls[0]?.[0];
      // All values should be 0 (maxValue - minValue = 50000 - 50000 = 0)
      histogramData?.forEach((point: any) => {
        expect(point.value).toBe(0);
      });
    });

    it('should handle areas with same time points', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640995200000, value: 51000, type: 'trough' }, // Same time
        ],
        areas: [
          {
            points: [0, 1],
          },
        ],
      };

      const result = renderPatternAreas('pattern-same-times', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockHistogramSeries.setData).toHaveBeenCalled();
    });

    it('should handle visualization with missing keyPoints', () => {
      const visualization: PatternVisualization = {
        areas: [
          {
            points: [0, 1],
          },
        ],
      } as PatternVisualization;

      const result = renderPatternAreas('pattern-no-keypoints', visualization, deps);

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Insufficient valid points for area',
        expect.anything()
      );
    });

    it('should handle very large point arrays', () => {
      const visualization: PatternVisualization = {
        keyPoints: Array.from({ length: 100 }, (_, i) => ({
          time: 1640995200000 + i * 3600000,
          value: 50000 + i * 100,
          type: 'peak' as const,
        })),
        areas: [
          {
            points: Array.from({ length: 100 }, (_, i) => i), // All indices
          },
        ],
      };

      const result = renderPatternAreas('pattern-large', visualization, deps);

      expect(result).toHaveLength(1);
      expect(mockHistogramSeries.setData).toHaveBeenCalled();
      
      const histogramData = mockHistogramSeries.setData.mock.calls[0]?.[0];
      // Should be limited to 20 points max
      expect(histogramData?.length).toBeLessThanOrEqual(20);
    });
  });

  describe('logging', () => {
    it('should log info on successful rendering', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1],
          },
        ],
      };

      renderPatternAreas('pattern-log', visualization, deps);

      expect(logger.info).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Rendering pattern areas',
        expect.objectContaining({
          id: 'pattern-log',
          areaCount: 1,
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Completed area rendering',
        expect.objectContaining({
          id: 'pattern-log',
          created: 1,
        })
      );
    });

    it('should log debug for created areas', () => {
      const visualization: PatternVisualization = {
        keyPoints: [
          { time: 1640995200000, value: 50000, type: 'peak' },
          { time: 1640998800000, value: 51000, type: 'trough' },
        ],
        areas: [
          {
            points: [0, 1],
          },
        ],
      };

      renderPatternAreas('pattern-debug', visualization, deps);

      expect(logger.debug).toHaveBeenCalledWith(
        '[PatternAreaRenderer] Created histogram area',
        expect.objectContaining({
          id: 'pattern-debug',
          areaIndex: 0,
          startTime: expect.any(String),
          endTime: expect.any(String),
          minValue: 50000,
          maxValue: 51000,
        })
      );
    });
  });
});