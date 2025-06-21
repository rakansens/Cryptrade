import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { proposalGenerationTool } from '@/lib/mastra/tools/proposal-generation.tool';
import { memoryRecallTool } from '@/lib/mastra/tools/memory-recall.tool';
import { uiStateTool } from '@/lib/mastra/tools/ui-state.tool';
import { marketSnapshotTool } from '@/lib/mastra/tools/market-snapshot.tool';
import { agentSelectionTool } from '@/lib/mastra/tools/agent-selection.tool';
import { 
  calculateConfidence,
  validateDrawing,
  generatePattern,
  generateTrendline,
  generateFibonacci,
  generateSupportResistance,
} from '@/lib/mastra/tools/proposal-generation/index';
import type { 
  ProposalGenerationInput,
  DrawingValidationInput,
  PatternGenerationInput,
  ConfidenceFactors,
} from '@/lib/mastra/tools/proposal-generation/types';

// Mock dependencies
jest.mock('@/lib/services/chart-drawing.service');
jest.mock('@/lib/services/database/memory.service');
jest.mock('../../../store/ui.store');

describe('Mastra Tools Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Proposal Generation Tool', () => {
    const mockInput: ProposalGenerationInput = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      analysisType: 'pattern',
      priceData: {
        current: 50000,
        high24h: 51000,
        low24h: 49000,
        volume24h: 1000000,
      },
      indicators: {
        rsi: { value: 65, period: 14 },
        macd: { 
          value: 100,
          signal: 80,
          histogram: 20,
        },
      },
    };

    it('should generate pattern-based proposals', async () => {
      const result = await proposalGenerationTool.execute({
        input: mockInput,
      });

      expect(result).toHaveProperty('proposals');
      expect(result.proposals).toBeInstanceOf(Array);
      expect(result.proposals.length).toBeGreaterThan(0);
      
      const proposal = result.proposals[0];
      expect(proposal).toHaveProperty('type');
      expect(proposal).toHaveProperty('confidence');
      expect(proposal).toHaveProperty('entry');
      expect(proposal).toHaveProperty('targets');
      expect(proposal).toHaveProperty('stopLoss');
    });

    it('should generate support/resistance proposals', async () => {
      const input = {
        ...mockInput,
        analysisType: 'support-resistance',
      };

      const result = await proposalGenerationTool.execute({ input });

      expect(result.proposals).toBeDefined();
      result.proposals.forEach((proposal) => {
        expect(['support', 'resistance']).toContain(proposal.type);
        expect(proposal.levels).toBeDefined();
        expect(proposal.levels.length).toBeGreaterThan(0);
      });
    });

    it('should handle fibonacci analysis', async () => {
      const input = {
        ...mockInput,
        analysisType: 'fibonacci',
        fibonacciLevels: {
          high: 52000,
          low: 48000,
        },
      };

      const result = await proposalGenerationTool.execute({ input });

      expect(result.proposals).toBeDefined();
      const fibProposal = result.proposals.find(p => p.type === 'fibonacci');
      expect(fibProposal).toBeDefined();
      expect(fibProposal?.retracementLevels).toBeDefined();
      expect(fibProposal?.retracementLevels).toHaveProperty('0.236');
      expect(fibProposal?.retracementLevels).toHaveProperty('0.382');
      expect(fibProposal?.retracementLevels).toHaveProperty('0.5');
      expect(fibProposal?.retracementLevels).toHaveProperty('0.618');
    });

    it('should calculate confidence scores correctly', () => {
      const factors: ConfidenceFactors = {
        technicalScore: 0.8,
        volumeScore: 0.7,
        trendScore: 0.9,
        indicatorAlignment: 0.85,
      };

      const confidence = calculateConfidence(factors);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
      expect(confidence).toBeCloseTo(0.8125, 3); // Average of factors
    });

    it('should validate drawings before generation', () => {
      const validationInput: DrawingValidationInput = {
        drawing: {
          type: 'trendline',
          points: [
            { x: 100, y: 50000, timestamp: 1718620800000 },
            { x: 200, y: 51000, timestamp: 1718624400000 },
          ],
          id: 'test-drawing-1',
        },
        priceData: mockInput.priceData,
      };

      const validation = validateDrawing(validationInput);
      
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
    });
  });

  describe('Memory Recall Tool', () => {
    const mockMemoryInput = {
      query: 'previous BTC analysis',
      filters: {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        limit: 10,
      },
    };

    it('should recall relevant memories', async () => {
      const result = await memoryRecallTool.execute({
        input: mockMemoryInput,
      });

      expect(result).toHaveProperty('memories');
      expect(result.memories).toBeInstanceOf(Array);
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('relevanceScores');
    });

    it('should filter memories by timeframe', async () => {
      const input = {
        ...mockMemoryInput,
        filters: {
          ...mockMemoryInput.filters,
          startDate: '2025-06-01T00:00:00Z',
          endDate: '2025-06-17T23:59:59Z',
        },
      };

      const result = await memoryRecallTool.execute({ input });

      result.memories.forEach((memory) => {
        const timestamp = new Date(memory.timestamp);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(
          new Date('2025-06-01T00:00:00Z').getTime()
        );
        expect(timestamp.getTime()).toBeLessThanOrEqual(
          new Date('2025-06-17T23:59:59Z').getTime()
        );
      });
    });

    it('should calculate relevance scores', async () => {
      const result = await memoryRecallTool.execute({
        input: mockMemoryInput,
      });

      expect(result.relevanceScores).toBeDefined();
      result.relevanceScores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('UI State Tool', () => {
    const mockUIStateInput = {
      action: 'update' as const,
      component: 'chart',
      state: {
        timeframe: '4h',
        indicators: ['RSI', 'MACD'],
        drawings: ['trendline-1', 'support-1'],
      },
    };

    it('should update UI state', async () => {
      const result = await uiStateTool.execute({
        input: mockUIStateInput,
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('previousState');
      expect(result).toHaveProperty('currentState');
      expect(result.currentState).toMatchObject(mockUIStateInput.state);
    });

    it('should get current UI state', async () => {
      const input = {
        action: 'get' as const,
        component: 'chart',
      };

      const result = await uiStateTool.execute({ input });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('currentState');
      expect(result.currentState).toHaveProperty('timeframe');
      expect(result.currentState).toHaveProperty('indicators');
    });

    it('should reset UI state', async () => {
      const input = {
        action: 'reset' as const,
        component: 'all',
      };

      const result = await uiStateTool.execute({ input });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('reset');
    });
  });

  describe('Market Snapshot Tool', () => {
    const mockMarketInput = {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      includeOrderBook: true,
      includeRecentTrades: true,
      depth: 20,
    };

    it('should capture market snapshot', async () => {
      const result = await marketSnapshotTool.execute({
        input: mockMarketInput,
      });

      expect(result).toHaveProperty('snapshots');
      expect(result.snapshots).toHaveProperty('BTCUSDT');
      expect(result.snapshots).toHaveProperty('ETHUSDT');

      const btcSnapshot = result.snapshots.BTCUSDT;
      expect(btcSnapshot).toHaveProperty('price');
      expect(btcSnapshot).toHaveProperty('volume24h');
      expect(btcSnapshot).toHaveProperty('change24h');
      expect(btcSnapshot).toHaveProperty('orderBook');
      expect(btcSnapshot).toHaveProperty('recentTrades');
    });

    it('should include order book data when requested', async () => {
      const result = await marketSnapshotTool.execute({
        input: mockMarketInput,
      });

      const orderBook = result.snapshots.BTCUSDT.orderBook;
      expect(orderBook).toBeDefined();
      expect(orderBook).toHaveProperty('bids');
      expect(orderBook).toHaveProperty('asks');
      expect(orderBook.bids.length).toBeLessThanOrEqual(mockMarketInput.depth);
      expect(orderBook.asks.length).toBeLessThanOrEqual(mockMarketInput.depth);
    });

    it('should calculate market metrics', async () => {
      const result = await marketSnapshotTool.execute({
        input: mockMarketInput,
      });

      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('totalVolume');
      expect(result.metrics).toHaveProperty('averageChange');
      expect(result.metrics).toHaveProperty('timestamp');
    });
  });

  describe('Agent Selection Tool', () => {
    const mockAgentInput = {
      task: 'analyze chart patterns',
      context: {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        hasDrawings: true,
        requiresML: false,
      },
    };

    it('should select appropriate agent', async () => {
      const result = await agentSelectionTool.execute({
        input: mockAgentInput,
      });

      expect(result).toHaveProperty('selectedAgent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result.selectedAgent).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide alternative agents', async () => {
      const result = await agentSelectionTool.execute({
        input: mockAgentInput,
      });

      expect(result).toHaveProperty('alternatives');
      expect(result.alternatives).toBeInstanceOf(Array);
      result.alternatives.forEach((alt) => {
        expect(alt).toHaveProperty('agent');
        expect(alt).toHaveProperty('score');
        expect(alt.score).toBeLessThan(result.confidence);
      });
    });

    it('should handle ML-required tasks', async () => {
      const input = {
        ...mockAgentInput,
        context: {
          ...mockAgentInput.context,
          requiresML: true,
        },
      };

      const result = await agentSelectionTool.execute({ input });

      expect(result.selectedAgent).toContain('ml');
      expect(result.reasoning).toContain('machine learning');
    });
  });

  // Snapshot tests for complex outputs
  describe('Tool Output Snapshots', () => {
    it('should match proposal generation snapshot', async () => {
      const input: ProposalGenerationInput = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        analysisType: 'comprehensive',
        priceData: {
          current: 50000,
          high24h: 52000,
          low24h: 48000,
          volume24h: 2000000,
        },
        indicators: {
          rsi: { value: 55, period: 14 },
          macd: { value: 50, signal: 45, histogram: 5 },
          bollingerBands: {
            upper: 51000,
            middle: 50000,
            lower: 49000,
          },
        },
      };

      const result = await proposalGenerationTool.execute({ input });
      expect(result).toMatchSnapshot();
    });

    it('should match memory recall snapshot', async () => {
      const result = await memoryRecallTool.execute({
        input: {
          query: 'BTC bullish pattern',
          filters: {
            symbol: 'BTCUSDT',
            limit: 5,
          },
        },
      });

      expect(result).toMatchSnapshot();
    });

    it('should match market snapshot', async () => {
      const result = await marketSnapshotTool.execute({
        input: {
          symbols: ['BTCUSDT'],
          includeOrderBook: false,
          includeRecentTrades: false,
        },
      });

      expect(result).toMatchSnapshot();
    });
  });
});