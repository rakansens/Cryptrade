/**
 * LineRenderer Plugin Tests
 * 
 * チャートプラグインのラインレンダラーの包括的なテストスイート
 */

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/config/env', () => ({
  isDevelopment: jest.fn(() => true),
}));

// Mock utils module
jest.mock('@/lib/chart/plugins/utils', () => ({
  ValidationUtils: {
    validateLines: jest.fn(() => true),
    validatePatternId: jest.fn(() => true),
    validateVisualization: jest.fn(() => true),
  },
  ColorUtils: {
    getLineColorPalette: jest.fn(() => ['#E91E63', '#2196F3', '#4CAF50']),
    getFromPalette: jest.fn((index) => {
      const palette = ['#E91E63', '#2196F3', '#4CAF50'];
      return palette[index % palette.length];
    }),
  },
  TimeUtils: {
    normalizeTime: jest.fn((time) => {
      // Convert milliseconds to seconds if needed
      if (time > 10000000000) {
        return Math.floor(time / 1000);
      }
      return time;
    }),
  },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LineRenderer } from '@/lib/chart/plugins/LineRenderer';
import type { PluginContext, LineStyle } from '@/lib/chart/plugins/interfaces';
import type { PatternVisualization } from '@/types/pattern';
import type { ISeriesApi, SeriesType } from 'lightweight-charts';
import { PluginError } from '@/lib/chart/plugins/interfaces';
import { ValidationUtils, ColorUtils, TimeUtils } from '@/lib/chart/plugins/utils';
import { logger } from '@/lib/utils/logger';

describe('LineRenderer', () => {
  let renderer: LineRenderer;
  let mockContext: PluginContext;
  let mockAddLineSeries: jest.Mock;
  let mockRemoveSeries: jest.Mock;
  let mockLineSeries: ISeriesApi<SeriesType>;
  let mockRegisterSeries: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLineSeries = {
      setData: jest.fn(),
    } as any;
    
    mockAddLineSeries = jest.fn(() => mockLineSeries);
    mockRemoveSeries = jest.fn();
    mockRegisterSeries = jest.fn();
    
    mockContext = {
      instanceId: 123,
      chart: {
        addLineSeries: mockAddLineSeries,
        removeSeries: mockRemoveSeries,
      } as any,
      mainSeries: {} as any,
      registry: {
        registerSeries: mockRegisterSeries,
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
        calculateTimeRange: jest.fn(() => ({
          minTime: 1000,
          maxTime: 2000,
          startTime: 500,
          endTime: 2500,
        })),
      },
    };

    renderer = new LineRenderer();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(renderer.name).toBe('LineRenderer');
    });

    it('should initialize with context', () => {
      renderer.initialize(mockContext);
      expect(renderer.getDebugState().initialized).toBe(true);
    });

    it('should have default line style', () => {
      const state = renderer.getDebugState();
      expect(state.lineStyle).toEqual({
        color: '#2196F3',
        width: 2,
        style: 'solid',
        opacity: 1.0,
      });
    });
  });

  describe('supports', () => {
    it('should support data with lines', () => {
      const data: PatternVisualization = {
        keyPoints: [],
        lines: [
          { from: 0, to: 1, type: 'resistance' },
        ],
      };
      
      expect(renderer.supports(data)).toBe(true);
    });

    it('should not support data without lines', () => {
      const data: PatternVisualization = {
        keyPoints: [],
        lines: [],
      };
      
      expect(renderer.supports(data)).toBe(false);
    });

    it('should not support data with invalid lines', () => {
      const data: PatternVisualization = {
        keyPoints: [],
        lines: null as any,
      };
      
      expect(renderer.supports(data)).toBe(false);
    });
  });

  describe('setLineStyle', () => {
    it('should update line style', () => {
      const newStyle: LineStyle = {
        color: '#FF0000',
        width: 3,
        style: 'dashed',
        opacity: 0.8,
      };
      
      renderer.setLineStyle(newStyle);
      
      const state = renderer.getDebugState();
      expect(state.lineStyle).toEqual(newStyle);
    });

    it('should merge partial style updates', () => {
      renderer.setLineStyle({ color: '#00FF00' });
      
      const state = renderer.getDebugState();
      expect(state.lineStyle.color).toBe('#00FF00');
      expect(state.lineStyle.width).toBe(2); // default retained
    });
  });

  describe('render', () => {
    // TODO: Fix test data format to match LineRenderer expectations
    // The current test data uses from/to indexes which don't match the actual implementation
    const mockData: PatternVisualization = {
      keyPoints: [
        { time: 1000, value: 100, type: 'peak' },
        { time: 2000, value: 50, type: 'trough' },
        { time: 3000, value: 150, type: 'peak' },
      ],
      lines: [
        { from: 0, to: 2, type: 'resistance' },
        { from: 1, to: 2, type: 'support' },
      ],
    };

    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should render lines as series', async () => {
      // ValidationUtils is already mocked to return true
      
      await renderer.render('pattern-1', mockData);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(2);
      expect(mockLineSeries.setData).toHaveBeenCalledTimes(2);
      
      // Check first line series config
      const firstConfig = mockAddLineSeries.mock.calls[0]?.[0];
      expect(firstConfig).toBeDefined();
      expect(firstConfig).toMatchObject({
        color: expect.any(String),
        lineWidth: expect.any(Number),
        lineStyle: expect.any(Number),
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: expect.any(String),
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new LineRenderer();
      
      await expect(uninitializedRenderer.render('pattern-1', mockData))
        .rejects.toThrow(PluginError);
    });

    it('should validate pattern ID', async () => {
      // Mock validatePatternId to return false for empty string
      (ValidationUtils.validatePatternId as jest.Mock).mockReturnValueOnce(false);
      
      await expect(renderer.render('', mockData))
        .rejects.toThrow('Invalid pattern ID');
    });

    it('should validate lines data', async () => {
      const invalidData: PatternVisualization = {
        keyPoints: [],
        lines: [
          { points: [0] } as any, // Invalid format for validation
        ],
      };
      
      // Mock validateLines to return false for this test
      (ValidationUtils.validateLines as jest.Mock).mockReturnValueOnce(false);
      
      await expect(renderer.render('pattern-1', invalidData))
        .rejects.toThrow('Invalid lines data');
    });

    it('should handle lines with style properties', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithStyles: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [
          { 
            from: 0, 
            to: 1, 
            type: 'resistance',
            style: { color: '#FF0000', width: 3, style: 'dashed' }
          } as any,
        ],
      };
      
      await renderer.render('pattern-1', dataWithStyles);
      
      const config = mockAddLineSeries.mock.calls[0][0];
      expect(config.color).toBe('#FF0000');
      expect(config.lineWidth).toBe(3);
      expect(config.lineStyle).toBe(1); // dashed
    });

    it('should apply type-based styles', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithTypes: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'trendline' as any },
          { from: 0, to: 1, type: 'support' as any },
          { from: 0, to: 1, type: 'fibonacci' as any },
        ],
      };
      
      await renderer.render('pattern-1', dataWithTypes);
      
      expect(mockAddLineSeries).toHaveBeenCalledTimes(3);
      
      // Check trendline style
      expect(mockAddLineSeries.mock.calls[0][0].color).toBe('#4CAF50');
      
      // Check support style
      expect(mockAddLineSeries.mock.calls[1][0].color).toBe('#00BCD4');
      expect(mockAddLineSeries.mock.calls[1][0].lineStyle).toBe(1); // dashed
      
      // Check fibonacci style
      expect(mockAddLineSeries.mock.calls[2][0].color).toBe('#9C27B0');
      expect(mockAddLineSeries.mock.calls[2][0].lineStyle).toBe(2); // dotted
    });

    it('should handle legacy points array format', async () => {
      // ValidationUtils is already mocked to return true
      
      const legacyData: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
          { time: 3000, value: 150, type: 'peak' },
        ],
        lines: [
          { points: [0, 1, 2] } as any,
        ],
      };
      
      await renderer.render('pattern-1', legacyData);
      
      expect(mockLineSeries.setData).toHaveBeenCalledWith([
        { time: 1000, value: 100 },
        { time: 2000, value: 50 },
        { time: 3000, value: 150 },
      ]);
    });

    it('should extend lines when specified', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithExtend: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, extend: true } as any,
        ],
      };
      
      await renderer.render('pattern-1', dataWithExtend);
      
      const lineData = (mockLineSeries.setData as jest.Mock).mock.calls[0][0];
      expect(lineData).toHaveLength(4); // 2 original + 2 extended points
      
      // Check extended points
      expect(lineData[0].time).toBeLessThan(1000);
      expect(lineData[3].time).toBeGreaterThan(2000);
    });

    it('should skip lines with insufficient data', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithInvalidLine: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
        ],
        lines: [
          { from: 0, to: 1 }, // Invalid: point 1 doesn't exist
          { points: [5, 6] } as any, // Invalid: points don't exist
        ],
      };
      
      // Mock console.warn to suppress warnings in test output
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await renderer.render('pattern-1', dataWithInvalidLine);
      
      expect(mockAddLineSeries).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[LineRenderer] No lines created'),
        expect.objectContaining({ id: 'pattern-1' })
      );
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });

    it('should register series with metadata', async () => {
      // ValidationUtils is already mocked to return true
      
      await renderer.render('pattern-1', mockData);
      
      expect(mockRegisterSeries).toHaveBeenCalledWith(
        'pattern-1',
        expect.any(Array),
        'line',
        expect.objectContaining({
          linesCount: 2,
          createdAt: expect.any(Number),
        })
      );
    });

    it('should generate appropriate titles', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithLabels: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'trendline', label: 'Main Trend' } as any,
          { from: 0, to: 1, type: 'support' } as any,
        ],
      };
      
      await renderer.render('pattern-1', dataWithLabels);
      
      expect(mockAddLineSeries.mock.calls[0][0].title).toBe('Main Trend');
      expect(mockAddLineSeries.mock.calls[1][0].title).toBe('サポートライン');
    });

    it('should normalize timestamps', async () => {
      // ValidationUtils is already mocked to return true
      
      const dataWithMilliseconds: PatternVisualization = {
        keyPoints: [
          { time: 1234567890000, value: 100, type: 'peak' }, // milliseconds
          { time: 1234567900000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'resistance' },
        ],
      };
      
      await renderer.render('pattern-1', dataWithMilliseconds);
      
      const lineData = (mockLineSeries.setData as jest.Mock).mock.calls[0][0];
      expect(lineData[0].time).toBe(1234567890); // Converted to seconds
      expect(lineData[1].time).toBe(1234567900);
    });
  });

  describe('remove', () => {
    // TODO: Skipped due to render tests being skipped
    const mockData: PatternVisualization = {
      keyPoints: [
        { time: 1000, value: 100, type: 'peak' },
        { time: 2000, value: 50, type: 'trough' },
      ],
      lines: [
        { from: 0, to: 1, type: 'resistance' },
      ],
    };

    beforeEach(async () => {
      renderer.initialize(mockContext);
      // ValidationUtils is already mocked to return true
      await renderer.render('pattern-1', mockData);
    });

    it('should remove pattern lines', async () => {
      await renderer.remove('pattern-1');
      
      expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
      expect(mockRemoveSeries).toHaveBeenCalledWith(mockLineSeries);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new LineRenderer();
      
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

  describe('updateLineColors', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should warn about color update requiring re-render', async () => {
      // First render a pattern to have something to update
      const mockData: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'resistance' },
        ],
      };
      
      await renderer.render('pattern-1', mockData);
      
      // Now try to update colors
      renderer.updateLineColors('pattern-1', {
        line1: '#FF0000',
        line2: '#00FF00',
      });
      
      // Should log warning about re-rendering
      expect(logger.warn).toHaveBeenCalledWith(
        '[LineRenderer] Color update requires re-rendering. Use remove() and render() instead.'
      );
    });

    it('should warn if pattern not found', () => {
      renderer.updateLineColors('non-existent', {
        line1: '#FF0000',
      });
      
      expect(require('@/lib/utils/logger').logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pattern not found'),
        expect.any(Object)
      );
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      renderer.initialize(mockContext);
      // ValidationUtils is already mocked to return true
      
      // Add multiple patterns
      const data1: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'peak' },
        ],
        lines: [{ from: 0, to: 1, type: 'resistance' }],
      };
      
      const data2: PatternVisualization = {
        keyPoints: [
          { time: 3000, value: 300, type: 'peak' },
          { time: 4000, value: 400, type: 'peak' },
        ],
        lines: [{ from: 0, to: 1, type: 'support' }],
      };
      
      await renderer.render('pattern-1', data1);
      await renderer.render('pattern-2', data2);
    });

    it('should remove all patterns', async () => {
      // TODO: This test depends on patterns being rendered, which is skipped
      // The beforeEach tries to render patterns but render functionality is skipped
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
        keyPoints: [
          { time: 5000, value: 500, type: 'peak' },
          { time: 6000, value: 600, type: 'peak' },
        ],
        lines: [{ from: 0, to: 1, type: 'resistance' }],
      })).rejects.toThrow('Plugin not initialized');
    });
  });

  describe('line data generation', () => {
    // TODO: Skipped due to render tests being skipped
    beforeEach(() => {
      renderer.initialize(mockContext);
      // ValidationUtils is already mocked to return true
    });

    it('should sort line data by time', async () => {
      const data: PatternVisualization = {
        keyPoints: [
          { time: 2000, value: 200, type: 'peak' },
          { time: 1000, value: 100, type: 'trough' },
          { time: 3000, value: 300, type: 'peak' },
        ],
        lines: [
          { points: [1, 0, 2] } as any, // Unordered points
        ],
      };
      
      await renderer.render('pattern-1', data);
      
      const lineData = (mockLineSeries.setData as jest.Mock).mock.calls[0][0];
      expect(lineData[0].time).toBe(1000);
      expect(lineData[1].time).toBe(2000);
      expect(lineData[2].time).toBe(3000);
    });

    it('should calculate proper extension for lines', async () => {
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, extend: true } as any,
        ],
      };
      
      await renderer.render('pattern-1', data);
      
      const lineData = (mockLineSeries.setData as jest.Mock).mock.calls[0][0];
      
      // Check extension calculation (30% of range)
      const timeRange = 2000 - 1000;
      const extension = timeRange * 0.3;
      
      expect(lineData[0].time).toBe(1000 - extension);
      expect(lineData[3].time).toBe(2000 + extension);
      
      // Check slope calculation
      const slope = (200 - 100) / (2000 - 1000);
      expect(lineData[0].value).toBeCloseTo(100 - slope * extension);
      expect(lineData[3].value).toBeCloseTo(200 + slope * extension);
    });

    it('should use palette colors when no style specified', async () => {
      // Override the default line style to have no color
      renderer.setLineStyle({ color: undefined as any, width: 2, style: 'solid', opacity: 1 });
      
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1 } as any, // No type or style
          { from: 0, to: 1 } as any,
          { from: 0, to: 1 } as any,
        ],
      };
      
      await renderer.render('pattern-1', data);
      
      // Verify ColorUtils.getFromPalette was called for each line
      expect(ColorUtils.getFromPalette).toHaveBeenCalledTimes(3);
      expect(ColorUtils.getFromPalette).toHaveBeenCalledWith(0);
      expect(ColorUtils.getFromPalette).toHaveBeenCalledWith(1);
      expect(ColorUtils.getFromPalette).toHaveBeenCalledWith(2);
      
      // Check palette colors are used
      expect(mockAddLineSeries.mock.calls[0][0].color).toBe('#E91E63'); // First color from palette
      expect(mockAddLineSeries.mock.calls[1][0].color).toBe('#2196F3'); // Second color from palette
      expect(mockAddLineSeries.mock.calls[2][0].color).toBe('#4CAF50'); // Third color from palette
    });
  });

  describe('error handling', () => {
    // TODO: Skipped due to render tests being skipped
    beforeEach(() => {
      renderer.initialize(mockContext);
      // ValidationUtils is already mocked to return true
    });

    it('should wrap unexpected errors in PluginError', async () => {
      // Mock validateLines to throw an unexpected error
      (ValidationUtils.validateLines as jest.Mock).mockImplementation(() => {
        throw new TypeError('Unexpected type error');
      });
      
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [{ from: 0, to: 1, type: 'resistance' }],
      };
      
      await expect(renderer.render('pattern-1', data))
        .rejects.toThrow(PluginError);
      
      // Restore the mock
      (ValidationUtils.validateLines as jest.Mock).mockReturnValue(true);
    });

    it('should handle errors in individual line creation', async () => {
      let callCount = 0;
      mockAddLineSeries.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First line fails');
        }
        return mockLineSeries;
      });
      
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'resistance' },
          { from: 0, to: 1, type: 'support' },
        ],
      };
      
      await renderer.render('pattern-1', data);
      
      // Should create only the second line
      expect(mockRegisterSeries).toHaveBeenCalledWith(
        'pattern-1',
        expect.arrayContaining([mockLineSeries]),
        'line',
        expect.any(Object)
      );
    });
  });

  describe('getDebugState', () => {
    // TODO: Skipped due to render tests being skipped
    it('should return complete state information', async () => {
      renderer.initialize(mockContext);
      // ValidationUtils is already mocked to return true
      
      const data1: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [{ from: 0, to: 1, type: 'resistance' }],
      };
      
      const data2: PatternVisualization = {
        keyPoints: [
          { time: 3000, value: 300, type: 'peak' },
          { time: 4000, value: 400, type: 'trough' },
        ],
        lines: [
          { from: 0, to: 1, type: 'support' },
          { from: 0, to: 1, type: 'trendline' },
        ],
      };
      
      await renderer.render('pattern-1', data1);
      await renderer.render('pattern-2', data2);
      
      const state = renderer.getDebugState();
      
      expect(state).toEqual({
        name: 'LineRenderer',
        initialized: true,
        patternsCount: 2,
        patterns: [
          { id: 'pattern-1', seriesCount: 1 },
          { id: 'pattern-2', seriesCount: 2 },
        ],
        lineStyle: {
          color: '#2196F3',
          width: 2,
          style: 'solid',
          opacity: 1.0,
        },
      });
    });
  });
});