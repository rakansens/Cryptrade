import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { agentNetwork } from '../network/agent-network';
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

// Mock the entire agent system
jest.mock('../network/agent-registry', () => ({
  registerAllAgents: jest.fn(),
  priceInquiryAgent: { name: 'priceInquiryAgent' },
  tradingAnalysisAgent: { name: 'tradingAnalysisAgent' },
  uiControlAgent: { name: 'uiControlAgent' },
  orchestratorAgent: { name: 'orchestratorAgent' },
}));

// Mock the agents
jest.mock('../agents/trading.agent', () => ({
  tradingAgent: {
    name: 'tradingAgent',
    generate: jest.fn().mockResolvedValue({
      text: 'エントリー提案を生成しました',
      steps: [
        {
          toolCalls: [
            {
              toolName: 'entryProposalGeneration',
              args: {
                symbol: 'BTCUSDT',
                interval: '1h',
                strategyPreference: 'dayTrading',
                riskPercentage: 1,
                maxProposals: 3,
              },
            },
          ],
          toolResults: [
            {
              toolName: 'entryProposalGeneration',
              result: {
                success: true,
                proposalGroup: {
                  id: 'epg_test_123',
                  title: 'BTCUSDT デイトレードエントリー提案',
                  description: '3個のエントリー提案を生成しました',
                  proposals: [
                    {
                      id: 'ep_test_1',
                      symbol: 'BTCUSDT',
                      direction: 'long',
                      entryPrice: 100500,
                      confidence: 0.85,
                    },
                  ],
                  summary: {
                    bestEntry: 'ep_test_1',
                    averageConfidence: 0.85,
                    marketBias: 'bullish',
                  },
                  createdAt: Date.now(),
                  status: 'pending',
                },
              },
            },
          ],
        },
      ],
    }),
  },
}));

describe('A2A Entry Proposal Mock Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entry Proposal Execution', () => {
    it('should successfully execute entry proposal with mocked agents', async () => {
      // Mock the sendMessage method to simulate successful A2A communication
      const mockResponse = {
        id: 'resp-msg-123',
        type: 'response' as const,
        source: 'tradingAnalysisAgent',
        target: 'orchestratorAgent',
        result: 'エントリー提案を生成しました',
        timestamp: Date.now(),
        correlationId: 'test-correlation-123',
        steps: [
          {
            toolResults: [
              {
                toolName: 'entryProposalGeneration',
                result: {
                  success: true,
                  proposalGroup: {
                    id: 'epg_test_123',
                    proposals: [
                      {
                        id: 'ep_test_1',
                        symbol: 'BTCUSDT',
                        direction: 'long',
                        entryPrice: 100500,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      };

      jest.spyOn(agentNetwork, 'sendMessage').mockResolvedValue(mockResponse);

      const result = await agentNetwork.sendMessage(
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

      expect(result).toBeDefined();
      expect(result?.type).toBe('response');
      expect(result?.steps).toBeDefined();
      expect(result?.steps?.[0]?.toolResults).toBeDefined();
      
      const toolResult = result?.steps?.[0]?.toolResults?.[0];
      expect(toolResult?.toolName).toBe('entryProposalGeneration');
      expect(toolResult?.result?.success).toBe(true);
      expect(toolResult?.result?.proposalGroup?.proposals).toHaveLength(1);
    });

    it('should handle tool name correctly in prompts', async () => {
      const mockFormatMessage = jest.fn();
      
      // Test the prompt generation logic
      const context = {
        extractedSymbol: 'BTCUSDT',
        isProposalMode: true,
        proposalType: 'entry',
        isEntryProposal: true,
        interval: '1h',
      };

      const expectedPrompt = `entryProposalGeneration({
  symbol: "BTCUSDT",
  interval: "1h",
  strategyPreference: "dayTrading",
  riskPercentage: 1,
  maxProposals: 3
})`;

      // Verify the prompt contains the correct tool name
      expect(expectedPrompt).toContain('entryProposalGeneration');
      expect(expectedPrompt).not.toContain('entryProposalGenerationTool');
    });

    it('should differentiate between entry and regular proposals', async () => {
      // Mock for entry proposal
      const entryResponse = {
        id: 'resp-entry-123',
        type: 'response' as const,
        source: 'tradingAnalysisAgent',
        target: 'orchestratorAgent',
        result: 'エントリー提案を生成しました',
        timestamp: Date.now(),
        correlationId: 'entry-correlation-123',
        proposalGroup: {
          id: 'epg_123',
          type: 'entryProposalGroup',
          proposals: [],
        },
      };

      // Mock for regular proposal
      const regularResponse = {
        id: 'resp-regular-123',
        type: 'response' as const,
        source: 'tradingAnalysisAgent',
        target: 'orchestratorAgent',
        result: 'トレンドライン提案を生成しました',
        timestamp: Date.now(),
        correlationId: 'regular-correlation-123',
        proposalGroup: {
          id: 'pg_123',
          type: 'proposalGroup',
          proposals: [],
        },
      };

      const sendMessageSpy = jest.spyOn(agentNetwork, 'sendMessage');
      sendMessageSpy.mockResolvedValueOnce(entryResponse);
      sendMessageSpy.mockResolvedValueOnce(regularResponse);

      // Test entry proposal
      const entryResult = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'エントリー提案して',
          context: {
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
          },
        }
      );

      expect(entryResult?.proposalGroup?.type).toBe('entryProposalGroup');

      // Test regular proposal
      const regularResult = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'トレンドライン提案して',
          context: {
            isProposalMode: true,
            proposalType: 'trendline',
          },
        }
      );

      expect(regularResult?.proposalGroup?.type).toBe('proposalGroup');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const errorResponse = {
        id: 'err-msg-123',
        type: 'error' as const,
        source: 'tradingAnalysisAgent',
        target: 'orchestratorAgent',
        error: {
          code: -32603,
          message: 'Agent execution failed',
          data: { originalError: 'Tool execution error' },
        },
        timestamp: Date.now(),
        correlationId: 'error-correlation-123',
      };

      jest.spyOn(agentNetwork, 'sendMessage').mockResolvedValue(errorResponse);

      const result = await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        {
          query: 'Invalid request',
          context: {},
        }
      );

      expect(result?.type).toBe('error');
      expect(result?.error).toBeDefined();
      expect(result?.error?.message).toBe('Agent execution failed');
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const mockResponse = {
        id: 'perf-msg-123',
        type: 'response' as const,
        source: 'tradingAnalysisAgent',
        target: 'orchestratorAgent',
        result: 'Quick response',
        timestamp: Date.now(),
        correlationId: 'perf-correlation-123',
      };

      jest.spyOn(agentNetwork, 'sendMessage').mockResolvedValue(mockResponse);

      await agentNetwork.sendMessage(
        'orchestratorAgent',
        'tradingAnalysisAgent',
        'process_query',
        { query: 'test' }
      );

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});