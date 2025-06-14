import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { PatternRendererCore } from '@/lib/chart/PatternRendererCore';
import { PatternRendererAdapter } from '@/lib/chart/PatternRendererAdapter';
import type { ChartDrawing } from '@/types/drawing';
import type { PatternData } from '@/types/pattern';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  singleDrawing: 5,
  tenDrawings: 20,
  hundredDrawings: 100,
  patternRender: 10,
  complexPattern: 30,
  drawingUpdate: 3,
  drawingRemoval: 2,
  batchOperation: 50
};

describe('Chart Rendering Performance Tests', () => {
  let mockChart: any;
  let mockSeries: any;
  let renderer: PatternRendererCore;
  let adapter: PatternRendererAdapter;
  let performanceResults: Record<string, number[]> = {};

  beforeEach(() => {
    // Mock chart and series
    mockSeries = {
      createPriceLine: jest.fn().mockReturnValue({ 
        remove: jest.fn(),
        applyOptions: jest.fn()
      }),
      setMarkers: jest.fn(),
      markers: jest.fn().mockReturnValue([])
    };

    mockChart = {
      addLineSeries: jest.fn().mockReturnValue(mockSeries),
      addHistogramSeries: jest.fn().mockReturnValue(mockSeries),
      removeSeries: jest.fn(),
      timeScale: jest.fn().mockReturnValue({
        coordinateToTime: jest.fn(),
        timeToCoordinate: jest.fn()
      }),
      priceScale: jest.fn().mockReturnValue({
        coordinateToPrice: jest.fn(),
        priceToCoordinate: jest.fn()
      })
    };

    renderer = new PatternRendererCore(mockChart as any, mockSeries as any);
    adapter = new PatternRendererAdapter(mockChart as any, mockSeries as any);
  });

  afterEach(() => {
    // Log performance results
    Object.entries(performanceResults).forEach(([test, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      console.log(`[PERF] ${test}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
    });
    performanceResults = {};
  });

  describe('Drawing Rendering Performance', () => {
    it('should render a single drawing within threshold', () => {
      const drawing = createMockDrawing('trendline');
      const times: number[] = [];

      // Run multiple iterations for accuracy
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        renderer.addDrawing(drawing);
        const end = performance.now();
        times.push(end - start);
        renderer.removeDrawing(drawing.id);
      }

      performanceResults['singleDrawing'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.singleDrawing);
    });

    it('should render 10 drawings within threshold', () => {
      const drawings = Array.from({ length: 10 }, (_, i) => 
        createMockDrawing('trendline', `drawing-${i}`)
      );

      const start = performance.now();
      drawings.forEach(d => renderer.addDrawing(d));
      const end = performance.now();
      const renderTime = end - start;

      performanceResults['tenDrawings'] = [renderTime];
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.tenDrawings);

      // Cleanup
      drawings.forEach(d => renderer.removeDrawing(d.id));
    });

    it('should render 100 drawings within threshold', () => {
      const drawings = Array.from({ length: 100 }, (_, i) => 
        createMockDrawing(['trendline', 'horizontal', 'fibonacci'][i % 3], `drawing-${i}`)
      );

      const start = performance.now();
      drawings.forEach(d => renderer.addDrawing(d));
      const end = performance.now();
      const renderTime = end - start;

      performanceResults['hundredDrawings'] = [renderTime];
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.hundredDrawings);

      // Cleanup
      drawings.forEach(d => renderer.removeDrawing(d.id));
    });

    it('should update drawing properties efficiently', () => {
      const drawing = createMockDrawing('horizontal');
      renderer.addDrawing(drawing);

      const times: number[] = [];
      for (let i = 0; i < 100; i++) {
        const updatedDrawing = {
          ...drawing,
          style: {
            ...drawing.style,
            color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
          }
        };

        const start = performance.now();
        renderer.updateDrawing(updatedDrawing);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['drawingUpdate'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.drawingUpdate);
    });

    it('should remove drawings efficiently', () => {
      const drawings = Array.from({ length: 50 }, (_, i) => 
        createMockDrawing('trendline', `drawing-${i}`)
      );
      
      // Add all drawings first
      drawings.forEach(d => renderer.addDrawing(d));

      const times: number[] = [];
      drawings.forEach(d => {
        const start = performance.now();
        renderer.removeDrawing(d.id);
        const end = performance.now();
        times.push(end - start);
      });

      performanceResults['drawingRemoval'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.drawingRemoval);
    });
  });

  describe('Pattern Rendering Performance', () => {
    it('should render simple patterns within threshold', () => {
      const pattern = createMockPattern('triangle');
      const times: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        renderer.renderPattern(pattern);
        const end = performance.now();
        times.push(end - start);
        renderer.clearPattern();
      }

      performanceResults['patternRender'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.patternRender);
    });

    it('should render complex patterns within threshold', () => {
      const pattern = createComplexPattern();
      
      const start = performance.now();
      renderer.renderPattern(pattern);
      const end = performance.now();
      const renderTime = end - start;

      performanceResults['complexPattern'] = [renderTime];
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.complexPattern);

      renderer.clearPattern();
    });

    it('should handle pattern updates efficiently', () => {
      const pattern = createMockPattern('headAndShoulders');
      renderer.renderPattern(pattern);

      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        // Update pattern metrics
        const updatedPattern = {
          ...pattern,
          metrics: {
            ...pattern.metrics,
            confidence: Math.random()
          }
        };

        const start = performance.now();
        renderer.updatePattern(updatedPattern);
        const end = performance.now();
        times.push(end - start);
      }

      performanceResults['patternUpdate'] = times;
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(5); // Pattern updates should be fast
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch drawing operations efficiently', () => {
      const drawings = Array.from({ length: 50 }, (_, i) => 
        createMockDrawing(['trendline', 'horizontal', 'fibonacci'][i % 3], `drawing-${i}`)
      );

      // Batch add
      const addStart = performance.now();
      drawings.forEach(d => renderer.addDrawing(d));
      const addEnd = performance.now();
      const addTime = addEnd - addStart;

      // Batch update
      const updateStart = performance.now();
      drawings.forEach(d => {
        renderer.updateDrawing({
          ...d,
          visible: Math.random() > 0.5
        });
      });
      const updateEnd = performance.now();
      const updateTime = updateEnd - updateStart;

      // Batch remove
      const removeStart = performance.now();
      drawings.forEach(d => renderer.removeDrawing(d.id));
      const removeEnd = performance.now();
      const removeTime = removeEnd - removeStart;

      performanceResults['batchOperation'] = [addTime, updateTime, removeTime];
      
      expect(addTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);
      expect(updateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);
      expect(removeTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);
    });

    it('should maintain performance with mixed operations', () => {
      const drawings: ChartDrawing[] = [];
      const operations: Array<() => void> = [];

      // Create mixed operations
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          // Add operation
          const drawing = createMockDrawing('trendline', `drawing-${i}`);
          operations.push(() => {
            renderer.addDrawing(drawing);
            drawings.push(drawing);
          });
        } else if (i % 3 === 1 && drawings.length > 0) {
          // Update operation
          operations.push(() => {
            const drawing = drawings[Math.floor(Math.random() * drawings.length)];
            renderer.updateDrawing({
              ...drawing,
              style: { ...drawing.style, lineWidth: Math.floor(Math.random() * 5) + 1 }
            });
          });
        } else if (drawings.length > 0) {
          // Remove operation
          operations.push(() => {
            const index = Math.floor(Math.random() * drawings.length);
            const drawing = drawings[index];
            renderer.removeDrawing(drawing.id);
            drawings.splice(index, 1);
          });
        }
      }

      const start = performance.now();
      operations.forEach(op => op());
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['mixedOperations'] = [totalTime];
      expect(totalTime).toBeLessThan(100); // 100 mixed operations under 100ms
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory when adding/removing many drawings', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many add/remove cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const drawings = Array.from({ length: 100 }, (_, i) => 
          createMockDrawing('trendline', `drawing-${cycle}-${i}`)
        );
        
        drawings.forEach(d => renderer.addDrawing(d));
        drawings.forEach(d => renderer.removeDrawing(d.id));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent drawing operations', async () => {
      const concurrentOps = 50;
      const operations: Promise<void>[] = [];

      const start = performance.now();
      
      for (let i = 0; i < concurrentOps; i++) {
        operations.push(new Promise<void>((resolve) => {
          const drawing = createMockDrawing('horizontal', `concurrent-${i}`);
          renderer.addDrawing(drawing);
          
          setTimeout(() => {
            renderer.updateDrawing({
              ...drawing,
              visible: Math.random() > 0.5
            });
            renderer.removeDrawing(drawing.id);
            resolve();
          }, Math.random() * 10);
        }));
      }

      await Promise.all(operations);
      
      const end = performance.now();
      const totalTime = end - start;

      performanceResults['concurrentOperations'] = [totalTime];
      expect(totalTime).toBeLessThan(100); // All concurrent ops under 100ms
    });
  });
});

// Helper functions

function createMockDrawing(type: string, id?: string): ChartDrawing {
  return {
    id: id || `drawing-${Date.now()}-${Math.random()}`,
    type: type as any,
    points: [
      { time: Date.now() - 3600000, value: 50000 },
      { time: Date.now(), value: 51000 }
    ],
    style: {
      color: '#ff0000',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: false
    },
    visible: true,
    interactive: true
  };
}

function createMockPattern(type: string): PatternData {
  return {
    type,
    confidence: 0.85,
    startTime: Date.now() - 7200000,
    endTime: Date.now(),
    visualization: {
      keyPoints: [
        { time: Date.now() - 7200000, value: 50000, type: 'peak', label: 'P1' },
        { time: Date.now() - 3600000, value: 49000, type: 'trough', label: 'T1' },
        { time: Date.now(), value: 51000, type: 'peak', label: 'P2' }
      ],
      lines: [
        { from: 0, to: 1, type: 'support', style: { color: '#00ff00' } },
        { from: 1, to: 2, type: 'resistance', style: { color: '#ff0000' } }
      ]
    },
    metrics: {
      formation_period: 50,
      breakout_level: 51500,
      stop_loss: 48500,
      confidence: 0.85
    },
    description: `${type} pattern detected`,
    tradingImplication: 'bullish'
  };
}

function createComplexPattern(): PatternData {
  const keyPoints = Array.from({ length: 20 }, (_, i) => ({
    time: Date.now() - (20 - i) * 3600000,
    value: 50000 + Math.sin(i * 0.3) * 1000,
    type: i % 2 === 0 ? 'peak' as const : 'trough' as const,
    label: `P${i}`
  }));

  const lines = Array.from({ length: 15 }, (_, i) => ({
    from: i,
    to: i + 1,
    type: 'pattern' as const,
    style: { color: '#0000ff', lineWidth: 1 }
  }));

  return {
    type: 'complex',
    confidence: 0.92,
    startTime: keyPoints[0].time,
    endTime: keyPoints[keyPoints.length - 1].time,
    visualization: {
      keyPoints,
      lines,
      areas: [{
        points: Array.from({ length: keyPoints.length }, (_, i) => i),
        style: { fillColor: '#0000ff', opacity: 0.1 }
      }]
    },
    metrics: {
      formation_period: 100,
      complexity: 0.9,
      patterns_detected: 5
    },
    description: 'Complex multi-pattern formation',
    tradingImplication: 'neutral'
  };
}