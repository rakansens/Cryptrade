import { describe, it, expect } from '@jest/globals';
import { validateChartEvent, createChartEvent, ChartEventSchemas } from '../chart-events';

describe('Chart Events Validation', () => {
  describe('addDrawing event', () => {
    it('should validate correct addDrawing payload', () => {
      const payload = {
        id: 'test-drawing-123',
        type: 'trendline' as const,
        points: [
          { time: 1234567890, value: 100 },
          { time: 1234567900, value: 110 }
        ],
        style: {
          color: '#ff0000',
          lineWidth: 2,
          lineStyle: 'solid' as const
        }
      };

      const result = validateChartEvent('addDrawing', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test-drawing-123');
        expect(result.data.type).toBe('trendline');
        expect(result.data.points).toHaveLength(2);
      }
    });

    it('should reject invalid addDrawing payload', () => {
      const payload = {
        id: '', // Empty string should fail
        type: 'invalid-type',
        points: [] // Empty array should fail (min 1)
      };

      const result = validateChartEvent('addDrawing', payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle horizontal line with price', () => {
      const payload = {
        id: 'horizontal-line-123',
        type: 'horizontal' as const,
        points: [{ time: 1234567890, value: 100 }],
        price: 105.5
      };

      const result = validateChartEvent('addDrawing', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(105.5);
      }
    });
  });

  describe('deleteDrawing event', () => {
    it('should validate correct deleteDrawing payload', () => {
      const payload = { id: 'drawing-to-delete-123' };

      const result = validateChartEvent('deleteDrawing', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('drawing-to-delete-123');
      }
    });

    it('should reject deleteDrawing without id', () => {
      const payload = {};

      const result = validateChartEvent('deleteDrawing', payload);
      expect(result.success).toBe(false);
    });
  });

  describe('addPattern event', () => {
    it('should validate correct addPattern payload', () => {
      const payload = {
        id: 'pattern-123',
        pattern: {
          type: 'head_and_shoulders',
          visualization: {
            keyPoints: [
              { time: 1234567890, value: 100, type: 'trough', label: 'Left' },
              { time: 1234567900, value: 110, type: 'peak', label: 'Head' }
            ],
            lines: [
              { from: 0, to: 1, type: 'outline' }
            ]
          },
          metrics: {
            target_level: 120,
            stop_loss: 95
          },
          confidence: 0.8
        }
      };

      const result = validateChartEvent('addPattern', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern.type).toBe('head_and_shoulders');
        expect(result.data.pattern.visualization.keyPoints).toHaveLength(2);
        expect(result.data.pattern.metrics?.target_level).toBe(120);
      }
    });

    it('should reject pattern with empty keyPoints', () => {
      const payload = {
        id: 'pattern-123',
        pattern: {
          type: 'triangle',
          visualization: {
            keyPoints: [] // Should fail (min 1)
          }
        }
      };

      const result = validateChartEvent('addPattern', payload);
      expect(result.success).toBe(false);
    });
  });

  describe('updateDrawingStyle event', () => {
    it('should validate updateDrawingStyle with drawingId', () => {
      const payload = {
        drawingId: 'drawing-123',
        style: {
          color: '#00ff00',
          lineWidth: 3
        },
        immediate: true
      };

      const result = validateChartEvent('updateDrawingStyle', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.drawingId).toBe('drawing-123');
        expect(result.data.style.color).toBe('#00ff00');
        expect(result.data.immediate).toBe(true);
      }
    });

    it('should handle legacy id field', () => {
      const payload = {
        id: 'legacy-drawing-123', // Legacy field
        style: {
          color: '#0000ff'
        }
      };

      const result = validateChartEvent('updateDrawingStyle', payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.drawingId).toBe('legacy-drawing-123');
      }
    });
  });

  describe('createChartEvent helper', () => {
    it('should create valid CustomEvent', () => {
      const payload = {
        id: 'test-drawing',
        type: 'trendline' as const,
        points: [{ time: 1234567890, value: 100 }]
      };

      const event = createChartEvent('addDrawing', payload);
      expect(event.type).toBe('chart:addDrawing');
      expect(event.detail.id).toBe('test-drawing');
    });

    it('should throw on invalid payload', () => {
      const invalidPayload = {
        id: '', // Invalid
        type: 'invalid'
      };

      expect(() => {
        createChartEvent('addDrawing', invalidPayload as any);
      }).toThrow();
    });
  });

  describe('unknown event type', () => {
    it('should handle unknown event type', () => {
      const result = validateChartEvent('unknownEvent' as any, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Unknown event type');
      }
    });
  });
});