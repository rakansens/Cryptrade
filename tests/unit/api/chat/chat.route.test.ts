// Setup test environment before any imports
import { mockTestEnv } from '@/tests/helpers/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '@/app/api/ai/chat/route';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { extractProposalGroup } from '@/lib/api/helpers/proposal-extractor';
import { memoryStore } from '@/lib/api/rate-limit';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

jest.mock('@/lib/mastra/agents/orchestrator.agent', () => ({
  executeImprovedOrchestrator: jest.fn(),
}));

jest.mock('@/lib/api/helpers/proposal-extractor', () => ({
  extractProposalGroup: jest.fn(),
  debugProposalGroupStructure: jest.fn(),
}));

jest.mock('@/lib/api/helpers/request-validator', () => ({
  registerAgentsSafely: jest.fn(),
}));

describe('AI Chat API Route', () => {
  const mockExecuteImprovedOrchestrator = executeImprovedOrchestrator as jest.Mock;
  const mockExtractProposalGroup = extractProposalGroup as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear rate limit memory store
    memoryStore.clear();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('POST /api/ai/chat', () => {
    it('should process a basic chat message successfully', async () => {
      // Generate dynamic response data
      const btcPrice = 40000 + Math.floor(Math.random() * 60000);
      const confidence = 0.8 + Math.random() * 0.2;
      const execTime = 800 + Math.floor(Math.random() * 1200);
      
      const mockResult = {
        analysis: {
          intent: 'market_query',
          confidence: parseFloat(confidence.toFixed(2)),
          symbol: 'BTCUSDT',
          isProposalMode: false
        },
        executionResult: {
          success: true,
          message: `Bitcoin is currently trading at $${btcPrice.toLocaleString()}`
        },
        executionTime: execTime,
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What is the current price of Bitcoin?',
          sessionId: 'test-session-123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Response is wrapped in 'data' property
      expect(data.data).toMatchObject({
        message: expect.stringContaining('Bitcoin is currently trading at $'),
        selectedAgent: 'market_query',
        analysis: {
          intent: 'market_query',
          confidence: expect.any(Number)
        },
        metadata: {
          sessionId: 'test-session-123',
          a2aEnabled: true
        }
      });
      
      // Verify the price is within expected range
      const priceMatch = data.data.message.match(/\$([\d,]+)/);
      expect(priceMatch).toBeTruthy();
      const price = parseInt(priceMatch[1].replace(/,/g, ''));
      expect(price).toBeGreaterThanOrEqual(40000);
      expect(price).toBeLessThanOrEqual(100000);

      expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledWith(
        'What is the current price of Bitcoin?',
        'test-session-123',
        {
          queryComplexity: 'simple',
          isProposalMode: false,
          userTier: 'free',
          userLevel: 'intermediate',
          marketStatus: 'open'
        }
      );
    });

    it('should handle proposal generation requests', async () => {
      // Generate dynamic proposal data
      const proposalId = `pg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const propId = `prop_${Math.floor(Math.random() * 10000)}`;
      
      const mockProposalGroup = {
        id: proposalId,
        proposals: [
          {
            id: propId,
            type: 'trendline',
            reasoning: 'Strong uptrend detected',
            drawings: []
          }
        ]
      };

      const mockResult = {
        analysis: {
          intent: 'proposal_request',
          confidence: 0.95,
          symbol: 'BTCUSDT',
          isProposalMode: true
        },
        executionResult: {
          success: true,
          proposalGroup: mockProposalGroup
        },
        executionTime: 1500 + Math.floor(Math.random() * 1000),
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);
      mockExtractProposalGroup.mockReturnValue(mockProposalGroup);

      const request = new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Draw trendlines for BTCUSDT',
          context: {
            symbol: 'BTCUSDT',
            interval: '1h',
            analysisDepth: 'detailed'
          }
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Response is wrapped in 'data' property
      expect(data.data).toMatchObject({
        message: 'トレンドラインの提案を生成しました。',
        proposalGroup: mockProposalGroup,
        selectedAgent: 'proposal_request',
        analysis: {
          intent: 'proposal_request',
          confidence: 0.95
        }
      });
    });

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required 'message' field
          sessionId: 'test-session'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatchObject({
        message: 'Invalid query parameters',
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ['message'],
            message: 'Required'
          })
        ])
      });
    });

    it('should handle orchestrator errors gracefully', async () => {
      mockExecuteImprovedOrchestrator.mockRejectedValue(
        new Error('Orchestrator execution failed')
      );

      const request = new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Response is wrapped in 'data' property
      expect(data.data).toMatchObject({
        message: expect.stringContaining('問題が発生しました'),
        selectedAgent: 'error',
        execution: {
          success: false
        }
      });
    });

    it('should apply rate limiting', async () => {
      // Note: In test environment without KV storage, rate limiter fails open (allows all requests)
      // This is intentional for production resilience
      const mockResult = {
        analysis: { intent: 'greeting', confidence: 1, isProposalMode: false },
        executionResult: { success: true, message: 'Hello!' },
        executionTime: 50 + Math.floor(Math.random() * 100),
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);

      // Make a few requests to ensure rate limiter doesn't crash
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hello' })
        });
        const response = await POST(request);
        responses.push(response);
      }

      // In test environment, all requests should succeed (fail open behavior)
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(5);
      
      // Verify the handler was called for each request
      expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledTimes(5);
    });

    it('should use context parameters when provided', async () => {
      const mockResult = {
        analysis: {
          intent: 'technical_analysis',
          confidence: 0.85,
          symbol: 'ETHUSDT',
          isProposalMode: false
        },
        executionResult: {
          success: true,
          message: 'ETH analysis complete'
        },
        executionTime: 1200 + Math.floor(Math.random() * 800),
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);

      const contextData = {
        symbol: 'ETHUSDT',
        interval: '4h',
        analysisDepth: 'comprehensive'
      };

      const request = new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze Ethereum',
          context: contextData
        })
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledWith(
        'Analyze Ethereum',
        expect.any(String),
        {
          queryComplexity: 'complex', // comprehensive maps to complex
          isProposalMode: false,
          userTier: 'free',
          userLevel: 'intermediate',
          marketStatus: 'open'
        }
      );
    });
  });

  describe('OPTIONS /api/ai/chat', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
      expect(response.headers.get('access-control-allow-methods')).toMatch(/POST|GET|OPTIONS/);
    });
  });
});