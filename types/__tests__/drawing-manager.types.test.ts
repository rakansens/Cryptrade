// Jest is configured globally, no imports needed
import type {
  DrawingMetadata,
  DrawingItem,
  DrawingWithMetadata,
  PatternItem
} from '../drawing-manager.types';
import type { DrawingStyle } from '../ui-events.types';

describe('drawing-manager.types', () => {
  describe('DrawingMetadata interface', () => {
    it('should accept empty DrawingMetadata', () => {
      const metadata: DrawingMetadata = {};
      
      expect(metadata).toBeDefined();
      expect(Object.keys(metadata).length).toBe(0);
    });

    it('should accept DrawingMetadata with timestamps', () => {
      const now = Date.now();
      const metadata: DrawingMetadata = {
        createdAt: now,
        modifiedAt: now + 1000
      };

      expect(metadata.createdAt).toBe(now);
      expect(metadata.modifiedAt).toBe(now + 1000);
    });

    it('should accept DrawingMetadata with dynamic properties', () => {
      const metadata: DrawingMetadata = {
        createdAt: Date.now(),
        modifiedAt: Date.now() + 1000,
        author: 'user123',
        source: 'manual',
        confidence: 0.85,
        validated: true,
        tags: ['important', 'support'],
        customData: {
          nested: {
            deep: 'value'
          }
        }
      };

      expect(metadata.author).toBe('user123');
      expect(metadata.source).toBe('manual');
      expect(metadata.confidence).toBe(0.85);
      expect(metadata.validated).toBe(true);
      expect(metadata.tags).toEqual(['important', 'support']);
      expect(metadata.customData).toBeDefined();
    });

    it('should handle various data types in dynamic properties', () => {
      const metadata: DrawingMetadata = {
        stringProp: 'text',
        numberProp: 123.45,
        booleanProp: false,
        nullProp: null,
        undefinedProp: undefined,
        arrayProp: [1, 2, 3],
        objectProp: { key: 'value' },
        dateProp: new Date(),
        functionProp: () => 'test' // functions are allowed as unknown type
      };

      expect(typeof metadata.stringProp).toBe('string');
      expect(typeof metadata.numberProp).toBe('number');
      expect(typeof metadata.booleanProp).toBe('boolean');
      expect(metadata.nullProp).toBeNull();
      expect(metadata.undefinedProp).toBeUndefined();
      expect(Array.isArray(metadata.arrayProp)).toBe(true);
      expect(typeof metadata.objectProp).toBe('object');
    });
  });

  describe('DrawingItem interface', () => {
    it('should accept valid DrawingItem with required fields', () => {
      const item: DrawingItem = {
        id: 'drawing-1',
        isPattern: false,
        idx: 0,
        color: '#ff0000',
        direction: null
      };

      expect(item).toBeDefined();
      expect(item.id).toBe('drawing-1');
      expect(item.isPattern).toBe(false);
      expect(item.idx).toBe(0);
      expect(item.color).toBe('#ff0000');
      expect(item.direction).toBeNull();
    });

    it('should accept DrawingItem with all fields', () => {
      const createdAt = Date.now();
      const item: DrawingItem = {
        id: 'drawing-2',
        isPattern: true,
        idx: 5,
        color: '#00ff00',
        direction: 'up',
        createdAt: createdAt
      };

      expect(item.isPattern).toBe(true);
      expect(item.idx).toBe(5);
      expect(item.direction).toBe('up');
      expect(item.createdAt).toBe(createdAt);
    });

    it('should accept all valid direction values', () => {
      const upItem: DrawingItem = {
        id: 'up-item',
        isPattern: false,
        idx: 1,
        color: '#0000ff',
        direction: 'up'
      };

      const downItem: DrawingItem = {
        id: 'down-item',
        isPattern: false,
        idx: 2,
        color: '#ff00ff',
        direction: 'down'
      };

      const nullItem: DrawingItem = {
        id: 'null-item',
        isPattern: false,
        idx: 3,
        color: '#ffff00',
        direction: null
      };

      expect(upItem.direction).toBe('up');
      expect(downItem.direction).toBe('down');
      expect(nullItem.direction).toBeNull();
    });

    it('should handle negative and zero indices', () => {
      const zeroIdx: DrawingItem = {
        id: 'zero-idx',
        isPattern: false,
        idx: 0,
        color: '#000000',
        direction: null
      };

      const negativeIdx: DrawingItem = {
        id: 'negative-idx',
        isPattern: false,
        idx: -1,
        color: '#ffffff',
        direction: null
      };

      expect(zeroIdx.idx).toBe(0);
      expect(negativeIdx.idx).toBe(-1);
    });

    it('should handle various color formats', () => {
      const hexColor: DrawingItem = {
        id: 'hex-color',
        isPattern: false,
        idx: 0,
        color: '#abc123',
        direction: null
      };

      const rgbColor: DrawingItem = {
        id: 'rgb-color',
        isPattern: false,
        idx: 1,
        color: 'rgb(255, 0, 0)',
        direction: null
      };

      const namedColor: DrawingItem = {
        id: 'named-color',
        isPattern: false,
        idx: 2,
        color: 'red',
        direction: null
      };

      expect(hexColor.color).toBe('#abc123');
      expect(rgbColor.color).toBe('rgb(255, 0, 0)');
      expect(namedColor.color).toBe('red');
    });
  });

  describe('DrawingWithMetadata interface', () => {
    it('should accept valid DrawingWithMetadata with required fields', () => {
      const drawing: DrawingWithMetadata = {
        id: 'drawing-1',
        type: 'trendline',
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 110 }
        ]
      };

      expect(drawing).toBeDefined();
      expect(drawing.id).toBe('drawing-1');
      expect(drawing.type).toBe('trendline');
      expect(drawing.points).toHaveLength(2);
    });

    it('should accept DrawingWithMetadata with all optional fields', () => {
      const now = Date.now();
      const drawing: DrawingWithMetadata = {
        id: 'drawing-2',
        type: 'support-resistance',
        points: [
          { time: now, value: 95 },
          { time: now + 5000, value: 95 }
        ],
        style: {
          color: '#00ff00',
          lineWidth: 3,
          lineStyle: 'dashed',
          showLabels: true
        },
        metadata: {
          createdAt: now,
          modifiedAt: now + 100,
          source: 'auto-detection',
          confidence: 0.92
        }
      };

      expect(drawing.style).toBeDefined();
      expect(drawing.style?.color).toBe('#00ff00');
      expect(drawing.metadata).toBeDefined();
      expect(drawing.metadata?.confidence).toBe(0.92);
    });

    it('should handle empty points array', () => {
      const drawing: DrawingWithMetadata = {
        id: 'empty-points',
        type: 'placeholder',
        points: []
      };

      expect(drawing.points).toHaveLength(0);
    });

    it('should handle various drawing types', () => {
      const types = ['trendline', 'horizontal', 'vertical', 'channel', 'fibonacci', 'pattern'];
      
      types.forEach((type, index) => {
        const drawing: DrawingWithMetadata = {
          id: `drawing-${type}`,
          type,
          points: [
            { time: Date.now() + index * 1000, value: 100 + index }
          ]
        };
        
        expect(drawing.type).toBe(type);
      });
    });

    it('should work with DrawingStyle from ui-events.types', () => {
      const style: DrawingStyle = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: false
      };

      const drawing: DrawingWithMetadata = {
        id: 'style-test',
        type: 'trendline',
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 105 }
        ],
        style: style
      };

      expect(drawing.style).toEqual(style);
    });
  });

  describe('PatternItem interface', () => {
    it('should accept valid PatternItem', () => {
      const pattern: PatternItem = {
        id: 'pattern-1',
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [
            { time: Date.now(), value: 100 },
            { time: Date.now() + 1000, value: 110 },
            { time: Date.now() + 2000, value: 105 }
          ]
        }
      };

      expect(pattern).toBeDefined();
      expect(pattern.id).toBe('pattern-1');
      expect(pattern.type).toBe('triangle');
      expect(pattern.visualization).toBeDefined();
    });

    it('should accept PatternItem with metrics', () => {
      const pattern: PatternItem = {
        id: 'pattern-2',
        type: 'wedge',
        visualization: {
          type: 'wedge',
          lines: [],
          zones: []
        },
        metrics: {
          confidence: 0.85,
          strength: 0.9,
          breakoutProbability: 0.75
        }
      };

      expect(pattern.metrics).toBeDefined();
      expect(pattern.metrics).toHaveProperty('confidence', 0.85);
    });

    it('should handle various visualization structures', () => {
      const simpleVisualization: PatternItem = {
        id: 'simple',
        type: 'simple',
        visualization: 'simple-viz'
      };

      const arrayVisualization: PatternItem = {
        id: 'array',
        type: 'array',
        visualization: [1, 2, 3, 4, 5]
      };

      const complexVisualization: PatternItem = {
        id: 'complex',
        type: 'complex',
        visualization: {
          nested: {
            deep: {
              value: 'deep-nested'
            }
          },
          array: [
            { id: 1, value: 'first' },
            { id: 2, value: 'second' }
          ],
          mixed: [
            'string',
            123,
            { object: true },
            null
          ]
        }
      };

      expect(simpleVisualization.visualization).toBe('simple-viz');
      expect(Array.isArray(arrayVisualization.visualization)).toBe(true);
      expect(complexVisualization.visualization).toHaveProperty('nested');
    });

    it('should handle various metrics structures', () => {
      const numberMetrics: PatternItem = {
        id: 'number-metrics',
        type: 'test',
        visualization: {},
        metrics: 0.95
      };

      const stringMetrics: PatternItem = {
        id: 'string-metrics',
        type: 'test',
        visualization: {},
        metrics: 'high-confidence'
      };

      const objectMetrics: PatternItem = {
        id: 'object-metrics',
        type: 'test',
        visualization: {},
        metrics: {
          scores: [0.8, 0.85, 0.9],
          average: 0.85,
          metadata: {
            calculatedAt: Date.now(),
            algorithm: 'v2'
          }
        }
      };

      expect(numberMetrics.metrics).toBe(0.95);
      expect(stringMetrics.metrics).toBe('high-confidence');
      expect(objectMetrics.metrics).toHaveProperty('average', 0.85);
    });

    it('should handle undefined metrics', () => {
      const pattern: PatternItem = {
        id: 'no-metrics',
        type: 'basic',
        visualization: { type: 'basic' }
        // metrics is optional and not provided
      };

      expect(pattern.metrics).toBeUndefined();
    });
  });

  describe('Integration and edge cases', () => {
    it('should handle complex nested structures', () => {
      const drawing: DrawingWithMetadata = {
        id: 'complex-drawing',
        type: 'advanced-pattern',
        points: Array.from({ length: 100 }, (_, i) => ({
          time: Date.now() + i * 1000,
          value: 100 + Math.sin(i / 10) * 10
        })),
        style: {
          color: 'rgba(255, 0, 0, 0.5)',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        metadata: {
          createdAt: Date.now(),
          analysis: {
            pattern: {
              primary: 'sine-wave',
              confidence: 0.95,
              characteristics: {
                amplitude: 10,
                frequency: 0.1,
                phase: 0
              }
            },
            relatedPatterns: ['wave', 'oscillation'],
            tradingSignals: {
              entry: { price: 105, confidence: 0.8 },
              exit: { price: 110, confidence: 0.7 }
            }
          }
        }
      };

      expect(drawing.points).toHaveLength(100);
      expect(drawing.metadata?.analysis).toBeDefined();
    });

    it('should handle relationships between types', () => {
      const item: DrawingItem = {
        id: 'item-1',
        isPattern: true,
        idx: 0,
        color: '#ff0000',
        direction: 'up',
        createdAt: Date.now()
      };

      const drawing: DrawingWithMetadata = {
        id: item.id, // Same ID as DrawingItem
        type: 'pattern',
        points: [
          { time: Date.now(), value: 100 }
        ],
        metadata: {
          createdAt: item.createdAt,
          isPattern: item.isPattern,
          direction: item.direction
        }
      };

      const pattern: PatternItem = {
        id: item.id, // Same ID
        type: 'triangle',
        visualization: drawing,
        metrics: {
          fromDrawing: true,
          originalColor: item.color
        }
      };

      expect(pattern.id).toBe(item.id);
      expect(pattern.id).toBe(drawing.id);
      expect(drawing.metadata?.createdAt).toBe(item.createdAt);
    });

    it('should handle large datasets', () => {
      const largeDrawing: DrawingWithMetadata = {
        id: 'large-dataset',
        type: 'historical',
        points: Array.from({ length: 10000 }, (_, i) => ({
          time: Date.now() + i * 60000, // 1 minute intervals
          value: 100 + Math.random() * 50
        }))
      };

      expect(largeDrawing.points).toHaveLength(10000);
      expect(largeDrawing.points[0].time).toBeLessThan(largeDrawing.points[9999].time);
    });
  });
});