import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
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
  type DrawingPoint,
  type DrawingStyle,
  type DrawingType,
  type ChartDrawing,
  type PatternData,
  type DrawingMode
} from '../chart-drawing.schema';

describe('DrawingPointSchema', () => {
  describe('valid points', () => {
    it('should validate correct drawing point', () => {
      const validPoint = {
        time: 1234567890,
        value: 50000.5
      };
      
      const result = DrawingPointSchema.parse(validPoint);
      expect(result).toEqual(validPoint);
    });

    it('should accept integer timestamps', () => {
      const point = {
        time: 1000,
        value: 100
      };
      
      expect(() => DrawingPointSchema.parse(point)).not.toThrow();
    });

    it('should accept decimal values', () => {
      const point = {
        time: 1000,
        value: 123.456789
      };
      
      const result = DrawingPointSchema.parse(point);
      expect(result.value).toBe(123.456789);
    });
  });

  describe('invalid points', () => {
    it('should reject negative timestamps', () => {
      const invalidPoint = {
        time: -1000,
        value: 100
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject zero timestamp', () => {
      const invalidPoint = {
        time: 0,
        value: 100
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject non-integer timestamps', () => {
      const invalidPoint = {
        time: 1234.5,
        value: 100
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject missing time field', () => {
      const invalidPoint = {
        value: 100
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject missing value field', () => {
      const invalidPoint = {
        time: 1000
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });

    it('should reject non-numeric values', () => {
      const invalidPoint = {
        time: 1000,
        value: 'not a number'
      };
      
      expect(() => DrawingPointSchema.parse(invalidPoint)).toThrow();
    });
  });
});

describe('DrawingStyleSchema', () => {
  describe('valid styles', () => {
    it('should validate complete style object', () => {
      const validStyle = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'solid' as const,
        showLabels: true
      };
      
      const result = DrawingStyleSchema.parse(validStyle);
      expect(result).toEqual(validStyle);
    });

    it('should accept all valid line styles', () => {
      const lineStyles: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted'];
      
      lineStyles.forEach(style => {
        const styleObj = {
          color: '#00ff00',
          lineWidth: 3,
          lineStyle: style,
          showLabels: false
        };
        
        expect(() => DrawingStyleSchema.parse(styleObj)).not.toThrow();
      });
    });

    it('should accept line widths from 1 to 10', () => {
      for (let width = 1; width <= 10; width++) {
        const style = {
          color: '#0000ff',
          lineWidth: width,
          lineStyle: 'solid' as const,
          showLabels: true
        };
        
        expect(() => DrawingStyleSchema.parse(style)).not.toThrow();
      }
    });

    it('should accept uppercase and lowercase hex colors', () => {
      const colors = ['#FFFFFF', '#ffffff', '#AbCdEf', '#123ABC'];
      
      colors.forEach(color => {
        const style = {
          color,
          lineWidth: 2,
          lineStyle: 'solid' as const,
          showLabels: true
        };
        
        expect(() => DrawingStyleSchema.parse(style)).not.toThrow();
      });
    });
  });

  describe('invalid styles', () => {
    it('should reject invalid hex colors', () => {
      const invalidColors = [
        '#fff',        // Too short
        '#fffffff',    // Too long
        '#gggggg',     // Invalid characters
        'ff0000',      // Missing #
        'red',         // Named color
        '#ff00',       // 4 digits
        ''             // Empty
      ];
      
      invalidColors.forEach(color => {
        const style = {
          color,
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        };
        
        expect(() => DrawingStyleSchema.parse(style)).toThrow();
      });
    });

    it('should reject line width outside valid range', () => {
      const invalidWidths = [0, -1, 11, 100, 0.5];
      
      invalidWidths.forEach(width => {
        const style = {
          color: '#ff0000',
          lineWidth: width,
          lineStyle: 'solid',
          showLabels: true
        };
        
        expect(() => DrawingStyleSchema.parse(style)).toThrow();
      });
    });

    it('should reject invalid line styles', () => {
      const style = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'double', // Invalid
        showLabels: true
      };
      
      expect(() => DrawingStyleSchema.parse(style)).toThrow();
    });

    it('should reject non-boolean showLabels', () => {
      const style = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: 'yes' // Should be boolean
      };
      
      expect(() => DrawingStyleSchema.parse(style)).toThrow();
    });
  });
});

describe('DrawingTypeSchema', () => {
  it('should accept all valid drawing types', () => {
    const validTypes: DrawingType[] = ['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern'];
    
    validTypes.forEach(type => {
      expect(() => DrawingTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid drawing types', () => {
    const invalidTypes = ['line', 'circle', 'rectangle', 'text', ''];
    
    invalidTypes.forEach(type => {
      expect(() => DrawingTypeSchema.parse(type)).toThrow();
    });
  });
});

describe('ChartDrawingSchema', () => {
  describe('valid drawings', () => {
    it('should validate complete drawing object', () => {
      const validDrawing = {
        id: 'drawing-123',
        type: 'trendline' as const,
        points: [
          { time: 1000, value: 100 },
          { time: 2000, value: 200 }
        ],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid' as const,
          showLabels: true
        },
        visible: true,
        interactive: true,
        metadata: {
          createdBy: 'user123',
          angle: 45
        }
      };
      
      const result = ChartDrawingSchema.parse(validDrawing);
      expect(result).toEqual(validDrawing);
    });

    it('should accept drawing without optional metadata', () => {
      const drawing = {
        id: 'test-1',
        type: 'horizontal' as const,
        points: [{ time: 1000, value: 50000 }],
        style: {
          color: '#00ff00',
          lineWidth: 1,
          lineStyle: 'dashed' as const,
          showLabels: false
        },
        visible: false,
        interactive: false
      };
      
      const result = ChartDrawingSchema.parse(drawing);
      expect(result.metadata).toBeUndefined();
    });

    it('should accept minimum 1 point', () => {
      const drawing = {
        id: 'horizontal-1',
        type: 'horizontal' as const,
        points: [{ time: 1000, value: 100 }],
        style: {
          color: '#0000ff',
          lineWidth: 3,
          lineStyle: 'dotted' as const,
          showLabels: true
        },
        visible: true,
        interactive: true
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).not.toThrow();
    });

    it('should accept maximum 10 points', () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        time: 1000 + i * 1000,
        value: 100 + i * 10
      }));
      
      const drawing = {
        id: 'pattern-1',
        type: 'pattern' as const,
        points,
        style: {
          color: '#ff00ff',
          lineWidth: 2,
          lineStyle: 'solid' as const,
          showLabels: true
        },
        visible: true,
        interactive: false
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).not.toThrow();
    });
  });

  describe('invalid drawings', () => {
    it('should reject empty id', () => {
      const drawing = {
        id: '',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).toThrow();
    });

    it('should reject empty points array', () => {
      const drawing = {
        id: 'test-1',
        type: 'trendline',
        points: [],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).toThrow();
    });

    it('should reject more than 10 points', () => {
      const points = Array.from({ length: 11 }, (_, i) => ({
        time: 1000 + i * 1000,
        value: 100
      }));
      
      const drawing = {
        id: 'test-1',
        type: 'pattern',
        points,
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).toThrow();
    });

    it('should reject non-boolean visible field', () => {
      const drawing = {
        id: 'test-1',
        type: 'horizontal',
        points: [{ time: 1000, value: 100 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: 'yes', // Should be boolean
        interactive: true
      };
      
      expect(() => ChartDrawingSchema.parse(drawing)).toThrow();
    });

    it('should reject missing required fields', () => {
      const requiredFields = ['id', 'type', 'points', 'style', 'visible', 'interactive'];
      
      requiredFields.forEach(fieldToOmit => {
        const drawing: any = {
          id: 'test-1',
          type: 'trendline',
          points: [{ time: 1000, value: 100 }],
          style: {
            color: '#ff0000',
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true
          },
          visible: true,
          interactive: true
        };
        
        delete drawing[fieldToOmit];
        
        expect(() => ChartDrawingSchema.parse(drawing)).toThrow();
      });
    });
  });
});

describe('PatternDataSchema', () => {
  describe('valid pattern data', () => {
    it('should validate complete pattern data', () => {
      const patternData = {
        type: 'headAndShoulders',
        visualization: {
          keyPoints: [
            { x: 100, y: 200 },
            { x: 150, y: 250 }
          ],
          lines: []
        },
        metrics: {
          leftShoulderHeight: 100,
          headHeight: 120,
          rightShoulderHeight: 98
        },
        tradingImplication: 'bearish',
        confidence: 0.85
      };
      
      const result = PatternDataSchema.parse(patternData);
      expect(result).toEqual(patternData);
    });

    it('should accept pattern data with only required fields', () => {
      const minimalPattern = {
        type: 'triangle',
        visualization: { type: 'ascending' }
      };
      
      const result = PatternDataSchema.parse(minimalPattern);
      expect(result.metrics).toBeUndefined();
      expect(result.tradingImplication).toBeUndefined();
      expect(result.confidence).toBeUndefined();
    });

    it('should accept confidence values between 0 and 1', () => {
      const confidenceValues = [0, 0.1, 0.5, 0.99, 1];
      
      confidenceValues.forEach(confidence => {
        const pattern = {
          type: 'doubleTop',
          visualization: {},
          confidence
        };
        
        expect(() => PatternDataSchema.parse(pattern)).not.toThrow();
      });
    });

    it('should accept complex visualization objects', () => {
      const pattern = {
        type: 'fibonacci',
        visualization: {
          levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
          colors: ['#ff0000', '#00ff00', '#0000ff'],
          labels: {
            show: true,
            position: 'right'
          }
        }
      };
      
      expect(() => PatternDataSchema.parse(pattern)).not.toThrow();
    });
  });

  describe('invalid pattern data', () => {
    it('should reject empty type', () => {
      const pattern = {
        type: '',
        visualization: {}
      };
      
      expect(() => PatternDataSchema.parse(pattern)).toThrow();
    });

    it('should reject confidence outside valid range', () => {
      const invalidConfidences = [-0.1, 1.1, 2, -1];
      
      invalidConfidences.forEach(confidence => {
        const pattern = {
          type: 'pattern',
          visualization: {},
          confidence
        };
        
        expect(() => PatternDataSchema.parse(pattern)).toThrow();
      });
    });

    it('should reject missing type field', () => {
      const patternMissingType = {
        visualization: {}
      };
      
      expect(() => PatternDataSchema.parse(patternMissingType)).toThrow();
    });
    
    it('should accept missing visualization field since it uses z.any()', () => {
      // Note: visualization uses z.any() in the schema, which accepts undefined
      const patternMissingVisualization = {
        type: 'triangle'
      };
      
      // This should actually succeed because z.any() accepts undefined
      const result = PatternDataSchema.safeParse(patternMissingVisualization);
      expect(result.success).toBe(true);
      
      // To properly test, we would need to explicitly check for the field
      if (result.success) {
        expect(result.data.visualization).toBeUndefined();
      }
    });
  });
});

describe('DrawingModeSchema', () => {
  it('should accept all valid drawing modes', () => {
    const validModes: DrawingMode[] = ['none', 'trendline', 'fibonacci', 'horizontal', 'vertical'];
    
    validModes.forEach(mode => {
      expect(() => DrawingModeSchema.parse(mode)).not.toThrow();
    });
  });

  it('should reject invalid drawing modes', () => {
    const invalidModes = ['draw', 'select', 'pattern', 'edit', ''];
    
    invalidModes.forEach(mode => {
      expect(() => DrawingModeSchema.parse(mode)).toThrow();
    });
  });
});

describe('Validation helper functions', () => {
  describe('validateDrawing', () => {
    it('should validate and return valid drawing', () => {
      const drawing = {
        id: 'test-123',
        type: 'horizontal',
        points: [{ time: 1000, value: 50000 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: false
      };
      
      const result = validateDrawing(drawing);
      expect(result).toEqual(drawing);
    });

    it('should throw ZodError for invalid drawing', () => {
      const invalidDrawing = {
        id: 'test-123',
        type: 'invalid-type',
        points: [],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: false
      };
      
      expect(() => validateDrawing(invalidDrawing)).toThrow(z.ZodError);
    });
  });

  describe('validateDrawingPoints', () => {
    it('should validate array of drawing points', () => {
      const points = [
        { time: 1000, value: 100 },
        { time: 2000, value: 200 },
        { time: 3000, value: 150 }
      ];
      
      const result = validateDrawingPoints(points);
      expect(result).toEqual(points);
    });

    it('should throw for invalid points', () => {
      const invalidPoints = [
        { time: 1000, value: 100 },
        { time: -1000, value: 200 }, // Invalid time
        { time: 3000, value: 'invalid' } // Invalid value
      ];
      
      expect(() => validateDrawingPoints(invalidPoints)).toThrow();
    });

    it('should handle empty array', () => {
      const result = validateDrawingPoints([]);
      expect(result).toEqual([]);
    });
  });

  describe('isValidDrawing', () => {
    it('should return true for valid drawing', () => {
      const validDrawing = {
        id: 'test-123',
        type: 'fibonacci',
        points: [
          { time: 1000, value: 100 },
          { time: 2000, value: 200 }
        ],
        style: {
          color: '#00ff00',
          lineWidth: 3,
          lineStyle: 'dashed',
          showLabels: false
        },
        visible: true,
        interactive: true
      };
      
      expect(isValidDrawing(validDrawing)).toBe(true);
    });

    it('should return false for invalid drawing', () => {
      const invalidDrawings = [
        null,
        undefined,
        {},
        { id: 'test' }, // Missing required fields
        { 
          id: 'test',
          type: 'invalid', // Invalid type
          points: [],
          style: {},
          visible: true,
          interactive: true
        }
      ];
      
      invalidDrawings.forEach(drawing => {
        expect(isValidDrawing(drawing)).toBe(false);
      });
    });

    it('should act as type guard', () => {
      const unknownData: unknown = {
        id: 'test-123',
        type: 'trendline',
        points: [{ time: 1000, value: 100 }],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      };
      
      if (isValidDrawing(unknownData)) {
        // TypeScript should recognize this as ChartDrawing
        expect(unknownData.type).toBe('trendline');
        expect(unknownData.points.length).toBe(1);
      } else {
        fail('Should be valid drawing');
      }
    });
  });
});

describe('Edge cases and complex scenarios', () => {
  it('should handle drawings with maximum complexity', () => {
    const complexDrawing = {
      id: 'complex-pattern-123',
      type: 'pattern' as const,
      points: Array.from({ length: 10 }, (_, i) => ({
        time: Date.now() + i * 3600000,
        value: 50000 + Math.sin(i) * 1000
      })),
      style: {
        color: '#AbCdEf',
        lineWidth: 10,
        lineStyle: 'dotted' as const,
        showLabels: true
      },
      visible: true,
      interactive: true,
      metadata: {
        patternType: 'headAndShoulders',
        confidence: 0.85,
        detectedAt: Date.now(),
        algorithm: 'ml-v2',
        nested: {
          data: {
            complex: true,
            values: [1, 2, 3]
          }
        }
      }
    };
    
    expect(() => ChartDrawingSchema.parse(complexDrawing)).not.toThrow();
  });

  it('should handle special numeric values appropriately', () => {
    // Test with very large timestamps (year 2100)
    const futurePoint = {
      time: 4102444800000,
      value: 100000
    };
    
    expect(() => DrawingPointSchema.parse(futurePoint)).not.toThrow();
    
    // Test with very small positive values
    const smallValuePoint = {
      time: 1000,
      value: 0.00000001
    };
    
    expect(() => DrawingPointSchema.parse(smallValuePoint)).not.toThrow();
    
    // Test with negative values (valid for some use cases)
    const negativeValuePoint = {
      time: 1000,
      value: -100
    };
    
    expect(() => DrawingPointSchema.parse(negativeValuePoint)).not.toThrow();
  });

  it('should preserve metadata types', () => {
    const drawingWithMetadata = {
      id: 'test-123',
      type: 'fibonacci' as const,
      points: [
        { time: 1000, value: 100 },
        { time: 2000, value: 200 }
      ],
      style: {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'solid' as const,
        showLabels: true
      },
      visible: true,
      interactive: true,
      metadata: {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
        undefined: undefined
      }
    };
    
    const result = ChartDrawingSchema.parse(drawingWithMetadata);
    
    expect(result.metadata?.string).toBe('test');
    expect(result.metadata?.number).toBe(123);
    expect(result.metadata?.boolean).toBe(true);
    expect(result.metadata?.array).toEqual([1, 2, 3]);
    expect(result.metadata?.object).toEqual({ nested: 'value' });
    expect(result.metadata?.null).toBeNull();
    expect(result.metadata?.undefined).toBeUndefined();
  });

  it('should handle validation errors with useful information', () => {
    const invalidDrawing = {
      id: '',
      type: 'invalid-type',
      points: [],
      style: {
        color: 'red', // Invalid format
        lineWidth: 0, // Out of range
        lineStyle: 'double', // Invalid option
        showLabels: 'yes' // Wrong type
      },
      visible: 'true', // Wrong type
      interactive: null // Wrong type
    };
    
    try {
      ChartDrawingSchema.parse(invalidDrawing);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      if (error instanceof z.ZodError) {
        // Should have multiple issues
        expect(error.issues.length).toBeGreaterThan(5);
        
        // Check for specific error paths
        const errorPaths = error.issues.map(issue => issue.path.join('.'));
        expect(errorPaths).toContain('id');
        expect(errorPaths).toContain('type');
        expect(errorPaths).toContain('points');
        expect(errorPaths).toContain('style.color');
        expect(errorPaths).toContain('style.lineWidth');
        expect(errorPaths).toContain('style.lineStyle');
        expect(errorPaths).toContain('style.showLabels');
        expect(errorPaths).toContain('visible');
        expect(errorPaths).toContain('interactive');
      }
    }
  });
});