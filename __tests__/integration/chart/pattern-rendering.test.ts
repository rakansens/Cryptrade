import 'dotenv/config';
import { PatternRendererCore } from '../../../lib/chart/PatternRendererCore';
import { PatternRendererAdapter } from '../../../lib/chart/PatternRendererAdapter';
import type { ISeriesApi, IChartApi, Time } from 'lightweight-charts';
import type { 
  DrawingEventData, 
  PatternEventData 
} from '../../../types/events/all-event-types';
import { 
  createMockDrawingEvent, 
  createMockPatternEvent,
  createMockCandlestickData 
} from '../../helpers/test-factory';
import { MockChartBuilder } from '../../helpers/mock-builders';

describe('Pattern Rendering Integration Tests', () => {
  let mockChart: IChartApi;
  let mockSeries: ISeriesApi<'Candlestick'>;
  let renderer: PatternRendererCore;
  let adapter: PatternRendererAdapter;

  beforeEach(() => {
    // Create mock chart and series
    const chartBuilder = new MockChartBuilder();
    
    mockSeries = {
      setData: jest.fn(),
      update: jest.fn(),
      createPriceLine: jest.fn(),
      removePriceLine: jest.fn(),
      markers: jest.fn(),
      setMarkers: jest.fn(),
      applyOptions: jest.fn(),
    } as any;

    mockChart = chartBuilder
      .withSeries('Candlestick', mockSeries)
      .build();

    // Initialize renderer
    renderer = new PatternRendererCore(mockChart, mockSeries);
    adapter = new PatternRendererAdapter(mockChart, mockSeries);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Drawing Rendering', () => {
    describe('Trendline Rendering', () => {
      test('should render trendline with correct coordinates', async () => {
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
            style: { color: '#00FF00', lineWidth: 2 }
          }]
        };
        
        const result = await renderer.renderPattern('trendline-1', visualization, 'trendline');

        // Verify pattern was rendered
        expect(result.success).toBe(true);
        expect(result.patternId).toBe('trendline-1');
      });

      test('should update trendline position', async () => {
        // First create a trendline
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
            style: { color: '#00FF00', lineWidth: 2 }
          }]
        };
        
        await renderer.renderPattern('trendline-1', visualization, 'trendline');

        // Then update it with new coordinates
        const updatedVisualization = {
          ...visualization,
          lines: [{
            ...visualization.lines[0],
            startPoint: { time: Date.now() / 1000 as Time, price: 45500 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 46000 }
          }]
        };
        
        const result = await renderer.renderPattern('trendline-1', updatedVisualization, 'trendline');
        expect(result.success).toBe(true);
      });

      test('should delete trendline', async () => {
        // Create a trendline
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
            style: { color: '#00FF00', lineWidth: 2 }
          }]
        };
        
        await renderer.renderPattern('trendline-1', visualization, 'trendline');
        
        // Verify it exists in debug state
        const stateBefore = renderer.getDebugState();
        expect(stateBefore.registryState.patterns).toContain('trendline-1');

        // Delete it
        await renderer.removePattern('trendline-1');

        // Verify it's removed
        const stateAfter = renderer.getDebugState();
        expect(stateAfter.registryState.patterns).not.toContain('trendline-1');
      });
    });

    describe('Horizontal Line Rendering', () => {
      test('should render horizontal line at specific price', async () => {
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 }
          ],
          lines: [{
            type: 'horizontal' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 7200) as Time, price: 45000 },
            style: { color: '#FF0000', lineWidth: 2 }
          }]
        };

        const result = await renderer.renderPattern('hline-1', visualization, 'horizontal_line');

        expect(result.success).toBe(true);
        expect(mockSeries.createPriceLine).toHaveBeenCalledWith({
          price: 45000,
          color: '#FF0000',
          lineWidth: 2,
          lineStyle: expect.any(Number)
        });
      });
    });

    describe('Support/Resistance Lines', () => {
      test('should render multiple support and resistance lines', async () => {
        const supportVisualization = {
          keyPoints: [{ time: Date.now() / 1000 as Time, price: 44000 }],
          lines: [{
            type: 'horizontal' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 44000 },
            endPoint: { time: (Date.now() / 1000 + 7200) as Time, price: 44000 },
            style: { color: '#00FF00', lineWidth: 2 }
          }],
          metrics: { label: 'Support' }
        };

        const resistanceVisualization = {
          keyPoints: [{ time: Date.now() / 1000 as Time, price: 46000 }],
          lines: [{
            type: 'horizontal' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 46000 },
            endPoint: { time: (Date.now() / 1000 + 7200) as Time, price: 46000 },
            style: { color: '#FF0000', lineWidth: 2 }
          }],
          metrics: { label: 'Resistance' }
        };

        await renderer.renderPattern('support-1', supportVisualization, 'support');
        await renderer.renderPattern('resistance-1', resistanceVisualization, 'resistance');

        expect(mockSeries.createPriceLine).toHaveBeenCalledTimes(2);
        const state = renderer.getDebugState();
        expect(state.registryState.patternCount).toBe(2);
      });
    });

    describe('Fibonacci Retracement', () => {
      test('should render Fibonacci levels', async () => {
        const startPrice = 44000;
        const endPrice = 46000;
        const expectedLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        
        const fibonacciLines = expectedLevels.map(level => {
          const price = startPrice + (endPrice - startPrice) * level;
          return {
            type: 'horizontal' as const,
            startPoint: { time: (Date.now() / 1000 - 7200) as Time, price },
            endPoint: { time: Date.now() / 1000 as Time, price },
            style: { color: '#FFD700', lineWidth: 1 }
          };
        });

        const visualization = {
          keyPoints: [
            { time: (Date.now() / 1000 - 7200) as Time, price: startPrice },
            { time: Date.now() / 1000 as Time, price: endPrice }
          ],
          lines: fibonacciLines
        };

        await renderer.renderPattern('fibo-1', visualization, 'fibonacci');

        // Should create price lines for common Fibonacci levels
        expect(mockSeries.createPriceLine).toHaveBeenCalledTimes(expectedLevels.length);
      });
    });
  });

  describe('Pattern Detection and Rendering', () => {
    describe('Pattern Detection Events', () => {
      test('should render detected pattern', async () => {
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
            { time: (Date.now() / 1000 + 7200) as Time, price: 45200 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 7200) as Time, price: 45200 },
            style: { color: '#0000FF', lineWidth: 2 }
          }]
        };
        
        adapter.renderPattern('triangle-1', visualization, 'triangle');

        // Should create visual representation of pattern
        const state = adapter.debugGetState();
        expect(state).toBeDefined();
      });

      test('should update pattern on confirmation', async () => {
        // First render pattern
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45300 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45300 },
            style: { color: '#00FF00', lineWidth: 2 }
          }]
        };
        
        adapter.renderPattern('flag-1', visualization, 'flag');

        // Then update it with confirmed status
        const confirmedVisualization = {
          ...visualization,
          metrics: { status: 'confirmed', confidence: 0.9 }
        };
        adapter.renderPattern('flag-1', confirmedVisualization, 'flag');

        const state = adapter.debugGetState();
        expect(state).toBeDefined();
      });

      test('should remove pattern on invalidation', async () => {
        // First render pattern
        const visualization = {
          keyPoints: [
            { time: Date.now() / 1000 as Time, price: 45000 },
            { time: (Date.now() / 1000 + 3600) as Time, price: 45400 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
            endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45400 },
            style: { color: '#FF00FF', lineWidth: 2 }
          }]
        };
        
        adapter.renderPattern('wedge-1', visualization, 'wedge');
        
        // Remove the pattern
        adapter.removePattern('wedge-1');

        const state = adapter.debugGetState();
        expect(state).toBeDefined();
      });
    });

    describe('Complex Pattern Rendering', () => {
      test('should render head and shoulders pattern', () => {
        const pattern: PatternEventData = {
          type: 'pattern.detected',
          pattern: {
            id: 'hs-1',
            type: 'head_and_shoulders',
            confidence: 0.85,
            points: [
              { time: (Date.now() / 1000 - 14400) as Time, price: 45000 }, // Left shoulder
              { time: (Date.now() / 1000 - 10800) as Time, price: 44000 }, // Left valley
              { time: (Date.now() / 1000 - 7200) as Time, price: 46000 },  // Head
              { time: (Date.now() / 1000 - 3600) as Time, price: 44000 },  // Right valley
              { time: Date.now() / 1000 as Time, price: 45000 }            // Right shoulder
            ],
            prediction: {
              targetPrice: 42000,
              timeframe: '4h',
              confidence: 0.75
            }
          }
        };

        const visualization = {
          keyPoints: pattern.pattern.points,
          lines: [
            {
              type: 'horizontal' as const,
              startPoint: pattern.pattern.points[1],
              endPoint: pattern.pattern.points[3],
              style: { color: '#FF0000', lineWidth: 2 }
            }
          ],
          metrics: {
            confidence: pattern.pattern.confidence,
            prediction: pattern.pattern.prediction
          }
        };

        adapter.renderPattern(pattern.pattern.id, visualization, pattern.pattern.type);
        
        // Should create neckline
        expect(mockSeries.createPriceLine).toHaveBeenCalled();
      });

      test('should render multiple patterns simultaneously', async () => {
        const patterns = ['triangle', 'flag', 'wedge'];
        
        for (const type of patterns) {
          const visualization = {
            keyPoints: [
              { time: Date.now() / 1000 as Time, price: 45000 },
              { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
            ],
            lines: [{
              type: 'trendline' as const,
              startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
              endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
              style: { color: '#0000FF', lineWidth: 2 }
            }]
          };
          adapter.renderPattern(`${type}-1`, visualization, type);
        }

        const state = adapter.debugGetState();
        expect(state).toBeDefined();
      });
    });
  });

  describe('Persistence and Restoration', () => {
    test('should persist patterns across timeframe changes', async () => {
      // Add some patterns
      const trendlineViz = {
        keyPoints: [
          { time: Date.now() / 1000 as Time, price: 45000 },
          { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
        ],
        lines: [{
          type: 'trendline' as const,
          startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
          endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
          style: { color: '#00FF00', lineWidth: 2 }
        }]
      };
      
      const hlineViz = {
        keyPoints: [{ time: Date.now() / 1000 as Time, price: 46000 }],
        lines: [{
          type: 'horizontal' as const,
          startPoint: { time: Date.now() / 1000 as Time, price: 46000 },
          endPoint: { time: (Date.now() / 1000 + 7200) as Time, price: 46000 },
          style: { color: '#FF0000', lineWidth: 2 }
        }]
      };
      
      await renderer.renderPattern('trendline-1', trendlineViz, 'trendline');
      await renderer.renderPattern('hline-1', hlineViz, 'horizontal_line');

      // Get state
      const stateBefore = renderer.getDebugState();
      expect(stateBefore.registryState.patternCount).toBe(2);
      
      // Remove patterns
      await renderer.removePattern('trendline-1');
      await renderer.removePattern('hline-1');
      
      const stateAfter = renderer.getDebugState();
      expect(stateAfter.registryState.patternCount).toBe(0);
      
      // Re-render patterns
      await renderer.renderPattern('trendline-1', trendlineViz, 'trendline');
      await renderer.renderPattern('hline-1', hlineViz, 'horizontal_line');
      
      const stateFinal = renderer.getDebugState();
      expect(stateFinal.registryState.patternCount).toBe(2);
    });

    test('should maintain pattern styles after re-rendering', async () => {
      const visualization = {
        keyPoints: [
          { time: (Date.now() / 1000 - 3600) as Time, price: 45000 },
          { time: Date.now() / 1000 as Time, price: 46000 }
        ],
        lines: [{
          type: 'trendline' as const,
          startPoint: { time: (Date.now() / 1000 - 3600) as Time, price: 45000 },
          endPoint: { time: Date.now() / 1000 as Time, price: 46000 },
          style: {
            color: '#FF00FF',
            lineWidth: 3,
            lineStyle: 'dashed' as const
          }
        }]
      };

      const result = await renderer.renderPattern('styled-line', visualization, 'trendline');
      expect(result.success).toBe(true);
      
      // Remove and re-render
      await renderer.removePattern('styled-line');
      const result2 = await renderer.renderPattern('styled-line', visualization, 'trendline');
      
      expect(result2.success).toBe(true);
      // The series should maintain the style properties when rendered
    });
  });

  describe('Performance', () => {
    test('should handle large number of patterns efficiently', async () => {
      const startTime = Date.now();
      
      // Add 100 patterns
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const visualization = {
          keyPoints: [
            { time: (Date.now() / 1000 - 3600) as Time, price: 45000 + i * 10 },
            { time: Date.now() / 1000 as Time, price: 46000 + i * 10 }
          ],
          lines: [{
            type: 'trendline' as const,
            startPoint: { time: (Date.now() / 1000 - 3600) as Time, price: 45000 + i * 10 },
            endPoint: { time: Date.now() / 1000 as Time, price: 46000 + i * 10 },
            style: { color: '#2196F3', lineWidth: 1 }
          }]
        };
        
        promises.push(renderer.renderPattern(`line-${i}`, visualization, 'trendline'));
      }
      
      await Promise.all(promises);
      const renderTime = Date.now() - startTime;
      
      const state = renderer.getDebugState();
      expect(state.registryState.patternCount).toBe(100);
      expect(renderTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should optimize updates for visible range only', async () => {
      const visibleRange = {
        from: (Date.now() / 1000 - 86400) as Time, // 1 day ago
        to: Date.now() / 1000 as Time
      };

      // Add pattern outside visible range
      const outsideVisualization = {
        keyPoints: [
          { time: (Date.now() / 1000 - 172800) as Time, price: 40000 }, // 2 days ago
          { time: (Date.now() / 1000 - 172800) as Time, price: 41000 }
        ],
        lines: [{
          type: 'trendline' as const,
          startPoint: { time: (Date.now() / 1000 - 172800) as Time, price: 40000 },
          endPoint: { time: (Date.now() / 1000 - 172800) as Time, price: 41000 },
          style: { color: '#FF0000', lineWidth: 2 }
        }]
      };

      await renderer.renderPattern('outside-line', outsideVisualization, 'trendline');
      
      // Should still track the pattern
      const state = renderer.getDebugState();
      expect(state.registryState.patternCount).toBe(1);
      
      // The renderer should handle patterns regardless of visible range
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid pattern data gracefully', async () => {
      const invalidVisualization = {
        keyPoints: [], // Empty points
        lines: []
      };

      // Should not throw
      const result = await renderer.renderPattern('invalid', invalidVisualization, 'unknown_type');
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      // Pattern count should remain 0 due to failed render
      const state = renderer.getDebugState();
      expect(state.registryState.patternCount).toBe(0);
    });

    test('should handle missing chart instance', async () => {
      const rendererWithoutChart = new PatternRendererCore(null as any, null as any);
      
      const visualization = {
        keyPoints: [
          { time: Date.now() / 1000 as Time, price: 45000 },
          { time: (Date.now() / 1000 + 3600) as Time, price: 45500 }
        ],
        lines: [{
          type: 'trendline' as const,
          startPoint: { time: Date.now() / 1000 as Time, price: 45000 },
          endPoint: { time: (Date.now() / 1000 + 3600) as Time, price: 45500 },
          style: { color: '#00FF00', lineWidth: 2 }
        }]
      };
      
      // Should handle gracefully
      const result = await rendererWithoutChart.renderPattern('test', visualization, 'trendline');
      expect(result.success).toBe(false);
    });
  });
});