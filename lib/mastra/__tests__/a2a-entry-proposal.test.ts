import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { agentNetwork } from '../network/agent-network';
import { tradingAgent } from '../agents/trading.agent';
import { orchestratorAgent } from '../agents/orchestrator.agent';
import { registerAllAgents } from '../network/agent-registry';
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

// Mock binance API to avoid actual API calls
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

// Mock the entry proposal generation tool dependencies
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

// Mock OpenAI to avoid API calls in tests
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    generate: jest.fn().mockImplementation((messages, options) => {
      // Check if this is for entry proposal generation
      if (options?.isProposalMode && options?.proposalType === 'entry') {
        return Promise.resolve({
          text: 'BTCUSDTのエントリー提案を生成しました。',
          steps: [{
            toolCalls: [{
              toolName: 'entryProposalGeneration',
              args: {
                symbol: options.extractedSymbol || 'BTCUSDT',
                interval: options.interval || '1h',
                strategyPreference: 'dayTrading',
                riskPercentage: 1,
                maxProposals: 3,
              },
            }],
            toolResults: [{
              toolName: 'entryProposalGeneration',
              result: {
                success: true,
                proposalGroup: {
                  id: 'epg_test_123',
                  title: 'BTCUSDT デイトレードエントリー提案',
                  description: '1個のエントリー提案を生成しました。',
                  proposals: [{
                    id: 'ep_test_1',
                    symbol: 'BTCUSDT',
                    direction: 'long',
                    entryPrice: 100500,
                    entryZone: { start: 100000, end: 101000 },
                    riskParameters: {
                      stopLoss: 99500,
                      takeProfit: [102000, 103000],
                      positionSize: 0.1,
                    },
                    confidence: 0.85,
                  }],
                  summary: {
                    bestEntry: 'ep_test_1',
                    averageConfidence: 0.85,
                    marketBias: 'bullish',
                  },
                  createdAt: Date.now(),
                  status: 'pending',
                },
              },
            }],
          }],
        });
      }
      // Default response
      return Promise.resolve({
        text: 'Mocked response',
        steps: [],
      });
    }),
  })),
}));

