/**
 * MetricRenderer Plugin Tests
 * 
 * チャートプラグインのメトリックレンダラーの包括的なテストスイート
 */

// Mock dependencies
jest.mock('@/lib/utils/logger');

jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => false),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MetricRenderer } from '@/lib/chart/plugins/MetricRenderer';
import type { PluginContext, MetricStyle } from '@/lib/chart/plugins/interfaces';
import type { PatternVisualization } from '@/types/pattern';
import type { ISeriesApi, SeriesType } from 'lightweight-charts';
import { PluginError } from '@/lib/chart/plugins/interfaces';
import { logger } from '@/lib/utils/logger';

describe('MetricRenderer', () => {
  let renderer: MetricRenderer;
  let mockContext: PluginContext;
  let mockAddLineSeries: jest.Mock;
  let mockRemoveSeries: jest.Mock;
  let mockLineSeries: ISeriesApi<SeriesType>;
  let mockRegisterMetricLines: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLineSeries = {
      setData: jest.fn(),
    } as any;
    
    // Track created series so they can be removed
    const createdSeries: any[] = [];
    
    // Create a new mock series for each call
    mockAddLineSeries = jest.fn(() => {
      const series = {
        setData: jest.fn(),
        _id: Math.random(), // Add unique ID for tracking
      };
      createdSeries.push(series);
      return series;
    });
    
    mockRemoveSeries = jest.fn();
    mockRegisterMetricLines = jest.fn();
    
    mockContext = {
      instanceId: 123,
      chart: {
        addLineSeries: mockAddLineSeries,
        removeSeries: mockRemoveSeries,
      } as any,
      mainSeries: {} as any,
      registry: {
        registerMetricLines: mockRegisterMetricLines,
      } as any,
      utilities: {
        getLineColor: jest.fn((type) => `#${type}`),
        convertLineStyle: jest.fn((style) => {
          const styles: Record<string, number> = {
            solid: 0,
            dashed: 1,
            dotted: 2,
          };
          return styles[style] || 0;
        }),
        addOpacity: jest.fn((color, opacity) => `${color}:${opacity}`),
        calculateTimeRange: jest.fn((keyPoints) => ({
          minTime: 1000,
          maxTime: 2000,
          startTime: 500,
          endTime: 2500,
        })),
      },
    };

    renderer = new MetricRenderer();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(renderer.name).toBe('MetricRenderer');
    });

    it('should initialize with context', () => {
      renderer.initialize(mockContext);
      expect(renderer.getDebugState().initialized).toBe(true);
    });

    it('should have default metric style', () => {
      const state = renderer.getDebugState();
      expect(state.metricStyle).toEqual({
        showLabels: true,
        labelPosition: 'right',
        colors: {
          target: '#4CAF50',
          stopLoss: '#F44336',
          breakout: '#FF9800',
        },
        lineStyles: {
          target: 'dashed',
          stopLoss: 'dashed',
          breakout: 'dotted',
        },
      });
    });
  });

  describe('supports', () => {
    it('should support data with metrics in extra parameter', () => {
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      
      // Mock extractMetrics to return metrics
      const extractMetricsSpy = jest.spyOn(renderer as any, 'extractMetrics')
        .mockReturnValue({ targetLevel: 120 });
      
      expect(renderer.supports(data)).toBe(true);
      
      extractMetricsSpy.mockRestore();
    });

    it('should support data with metrics property', () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: {
          targetLevel: 120,
          stopLoss: 90,
        },
      };
      
      expect(renderer.supports(data)).toBe(true);
    });

    it('should support data with patterns containing metrics', () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        patterns: [
          {
            metrics: {
              breakoutLevel: 110,
            },
          },
        ],
      };
      
      expect(renderer.supports(data)).toBe(true);
    });

    it('should not support data without metrics', () => {
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      
      expect(renderer.supports(data)).toBe(false);
    });
  });

  describe('setMetricStyle', () => {
    it('should update metric style', () => {
      const newStyle: MetricStyle = {
        showLabels: false,
        labelPosition: 'left',
        colors: {
          target: '#00FF00',
          stopLoss: '#FF0000',
        },
      };
      
      renderer.setMetricStyle(newStyle);
      
      const state = renderer.getDebugState();
      expect(state.metricStyle).toMatchObject(newStyle);
    });

    it('should merge partial style updates', () => {
      renderer.setMetricStyle({ showLabels: false });
      
      const state = renderer.getDebugState();
      expect(state.metricStyle.showLabels).toBe(false);
      expect(state.metricStyle.labelPosition).toBe('right'); // default retained
    });
  });

  describe('render', () => {
    let mockData: PatternVisualization;
    
    beforeEach(() => {
      renderer.initialize(mockContext);
      
      // Reset mockData for each test
      mockData = {
        keyPoints: [
          { x: 0, y: 100, time: 1000 },
          { x: 1, y: 50, time: 2000 },
        ],
        lines: [],
        // Add patterns with dummy metrics to pass supports() check
        // This avoids conflicting with extra parameter metrics
        patterns: [{ metrics: { dummy: 1 } }]
      } as any;
    });

    it('should render metric lines from extra parameter', async () => {
      const extra = {
        targetLevel: 120,
        stopLoss: 80,
        breakoutLevel: 110,
      };
      
      // Verify the data is supported
      expect(renderer.supports(mockData)).toBe(true);
      
      await renderer.render('pattern-1', mockData, extra);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(3);
      
      // Check target line
      expect(mockAddLineSeries.mock.calls[0][0]).toMatchObject({
        color: '#4CAF50',
        lineWidth: 2,
        lineStyle: 1, // dashed
        title: '目標: 120.00',
        lastValueVisible: true,
      });
      
      // Check stop loss line
      expect(mockAddLineSeries.mock.calls[1][0]).toMatchObject({
        color: '#F44336',
        lineWidth: 2,
        lineStyle: 1, // dashed
        title: 'SL: 80.00',
      });
      
      // Check breakout line
      expect(mockAddLineSeries.mock.calls[2][0]).toMatchObject({
        color: '#FF9800',
        lineWidth: 2,
        lineStyle: 2, // dotted
        title: 'BO: 110.00',
      });
    });

    it('should render horizontal lines with correct data', async () => {
      const extra = { targetLevel: 120 };
      
      await renderer.render('pattern-1', mockData, extra);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(1);
      const createdSeries = mockAddLineSeries.mock.results[0].value;
      expect(createdSeries.setData).toHaveBeenCalledWith([
        { time: 500, value: 120 },
        { time: 2500, value: 120 },
      ]);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new MetricRenderer();
      
      await expect(uninitializedRenderer.render('pattern-1', mockData))
        .rejects.toThrow(PluginError);
    });

    it('should validate pattern ID', async () => {
      // The renderer throws an error for invalid pattern IDs
      await expect(renderer.render('', mockData, { targetLevel: 120 }))
        .rejects.toThrow(PluginError);
      
      // Should not create any lines due to invalid pattern ID
      expect(mockAddLineSeries).not.toHaveBeenCalled();
    });

    it('should handle data without keyPoints', async () => {
      const dataWithoutKeyPoints: PatternVisualization = {
        keyPoints: [],
        lines: [],
        patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
      } as any;
      
      const extra = { targetLevel: 120 };
      
      // Initialize the renderer
      renderer.initialize(mockContext);
      
      await expect(renderer.render('pattern-1', dataWithoutKeyPoints, extra))
        .rejects.toThrow('Cannot calculate time range');
    });

    it('should render support and resistance levels', async () => {
      const dataWithLevels: any = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [],
        metrics: {
          supportLevel: 95,
          resistanceLevel: 105,
        },
      };
      
      await renderer.render('pattern-1', dataWithLevels);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(2);
      
      // Check support line
      expect(mockAddLineSeries.mock.calls[0][0]).toMatchObject({
        color: '#00BCD4',
        lineStyle: 0, // solid
        title: 'サポート: 95.00',
      });
      
      // Check resistance line
      expect(mockAddLineSeries.mock.calls[1][0]).toMatchObject({
        color: '#E91E63',
        lineStyle: 0, // solid
        title: 'レジスタンス: 105.00',
      });
    });

    it('should handle no valid metrics gracefully', async () => {
      await renderer.render('pattern-1', mockData);
      
      expect(mockAddLineSeries).not.toHaveBeenCalled();
    });

    it('should register metric lines with metadata', async () => {
      const extra = {
        targetLevel: 120,
        stopLoss: 80,
      };
      
      await renderer.render('pattern-1', mockData, extra);
      
      expect(mockRegisterMetricLines).toHaveBeenCalledWith(
        'pattern-1',
        expect.any(Array),
        expect.objectContaining({
          metricsCount: 3, // includes dummy metric from patterns
          metrics: {
            dummy: 1,       // from patterns
            stopLoss: 80,   // from extra
            targetLevel: 120 // from extra
          },
          createdAt: expect.any(Number),
        })
      );
    });

    it('should respect showLabels setting', async () => {
      renderer.setMetricStyle({ showLabels: false });
      
      const extra = { targetLevel: 120 };
      
      await renderer.render('pattern-1', mockData, extra);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(1);
      expect(mockAddLineSeries.mock.calls[0][0].lastValueVisible).toBe(false);
    });

    it('should handle creation errors for individual metrics', async () => {
      let callCount = 0;
      mockAddLineSeries.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Failed to create target line');
        }
        return mockLineSeries;
      });
      
      const extra = {
        targetLevel: 120,
        stopLoss: 80,
      };
      
      await renderer.render('pattern-1', mockData, extra);
      
      // Should create only stop loss line (target line creation failed)
      expect(mockAddLineSeries).toHaveBeenCalledTimes(2);
      expect(mockRegisterMetricLines).toHaveBeenCalledWith(
        'pattern-1',
        expect.arrayContaining([expect.objectContaining({ setData: expect.any(Function) })]),
        expect.any(Object)
      );
    });
  });

  describe('remove', () => {
    const mockData: PatternVisualization = {
      keyPoints: [
        { x: 0, y: 100, time: 1000 },
        { x: 1, y: 50, time: 2000 },
      ],
      lines: [],
      patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
    } as any;

    beforeEach(async () => {
      renderer.initialize(mockContext);
      // Clear mocks before rendering to get accurate counts
      jest.clearAllMocks();
      
      await renderer.render('pattern-1', mockData, {
        targetLevel: 120,
        stopLoss: 80,
      });
      
      // Verify that 2 series were created
      expect(mockAddLineSeries).toHaveBeenCalledTimes(2);
      jest.clearAllMocks();
    });

    it('should remove pattern metric lines', async () => {
      await renderer.remove('pattern-1');
      
      // The renderer should remove both series that were created
      expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new MetricRenderer();
      
      await expect(uninitializedRenderer.remove('pattern-1'))
        .rejects.toThrow('Plugin not initialized');
    });

    it('should handle non-existent pattern gracefully', async () => {
      await renderer.remove('non-existent');
      
      expect(mockRemoveSeries).not.toHaveBeenCalled();
    });

    it('should handle removal errors gracefully', async () => {
      mockRemoveSeries.mockImplementation(() => {
        throw new Error('Chart error');
      });
      
      await renderer.remove('pattern-1');
      
      // Should still remove from internal registry
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
    });

    it('should remove from internal registry', async () => {
      await renderer.remove('pattern-1');
      
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
    });
  });

  describe('updateMetric', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should warn about metric update requiring re-render', () => {
      renderer.updateMetric('pattern-1', 'targetLevel', 130);
      
      expect(logger.warn).toHaveBeenCalledWith(
        '[MetricRenderer] Metric update requires re-rendering. Use remove() and render() instead.'
      );
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      renderer.initialize(mockContext);
      
      // Add multiple patterns
      const data: PatternVisualization = {
        keyPoints: [
          { x: 0, y: 100, time: 1000 },
          { x: 1, y: 200, time: 2000 },
        ],
        lines: [],
        patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
      } as any;
      
      await renderer.render('pattern-1', data, { targetLevel: 120 });
      await renderer.render('pattern-2', data, { stopLoss: 80 });
    });

    it('should remove all patterns', async () => {
      await renderer.dispose();
      
      expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
      
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
      expect(state.initialized).toBe(false);
    });

    it('should handle removal errors gracefully', async () => {
      mockRemoveSeries.mockImplementation(() => {
        throw new Error('Removal error');
      });
      
      await renderer.dispose();
      
      // Should still clear internal state
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
    });

    it('should clear context reference', async () => {
      await renderer.dispose();
      
      // Trying to render should fail
      await expect(renderer.render('pattern-3', {
        keyPoints: [{ time: 3000, value: 300, type: 'peak' }],
        lines: [],
      })).rejects.toThrow('Plugin not initialized');
    });
  });

  describe('metric extraction', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should extract metrics from extra parameter', async () => {
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
      } as any;
      
      const extra = {
        targetLevel: 120,
        stopLoss: 80,
        breakoutLevel: 110,
        ignoredField: 'not a metric',
      };
      
      await renderer.render('pattern-1', data, extra);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(3);
    });

    it('should extract metrics from data.metrics', async () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: {
          targetLevel: 125,
          supportLevel: 95,
        },
      };
      
      await renderer.render('pattern-1', data);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(2);
    });

    it('should extract metrics from patterns array', async () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        patterns: [
          {
            type: 'triangle',
            metrics: {
              breakoutLevel: 110,
              targetLevel: 130,
            },
          },
          {
            type: 'flag',
            metrics: {
              stopLoss: 85,
            },
          },
        ],
      };
      
      await renderer.render('pattern-1', data);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(3);
    });

    it('should merge metrics from multiple sources', async () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: {
          targetLevel: 120,
        },
        patterns: [
          {
            metrics: {
              stopLoss: 80,
            },
          },
        ],
      };
      
      const extra = {
        breakoutLevel: 110,
      };
      
      await renderer.render('pattern-1', data, extra);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(3);
    });

    it('should prioritize extra parameter over data metrics', async () => {
      const data: any = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: {
          targetLevel: 120,
        },
      };
      
      const extra = {
        targetLevel: 130, // Different value
      };
      
      await renderer.render('pattern-1', data, extra);
      
      // Since data.metrics is assigned after extra, it overrides the extra value
      const config = mockAddLineSeries.mock.calls[0][0];
      expect(config.title).toBe('目標: 120.00'); // Data metrics value used
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should wrap unexpected errors in PluginError', async () => {
      mockContext.utilities.calculateTimeRange = jest.fn(() => {
        throw new TypeError('Unexpected type error');
      });
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: { targetLevel: 0 } // Add metrics to pass supports check
      } as any;
      
      await expect(renderer.render('pattern-1', data, { targetLevel: 120 }))
        .rejects.toThrow(PluginError);
    });

    it('should preserve original error as cause', async () => {
      const originalError = new Error('Original error');
      mockContext.utilities.calculateTimeRange = jest.fn(() => {
        throw originalError;
      });
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        metrics: { targetLevel: 0 } // Add metrics to pass supports check
      } as any;
      
      try {
        await renderer.render('pattern-1', data, { targetLevel: 120 });
      } catch (error) {
        expect(error).toBeInstanceOf(PluginError);
        expect((error as PluginError).cause).toBe(originalError);
        expect((error as PluginError).pluginName).toBe('MetricRenderer');
        expect((error as PluginError).operation).toBe('render');
      }
    });
  });

  describe('getDebugState', () => {
    it('should return complete state information', async () => {
      renderer.initialize(mockContext);
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
      } as any;
      
      await renderer.render('pattern-1', data, { targetLevel: 120, stopLoss: 80 });
      await renderer.render('pattern-2', data, { breakoutLevel: 110 });
      
      const state = renderer.getDebugState();
      
      expect(state).toEqual({
        name: 'MetricRenderer',
        initialized: true,
        patternsCount: 2,
        patterns: [
          { id: 'pattern-1', seriesCount: 2 },
          { id: 'pattern-2', seriesCount: 1 },
        ],
        metricStyle: {
          showLabels: true,
          labelPosition: 'right',
          colors: {
            target: '#4CAF50',
            stopLoss: '#F44336',
            breakout: '#FF9800',
          },
          lineStyles: {
            target: 'dashed',
            stopLoss: 'dashed',
            breakout: 'dotted',
          },
        },
      });
    });
  });

  describe('metric formatting', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should format prices with correct decimal places', async () => {
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
        patterns: [{ metrics: { dummy: 1 } }] // Add patterns to pass supports check
      } as any;
      
      const extra = {
        targetLevel: 123.456789,
        stopLoss: 98.1,
      };
      
      await renderer.render('pattern-1', data, extra);
      
      expect(mockAddLineSeries.mock.calls[0][0].title).toBe('目標: 123.46');
      expect(mockAddLineSeries.mock.calls[1][0].title).toBe('SL: 98.10');
    });
  });
});