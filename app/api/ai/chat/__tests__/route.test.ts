// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '../route';
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
      const mockResult = {
        analysis: {
          intent: 'market_query',
          confidence: 0.9,
          symbol: 'BTCUSDT',
          isProposalMode: false
        },
        executionResult: {
          success: true,
          message: 'Bitcoin is currently trading at $108,500'
        },
        executionTime: 1500,
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
      expect(data).toMatchObject({
        message: 'Bitcoin is currently trading at $108,500',
        selectedAgent: 'market_query',
        analysis: {
          intent: 'market_query',
          confidence: 0.9
        },
        metadata: {
          sessionId: 'test-session-123',
          a2aEnabled: true
        }
      });

      expect(mockExecuteImprovedOrchestrator).toHaveBeenCalledWith(
        'What is the current price of Bitcoin?',
        'test-session-123',
        {}
      );
    });

    it('should handle proposal generation requests', async () => {
      const mockProposalGroup = {
        id: 'pg_123',
        proposals: [
          {
            id: 'prop_1',
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
        executionTime: 2000,
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
      expect(data).toMatchObject({
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
      expect(data).toMatchObject({
        error: 'Invalid request data',
        details: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: ['message'],
              message: 'Required'
            })
          ])
        }
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
      expect(data).toMatchObject({
        message: expect.stringContaining('問題が発生しました'),
        selectedAgent: 'error',
        execution: {
          success: false
        }
      });
    });

    it('should apply rate limiting', async () => {
      const mockResult = {
        analysis: { intent: 'greeting', confidence: 1, isProposalMode: false },
        executionResult: { success: true, message: 'Hello!' },
        executionTime: 100,
        success: true
      };

      mockExecuteImprovedOrchestrator.mockResolvedValue(mockResult);

      // Make multiple requests to test rate limiting
      const requests = Array(25).fill(null).map(() => 
        new NextRequest('http://localhost/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hello' })
        })
      );

      const responses = await Promise.all(
        requests.map(req => POST(req))
      );

      const successCount = responses.filter(r => r.status === 200).length;
      
      // With rate limit of 20 per minute, some requests should be limited
      expect(successCount).toBeLessThanOrEqual(20);
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
        executionTime: 1800,
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
        contextData
      );
    });
  });

  describe('OPTIONS /api/ai/chat', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toMatch(/POST|GET|OPTIONS/);
    });
  });
});