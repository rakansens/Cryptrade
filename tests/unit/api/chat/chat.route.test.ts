// Setup test environment before any imports
import { mockTestEnv } from '@/tests/helpers/setupEnvMock';

// Disable API authentication for tests
const restoreEnv = mockTestEnv({
  API_AUTH_ENABLED: 'false'
});

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '@/app/api/ai/chat/route';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { extractProposalGroup } from '@/lib/api/helpers/proposal-extractor';

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

// Mock authentication
jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      email: 'test@example.com'
    }
  })
}));

// Mock rate limit modules
jest.mock('@/lib/api/rate-limit', () => ({
  memoryStore: {
    clear: jest.fn()
  }
}));

jest.mock('@/lib/api/rate-limit-edge', () => ({
  getClientIdentifier: jest.fn(() => 'test-client-id'),
  checkRateLimit: jest.fn(() => Promise.resolve({
    success: true,
    remainingRequests: 100,
    resetTime: Date.now() + 60000
  }))
}));

describe('AI Chat API Route', () => {
  const mockExecuteImprovedOrchestrator = executeImprovedOrchestrator as jest.Mock;
  const mockExtractProposalGroup = extractProposalGroup as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should handle multiple requests gracefully', async () => {
      // Test that multiple requests are handled without errors
      // In test environment, rate limiting fails open (allows all requests)
      const mockResult = {
        analysis: { intent: 'greeting', confidence: 1, isProposalMode: false },
        executionResult: { success: true, message: 'Hello!' },
        executionTime: 50 + Math.floor(Math.random() * 100),
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);

      // Make multiple requests
      const responses: Response[] = [];
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Hello ${i}` })
        });
        const response = await POST(request);
        responses.push(response);
      }

      // All requests should succeed in test environment
      responses.forEach((response: Response) => {
        expect(response.status).toBe(200);
      });
      
      // Verify the handler was called for each request
      expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledTimes(5);
      
      // Verify each call had the correct message
      for (let i = 0; i < 5; i++) {
        expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledWith(
          `Hello ${i}`,
          expect.any(String),
          expect.any(Object)
        );
      }
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