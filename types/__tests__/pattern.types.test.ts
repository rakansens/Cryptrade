// Jest is configured globally, no imports needed
import type { 
  PatternVisualization, 
  PatternPoint, 
  PatternLine, 
  PatternChannel,
  PatternLabel,
  PatternMetrics,
  PatternState,
  PatternRenderer
} from '../pattern.types';
import { 
  isPatternVisualization, 
  isPatternMetrics, 
  isPatternRenderer 
} from '../pattern.types';

describe('pattern.types', () => {
  describe('isPatternVisualization', () => {
    it('should return true for valid PatternVisualization', () => {
      const validVisualization: PatternVisualization = {
        type: 'triangle',
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 110 }
        ]
      };

      expect(isPatternVisualization(validVisualization)).toBe(true);
    });

    it('should return true for all valid pattern types', () => {
      const patternTypes = ['triangle', 'channel', 'wedge', 'pennant', 'flag'];
      
      patternTypes.forEach(type => {
        const visualization = {
          type,
          points: [{ time: Date.now(), value: 100 }]
        };
        expect(isPatternVisualization(visualization)).toBe(true);
      });
    });

    it('should return true with optional fields', () => {
      const validVisualization: PatternVisualization = {
        type: 'channel',
        points: [
          { time: Date.now(), value: 100, type: 'high' },
          { time: Date.now() + 1000, value: 90, type: 'low' }
        ],
        lines: [{
          point1: { time: Date.now(), value: 100 },
          point2: { time: Date.now() + 1000, value: 110 },
          color: '#ff0000'
        }],
        channels: [{
          upperLine: {
            point1: { time: Date.now(), value: 100 },
            point2: { time: Date.now() + 1000, value: 110 }
          },
          lowerLine: {
            point1: { time: Date.now(), value: 90 },
            point2: { time: Date.now() + 1000, value: 100 }
          },
          fillColor: '#00ff00',
          fillOpacity: 0.2
        }],
        labels: [{
          point: { time: Date.now(), value: 100 },
          text: 'Pattern Label'
        }]
      };

      expect(isPatternVisualization(validVisualization)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPatternVisualization(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPatternVisualization(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPatternVisualization('string')).toBe(false);
      expect(isPatternVisualization(123)).toBe(false);
      expect(isPatternVisualization(true)).toBe(false);
      expect(isPatternVisualization([])).toBe(false);
    });

    it('should return false for invalid pattern type', () => {
      const invalidVisualization = {
        type: 'invalid-type',
        points: []
      };
      expect(isPatternVisualization(invalidVisualization)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isPatternVisualization({})).toBe(false);
      expect(isPatternVisualization({ type: 'triangle' })).toBe(false);
      expect(isPatternVisualization({ points: [] })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isPatternVisualization({
        type: 123, // should be string
        points: []
      })).toBe(false);

      expect(isPatternVisualization({
        type: 'triangle',
        points: 'not-an-array' // should be array
      })).toBe(false);
    });
  });

  describe('isPatternMetrics', () => {
    it('should return true for valid PatternMetrics', () => {
      const validMetrics: PatternMetrics = {
        confidence: 0.85,
        strength: 0.9
      };

      expect(isPatternMetrics(validMetrics)).toBe(true);
    });

    it('should return true with optional fields', () => {
      const validMetrics: PatternMetrics = {
        confidence: 0.85,
        strength: 0.9,
        volume: 1000000,
        priceChange: 5.2,
        duration: 3600,
        breakoutProbability: 0.75
      };

      expect(isPatternMetrics(validMetrics)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPatternMetrics(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPatternMetrics(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPatternMetrics('string')).toBe(false);
      expect(isPatternMetrics(123)).toBe(false);
      expect(isPatternMetrics(true)).toBe(false);
      expect(isPatternMetrics([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isPatternMetrics({})).toBe(false);
      expect(isPatternMetrics({ confidence: 0.85 })).toBe(false);
      expect(isPatternMetrics({ strength: 0.9 })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isPatternMetrics({
        confidence: '0.85', // should be number
        strength: 0.9
      })).toBe(false);

      expect(isPatternMetrics({
        confidence: 0.85,
        strength: '0.9' // should be number
      })).toBe(false);
    });
  });

  describe('isPatternRenderer', () => {
    it('should return true for valid PatternRenderer', () => {
      const validRenderer: PatternRenderer = {
        renderPattern: () => {},
        removePattern: () => {},
        removeAllPatterns: () => {},
        debugGetState: () => ({ patterns: new Map() }),
        updateTimeScale: () => {}
      };

      expect(isPatternRenderer(validRenderer)).toBe(true);
    });

    it('should return true for minimal PatternRenderer', () => {
      const minimalRenderer = {
        renderPattern: () => {},
        removePattern: () => {},
        removeAllPatterns: () => {}
      };

      expect(isPatternRenderer(minimalRenderer)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPatternRenderer(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPatternRenderer(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPatternRenderer('string')).toBe(false);
      expect(isPatternRenderer(123)).toBe(false);
      expect(isPatternRenderer(true)).toBe(false);
      expect(isPatternRenderer([])).toBe(false);
    });

    it('should return false for missing required methods', () => {
      expect(isPatternRenderer({})).toBe(false);
      expect(isPatternRenderer({ renderPattern: () => {} })).toBe(false);
      expect(isPatternRenderer({ 
        renderPattern: () => {},
        removePattern: () => {}
      })).toBe(false);
    });

    it('should return false for wrong method types', () => {
      expect(isPatternRenderer({
        renderPattern: 'not-a-function', // should be function
        removePattern: () => {},
        removeAllPatterns: () => {}
      })).toBe(false);

      expect(isPatternRenderer({
        renderPattern: () => {},
        removePattern: 'not-a-function', // should be function
        removeAllPatterns: () => {}
      })).toBe(false);

      expect(isPatternRenderer({
        renderPattern: () => {},
        removePattern: () => {},
        removeAllPatterns: 'not-a-function' // should be function
      })).toBe(false);
    });
  });

  describe('PatternPoint interface', () => {
    it('should accept valid PatternPoint objects', () => {
      const point1: PatternPoint = {
        time: Date.now(),
        value: 100
      };

      const point2: PatternPoint = {
        time: Date.now(),
        value: 100,
        type: 'high'
      };

      expect(point1).toBeDefined();
      expect(point2).toBeDefined();
    });
  });

  describe('PatternLine interface', () => {
    it('should accept valid PatternLine objects', () => {
      const line: PatternLine = {
        point1: { time: Date.now(), value: 100 },
        point2: { time: Date.now() + 1000, value: 110 },
        color: '#ff0000',
        width: 2,
        style: 0
      };

      expect(line).toBeDefined();
    });
  });

  describe('PatternState interface', () => {
    it('should accept valid PatternState objects', () => {
      const state: PatternState = {
        id: 'pattern-1',
        type: 'triangle',
        visualization: {
          type: 'triangle',
          points: [
            { time: Date.now(), value: 100 },
            { time: Date.now() + 1000, value: 110 }
          ]
        },
        metrics: {
          confidence: 0.85,
          strength: 0.9
        },
        timestamp: Date.now()
      };

      expect(state).toBeDefined();
    });
  });
});