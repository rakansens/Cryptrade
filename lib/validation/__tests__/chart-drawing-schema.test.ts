import {
  DrawingPointSchema,
  DrawingStyleSchema,
  DrawingTypeSchema,
  ChartDrawingSchema,
  PatternDataSchema,
  DrawingModeSchema,
  validateDrawing,
  validateDrawingPoints,
  isValidDrawing,
  type ChartDrawing,
  type DrawingPoint,
  type PatternData
} from '../chart-drawing.schema';

describe('Chart Drawing Schema Validation', () => {
  describe('DrawingPointSchema', () => {
    it('validates valid drawing points', () => {
      const validPoint = {
        time: 1704067200,
        value: 45000
      };
      
      const result = DrawingPointSchema.parse(validPoint);
      expect(result).toEqual(validPoint);
    });

    it('rejects invalid time values', () => {
      expect(() => DrawingPointSchema.parse({ time: -1, value: 100 })).toThrow();
      expect(() => DrawingPointSchema.parse({ time: 0, value: 100 })).toThrow();
      expect(() => DrawingPointSchema.parse({ time: 1.5, value: 100 })).toThrow();
      expect(() => DrawingPointSchema.parse({ time: '123', value: 100 })).toThrow();
    });

    it('accepts any valid number for value', () => {
      const points = [
        { time: 1, value: 0 },
        { time: 1, value: -100 },
        { time: 1, value: 999999.99 },
        { time: 1, value: 0.0001 }
      ];
      
      points.forEach(point => {
        expect(() => DrawingPointSchema.parse(point)).not.toThrow();
      });
    });

    it('rejects missing or invalid fields', () => {
      expect(() => DrawingPointSchema.parse({})).toThrow();
      expect(() => DrawingPointSchema.parse({ time: 1 })).toThrow();
      expect(() => DrawingPointSchema.parse({ value: 100 })).toThrow();
      expect(() => DrawingPointSchema.parse({ time: null, value: null })).toThrow();
    });
  });

  describe('DrawingStyleSchema', () => {
    it('validates valid drawing styles', () => {
      const validStyle = {
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      };
      
      const result = DrawingStyleSchema.parse(validStyle);
      expect(result).toEqual(validStyle);
    });

    it('validates hex color format strictly', () => {
      // Valid hex colors
      expect(() => DrawingStyleSchema.parse({
        color: '#000000',
        lineWidth: 1,
        lineStyle: 'solid',
        showLabels: false
      })).not.toThrow();
      
      expect(() => DrawingStyleSchema.parse({
        color: '#FFFFFF',
        lineWidth: 1,
        lineStyle: 'solid',
        showLabels: false
      })).not.toThrow();
      
      // Invalid hex colors
      const invalidColors = ['#fff', '#GGGGGG', 'red', 'rgb(255,0,0)', '#12345', '#1234567'];
      invalidColors.forEach(color => {
        expect(() => DrawingStyleSchema.parse({
          color,
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: false
        })).toThrow();
      });
    });

    it('validates line width boundaries', () => {
      // Valid line widths
      for (let width = 1; width <= 10; width++) {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: width,
          lineStyle: 'solid',
          showLabels: false
        })).not.toThrow();
      }
      
      // Invalid line widths
      [0, 11, -1, 0.5, 100].forEach(width => {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: width,
          lineStyle: 'solid',
          showLabels: false
        })).toThrow();
      });
    });

    it('validates line style enum', () => {
      const validStyles = ['solid', 'dashed', 'dotted'];
      validStyles.forEach(style => {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: 1,
          lineStyle: style,
          showLabels: false
        })).not.toThrow();
      });
      
      // Invalid styles
      ['bold', 'thin', '', null, 123].forEach(style => {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: 1,
          lineStyle: style,
          showLabels: false
        })).toThrow();
      });
    });

    it('validates showLabels as boolean', () => {
      [true, false].forEach(showLabels => {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels
        })).not.toThrow();
      });
      
      // Non-boolean values
      [1, 0, 'true', null, undefined].forEach(showLabels => {
        expect(() => DrawingStyleSchema.parse({
          color: '#000000',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels
        })).toThrow();
      });
    });
  });

  describe('DrawingTypeSchema', () => {
    it('validates all drawing types', () => {
      const validTypes = ['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern'];
      validTypes.forEach(type => {
        expect(() => DrawingTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('rejects invalid drawing types', () => {
      const invalidTypes = ['line', 'circle', 'rectangle', '', null, 123];
      invalidTypes.forEach(type => {
        expect(() => DrawingTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('ChartDrawingSchema', () => {
    const validDrawing: ChartDrawing = {
      id: 'drawing-1',
      type: 'trendline',
      points: [
        { time: 1704067200, value: 45000 },
        { time: 1704153600, value: 47000 }
      ],
      style: {
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      },
      visible: true,
      interactive: true
    };

    it('validates complete valid drawing', () => {
      const result = ChartDrawingSchema.parse(validDrawing);
      expect(result).toEqual(validDrawing);
    });

    it('validates drawing with optional metadata', () => {
      const drawingWithMetadata = {
        ...validDrawing,
        metadata: {
          createdAt: Date.now(),
          author: 'test-user',
          source: 'ai-analysis',
          customData: { foo: 'bar' }
        }
      };
      
      const result = ChartDrawingSchema.parse(drawingWithMetadata);
      expect(result.metadata).toEqual(drawingWithMetadata.metadata);
    });

    it('validates minimum required fields', () => {
      const minimalDrawing = {
        id: 'min',
        type: 'horizontal',
        points: [{ time: 1, value: 1 }],
        style: {
          color: '#000000',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: false
        },
        visible: false,
        interactive: false
      };
      
      expect(() => ChartDrawingSchema.parse(minimalDrawing)).not.toThrow();
    });

    it('validates points array constraints', () => {
      // Minimum 1 point
      expect(() => ChartDrawingSchema.parse({
        ...validDrawing,
        points: []
      })).toThrow();
      
      // Maximum 10 points
      const manyPoints = Array(11).fill(null).map((_, i) => ({
        time: 1704067200 + i * 3600,
        value: 45000 + i * 100
      }));
      
      expect(() => ChartDrawingSchema.parse({
        ...validDrawing,
        points: manyPoints
      })).toThrow();
      
      // 10 points should be valid
      expect(() => ChartDrawingSchema.parse({
        ...validDrawing,
        points: manyPoints.slice(0, 10)
      })).not.toThrow();
    });

    it('rejects drawings with missing required fields', () => {
      const requiredFields = ['id', 'type', 'points', 'style', 'visible', 'interactive'];
      
      requiredFields.forEach(field => {
        const incomplete = { ...validDrawing };
        delete (incomplete as any)[field];
        
        expect(() => ChartDrawingSchema.parse(incomplete)).toThrow();
      });
    });

    it('validates id as non-empty string', () => {
      expect(() => ChartDrawingSchema.parse({
        ...validDrawing,
        id: ''
      })).toThrow();
      
      expect(() => ChartDrawingSchema.parse({
        ...validDrawing,
        id: 123
      })).toThrow();
    });
  });

  describe('PatternDataSchema', () => {
    const validPattern: PatternData = {
      type: 'head-and-shoulders',
      visualization: {
        keyPoints: [
          { time: 1704067200, value: 45000, type: 'peak' }
        ],
        lines: []
      }
    };

    it('validates basic pattern data', () => {
      const result = PatternDataSchema.parse(validPattern);
      expect(result).toEqual(validPattern);
    });

    it('validates pattern with all optional fields', () => {
      const fullPattern = {
        ...validPattern,
        metrics: {
          target: 48000,
          stopLoss: 44000,
          breakoutLevel: 46500
        },
        tradingImplication: 'Bearish reversal pattern indicating potential downtrend',
        confidence: 0.85
      };
      
      const result = PatternDataSchema.parse(fullPattern);
      expect(result).toEqual(fullPattern);
    });

    it('validates confidence boundaries', () => {
      // Valid confidence values
      [0, 0.5, 1, 0.999, 0.001].forEach(confidence => {
        expect(() => PatternDataSchema.parse({
          ...validPattern,
          confidence
        })).not.toThrow();
      });
      
      // Invalid confidence values
      [-0.1, 1.1, 2, -1].forEach(confidence => {
        expect(() => PatternDataSchema.parse({
          ...validPattern,
          confidence
        })).toThrow();
      });
    });

    it('accepts any visualization structure', () => {
      const complexVisualization = {
        type: 'complex',
        visualization: {
          nested: {
            deeply: {
              structured: 'data',
              with: [1, 2, 3],
              various: true,
              types: null
            }
          }
        }
      };
      
      expect(() => PatternDataSchema.parse(complexVisualization)).not.toThrow();
    });

    it('rejects patterns without required type', () => {
      expect(() => PatternDataSchema.parse({
        visualization: {}
      })).toThrow();
      
      expect(() => PatternDataSchema.parse({
        type: '',
        visualization: {}
      })).toThrow();
    });
  });

  describe('DrawingModeSchema', () => {
    it('validates all drawing modes', () => {
      const validModes = ['none', 'trendline', 'fibonacci', 'horizontal', 'vertical'];
      validModes.forEach(mode => {
        expect(() => DrawingModeSchema.parse(mode)).not.toThrow();
      });
    });

    it('rejects invalid drawing modes', () => {
      ['pattern', 'circle', '', null, 123].forEach(mode => {
        expect(() => DrawingModeSchema.parse(mode)).toThrow();
      });
    });
  });

  describe('Validation Helper Functions', () => {
    const validDrawing: ChartDrawing = {
      id: 'test',
      type: 'horizontal',
      points: [{ time: 1704067200, value: 45000 }],
      style: {
        color: '#ff0000',
        lineWidth: 3,
        lineStyle: 'dashed',
        showLabels: true
      },
      visible: true,
      interactive: false
    };

    describe('validateDrawing', () => {
      it('returns parsed drawing for valid input', () => {
        const result = validateDrawing(validDrawing);
        expect(result).toEqual(validDrawing);
      });

      it('throws ZodError for invalid input', () => {
        expect(() => validateDrawing({ invalid: 'data' })).toThrow();
        expect(() => validateDrawing(null)).toThrow();
        expect(() => validateDrawing(undefined)).toThrow();
      });
    });

    describe('validateDrawingPoints', () => {
      it('validates array of drawing points', () => {
        const points = [
          { time: 1704067200, value: 45000 },
          { time: 1704153600, value: 47000 }
        ];
        
        const result = validateDrawingPoints(points);
        expect(result).toEqual(points);
      });

      it('throws for invalid points', () => {
        expect(() => validateDrawingPoints([{ time: 'invalid', value: 100 }])).toThrow();
        expect(() => validateDrawingPoints([{ time: 1 }])).toThrow();
        expect(() => validateDrawingPoints('not-array')).toThrow();
      });
    });

    describe('isValidDrawing', () => {
      it('returns true for valid drawings', () => {
        expect(isValidDrawing(validDrawing)).toBe(true);
      });

      it('returns false for invalid drawings', () => {
        expect(isValidDrawing({ invalid: 'data' })).toBe(false);
        expect(isValidDrawing(null)).toBe(false);
        expect(isValidDrawing(undefined)).toBe(false);
        expect(isValidDrawing({ ...validDrawing, type: 'invalid' })).toBe(false);
      });

      it('acts as type guard', () => {
        const unknown: unknown = validDrawing;
        
        if (isValidDrawing(unknown)) {
          // TypeScript should know this is ChartDrawing
          expect(unknown.type).toBe('horizontal');
          expect(unknown.points).toHaveLength(1);
        }
      });
    });
  });

  describe('Type Inference', () => {
    it('infers correct types from schemas', () => {
      // These tests ensure TypeScript compilation works
      const point: DrawingPoint = { time: 1, value: 1 };
      const drawing: ChartDrawing = {
        id: 'test',
        type: 'horizontal',
        points: [point],
        style: {
          color: '#000000',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: false
        },
        visible: true,
        interactive: true
      };
      
      expect(point).toBeDefined();
      expect(drawing).toBeDefined();
    });
  });
});