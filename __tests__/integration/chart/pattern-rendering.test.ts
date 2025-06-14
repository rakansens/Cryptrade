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
      test('should render trendline with correct coordinates', () => {
        const drawingEvent = createMockDrawingEvent('drawing.created', 'trendline');
        
        renderer.handleDrawingEvent(drawingEvent);

        // Verify drawing was created
        expect(renderer.getDrawings()).toHaveLength(1);
        
        const drawing = renderer.getDrawings()[0];
        expect(drawing.type).toBe('trendline');
        expect(drawing.points).toHaveLength(2);
      });

      test('should update trendline position', () => {
        // First create a trendline
        const createEvent = createMockDrawingEvent('drawing.created', 'trendline');
        renderer.handleDrawingEvent(createEvent);

        // Then update it
        const updateEvent = createMockDrawingEvent('drawing.updated', 'trendline');
        renderer.handleDrawingEvent(updateEvent);

        const drawings = renderer.getDrawings();
        expect(drawings).toHaveLength(1);
        
        // Check that points were updated
        const drawing = drawings[0];
        expect(drawing.points[0].price).toBe(45500); // Updated price
      });

      test('should delete trendline', () => {
        // Create and then delete
        const createEvent = createMockDrawingEvent('drawing.created', 'trendline');
        renderer.handleDrawingEvent(createEvent);
        
        expect(renderer.getDrawings()).toHaveLength(1);

        const deleteEvent = createMockDrawingEvent('drawing.deleted', 'trendline');
        renderer.handleDrawingEvent(deleteEvent);

        expect(renderer.getDrawings()).toHaveLength(0);
      });
    });

    describe('Horizontal Line Rendering', () => {
      test('should render horizontal line at specific price', () => {
        const event: DrawingEventData = {
          type: 'drawing.created',
          drawing: {
            id: 'hline-1',
            type: 'horizontal_line',
            points: [{ time: Date.now() / 1000 as Time, price: 45000 }],
            style: { color: '#FF0000', lineWidth: 2 }
          }
        };

        renderer.handleDrawingEvent(event);

        expect(mockSeries.createPriceLine).toHaveBeenCalledWith({
          price: 45000,
          color: '#FF0000',
          lineWidth: 2,
          lineStyle: expect.any(Number)
        });
      });
    });

    describe('Support/Resistance Lines', () => {
      test('should render multiple support and resistance lines', () => {
        const supportLine: DrawingEventData = {
          type: 'drawing.created',
          drawing: {
            id: 'support-1',
            type: 'horizontal_line',
            points: [{ time: Date.now() / 1000 as Time, price: 44000 }],
            style: { color: '#00FF00', lineWidth: 2 },
            label: 'Support'
          }
        };

        const resistanceLine: DrawingEventData = {
          type: 'drawing.created',
          drawing: {
            id: 'resistance-1',
            type: 'horizontal_line',
            points: [{ time: Date.now() / 1000 as Time, price: 46000 }],
            style: { color: '#FF0000', lineWidth: 2 },
            label: 'Resistance'
          }
        };

        renderer.handleDrawingEvent(supportLine);
        renderer.handleDrawingEvent(resistanceLine);

        expect(mockSeries.createPriceLine).toHaveBeenCalledTimes(2);
        expect(renderer.getDrawings()).toHaveLength(2);
      });
    });

    describe('Fibonacci Retracement', () => {
      test('should render Fibonacci levels', () => {
        const fiboEvent: DrawingEventData = {
          type: 'drawing.created',
          drawing: {
            id: 'fibo-1',
            type: 'fibonacci',
            points: [
              { time: (Date.now() / 1000 - 7200) as Time, price: 44000 },
              { time: Date.now() / 1000 as Time, price: 46000 }
            ],
            style: { color: '#FFD700', lineWidth: 1 }
          }
        };

        renderer.handleDrawingEvent(fiboEvent);

        // Should create price lines for common Fibonacci levels
        const expectedLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        expect(mockSeries.createPriceLine).toHaveBeenCalledTimes(expectedLevels.length);
      });
    });
  });

  describe('Pattern Detection and Rendering', () => {
    describe('Pattern Detection Events', () => {
      test('should render detected pattern', () => {
        const patternEvent = createMockPatternEvent('pattern.detected', 'triangle');
        
        adapter.handlePatternEvent(patternEvent);

        // Should create visual representation of pattern
        const patterns = adapter.getPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0].type).toBe('triangle');
      });

      test('should update pattern on confirmation', () => {
        // First detect pattern
        const detectEvent = createMockPatternEvent('pattern.detected', 'flag');
        adapter.handlePatternEvent(detectEvent);

        // Then confirm it
        const confirmEvent = createMockPatternEvent('pattern.confirmed', 'flag');
        adapter.handlePatternEvent(confirmEvent);

        const patterns = adapter.getPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0].status).toBe('confirmed');
      });

      test('should remove pattern on invalidation', () => {
        // Detect then invalidate
        const detectEvent = createMockPatternEvent('pattern.detected', 'wedge');
        adapter.handlePatternEvent(detectEvent);
        
        expect(adapter.getPatterns()).toHaveLength(1);

        const invalidateEvent = createMockPatternEvent('pattern.invalidated', 'wedge');
        adapter.handlePatternEvent(invalidateEvent);

        expect(adapter.getPatterns()).toHaveLength(0);
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

        adapter.handlePatternEvent(pattern);

        const patterns = adapter.getPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0].points).toHaveLength(5);
        
        // Should create neckline
        expect(mockSeries.createPriceLine).toHaveBeenCalled();
      });

      test('should render multiple patterns simultaneously', () => {
        const patterns = ['triangle', 'flag', 'wedge'];
        
        patterns.forEach(type => {
          const event = createMockPatternEvent('pattern.detected', type);
          adapter.handlePatternEvent(event);
        });

        expect(adapter.getPatterns()).toHaveLength(3);
      });
    });
  });

  describe('Persistence and Restoration', () => {
    test('should persist drawings across timeframe changes', () => {
      // Add some drawings
      const trendline = createMockDrawingEvent('drawing.created', 'trendline');
      const hline = createMockDrawingEvent('drawing.created', 'horizontal_line');
      
      renderer.handleDrawingEvent(trendline);
      renderer.handleDrawingEvent(hline);

      // Save state
      const state = renderer.saveState();
      
      // Clear and restore
      renderer.clear();
      expect(renderer.getDrawings()).toHaveLength(0);
      
      renderer.restoreState(state);
      expect(renderer.getDrawings()).toHaveLength(2);
    });

    test('should maintain drawing styles after restoration', () => {
      const drawing: DrawingEventData = {
        type: 'drawing.created',
        drawing: {
          id: 'styled-line',
          type: 'trendline',
          points: [
            { time: (Date.now() / 1000 - 3600) as Time, price: 45000 },
            { time: Date.now() / 1000 as Time, price: 46000 }
          ],
          style: {
            color: '#FF00FF',
            lineWidth: 3,
            lineStyle: 'dashed'
          }
        }
      };

      renderer.handleDrawingEvent(drawing);
      
      const state = renderer.saveState();
      renderer.clear();
      renderer.restoreState(state);
      
      const restored = renderer.getDrawings()[0];
      expect(restored.style.color).toBe('#FF00FF');
      expect(restored.style.lineWidth).toBe(3);
      expect(restored.style.lineStyle).toBe('dashed');
    });
  });

  describe('Performance', () => {
    test('should handle large number of drawings efficiently', () => {
      const startTime = Date.now();
      
      // Add 100 drawings
      for (let i = 0; i < 100; i++) {
        const event: DrawingEventData = {
          type: 'drawing.created',
          drawing: {
            id: `line-${i}`,
            type: 'trendline',
            points: [
              { time: (Date.now() / 1000 - 3600) as Time, price: 45000 + i * 10 },
              { time: Date.now() / 1000 as Time, price: 46000 + i * 10 }
            ],
            style: { color: '#2196F3', lineWidth: 1 }
          }
        };
        
        renderer.handleDrawingEvent(event);
      }
      
      const renderTime = Date.now() - startTime;
      
      expect(renderer.getDrawings()).toHaveLength(100);
      expect(renderTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should optimize updates for visible range only', () => {
      const visibleRange = {
        from: (Date.now() / 1000 - 86400) as Time, // 1 day ago
        to: Date.now() / 1000 as Time
      };

      // Add drawings outside visible range
      const outsideEvent: DrawingEventData = {
        type: 'drawing.created',
        drawing: {
          id: 'outside-line',
          type: 'trendline',
          points: [
            { time: (Date.now() / 1000 - 172800) as Time, price: 40000 }, // 2 days ago
            { time: (Date.now() / 1000 - 172800) as Time, price: 41000 }
          ],
          style: { color: '#FF0000', lineWidth: 2 }
        }
      };

      renderer.handleDrawingEvent(outsideEvent);
      
      // Should still track the drawing
      expect(renderer.getDrawings()).toHaveLength(1);
      
      // But optimize rendering based on visible range
      const visibleDrawings = renderer.getVisibleDrawings(visibleRange);
      expect(visibleDrawings).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid drawing data gracefully', () => {
      const invalidEvent: DrawingEventData = {
        type: 'drawing.created',
        drawing: {
          id: 'invalid',
          type: 'unknown_type' as any,
          points: [], // Empty points
          style: {}
        }
      };

      // Should not throw
      expect(() => renderer.handleDrawingEvent(invalidEvent)).not.toThrow();
      
      // Should not add invalid drawing
      expect(renderer.getDrawings()).toHaveLength(0);
    });

    test('should handle missing chart instance', () => {
      const rendererWithoutChart = new PatternRendererCore(null as any, null as any);
      
      const event = createMockDrawingEvent('drawing.created', 'trendline');
      
      // Should handle gracefully
      expect(() => rendererWithoutChart.handleDrawingEvent(event)).not.toThrow();
    });
  });
});