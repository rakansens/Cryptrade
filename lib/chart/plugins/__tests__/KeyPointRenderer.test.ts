/**
 * KeyPointRenderer Plugin Tests
 * 
 * チャートプラグインのキーポイントレンダラーの包括的なテストスイート
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
  isDevelopment: jest.fn(() => false),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { KeyPointRenderer } from '../KeyPointRenderer';
import type { PluginContext, MarkerStyle } from '../interfaces';
import type { PatternVisualization } from '@/types/pattern';
import type { SeriesMarker, Time } from 'lightweight-charts';
import { PluginError } from '../interfaces';

describe('KeyPointRenderer', () => {
  let renderer: KeyPointRenderer;
  let mockContext: PluginContext;
  let mockSetMarkers: jest.Mock;
  let mockGetMarkers: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSetMarkers = jest.fn();
    mockGetMarkers = jest.fn(() => []);
    
    mockContext = {
      instanceId: 123,
      chart: {} as any,
      mainSeries: {
        setMarkers: mockSetMarkers,
        markers: mockGetMarkers,
      } as any,
      registry: {} as any,
      utilities: {
        getLineColor: jest.fn(() => '#000000'),
        convertLineStyle: jest.fn(() => 0),
        addOpacity: jest.fn((color, opacity) => `rgba(${color}, ${opacity})`),
        calculateTimeRange: jest.fn(() => ({
          minTime: 1000,
          maxTime: 2000,
          startTime: 500,
          endTime: 2500,
        })),
      },
    };

    renderer = new KeyPointRenderer();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(renderer.name).toBe('KeyPointRenderer');
    });

    it('should initialize with context', () => {
      renderer.initialize(mockContext);
      expect(renderer.getDebugState().initialized).toBe(true);
    });

    it('should have default marker style', () => {
      const state = renderer.getDebugState();
      expect(state.markerStyle).toEqual({
        shape: 'circle',
        color: '#2196F3',
        size: 8,
        text: {
          color: '#ffffff',
          fontSize: 12,
        },
      });
    });
  });

  describe('supports', () => {
    it('should support data with keyPoints', () => {
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 200, type: 'trough' },
        ],
        lines: [],
      };
      
      expect(renderer.supports(data)).toBe(true);
    });

    it('should not support data without keyPoints', () => {
      const data: PatternVisualization = {
        keyPoints: [],
        lines: [],
      };
      
      expect(renderer.supports(data)).toBe(false);
    });

    it('should not support data with invalid keyPoints', () => {
      const data: PatternVisualization = {
        keyPoints: null as any,
        lines: [],
      };
      
      expect(renderer.supports(data)).toBe(false);
    });
  });

  describe('setMarkerStyle', () => {
    it('should update marker style', () => {
      const newStyle: MarkerStyle = {
        shape: 'square',
        color: '#FF0000',
        size: 10,
      };
      
      renderer.setMarkerStyle(newStyle);
      
      const state = renderer.getDebugState();
      expect(state.markerStyle).toMatchObject(newStyle);
    });

    it('should merge partial style updates', () => {
      renderer.setMarkerStyle({ color: '#00FF00' });
      
      const state = renderer.getDebugState();
      expect(state.markerStyle.color).toBe('#00FF00');
      expect(state.markerStyle.shape).toBe('circle'); // default retained
    });
  });

  describe('render', () => {
    const mockData: PatternVisualization = {
      keyPoints: [
        { time: 1000, value: 100, type: 'peak', label: 'HIGH' },
        { time: 2000, value: 50, type: 'trough', label: 'LOW' },
        { time: 3000, value: 150, type: 'peak' },
      ],
      lines: [],
    };

    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should render keypoints as markers', async () => {
      await renderer.render('pattern-1', mockData);
      
      expect(mockSetMarkers).toHaveBeenCalledTimes(1);
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers).toHaveLength(3);
      
      // Check first marker
      expect(markers[0]).toMatchObject({
        time: 1000,
        position: 'aboveBar',
        text: 'HIGH',
        shape: 'arrowUp',
      });
      
      // Check second marker
      expect(markers[1]).toMatchObject({
        time: 2000,
        position: 'aboveBar',
        text: 'LOW',
        shape: 'arrowDown',
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new KeyPointRenderer();
      
      await expect(uninitializedRenderer.render('pattern-1', mockData))
        .rejects.toThrow(PluginError);
    });

    it('should validate pattern ID', async () => {
      await expect(renderer.render('', mockData))
        .rejects.toThrow('Invalid pattern ID');
      
      await expect(renderer.render('invalid id!', mockData))
        .rejects.toThrow('Invalid pattern ID');
    });

    it('should validate keyPoints data', async () => {
      const invalidData: PatternVisualization = {
        keyPoints: [
          { time: 'invalid' as any, value: 100, type: 'peak' },
        ],
        lines: [],
      };
      
      await expect(renderer.render('pattern-1', invalidData))
        .rejects.toThrow('Invalid key points data');
    });

    it('should handle existing markers', async () => {
      const existingMarkers = [
        { time: 500 as Time, position: 'aboveBar' as const, shape: 'circle' as const },
      ];
      mockGetMarkers.mockReturnValue(existingMarkers);
      
      await renderer.render('pattern-1', mockData);
      
      const allMarkers = mockSetMarkers.mock.calls[0][0];
      expect(allMarkers).toHaveLength(4); // 1 existing + 3 new
      expect(allMarkers[0]).toEqual(existingMarkers[0]);
    });

    it('should generate default labels when not provided', async () => {
      const dataWithoutLabels: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [],
      };
      
      await renderer.render('pattern-1', dataWithoutLabels);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[0].text).toBe('A');
      expect(markers[1].text).toBe('B');
    });

    it('should apply color based on label keywords', async () => {
      const dataWithKeywords: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak', label: 'RESISTANCE POINT' },
          { time: 2000, value: 50, type: 'trough', label: 'SUPPORT LEVEL' },
          { time: 3000, value: 75, type: 'peak', label: 'BREAKOUT' },
        ],
        lines: [],
      };
      
      await renderer.render('pattern-1', dataWithKeywords);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[0].color).toBe('#E91E63'); // RESISTANCE
      expect(markers[1].color).toBe('#00BCD4'); // SUPPORT
      expect(markers[2].color).toBe('#FF9800'); // BREAK
    });

    it('should normalize timestamps', async () => {
      const dataWithVariousTimestamps: PatternVisualization = {
        keyPoints: [
          { time: 1234567890, value: 100, type: 'peak' }, // Unix seconds
          { time: 1234567890000, value: 50, type: 'trough' }, // Unix milliseconds
        ],
        lines: [],
      };
      
      await renderer.render('pattern-1', dataWithVariousTimestamps);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[0].time).toBe(1234567890);
      expect(markers[1].time).toBe(1234567890); // Converted from ms to s
    });

    it('should skip invalid keypoints', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const dataWithMixedValidity: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          null as any, // Invalid
          { time: 2000, value: 50, type: 'trough' },
        ],
        lines: [],
      };
      
      // This should throw due to validation
      await expect(renderer.render('pattern-1', dataWithMixedValidity))
        .rejects.toThrow('Invalid key points data');
      
      consoleSpy.mockRestore();
    });

    it('should handle empty keyPoints after creation', async () => {
      const emptyData: PatternVisualization = {
        keyPoints: [],
        lines: [],
      };
      
      await renderer.render('pattern-1', emptyData);
      
      // Should not call setMarkers if no markers created
      expect(mockSetMarkers).not.toHaveBeenCalled();
    });

    it('should store markers in registry', async () => {
      await renderer.render('pattern-1', mockData);
      
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(1);
      expect(state.patterns[0]).toEqual({
        id: 'pattern-1',
        markersCount: 3,
      });
    });
  });

  describe('remove', () => {
    const mockData: PatternVisualization = {
      keyPoints: [
        { time: 1000, value: 100, type: 'peak' },
        { time: 2000, value: 50, type: 'trough' },
      ],
      lines: [],
    };

    beforeEach(async () => {
      renderer.initialize(mockContext);
      await renderer.render('pattern-1', mockData);
    });

    it('should remove pattern markers', async () => {
      const renderedMarkers = mockSetMarkers.mock.calls[0][0];
      mockGetMarkers.mockReturnValue(renderedMarkers);
      
      await renderer.remove('pattern-1');
      
      expect(mockSetMarkers).toHaveBeenCalledTimes(2); // Once for render, once for remove
      const remainingMarkers = mockSetMarkers.mock.calls[1][0];
      expect(remainingMarkers).toHaveLength(0);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedRenderer = new KeyPointRenderer();
      
      await expect(uninitializedRenderer.remove('pattern-1'))
        .rejects.toThrow('Plugin not initialized');
    });

    it('should handle non-existent pattern gracefully', async () => {
      await renderer.remove('non-existent');
      
      // Should not throw, just log debug
      expect(mockSetMarkers).toHaveBeenCalledTimes(1); // Only from render
    });

    it('should preserve other pattern markers', async () => {
      // Add another pattern
      const otherData: PatternVisualization = {
        keyPoints: [
          { time: 3000, value: 200, type: 'peak' },
        ],
        lines: [],
      };
      await renderer.render('pattern-2', otherData);
      
      // Get all markers
      const allMarkers = mockSetMarkers.mock.calls[1][0];
      mockGetMarkers.mockReturnValue(allMarkers);
      
      // Remove first pattern
      await renderer.remove('pattern-1');
      
      const remainingMarkers = mockSetMarkers.mock.calls[2][0];
      expect(remainingMarkers).toHaveLength(1);
      expect(remainingMarkers[0].time).toBe(3000);
    });

    it('should remove from internal registry', async () => {
      await renderer.remove('pattern-1');
      
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
    });

    it('should handle errors during removal', async () => {
      mockSetMarkers.mockImplementation(() => {
        throw new Error('Chart error');
      });
      
      await expect(renderer.remove('pattern-1'))
        .rejects.toThrow('Failed to remove markers');
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      renderer.initialize(mockContext);
      
      // Add multiple patterns
      const data1: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      const data2: PatternVisualization = {
        keyPoints: [{ time: 2000, value: 200, type: 'peak' }],
        lines: [],
      };
      
      await renderer.render('pattern-1', data1);
      await renderer.render('pattern-2', data2);
    });

    it('should remove all patterns', async () => {
      await renderer.dispose();
      
      const state = renderer.getDebugState();
      expect(state.patternsCount).toBe(0);
      expect(state.initialized).toBe(false);
    });

    it('should handle removal errors gracefully', async () => {
      // Make remove fail for one pattern
      let callCount = 0;
      mockSetMarkers.mockImplementation(() => {
        callCount++;
        if (callCount === 3) { // Third call is first removal
          throw new Error('Removal error');
        }
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

  describe('marker generation', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should generate markers with proper shapes based on labels', async () => {
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak', label: 'UP TREND' },
          { time: 2000, value: 50, type: 'trough', label: 'DOWN MOVE' },
          { time: 3000, value: 75, type: 'peak', label: 'BREAKOUT POINT' },
          { time: 4000, value: 80, type: 'peak', label: 'TARGET REACHED' },
        ],
        lines: [],
      };
      
      await renderer.render('pattern-1', data);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[0].shape).toBe('arrowUp');
      expect(markers[1].shape).toBe('arrowDown');
      expect(markers[2].shape).toBe('square');
      expect(markers[3].shape).toBe('square');
    });

    it('should use palette colors for unlabeled points', async () => {
      const data: PatternVisualization = {
        keyPoints: [
          { time: 1000, value: 100, type: 'peak' },
          { time: 2000, value: 50, type: 'trough' },
          { time: 3000, value: 75, type: 'peak' },
          { time: 4000, value: 80, type: 'peak' },
          { time: 5000, value: 85, type: 'peak' },
        ],
        lines: [],
      };
      
      await renderer.render('pattern-1', data);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      // Colors from palette
      expect(markers[0].color).toBe('#4CAF50');
      expect(markers[1].color).toBe('#2196F3');
      expect(markers[2].color).toBe('#FF9800');
      expect(markers[3].color).toBe('#9C27B0');
      expect(markers[4].color).toBe('#F44336');
    });

    it('should generate overflow labels correctly', async () => {
      const manyPoints = Array.from({ length: 10 }, (_, i) => ({
        time: 1000 + i * 1000,
        value: 100 + i * 10,
        type: 'peak' as const,
      }));
      
      const data: PatternVisualization = {
        keyPoints: manyPoints,
        lines: [],
      };
      
      await renderer.render('pattern-1', data);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[8].text).toBe('P9'); // After H, use P notation
      expect(markers[9].text).toBe('P10');
    });

    it('should respect marker size setting', async () => {
      renderer.setMarkerStyle({ size: 12 });
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      
      await renderer.render('pattern-1', data);
      
      const markers = mockSetMarkers.mock.calls[0][0];
      expect(markers[0].size).toBe(12);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      renderer.initialize(mockContext);
    });

    it('should wrap unexpected errors in PluginError', async () => {
      mockSetMarkers.mockImplementation(() => {
        throw new TypeError('Unexpected type error');
      });
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      
      await expect(renderer.render('pattern-1', data))
        .rejects.toThrow(PluginError);
    });

    it('should preserve original error as cause', async () => {
      const originalError = new Error('Original error');
      mockSetMarkers.mockImplementation(() => {
        throw originalError;
      });
      
      const data: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      
      try {
        await renderer.render('pattern-1', data);
      } catch (error) {
        expect(error).toBeInstanceOf(PluginError);
        expect((error as PluginError).cause).toBe(originalError);
        expect((error as PluginError).pluginName).toBe('KeyPointRenderer');
        expect((error as PluginError).operation).toBe('render');
      }
    });
  });

  describe('getDebugState', () => {
    it('should return complete state information', async () => {
      renderer.initialize(mockContext);
      
      const data1: PatternVisualization = {
        keyPoints: [{ time: 1000, value: 100, type: 'peak' }],
        lines: [],
      };
      const data2: PatternVisualization = {
        keyPoints: [{ time: 2000, value: 200, type: 'peak' }],
        lines: [],
      };
      
      await renderer.render('pattern-1', data1);
      await renderer.render('pattern-2', data2);
      
      const state = renderer.getDebugState();
      
      expect(state).toEqual({
        name: 'KeyPointRenderer',
        initialized: true,
        patternsCount: 2,
        patterns: [
          { id: 'pattern-1', markersCount: 1 },
          { id: 'pattern-2', markersCount: 1 },
        ],
        markerStyle: {
          shape: 'circle',
          color: '#2196F3',
          size: 8,
          text: {
            color: '#ffffff',
            fontSize: 12,
          },
        },
      });
    });
  });
});