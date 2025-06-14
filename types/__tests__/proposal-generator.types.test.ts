// Jest is configured globally, no imports needed
import type {
  ProposalData,
  ConfidenceFactors,
  ConfidenceResult,
  TrendlineCandidate
} from '../proposal-generator.types';
import type { DrawingPoint, DrawingStyle } from '../ui-events.types';

describe('proposal-generator.types', () => {
  describe('ProposalData interface', () => {
    it('should accept valid ProposalData with required fields', () => {
      const proposal: ProposalData = {
        id: 'proposal-1',
        type: 'trendline',
        title: 'Bullish Trendline',
        description: 'Strong upward trend detected',
        confidence: 0.85,
        priority: 'high',
        drawingData: {
          type: 'trendline',
          points: [
            { time: Date.now(), value: 100 },
            { time: Date.now() + 1000, value: 110 }
          ]
        },
        analysis: {
          direction: 'bullish',
          strength: 0.9
        }
      };

      expect(proposal).toBeDefined();
      expect(proposal.confidence).toBeGreaterThanOrEqual(0);
      expect(proposal.confidence).toBeLessThanOrEqual(1);
    });

    it('should accept ProposalData with all optional fields', () => {
      const proposal: ProposalData = {
        id: 'proposal-2',
        type: 'support-resistance',
        title: 'Support Level',
        description: 'Major support level identified',
        confidence: 0.75,
        priority: 'medium',
        drawingData: {
          type: 'horizontal-line',
          points: [
            { time: Date.now(), value: 95 },
            { time: Date.now() + 5000, value: 95 }
          ],
          style: {
            color: '#00ff00',
            lineWidth: 2,
            lineStyle: 'dashed',
            showLabels: true
          },
          metadata: {
            source: 'technical-analysis',
            timeframe: '1h'
          }
        },
        analysis: {
          direction: 'neutral',
          strength: 0.8,
          touches: 5,
          angle: 0,
          length: 5000,
          volumeProfile: 'high',
          historicalSignificance: 0.9
        },
        metadata: {
          createdBy: 'system',
          strategy: 'support-resistance'
        }
      };

      expect(proposal).toBeDefined();
      expect(proposal.drawingData.style).toBeDefined();
      expect(proposal.drawingData.metadata).toBeDefined();
      expect(proposal.metadata).toBeDefined();
    });

    it('should accept all valid priority values', () => {
      const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
      
      priorities.forEach(priority => {
        const proposal: ProposalData = {
          id: `proposal-${priority}`,
          type: 'test',
          title: 'Test Proposal',
          description: 'Test description',
          confidence: 0.5,
          priority,
          drawingData: {
            type: 'test',
            points: []
          },
          analysis: {}
        };
        
        expect(proposal.priority).toBe(priority);
      });
    });

    it('should accept all valid analysis directions', () => {
      const directions: Array<'bullish' | 'bearish' | 'neutral'> = ['bullish', 'bearish', 'neutral'];
      
      directions.forEach(direction => {
        const proposal: ProposalData = {
          id: `proposal-${direction}`,
          type: 'test',
          title: 'Test Proposal',
          description: 'Test description',
          confidence: 0.5,
          priority: 'medium',
          drawingData: {
            type: 'test',
            points: []
          },
          analysis: {
            direction
          }
        };
        
        expect(proposal.analysis.direction).toBe(direction);
      });
    });

    it('should accept analysis with dynamic properties', () => {
      const proposal: ProposalData = {
        id: 'proposal-dynamic',
        type: 'pattern',
        title: 'Complex Pattern',
        description: 'Advanced pattern analysis',
        confidence: 0.9,
        priority: 'high',
        drawingData: {
          type: 'pattern',
          points: []
        },
        analysis: {
          direction: 'bullish',
          strength: 0.85,
          customMetric1: 100,
          customMetric2: 'strong',
          nestedData: {
            level1: {
              level2: 'deep'
            }
          }
        }
      };

      expect(proposal.analysis['customMetric1']).toBe(100);
      expect(proposal.analysis['customMetric2']).toBe('strong');
      expect(proposal.analysis['nestedData']).toBeDefined();
    });
  });

  describe('ConfidenceFactors interface', () => {
    it('should accept valid ConfidenceFactors with baseFactor only', () => {
      const factors: ConfidenceFactors = {
        baseFactor: 0.5
      };

      expect(factors).toBeDefined();
      expect(factors.baseFactor).toBe(0.5);
    });

    it('should accept ConfidenceFactors with all optional factors', () => {
      const factors: ConfidenceFactors = {
        baseFactor: 0.5,
        touchFactor: 0.8,
        lengthFactor: 0.7,
        volumeFactor: 0.9,
        timeFactor: 0.6
      };

      expect(factors).toBeDefined();
      expect(factors.touchFactor).toBe(0.8);
      expect(factors.lengthFactor).toBe(0.7);
      expect(factors.volumeFactor).toBe(0.9);
      expect(factors.timeFactor).toBe(0.6);
    });

    it('should accept ConfidenceFactors with dynamic properties', () => {
      const factors: ConfidenceFactors = {
        baseFactor: 0.5,
        customFactor1: 0.75,
        customFactor2: 0.85,
        patternSpecificFactor: 0.95
      };

      expect(factors['customFactor1']).toBe(0.75);
      expect(factors['customFactor2']).toBe(0.85);
      expect(factors['patternSpecificFactor']).toBe(0.95);
    });

    it('should handle undefined values for optional factors', () => {
      const factors: ConfidenceFactors = {
        baseFactor: 0.5,
        touchFactor: undefined,
        lengthFactor: 0.7,
        volumeFactor: undefined
      };

      expect(factors.touchFactor).toBeUndefined();
      expect(factors.volumeFactor).toBeUndefined();
      expect(factors.lengthFactor).toBe(0.7);
    });
  });

  describe('ConfidenceResult interface', () => {
    it('should accept valid ConfidenceResult', () => {
      const result: ConfidenceResult = {
        confidence: 0.85,
        factors: {
          baseFactor: 0.5,
          touchFactor: 0.9,
          lengthFactor: 0.8
        }
      };

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0.85);
      expect(result.factors).toBeDefined();
    });

    it('should accept ConfidenceResult with minimal factors', () => {
      const result: ConfidenceResult = {
        confidence: 0.6,
        factors: {
          baseFactor: 0.6
        }
      };

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0.6);
      expect(result.factors.baseFactor).toBe(0.6);
    });

    it('should accept ConfidenceResult with comprehensive factors', () => {
      const result: ConfidenceResult = {
        confidence: 0.92,
        factors: {
          baseFactor: 0.7,
          touchFactor: 0.95,
          lengthFactor: 0.85,
          volumeFactor: 0.9,
          timeFactor: 0.88,
          marketConditionFactor: 0.8,
          volatilityFactor: 0.75
        }
      };

      expect(result.confidence).toBe(0.92);
      expect(Object.keys(result.factors).length).toBe(7);
    });
  });

  describe('TrendlineCandidate interface', () => {
    it('should accept valid TrendlineCandidate', () => {
      const candidate: TrendlineCandidate = {
        points: [
          { time: Date.now(), value: 100 },
          { time: Date.now() + 1000, value: 105 },
          { time: Date.now() + 2000, value: 110 }
        ],
        touches: 3,
        angle: 15.5,
        strength: 0.85,
        type: 'support'
      };

      expect(candidate).toBeDefined();
      expect(candidate.touches).toBe(3);
      expect(candidate.angle).toBe(15.5);
      expect(candidate.strength).toBe(0.85);
      expect(candidate.type).toBe('support');
    });

    it('should accept both support and resistance types', () => {
      const supportCandidate: TrendlineCandidate = {
        points: [
          { time: Date.now(), value: 95 },
          { time: Date.now() + 1000, value: 96 }
        ],
        touches: 2,
        angle: 5.0,
        strength: 0.7,
        type: 'support'
      };

      const resistanceCandidate: TrendlineCandidate = {
        points: [
          { time: Date.now(), value: 120 },
          { time: Date.now() + 1000, value: 119 }
        ],
        touches: 4,
        angle: -2.5,
        strength: 0.9,
        type: 'resistance'
      };

      expect(supportCandidate.type).toBe('support');
      expect(resistanceCandidate.type).toBe('resistance');
    });

    it('should handle negative angles', () => {
      const candidate: TrendlineCandidate = {
        points: [
          { time: Date.now(), value: 110 },
          { time: Date.now() + 1000, value: 105 },
          { time: Date.now() + 2000, value: 100 }
        ],
        touches: 3,
        angle: -15.5,
        strength: 0.8,
        type: 'resistance'
      };

      expect(candidate.angle).toBeLessThan(0);
      expect(candidate.angle).toBe(-15.5);
    });

    it('should handle empty points array', () => {
      const candidate: TrendlineCandidate = {
        points: [],
        touches: 0,
        angle: 0,
        strength: 0,
        type: 'support'
      };

      expect(candidate.points).toHaveLength(0);
      expect(candidate.touches).toBe(0);
    });
  });

  describe('Integration tests', () => {
    it('should work with DrawingPoint from ui-events.types', () => {
      const drawingPoints: DrawingPoint[] = [
        { time: Date.now(), value: 100 },
        { time: Date.now() + 1000, price: 105 },
        { time: Date.now() + 2000, value: 110, price: 110 }
      ];

      const proposal: ProposalData = {
        id: 'integration-test',
        type: 'trendline',
        title: 'Integration Test',
        description: 'Testing type compatibility',
        confidence: 0.8,
        priority: 'high',
        drawingData: {
          type: 'trendline',
          points: drawingPoints
        },
        analysis: {}
      };

      expect(proposal.drawingData.points).toHaveLength(3);
    });

    it('should work with DrawingStyle from ui-events.types', () => {
      const style: DrawingStyle = {
        color: '#ff0000',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      };

      const proposal: ProposalData = {
        id: 'style-test',
        type: 'pattern',
        title: 'Style Test',
        description: 'Testing style compatibility',
        confidence: 0.75,
        priority: 'medium',
        drawingData: {
          type: 'pattern',
          points: [],
          style: style
        },
        analysis: {}
      };

      expect(proposal.drawingData.style).toEqual(style);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle confidence values at boundaries', () => {
      const minConfidence: ProposalData = {
        id: 'min-confidence',
        type: 'test',
        title: 'Min Confidence',
        description: 'Testing minimum confidence',
        confidence: 0,
        priority: 'low',
        drawingData: { type: 'test', points: [] },
        analysis: {}
      };

      const maxConfidence: ProposalData = {
        id: 'max-confidence',
        type: 'test',
        title: 'Max Confidence',
        description: 'Testing maximum confidence',
        confidence: 1,
        priority: 'high',
        drawingData: { type: 'test', points: [] },
        analysis: {}
      };

      expect(minConfidence.confidence).toBe(0);
      expect(maxConfidence.confidence).toBe(1);
    });

    it('should handle complex nested metadata', () => {
      const proposal: ProposalData = {
        id: 'complex-metadata',
        type: 'advanced-pattern',
        title: 'Complex Pattern',
        description: 'Pattern with nested metadata',
        confidence: 0.85,
        priority: 'high',
        drawingData: {
          type: 'pattern',
          points: [],
          metadata: {
            pattern: {
              primary: 'triangle',
              secondary: ['flag', 'pennant'],
              characteristics: {
                breakout: 'likely',
                direction: 'up',
                strength: { value: 0.8, confidence: 0.9 }
              }
            }
          }
        },
        analysis: {
          direction: 'bullish',
          nestedAnalysis: {
            level1: {
              level2: {
                level3: 'deep-value'
              }
            }
          }
        },
        metadata: {
          source: 'ml-model',
          modelVersion: '2.0',
          parameters: {
            sensitivity: 0.7,
            lookback: 100
          }
        }
      };

      expect(proposal.drawingData.metadata).toBeDefined();
      expect(proposal.metadata).toBeDefined();
      expect(proposal.analysis['nestedAnalysis']).toBeDefined();
    });
  });
});