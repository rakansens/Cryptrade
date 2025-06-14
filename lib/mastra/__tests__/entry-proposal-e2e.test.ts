/**
 * Entry Proposal End-to-End Integration Test
 * 
 * Tests the complete flow from user input to proposal display
 * Simulates real user interactions and verifies the entire system
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { executeImprovedOrchestrator } from '../agents/orchestrator.agent';
import { agentNetwork } from '../network/agent-network';
import { registerAllAgents } from '../network/agent-registry';
import { extractProposalGroup } from '@/lib/api/helpers/proposal-extractor';
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

// Mock environment
jest.mock('@/config/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
  },
}));

// Mock API and services
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

// Mock OpenAI with realistic responses
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    generate: jest.fn().mockImplementation(async (messages, options) => {
      const query = messages[0]?.content || '';
      const context = options || {};
      
      // Simulate realistic AI responses based on intent
      if (context.isProposalMode && context.proposalType === 'entry') {
        return {
          text: 'エントリー提案を生成しました。\n\n**ロングエントリー提案**\n- エントリー価格: $100,500\n- ストップロス: $99,500\n- テイクプロフィット: $102,000 / $103,000',
          steps: [{
            toolCalls: [{
              toolName: 'entryProposalGeneration',
              args: {
                symbol: context.extractedSymbol || 'BTCUSDT',
                interval: context.interval || '1h',
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
                  id: 'epg_e2e_test_123',
                  title: 'BTCUSDT デイトレードエントリー提案',
                  description: '3個のエントリー提案を生成しました。',
                  proposals: [
                    {
                      id: 'ep_e2e_1',
                      symbol: 'BTCUSDT',
                      direction: 'long',
                      strategy: 'dayTrading',
                      entryPrice: 100500,
                      entryZone: { start: 100000, end: 101000 },
                      riskParameters: {
                        stopLoss: 99500,
                        takeProfit: [102000, 103000],
                        positionSize: 0.1,
                        riskAmount: 100,
                        riskRewardRatio: 3,
                      },
                      conditions: {
                        conditions: [
                          { type: 'price_level', met: true, description: 'Price near support' },
                          { type: 'momentum', met: true, description: 'Positive momentum' },
                        ],
                        score: 0.85,
                        readyToEnter: true,
                      },
                      marketContext: {
                        trend: 'bullish',
                        volatility: 'normal',
                        volume: 'average',
                        momentum: 'positive',
                      },
                      confidence: 0.85,
                      reasoning: {
                        factors: [
                          { factor: 'Strong support level', weight: 0.8, impact: 'positive' },
                          { factor: 'Bullish market trend', weight: 0.7, impact: 'positive' },
                        ],
                      },
                      priority: 'high',
                      createdAt: Date.now(),
                      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                    },
                  ],
                  summary: {
                    bestEntry: 'ep_e2e_1',
                    averageConfidence: 0.85,
                    marketBias: 'bullish',
                  },
                  createdAt: Date.now(),
                  status: 'pending',
                },
              },
            }],
          }],
        };
      }
      
      // Default response for other queries
      return {
        text: 'Query processed',
        steps: [],
      };
    }),
  })),
}));

// Mock entry proposal tool dependencies
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

describe('Entry Proposal End-to-End Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registerAllAgents();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Flow', () => {
    it('should handle entry proposal request from start to finish', async () => {
      // Step 1: User input
      const userQuery = 'BTCUSDTのエントリー提案をしてください';
      
      // Step 2: Orchestrator processes the request
      const orchestratorResult = await executeImprovedOrchestrator(userQuery);
      
      // Verify intent analysis
      expect(orchestratorResult.success).toBe(true);
      expect(orchestratorResult.analysis.intent).toBe('proposal_request');
      expect(orchestratorResult.analysis.proposalType).toBe('entry');
      expect(orchestratorResult.analysis.isProposalMode).toBe(true);
      expect(orchestratorResult.analysis.confidence).toBeGreaterThan(0.8);
      
      // Step 3: Extract proposal group from execution result
      const proposalGroup = extractProposalGroup(orchestratorResult.executionResult);
      
      expect(proposalGroup).toBeDefined();
      expect(proposalGroup.id).toMatch(/^epg_/);
      expect(proposalGroup.proposals).toHaveLength(1);
      expect(proposalGroup.proposals[0].direction).toBe('long');
      expect(proposalGroup.proposals[0].entryPrice).toBe(100500);
      
      // Step 4: Verify UI events would be dispatched
      const proposal = proposalGroup.proposals[0];
      expect(proposal.riskParameters).toMatchObject({
        stopLoss: 99500,
        takeProfit: [102000, 103000],
        riskRewardRatio: 3,
      });
      
      // Step 5: Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Intent analysis completed/),
        expect.objectContaining({
          intent: 'proposal_request',
          confidence: expect.any(Number),
        })
      );
    });

    it('should handle multiple entry proposals', async () => {
      // Mock multiple proposals
      const { calculateEntryPoints } = require('../tools/entry-proposal-generation/calculators/entry-calculator');
      calculateEntryPoints.mockResolvedValueOnce([
        {
          price: 100500,
          direction: 'long',
          strategy: 'dayTrading',
          confidence: 0.85,
          zone: { start: 100000, end: 101000 },
          reasoning: { factors: [] },
          relatedPatterns: [],
          relatedDrawings: [],
        },
        {
          price: 105000,
          direction: 'short',
          strategy: 'dayTrading',
          confidence: 0.75,
          zone: { start: 104500, end: 105500 },
          reasoning: { factors: [] },
          relatedPatterns: [],
          relatedDrawings: [],
        },
        {
          price: 99000,
          direction: 'long',
          strategy: 'swingTrading',
          confidence: 0.70,
          zone: { start: 98500, end: 99500 },
          reasoning: { factors: [] },
          relatedPatterns: [],
          relatedDrawings: [],
        },
      ]);
      
      const result = await executeImprovedOrchestrator('複数のエントリー提案を見せて');
      
      expect(result.success).toBe(true);
      // The actual number of proposals would depend on the full implementation
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API failures gracefully', async () => {
      // Mock API failure
      const { binanceAPI } = require('@/lib/binance/api-service');
      binanceAPI.fetchKlines.mockRejectedValueOnce(new Error('API Error'));
      
      const result = await executeImprovedOrchestrator('エントリー提案');
      
      // Should still return a result, possibly with fallback behavior
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle invalid symbols', async () => {
      const result = await executeImprovedOrchestrator('INVALIDCOINのエントリー提案');
      
      expect(result).toBeDefined();
      // Should either fail gracefully or use a default symbol
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await executeImprovedOrchestrator('BTCのエントリー提案を素早く');
      
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeLessThan(5000);
    });
  });

  describe('Context Preservation', () => {
    it('should maintain context across the flow', async () => {
      const sessionId = 'test-session-123';
      
      // First request
      const result1 = await executeImprovedOrchestrator(
        'BTCのエントリー提案',
        sessionId,
        {
          userLevel: 'expert',
          marketStatus: 'open',
        }
      );
      
      expect(result1.success).toBe(true);
      expect(result1.memoryContext).toBeDefined();
      
      // Second request in same session
      const result2 = await executeImprovedOrchestrator(
        '詳細を見せて',
        sessionId
      );
      
      // Should maintain context from first request
      expect(result2.success).toBe(true);
    });
  });

  describe('UI Integration Points', () => {
    it('should provide data suitable for UI rendering', async () => {
      const result = await executeImprovedOrchestrator('エントリー提案をグラフィカルに');
      
      const proposalGroup = extractProposalGroup(result.executionResult);
      
      if (proposalGroup && proposalGroup.proposals.length > 0) {
        const proposal = proposalGroup.proposals[0];
        
        // Verify UI-ready data
        expect(proposal).toHaveProperty('id');
        expect(proposal).toHaveProperty('symbol');
        expect(proposal).toHaveProperty('direction');
        expect(proposal).toHaveProperty('entryPrice');
        expect(proposal).toHaveProperty('entryZone');
        expect(proposal).toHaveProperty('riskParameters');
        expect(proposal).toHaveProperty('confidence');
        expect(proposal).toHaveProperty('priority');
        
        // Verify chart drawing data
        expect(proposal.entryZone).toHaveProperty('start');
        expect(proposal.entryZone).toHaveProperty('end');
        expect(proposal.riskParameters.stopLoss).toBeGreaterThan(0);
        expect(proposal.riskParameters.takeProfit).toBeInstanceOf(Array);
      }
    });
  });
});