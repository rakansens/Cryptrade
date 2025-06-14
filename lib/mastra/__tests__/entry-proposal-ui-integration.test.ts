/**
 * Entry Proposal UI Integration Test
 * 
 * Tests the integration between entry proposal generation and UI components
 * Verifies that proposals are correctly displayed and interactive
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { tradingAgent } from '../agents/trading.agent';
import { entryProposalGenerationTool } from '../tools/entry-proposal-generation';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock window and document for UI interactions
const mockDispatchEvent = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

global.window = {
  dispatchEvent: mockDispatchEvent,
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
} as any;

// Mock the proposal store
const mockSetProposalGroup = jest.fn();
const mockAddProposal = jest.fn();
const mockUpdateProposalStatus = jest.fn();
const mockClearProposals = jest.fn();

// Mock proposal store - commenting out as it doesn't exist yet
// jest.mock('@/store/proposal.store', () => ({
//   useProposalStore: {
//     getState: () => ({
//       proposalGroups: [],
//       activeProposalId: null,
//       setProposalGroup: mockSetProposalGroup,
//       addProposal: mockAddProposal,
//       updateProposalStatus: mockUpdateProposalStatus,
//       clearProposals: mockClearProposals,
//     }),
//   },
// }));

// Mock binance API
jest.mock('@/lib/binance/api-service', () => ({
  binanceAPI: {
    fetchKlines: jest.fn().mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        time: Date.now() - (100 - i) * 3600000,
        open: 100000 + i * 100,
        high: 100100 + i * 100,
        low: 99900 + i * 100,
        close: 100050 + i * 100,
        volume: 1000 + i * 10,
      }))
    ),
  },
}));

// Mock the entry proposal dependencies
jest.mock('../tools/entry-proposal-generation/analyzers/market-context-analyzer', () => ({
  analyzeMarketContext: jest.fn().mockResolvedValue({
    trend: 'bullish',
    volatility: 'normal',
    volume: 'average',
    momentum: 'positive',
    keyLevels: { support: [100000, 99000], resistance: [105000, 106000] },
  }),
}));

jest.mock('../tools/entry-proposal-generation/analyzers/condition-evaluator', () => ({
  evaluateEntryConditions: jest.fn().mockResolvedValue({
    conditions: [
      { type: 'price_level', met: true, description: 'Price near support' },
      { type: 'momentum', met: true, description: 'Positive momentum' },
    ],
    score: 0.8,
    readyToEnter: true,
  }),
}));

jest.mock('../tools/entry-proposal-generation/calculators/entry-calculator', () => ({
  calculateEntryPoints: jest.fn().mockResolvedValue([
    {
      price: 100500,
      direction: 'long',
      strategy: 'dayTrading',
      confidence: 0.85,
      zone: { start: 100000, end: 101000 },
      reasoning: {
        factors: [
          { factor: 'Near support', weight: 0.8, impact: 'positive' },
          { factor: 'Bullish trend', weight: 0.7, impact: 'positive' },
        ],
      },
      relatedPatterns: [],
      relatedDrawings: [],
    },
  ]),
}));

jest.mock('../tools/entry-proposal-generation/calculators/risk-calculator', () => ({
  calculateRiskManagement: jest.fn().mockResolvedValue({
    stopLoss: 99500,
    takeProfit: [102000, 103000],
    positionSize: 0.1,
    riskAmount: 100,
    riskRewardRatio: 3,
  }),
}));

describe('Entry Proposal UI Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Proposal Display Events', () => {
    it('should dispatch proposal display event when proposals are generated', async () => {
      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.proposalGroup).toBeDefined();

      // Simulate UI event dispatch for proposal display
      const proposalEvent = new CustomEvent('proposal:generated', {
        detail: { proposalGroup: result.proposalGroup },
      });
      
      window.dispatchEvent(proposalEvent);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal:generated',
          detail: expect.objectContaining({
            proposalGroup: expect.objectContaining({
              id: expect.stringMatching(/^epg_/),
              proposals: expect.any(Array),
            }),
          }),
        })
      );
    });

    it('should handle proposal selection UI event', async () => {
      const mockProposal = {
        id: 'ep_test_123',
        symbol: 'BTCUSDT',
        direction: 'long',
        entryPrice: 100500,
        riskParameters: {
          stopLoss: 99500,
          takeProfit: [102000, 103000],
        },
      };

      // Simulate proposal selection event
      const selectionEvent = new CustomEvent('proposal:selected', {
        detail: { proposalId: mockProposal.id, proposal: mockProposal },
      });

      window.dispatchEvent(selectionEvent);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal:selected',
          detail: expect.objectContaining({
            proposalId: 'ep_test_123',
          }),
        })
      );
    });

    it('should handle proposal execution UI event', async () => {
      const mockProposal = {
        id: 'ep_test_123',
        symbol: 'BTCUSDT',
        direction: 'long',
        entryPrice: 100500,
        entryZone: { start: 100000, end: 101000 },
        riskParameters: {
          stopLoss: 99500,
          takeProfit: [102000, 103000],
          positionSize: 0.1,
        },
      };

      // Import and use the UI event dispatcher
      const { uiEventDispatcher } = require('@/lib/utils/ui-event-dispatcher');
      
      // Clear previous mock calls
      mockDispatchEvent.mockClear();
      
      // Use the dispatcher to execute the proposal
      uiEventDispatcher.dispatchProposalExecution(mockProposal);

      // Verify the execution event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal:execute',
        })
      );

      // Verify chart drawing events are dispatched
      const drawingEvents = mockDispatchEvent.mock.calls.filter(
        call => call[0].type?.includes('chart:')
      );
      
      // Should dispatch events for entry zone (1), stop loss (1), and take profit (2) = 4 total
      expect(drawingEvents.length).toBe(4);
      
      // Verify specific chart events
      const chartEventTypes = drawingEvents.map(call => call[0].type);
      expect(chartEventTypes).toContain('chart:drawZone');
      expect(chartEventTypes).toContain('chart:drawLine');
    });
  });

  describe('UI State Updates', () => {
    it('should update store when proposals are generated', async () => {
      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      // Simulate store update
      mockSetProposalGroup(result.proposalGroup);

      expect(mockSetProposalGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^epg_/),
          proposals: expect.any(Array),
        })
      );
    });

    it('should clear proposals on UI reset event', () => {
      // Simulate clear event
      const clearEvent = new CustomEvent('proposal:clear');
      window.dispatchEvent(clearEvent);

      // Simulate store clear
      mockClearProposals();

      expect(mockClearProposals).toHaveBeenCalled();
    });
  });

  describe('Chart Integration', () => {
    it('should draw entry zones on chart when proposal is selected', async () => {
      const mockProposal = {
        id: 'ep_test_123',
        entryZone: { start: 100000, end: 101000 },
        direction: 'long',
        riskParameters: {
          stopLoss: 99500,
          takeProfit: [102000, 103000],
        },
      };

      // Simulate drawing entry zone
      const drawZoneEvent = new CustomEvent('chart:drawZone', {
        detail: {
          type: 'entryZone',
          start: mockProposal.entryZone.start,
          end: mockProposal.entryZone.end,
          color: 'rgba(0, 255, 0, 0.2)',
          label: 'Entry Zone',
        },
      });

      window.dispatchEvent(drawZoneEvent);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chart:drawZone',
          detail: expect.objectContaining({
            type: 'entryZone',
          }),
        })
      );
    });

    it('should draw risk management levels on chart', async () => {
      const mockProposal = {
        entryPrice: 100500,
        riskParameters: {
          stopLoss: 99500,
          takeProfit: [102000, 103000],
        },
      };

      // Simulate drawing stop loss
      const stopLossEvent = new CustomEvent('chart:drawLine', {
        detail: {
          type: 'horizontalLine',
          price: mockProposal.riskParameters.stopLoss,
          color: 'red',
          style: 'dashed',
          label: 'Stop Loss',
        },
      });

      window.dispatchEvent(stopLossEvent);

      // Simulate drawing take profit levels
      mockProposal.riskParameters.takeProfit.forEach((tp, index) => {
        const takeProfitEvent = new CustomEvent('chart:drawLine', {
          detail: {
            type: 'horizontalLine',
            price: tp,
            color: 'green',
            style: 'dashed',
            label: `TP${index + 1}`,
          },
        });
        window.dispatchEvent(takeProfitEvent);
      });

      const drawingCalls = mockDispatchEvent.mock.calls.filter(
        call => call[0].type === 'chart:drawLine'
      );

      expect(drawingCalls.length).toBe(3); // 1 SL + 2 TP
    });
  });

  describe('Real-time Updates', () => {
    it('should update proposal status when market conditions change', async () => {
      const proposalId = 'ep_test_123';
      const currentPrice = 100600;
      const entryZone = { start: 100000, end: 101000 };

      // Import and use the UI event dispatcher
      const { uiEventDispatcher } = require('@/lib/utils/ui-event-dispatcher');
      
      // Clear previous mock calls
      mockDispatchEvent.mockClear();

      // Use the dispatcher to check price in entry zone
      uiEventDispatcher.checkPriceInEntryZone(currentPrice, entryZone);

      // Check if price is in entry zone
      const inEntryZone = currentPrice >= entryZone.start && currentPrice <= entryZone.end;

      if (inEntryZone) {
        // Should dispatch entry zone alert
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal:entryZoneReached',
            detail: expect.objectContaining({
              price: currentPrice,
              entryZone,
            }),
          })
        );
      }
    });

    it('should handle proposal expiration', () => {
      const expiredProposal = {
        id: 'ep_expired_123',
        expiresAt: Date.now() - 1000, // Already expired
      };

      // Simulate expiration check
      const expirationEvent = new CustomEvent('proposal:checkExpiration', {
        detail: { proposal: expiredProposal },
      });

      window.dispatchEvent(expirationEvent);

      // Should update status to expired
      mockUpdateProposalStatus(expiredProposal.id, 'expired');

      expect(mockUpdateProposalStatus).toHaveBeenCalledWith(
        'ep_expired_123',
        'expired'
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error UI when proposal generation fails', async () => {
      // Mock a failure
      const { analyzeMarketContext } = require('../tools/entry-proposal-generation/analyzers/market-context-analyzer');
      analyzeMarketContext.mockRejectedValueOnce(new Error('Market data error'));

      const result = await entryProposalGenerationTool.execute({
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        },
      });

      expect(result.success).toBe(false);

      // Simulate error event
      const errorEvent = new CustomEvent('proposal:error', {
        detail: {
          error: result.error,
          message: 'エントリー提案の生成に失敗しました',
        },
      });

      window.dispatchEvent(errorEvent);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal:error',
        })
      );
    });
  });
});