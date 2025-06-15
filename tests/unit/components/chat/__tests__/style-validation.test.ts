import { 
  validateStyleUpdate, 
  validatePatternStyleUpdate,
  StyleUpdateEvent,
  PatternStyleUpdateEvent
} from '@/types/style-editor'

describe('Style Validation Tests', () => {
  describe('validateStyleUpdate', () => {
    it('validates correct style update events', () => {
      const validUpdate: StyleUpdateEvent = {
        drawingId: 'test-123',
        style: {
          color: '#3b82f6',
          lineWidth: 5,
          lineStyle: 'dashed',
          showLabels: true,
        },
        immediate: true,
      }
      
      expect(() => validateStyleUpdate(validUpdate)).not.toThrow()
      const result = validateStyleUpdate(validUpdate)
      expect(result).toEqual(validUpdate)
    })

    it('allows partial style updates', () => {
      const partialUpdate = {
        drawingId: 'test-123',
        style: {
          color: '#ef4444',
        },
      }
      
      expect(() => validateStyleUpdate(partialUpdate)).not.toThrow()
    })

    it('rejects invalid line width', () => {
      const invalidUpdate = {
        drawingId: 'test-123',
        style: {
          lineWidth: 15, // Max is 10
        },
      }
      
      expect(() => validateStyleUpdate(invalidUpdate)).toThrow('Invalid style update: Number must be less than or equal to 10')
    })

    it('rejects invalid line style', () => {
      const invalidUpdate = {
        drawingId: 'test-123',
        style: {
          lineStyle: 'invalid' as any,
        },
      }
      
      expect(() => validateStyleUpdate(invalidUpdate)).toThrow()
    })

    it('accepts color in hex format', () => {
      const hexColorUpdate = {
        drawingId: 'test-123',
        style: {
          color: '#ff00ff',
        },
      }
      
      expect(() => validateStyleUpdate(hexColorUpdate)).not.toThrow()
    })

    it('accepts color names', () => {
      const namedColorUpdate = {
        drawingId: 'test-123',
        style: {
          color: 'red',
        },
      }
      
      expect(() => validateStyleUpdate(namedColorUpdate)).not.toThrow()
    })
  })

  describe('validatePatternStyleUpdate', () => {
    it('validates correct pattern style update events', () => {
      const validUpdate: PatternStyleUpdateEvent = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: 0.5,
          metricLabelPosition: 'left',
          showMetricLabels: true,
          highlightKeyPoints: false,
        },
        immediate: false,
      }
      
      expect(() => validatePatternStyleUpdate(validUpdate)).not.toThrow()
      const result = validatePatternStyleUpdate(validUpdate)
      expect(result).toEqual(validUpdate)
    })

    it('validates line styles for patterns', () => {
      const updateWithLineStyles = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: 0.2,
        },
        lineStyles: {
          target: { color: '#22c55e', lineWidth: 2 },
          stopLoss: { color: '#ef4444', lineWidth: 3 },
          breakout: { color: '#3b82f6', lineStyle: 'dashed' as const },
        },
      }
      
      expect(() => validatePatternStyleUpdate(updateWithLineStyles)).not.toThrow()
    })

    it('rejects invalid opacity values', () => {
      const invalidOpacity = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: 1.5, // Max is 1
        },
      }
      
      expect(() => validatePatternStyleUpdate(invalidOpacity)).toThrow('Invalid pattern style update: Number must be less than or equal to 1')
    })

    it('rejects negative opacity values', () => {
      const negativeOpacity = {
        patternId: 'pattern-123',
        patternStyle: {
          patternFillOpacity: -0.5,
        },
      }
      
      expect(() => validatePatternStyleUpdate(negativeOpacity)).toThrow('Invalid pattern style update: Number must be greater than or equal to 0')
    })

    it('rejects invalid metric label position', () => {
      const invalidPosition = {
        patternId: 'pattern-123',
        patternStyle: {
          metricLabelPosition: 'top' as any, // Only left, center, right are valid
        },
      }
      
      expect(() => validatePatternStyleUpdate(invalidPosition)).toThrow()
    })

    it('allows partial pattern style updates', () => {
      const partialUpdate = {
        patternId: 'pattern-123',
        patternStyle: {
          showMetricLabels: false,
        },
      }
      
      expect(() => validatePatternStyleUpdate(partialUpdate)).not.toThrow()
    })
  })
})