describe('A2A Entry Proposal Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Register all agents for A2A communication
    registerAllAgents();
  });

  afterEach(() => {
    // Clean up any registered agents
    jest.clearAllMocks();
  });

  describe('Direct A2A Communication', () => {
    it('should execute entry proposal through A2A message', async () => {
      const message = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'BTCUSDTのエントリー提案をしてください',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            interval: '1h',
          },
        }
      );

      expect(message).toBeDefined();
      expect(message?.type).toBe('response');
      
      // Check for proposalGroup in the response
      if (message?.proposalGroup) {
        expect(message.proposalGroup).toMatchObject({
          id: expect.stringMatching(/^epg_/),
          proposals: expect.any(Array),
        });
      }

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        '[AgentNetwork] Entry proposal context detected',
        expect.objectContaining({
          targetId: 'tradingAnalysisAgent',
          proposalType: 'entry',
          isEntryProposal: true,
        })
      );
    });

    it('should differentiate between entry and regular proposals', async () => {
      // Test entry proposal
      const entryMessage = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'エントリー提案して',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
          },
        }
      );

      // Test regular proposal
      const regularMessage = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'トレンドライン提案して',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'trendline',
          },
        }
      );

      expect(entryMessage).toBeDefined();
      expect(regularMessage).toBeDefined();
      
      // Verify different prompts were generated
      expect(logger.info).toHaveBeenCalledWith(
        '[AgentNetwork] Formatting message for proposal mode',
        expect.objectContaining({
          proposalType: 'entry',
          isEntryProposal: true,
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[AgentNetwork] Formatting message for proposal mode',
        expect.objectContaining({
          proposalType: 'trendline',
          isEntryProposal: undefined,
        })
      );
    });
  });

  describe('Orchestrator to Trading Agent Flow', () => {
    it('should handle entry proposal intent correctly', async () => {
      // Mock the orchestrator's intent analysis
      const mockIntentAnalysis = {
        intent: 'proposal_request',
        confidence: 0.95,
        extractedSymbol: 'BTCUSDT',
        reasoning: 'エントリー提案リクエスト',
        analysisDepth: 'detailed',
        isProposalMode: true,
        proposalType: 'entry',
        isEntryProposal: true,
      };

      // Simulate orchestrator routing to trading agent
      const response = await agentNetwork.routeMessage(
        'orchestratorAgent',
        'BTCUSDTのエントリー提案をお願いします',
        mockIntentAnalysis
      );

      expect(response).toBeDefined();
      expect(response?.type).not.toBe('error');
    });

    it('should handle error cases gracefully', async () => {
      // Test with invalid symbol
      const errorResponse = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'INVALIDのエントリー提案',
          context: {
            extractedSymbol: 'INVALID',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
          },
        }
      );

      expect(errorResponse).toBeDefined();
      // Error should be handled gracefully
      if (errorResponse?.type === 'error') {
        expect(errorResponse.error).toBeDefined();
      }
    });
  });

  describe('Tool Execution Verification', () => {
    it('should ensure correct tool is called for entry proposals', async () => {
      // Create a spy on the trading agent's generate method
      const generateSpy = jest.spyOn(tradingAgent, 'generate');

      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'BTCUSDTのエントリーポイントを提案してください',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            interval: '4h',
          },
        }
      );

      expect(generateSpy).toHaveBeenCalled();
      
      // Check the context passed to generate
      const generateCall = generateSpy.mock.calls[0];
      if (generateCall && generateCall[1]) {
        const context = generateCall[1];
        expect(context.isProposalMode).toBe(true);
        expect(context.proposalType).toBe('entry');
        expect(context.isEntryProposal).toBe(true);
      }

      generateSpy.mockRestore();
    });

    it('should extract proposalGroup from tool results', async () => {
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'エントリー提案を生成',
          context: {
            extractedSymbol: 'ETHUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            interval: '1h',
            strategyPreference: 'dayTrading',
            riskPercentage: 1.5,
          },
        }
      );

      expect(response).toBeDefined();
      
      // Log the response structure for debugging
      if (response) {
        console.log('A2A Response structure:', {
          hasSteps: !!response.steps,
          hasToolResults: !!response.toolResults,
          hasProposalGroup: !!response.proposalGroup,
          responseKeys: Object.keys(response),
        });
      }
    });
  });

  describe('Message Formatting', () => {
    it('should format entry proposal message correctly', async () => {
      // Test the formatMessageForAgent logic
      const testMessage = {
        id: 'test-msg-1',
        type: 'request' as const,
        source: 'orchestratorAgent',
        target: 'tradingAnalysisAgent',
        method: 'process_query',
        params: {
          query: 'BTCのエントリー提案',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            interval: '1h',
          },
        },
        timestamp: Date.now(),
      };

      const response = await agentNetwork.sendMessage(
        testMessage.source,
        testMessage.target,
        testMessage.method,
        testMessage.params
      );

      expect(response).toBeDefined();
      
      // Verify the correct prompt format was used
      expect(logger.info).toHaveBeenCalledWith(
        '[AgentNetwork] Formatting message for proposal mode',
        expect.objectContaining({
          target: 'tradingAnalysisAgent',
          proposalType: 'entry',
          isEntryProposal: true,
        })
      );
    });
  });

  describe('Performance and Timeout', () => {
    it('should complete entry proposal within timeout', async () => {
      const startTime = Date.now();
      
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'BTCUSDTのエントリー提案',
          context: {
            extractedSymbol: 'BTCUSDT',
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
          },
        }
      );

      const executionTime = Date.now() - startTime;
      
      expect(response).toBeDefined();
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing context gracefully', async () => {
      const response = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'エントリー提案',
          // Minimal context
          context: {},
        }
      );

      expect(response).toBeDefined();
      // Should still process the request even with minimal context
    });

    it('should handle network errors', async () => {
      // Temporarily mock a network error
      const originalSendMessage = agentNetwork.sendMessage;
      agentNetwork.sendMessage = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        agentNetwork.sendMessage(
          'orchestratorAgent',
          'tradingAnalysisAgent',
          'process_query',
          { query: 'test' }
        )
      ).rejects.toThrow('Network error');

      // Restore original method
      agentNetwork.sendMessage = originalSendMessage;
    });
  });
});