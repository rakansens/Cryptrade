// Jest is configured globally, no imports needed
import type {
  StoreMetadata,
  StoreMigration,
  PatternCoordinate,
  PatternLine,
  PatternVisualization,
  PatternZone,
  PatternLabel,
  PatternMetrics,
  TradingProposal,
  ProposalGroup,
  EntryProposal,
  EntryProposalGroup,
  IndicatorValue,
  IndicatorConfig,
  AnalysisMetadata,
  AnalysisResult
} from '../store.types';
import {
  isPatternVisualization,
  isProposalGroup,
  isEntryProposalGroup,
  createMigration,
  isValidPersistedState
} from '../store.types';

describe('store.types', () => {
  describe('isPatternVisualization', () => {
    it('should return true for valid PatternVisualization', () => {
      const validVisualization: PatternVisualization = {
        type: 'triangle',
        lines: [
          {
            start: { time: Date.now(), price: 100 },
            end: { time: Date.now() + 1000, price: 110 }
          }
        ]
      };

      expect(isPatternVisualization(validVisualization)).toBe(true);
    });

    it('should return true with optional fields', () => {
      const validVisualization: PatternVisualization = {
        type: 'wedge',
        lines: [
          {
            start: { time: Date.now(), price: 100 },
            end: { time: Date.now() + 1000, price: 110 },
            type: 'support',
            style: 'dashed'
          }
        ],
        zones: [
          {
            start: { time: Date.now(), price: 95 },
            end: { time: Date.now() + 2000, price: 105 },
            color: '#ff0000',
            opacity: 0.2,
            label: 'Support Zone'
          }
        ],
        labels: [
          {
            position: { time: Date.now() + 500, price: 105 },
            text: 'Pattern Peak',
            style: {
              color: '#000000',
              fontSize: 12,
              backgroundColor: '#ffffff'
            }
          }
        ],
        keyPoints: [
          { time: Date.now(), price: 100 },
          { time: Date.now() + 1000, price: 110 }
        ]
      };

      expect(isPatternVisualization(validVisualization)).toBe(true);
    });

    it('should return true for empty lines array', () => {
      const validVisualization: PatternVisualization = {
        type: 'channel',
        lines: []
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

    it('should return false for missing required fields', () => {
      expect(isPatternVisualization({})).toBe(false);
      expect(isPatternVisualization({ type: 'triangle' })).toBe(false);
      expect(isPatternVisualization({ lines: [] })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isPatternVisualization({
        type: 123, // should be string
        lines: []
      })).toBe(false);

      expect(isPatternVisualization({
        type: 'triangle',
        lines: 'not-an-array' // should be array
      })).toBe(false);
    });
  });

  describe('isProposalGroup', () => {
    it('should return true for valid ProposalGroup', () => {
      const validGroup: ProposalGroup = {
        id: 'group-1',
        proposals: [
          {
            id: 'proposal-1',
            type: 'buy',
            price: 100.50,
            reason: 'Strong support',
            confidence: 0.85,
            timestamp: Date.now()
          }
        ],
        timestamp: Date.now()
      };

      expect(isProposalGroup(validGroup)).toBe(true);
    });

    it('should return true with optional fields', () => {
      const validGroup: ProposalGroup = {
        id: 'group-1',
        proposals: [
          {
            id: 'proposal-1',
            type: 'sell',
            price: 110.50,
            stopLoss: 112.00,
            takeProfit: 105.00,
            reason: 'Resistance reached',
            confidence: 0.90,
            timestamp: Date.now()
          }
        ],
        summary: 'Bearish reversal pattern',
        totalConfidence: 0.90,
        timestamp: Date.now()
      };

      expect(isProposalGroup(validGroup)).toBe(true);
    });

    it('should return true for empty proposals array', () => {
      const validGroup: ProposalGroup = {
        id: 'group-1',
        proposals: [],
        timestamp: Date.now()
      };

      expect(isProposalGroup(validGroup)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isProposalGroup(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isProposalGroup(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isProposalGroup('string')).toBe(false);
      expect(isProposalGroup(123)).toBe(false);
      expect(isProposalGroup(true)).toBe(false);
      expect(isProposalGroup([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isProposalGroup({})).toBe(false);
      expect(isProposalGroup({ id: 'group-1' })).toBe(false);
      expect(isProposalGroup({ id: 'group-1', proposals: [] })).toBe(false);
      expect(isProposalGroup({ proposals: [], timestamp: Date.now() })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isProposalGroup({
        id: 123, // should be string
        proposals: [],
        timestamp: Date.now()
      })).toBe(false);

      expect(isProposalGroup({
        id: 'group-1',
        proposals: 'not-an-array', // should be array
        timestamp: Date.now()
      })).toBe(false);

      expect(isProposalGroup({
        id: 'group-1',
        proposals: [],
        timestamp: '2024-01-01' // should be number
      })).toBe(false);
    });
  });

  describe('isEntryProposalGroup', () => {
    it('should return true for valid EntryProposalGroup', () => {
      const validGroup: EntryProposalGroup = {
        id: 'entry-group-1',
        entries: [
          {
            id: 'entry-1',
            entryType: 'limit',
            direction: 'long',
            entryPrice: 100.00,
            stopLoss: 95.00,
            takeProfit: 110.00,
            riskRewardRatio: 2.0,
            positionSize: 0.1,
            reasoning: 'Bullish reversal at support',
            confidence: 0.80
          }
        ],
        timestamp: Date.now()
      };

      expect(isEntryProposalGroup(validGroup)).toBe(true);
    });

    it('should return true with optional fields', () => {
      const validGroup: EntryProposalGroup = {
        id: 'entry-group-1',
        entries: [
          {
            id: 'entry-1',
            entryType: 'market',
            direction: 'short',
            entryPrice: 105.00,
            stopLoss: 110.00,
            takeProfit: 95.00,
            riskRewardRatio: 2.0,
            positionSize: 0.05,
            reasoning: 'Breaking key support',
            confidence: 0.75
          }
        ],
        marketContext: 'Bearish trend continuation',
        riskAssessment: 'Moderate risk due to volatility',
        timestamp: Date.now()
      };

      expect(isEntryProposalGroup(validGroup)).toBe(true);
    });

    it('should return true for empty entries array', () => {
      const validGroup: EntryProposalGroup = {
        id: 'entry-group-1',
        entries: [],
        timestamp: Date.now()
      };

      expect(isEntryProposalGroup(validGroup)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isEntryProposalGroup(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEntryProposalGroup(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isEntryProposalGroup('string')).toBe(false);
      expect(isEntryProposalGroup(123)).toBe(false);
      expect(isEntryProposalGroup(true)).toBe(false);
      expect(isEntryProposalGroup([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isEntryProposalGroup({})).toBe(false);
      expect(isEntryProposalGroup({ id: 'entry-group-1' })).toBe(false);
      expect(isEntryProposalGroup({ id: 'entry-group-1', entries: [] })).toBe(false);
      expect(isEntryProposalGroup({ entries: [], timestamp: Date.now() })).toBe(false);
    });

    it('should return false for wrong field types', () => {
      expect(isEntryProposalGroup({
        id: 123, // should be string
        entries: [],
        timestamp: Date.now()
      })).toBe(false);

      expect(isEntryProposalGroup({
        id: 'entry-group-1',
        entries: 'not-an-array', // should be array
        timestamp: Date.now()
      })).toBe(false);

      expect(isEntryProposalGroup({
        id: 'entry-group-1',
        entries: [],
        timestamp: '2024-01-01' // should be number
      })).toBe(false);
    });
  });

  describe('createMigration', () => {
    it('should create a valid migration', () => {
      const migrator = jest.fn((state: unknown) => ({ 
        version: 2, 
        data: state 
      }));
      
      const migration = createMigration(2, migrator);

      expect(migration.version).toBe(2);
      expect(migration.migrate).toBeDefined();
    });

    it('should log migration and call migrator', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const migrator = jest.fn((state: unknown) => ({ 
        version: 2, 
        data: state 
      }));
      
      const migration = createMigration(2, migrator);
      const testState = { oldData: 'test' };
      
      const result = migration.migrate(testState, 1);

      expect(consoleSpy).toHaveBeenCalledWith('Migrating store from version 1 to 2');
      expect(migrator).toHaveBeenCalledWith(testState);
      expect(result).toEqual({ version: 2, data: testState });

      consoleSpy.mockRestore();
    });
  });

  describe('isValidPersistedState', () => {
    let mockValidator: jest.Mock<boolean>;
    
    beforeEach(() => {
      mockValidator = jest.fn((s: unknown): s is { valid: boolean } => {
        return typeof s === 'object' && 
               s !== null && 
               'valid' in s && 
               (s as any).valid === true;
      });
    });

    it('should return true for valid state', () => {
      const state = { valid: true };
      expect(isValidPersistedState(state, mockValidator)).toBe(true);
      expect(mockValidator).toHaveBeenCalledWith(state);
    });

    it('should return false for null', () => {
      expect(isValidPersistedState(null, mockValidator)).toBe(false);
      expect(mockValidator).not.toHaveBeenCalled();
    });

    it('should return false for undefined', () => {
      expect(isValidPersistedState(undefined, mockValidator)).toBe(false);
      expect(mockValidator).not.toHaveBeenCalled();
    });

    it('should return false for non-object values', () => {
      expect(isValidPersistedState('string', mockValidator)).toBe(false);
      expect(isValidPersistedState(123, mockValidator)).toBe(false);
      expect(isValidPersistedState(true, mockValidator)).toBe(false);
      expect(mockValidator).not.toHaveBeenCalled();
    });

    it('should return false when validator returns false', () => {
      const state = { valid: false };
      expect(isValidPersistedState(state, mockValidator)).toBe(false);
      expect(mockValidator).toHaveBeenCalledWith(state);
    });
  });

  describe('Interface validation', () => {
    it('should accept valid StoreMetadata', () => {
      const metadata: StoreMetadata = {
        version: 1,
        lastUpdated: Date.now(),
        migratedFrom: 0
      };

      expect(metadata).toBeDefined();
    });

    it('should accept valid PatternCoordinate', () => {
      const coordinate: PatternCoordinate = {
        time: Date.now(),
        price: 100.50
      };

      expect(coordinate).toBeDefined();
    });

    it('should accept valid TradingProposal', () => {
      const proposal: TradingProposal = {
        id: 'proposal-1',
        type: 'buy',
        price: 100.50,
        stopLoss: 95.00,
        takeProfit: 110.00,
        reason: 'Strong support level',
        confidence: 0.85,
        timestamp: Date.now()
      };

      expect(proposal).toBeDefined();
    });

    it('should accept valid IndicatorConfig', () => {
      const config: IndicatorConfig = {
        enabled: true,
        parameters: {
          period: 14,
          type: 'exponential'
        },
        style: {
          color: '#ff0000',
          lineWidth: 2,
          opacity: 0.8
        }
      };

      expect(config).toBeDefined();
    });

    it('should accept valid AnalysisResult', () => {
      const result: AnalysisResult = {
        id: 'analysis-1',
        type: 'pattern-detection',
        data: { pattern: 'triangle', confidence: 0.85 },
        metadata: {
          timestamp: Date.now(),
          duration: 1500,
          model: 'pattern-v1',
          version: '1.0.0',
          confidence: 0.85
        }
      };

      expect(result).toBeDefined();
    });

    it('should accept various IndicatorValue types', () => {
      const value1: IndicatorValue = 100.50;
      const value2: IndicatorValue = { macd: 1.25, signal: 1.10 };
      const value3: IndicatorValue = null;

      expect(value1).toBeDefined();
      expect(value2).toBeDefined();
      expect(value3).toBeNull();
    });
  });
});