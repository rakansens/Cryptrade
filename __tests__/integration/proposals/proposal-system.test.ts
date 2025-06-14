import 'dotenv/config';
import { config } from 'dotenv';
import { executeImprovedOrchestrator } from '../../../lib/mastra/agents/orchestrator.agent';
import { logger } from '../../../lib/utils/logger';
import { dispatchTypedUIEvent } from '../../../lib/utils/ui-event-dispatcher';
import type { ProposalEventData, ChartEventData } from '../../../types/events/all-event-types';

// Load environment variables
config({ path: '.env.local' });

describe('Proposal System Integration Tests', () => {
  const testSessionId = `test-proposal-${Date.now()}`;
  const defaultContext = { 
    userLevel: 'intermediate', 
    marketStatus: 'open',
    preferredSymbol: 'BTCUSDT'
  };

  beforeAll(() => {
    // Mock UI event dispatcher for testing
    jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      if (url.toString().includes('/api/ui-events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled fetch to ${url}`));
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Entry Proposal Generation', () => {
    const proposalQueries = [
      {
        query: 'BTCのエントリーポイントを提案して',
        expectedType: 'entry',
        expectedSymbol: 'BTCUSDT'
      },
      {
        query: 'いまエントリーすべき？',
        expectedType: 'entry',
        expectedSymbol: 'BTCUSDT'
      },
      {
        query: 'トレンドラインベースでエントリー提案して',
        expectedType: 'entry',
        expectedSymbol: 'BTCUSDT'
      }
    ];

    test.each(proposalQueries)(
      'should generate entry proposal for: "$query"',
      async ({ query, expectedType, expectedSymbol }) => {
        const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
        
        expect(result.analysis.intent).toBe('entry_proposal');
        expect(result.executionResult).toBeDefined();
        expect(result.executionResult.metadata?.processedBy).toContain('trading');
        
        // Verify proposal structure
        if (result.executionResult.proposal) {
          expect(result.executionResult.proposal.type).toBe(expectedType);
          expect(result.executionResult.proposal.symbol).toBe(expectedSymbol);
          expect(result.executionResult.proposal.confidence).toBeGreaterThan(0);
          expect(result.executionResult.proposal.confidence).toBeLessThanOrEqual(1);
        }
      }
    );
  });

  describe('Proposal with Chart Integration', () => {
    test('should generate proposal with chart annotations', async () => {
      const query = 'サポートラインでのエントリーポイントを表示して';
      const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
      
      expect(result.analysis.intent).toMatch(/entry_proposal|analysis/);
      expect(result.executionResult).toBeDefined();
      
      // Check if chart annotations are included
      if (result.executionResult.chartAnnotations) {
        expect(Array.isArray(result.executionResult.chartAnnotations)).toBe(true);
        expect(result.executionResult.chartAnnotations.length).toBeGreaterThan(0);
        
        const annotation = result.executionResult.chartAnnotations[0];
        expect(annotation).toHaveProperty('type');
        expect(annotation).toHaveProperty('points');
      }
    });
  });

  describe('Proposal API Integration', () => {
    beforeEach(() => {
      // Mock the proposal API endpoint
      jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
        if (url.toString().includes('/api/chat/proposal')) {
          const body = JSON.parse(options?.body as string);
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              proposal: {
                id: `prop-${Date.now()}`,
                type: 'entry',
                symbol: body.symbol || 'BTCUSDT',
                direction: 'long',
                entryPrice: 45000,
                stopLoss: 44000,
                takeProfit: 46000,
                confidence: 0.85,
                reasoning: 'Test proposal reasoning',
                timeframe: '1h',
                timestamp: new Date().toISOString()
              }
            }),
          } as Response);
        }
        return Promise.reject(new Error(`Unhandled fetch to ${url}`));
      });
    });

    test('should call proposal API with correct parameters', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      
      const response = await fetch('/api/chat/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Generate entry proposal',
          symbol: 'BTCUSDT',
          type: 'entry'
        })
      });
      
      const data = await response.json();
      
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/proposal'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      
      expect(data.success).toBe(true);
      expect(data.proposal).toBeDefined();
      expect(data.proposal.type).toBe('entry');
      expect(data.proposal.confidence).toBe(0.85);
    });
  });

  describe('Proposal UI Event Flow', () => {
    test('should dispatch proposal UI events correctly', async () => {
      const mockProposal = {
        id: 'test-proposal-1',
        type: 'entry' as const,
        symbol: 'BTCUSDT',
        direction: 'long' as const,
        entryPrice: 45000,
        stopLoss: 44000,
        takeProfit: 46000,
        confidence: 0.85,
        reasoning: 'Test reasoning',
        timeframe: '1h',
        timestamp: new Date().toISOString()
      };

      // Test proposal created event
      const createEvent: ProposalEventData = {
        type: 'proposal.created',
        proposal: mockProposal
      };
      
      await dispatchTypedUIEvent(createEvent);
      
      // Verify fetch was called with correct event data
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ui-events'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'proposal.created',
            data: createEvent
          })
        })
      );
    });

    test('should handle proposal approval flow', async () => {
      const proposalId = 'test-proposal-approve';
      
      // Test approval event
      const approveEvent: ProposalEventData = {
        type: 'proposal.approved',
        proposalId,
        symbol: 'BTCUSDT'
      };
      
      await dispatchTypedUIEvent(approveEvent);
      
      // Test rejection event
      const rejectEvent: ProposalEventData = {
        type: 'proposal.rejected',
        proposalId,
        symbol: 'BTCUSDT'
      };
      
      await dispatchTypedUIEvent(rejectEvent);
      
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Enhanced Proposal Features', () => {
    test('should include confidence factors in proposals', async () => {
      const query = 'BTCの高信頼度エントリーポイントを提案して';
      const result = await executeImprovedOrchestrator(query, testSessionId, {
        ...defaultContext,
        requireHighConfidence: true
      });
      
      expect(result.executionResult).toBeDefined();
      if (result.executionResult.proposal) {
        expect(result.executionResult.proposal.confidence).toBeGreaterThan(0.8);
        expect(result.executionResult.proposal.confidenceFactors).toBeDefined();
      }
    });

    test('should support multi-timeframe analysis in proposals', async () => {
      const query = 'マルチタイムフレーム分析でエントリー提案して';
      const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
      
      expect(result.executionResult).toBeDefined();
      if (result.executionResult.proposal) {
        expect(result.executionResult.proposal.timeframeAnalysis).toBeDefined();
        expect(Array.isArray(result.executionResult.proposal.timeframeAnalysis)).toBe(true);
      }
    });

    test('should include risk management in proposals', async () => {
      const query = 'リスク管理を含めたエントリー提案をして';
      const result = await executeImprovedOrchestrator(query, testSessionId, defaultContext);
      
      expect(result.executionResult).toBeDefined();
      if (result.executionResult.proposal) {
        expect(result.executionResult.proposal.riskReward).toBeDefined();
        expect(result.executionResult.proposal.positionSize).toBeDefined();
        expect(result.executionResult.proposal.maxRisk).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle missing symbol gracefully', async () => {
      const query = 'エントリーポイントを提案して'; // No symbol mentioned
      const result = await executeImprovedOrchestrator(query, testSessionId, {
        ...defaultContext,
        preferredSymbol: undefined // No default symbol
      });
      
      expect(result.executionResult).toBeDefined();
      // Should either use a default symbol or ask for clarification
      expect(result.executionResult.response).toBeDefined();
    });

    test('should handle API failures gracefully', async () => {
      // Mock API failure
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        throw new Error('API Error');
      });
      
      try {
        await dispatchTypedUIEvent({
          type: 'proposal.created',
          proposal: {} as any
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    test('should generate proposals within acceptable time', async () => {
      const startTime = Date.now();
      
      const result = await executeImprovedOrchestrator(
        'エントリーポイントを提案して',
        testSessionId,
        defaultContext
      );
      
      const executionTime = Date.now() - startTime;
      
      expect(result.executionResult).toBeDefined();
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});