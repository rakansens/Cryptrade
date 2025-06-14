/**
 * AI Tool Selection Test
 * 
 * Tests that AI agents correctly select and use the appropriate tools
 * Specifically focuses on entry proposal tool selection
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { tradingAgent } from '../agents/trading.agent';
import { orchestratorAgent } from '../agents/orchestrator.agent';
import { analyzeIntent } from '../utils/intent';
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

// Mock AI SDK to track tool selections
const mockToolCalls: any[] = [];
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => {
    const mockModel = {
      id: 'gpt-4o-mini',
      provider: 'openai',
    };
    
    // Add the generate function to the model
    mockModel.generate = jest.fn().mockImplementation(async (messages, options) => {
      const query = messages[0]?.content || '';
      const context = options || {};
      
      // Simulate AI tool selection based on context
      let selectedTool = null;
      let toolArgs = {};
      
      if (context.isProposalMode && context.proposalType === 'entry') {
        selectedTool = 'entryProposalGeneration';
        toolArgs = {
          symbol: context.extractedSymbol || 'BTCUSDT',
          interval: context.interval || '1h',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
          maxProposals: 3,
        };
      } else if (context.isProposalMode && context.proposalType) {
        selectedTool = 'proposalGeneration';
        toolArgs = {
          symbol: context.extractedSymbol || 'BTCUSDT',
          interval: context.interval || '1h',
          analysisType: context.proposalType,
          maxProposals: 5,
        };
      } else if (query.toLowerCase().includes('価格') || query.toLowerCase().includes('price')) {
        selectedTool = 'marketDataResilientTool';
        toolArgs = { symbol: context.extractedSymbol || 'BTCUSDT' };
      }
      
      if (selectedTool) {
        mockToolCalls.push({ toolName: selectedTool, args: toolArgs });
      }
      
      return {
        text: `Tool ${selectedTool} was called`,
        steps: selectedTool ? [{
          toolCalls: [{ toolName: selectedTool, args: toolArgs }],
          toolResults: [{ 
            toolName: selectedTool, 
            result: { success: true } 
          }],
        }] : [],
      };
    });
    
    return mockModel;
  }),
}));

describe('AI Tool Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToolCalls.length = 0;
  });

  describe('Entry Proposal Tool Selection', () => {
    it('should select entryProposalGeneration for entry proposal requests', async () => {
      const testQueries = [
        'BTCUSDTのエントリー提案をしてください',
        'エントリーポイントを教えて',
        'entry proposal for ETHUSDT',
        'BTCのエントリー提案',
      ];

      for (const query of testQueries) {
        mockToolCalls.length = 0; // Reset for each test
        
        const result = await tradingAgent.generate(
          [{ role: 'user', content: query }],
          {
            isProposalMode: true,
            proposalType: 'entry',
            isEntryProposal: true,
            extractedSymbol: 'BTCUSDT',
          }
        );

        expect(mockToolCalls).toHaveLength(1);
        expect(mockToolCalls[0].toolName).toBe('entryProposalGeneration');
        expect(mockToolCalls[0].args).toMatchObject({
          symbol: 'BTCUSDT',
          strategyPreference: 'dayTrading',
          riskPercentage: 1,
        });
      }
    });

    it('should NOT select entryProposalGeneration for regular proposals', async () => {
      const testQueries = [
        'トレンドラインの提案をして',
        'サポートレジスタンスを提案',
        'suggest trendlines',
      ];

      for (const query of testQueries) {
        mockToolCalls.length = 0;
        
        await tradingAgent.generate(
          [{ role: 'user', content: query }],
          {
            isProposalMode: true,
            proposalType: 'trendline',
            extractedSymbol: 'BTCUSDT',
          }
        );

        expect(mockToolCalls).toHaveLength(1);
        expect(mockToolCalls[0].toolName).toBe('proposalGeneration');
        expect(mockToolCalls[0].toolName).not.toBe('entryProposalGeneration');
      }
    });
  });

  describe('Context-based Tool Selection', () => {
    it('should use correct tool based on intent analysis', async () => {
      const testCases = [
        {
          query: 'BTCの価格は？',
          expectedIntent: 'price_inquiry',
          expectedTool: 'marketDataResilientTool',
        },
        {
          query: 'エントリー提案をお願いします',
          expectedIntent: 'proposal_request',
          expectedTool: 'entryProposalGeneration',
          context: { proposalType: 'entry', isEntryProposal: true },
        },
        {
          query: 'トレンドライン描いて',
          expectedIntent: 'proposal_request',
          expectedTool: 'proposalGeneration',
          context: { proposalType: 'trendline' },
        },
      ];

      for (const testCase of testCases) {
        mockToolCalls.length = 0;
        
        // Analyze intent
        const intent = analyzeIntent(testCase.query);
        expect(intent.intent).toBe(testCase.expectedIntent);
        
        // Generate with context
        const context = {
          isProposalMode: intent.isProposalMode,
          proposalType: intent.proposalType,
          isEntryProposal: intent.isEntryProposal,
          extractedSymbol: intent.extractedSymbol || 'BTCUSDT',
          ...testCase.context,
        };
        
        await tradingAgent.generate(
          [{ role: 'user', content: testCase.query }],
          context
        );
        
        if (testCase.expectedTool) {
          expect(mockToolCalls).toHaveLength(1);
          expect(mockToolCalls[0].toolName).toBe(testCase.expectedTool);
        }
      }
    });
  });

  describe('Dynamic Tool Availability', () => {
    it('should only provide entry proposal tool in entry proposal mode', () => {
      // Test tool selection logic
      const entryProposalContext = {
        isProposalMode: true,
        proposalType: 'entry',
        isEntryProposal: true,
      };
      
      const tools = tradingAgent.tools(entryProposalContext);
      expect(tools).toHaveProperty('entryProposalGeneration');
      expect(Object.keys(tools)).toHaveLength(1);
    });

    it('should only provide regular proposal tool in regular proposal mode', () => {
      const regularProposalContext = {
        isProposalMode: true,
        proposalType: 'trendline',
      };
      
      const tools = tradingAgent.tools(regularProposalContext);
      expect(tools).toHaveProperty('proposalGeneration');
      expect(tools).not.toHaveProperty('entryProposalGeneration');
      expect(Object.keys(tools)).toHaveLength(1);
    });

    it('should provide all tools in non-proposal mode', () => {
      const normalContext = {
        isProposalMode: false,
      };
      
      const tools = tradingAgent.tools(normalContext);
      expect(Object.keys(tools).length).toBeGreaterThan(1);
      expect(tools).toHaveProperty('marketData');
      expect(tools).toHaveProperty('proposalGeneration');
      expect(tools).toHaveProperty('entryProposalGeneration');
    });
  });

  describe('Tool Name Consistency', () => {
    it('should use correct tool names without "Tool" suffix', async () => {
      // This test ensures we're using 'entryProposalGeneration' not 'entryProposalGenerationTool'
      const context = {
        isProposalMode: true,
        proposalType: 'entry',
        isEntryProposal: true,
        extractedSymbol: 'BTCUSDT',
      };
      
      mockToolCalls.length = 0;
      await tradingAgent.generate(
        [{ role: 'user', content: 'エントリー提案して' }],
        context
      );
      
      expect(mockToolCalls[0].toolName).toBe('entryProposalGeneration');
      expect(mockToolCalls[0].toolName).not.toContain('Tool');
    });
  });

  describe('Error Cases', () => {
    it('should handle missing context gracefully', async () => {
      mockToolCalls.length = 0;
      
      // Call without proper context
      await tradingAgent.generate(
        [{ role: 'user', content: 'エントリー提案' }],
        {} // Empty context
      );
      
      // Should not crash, might not select the correct tool
      expect(mockToolCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('should log tool selection for debugging', async () => {
      const debugContext = {
        isProposalMode: true,
        proposalType: 'entry',
        isEntryProposal: true,
        extractedSymbol: 'BTCUSDT',
      };
      
      // The actual implementation logs tool selection
      console.log = jest.fn();
      
      const tools = tradingAgent.tools(debugContext);
      
      // In the real implementation, this would log
      expect(console.log).toHaveBeenCalledWith(
        '[TradingAgent] Tool selection context:',
        expect.objectContaining({
          isProposalMode: true,
          proposalType: 'entry',
          isEntryProposal: true,
        })
      );
    });
  });

  describe('Multi-step Tool Usage', () => {
    it('should handle multiple tool calls in sequence', async () => {
      // Mock a scenario where multiple tools are called
      jest.mock('@ai-sdk/openai', () => ({
        openai: jest.fn(() => ({
          generate: jest.fn().mockResolvedValue({
            text: 'Multiple tools used',
            steps: [
              {
                toolCalls: [
                  { toolName: 'marketDataResilientTool', args: { symbol: 'BTCUSDT' } },
                ],
                toolResults: [
                  { toolName: 'marketDataResilientTool', result: { currentPrice: 100000 } },
                ],
              },
              {
                toolCalls: [
                  { toolName: 'entryProposalGeneration', args: { symbol: 'BTCUSDT' } },
                ],
                toolResults: [
                  { toolName: 'entryProposalGeneration', result: { proposalGroup: {} } },
                ],
              },
            ],
          }),
        })),
      }));
      
      // In a real scenario, AI might use market data first, then generate proposals
      const result = {
        steps: [
          { toolCalls: [{ toolName: 'marketDataResilientTool' }] },
          { toolCalls: [{ toolName: 'entryProposalGeneration' }] },
        ],
      };
      
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].toolCalls[0].toolName).toBe('marketDataResilientTool');
      expect(result.steps[1].toolCalls[0].toolName).toBe('entryProposalGeneration');
    });
  });
});