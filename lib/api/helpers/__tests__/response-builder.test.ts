import { NextResponse } from 'next/server';
import { 
  buildChatResponse, 
  createSuccessResponse, 
  processOrchestratorResult,
  type ChatResponseParams 
} from '../response-builder';

// Mock middleware functions
jest.mock('@/lib/api/middleware', () => ({
  applyCorsHeaders: jest.fn((response) => response),
  applySecurityHeaders: jest.fn((response) => response),
}));

describe('response-builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildChatResponse', () => {
    it('should build standard chat response', () => {
      const params: ChatResponseParams = {
        message: 'Analysis complete',
        orchestratorResult: {
          analysis: {
            intent: 'market-analysis',
            confidence: 0.95,
            reasoning: 'User requested market analysis',
            analysisDepth: 'deep',
            isProposalMode: false,
            proposalType: null,
          },
          success: true,
          executionTime: 1234,
          memoryContext: { data: 'context' },
          executionResult: {
            data: { result: 'analysis data' }
          }
        },
        sessionId: 'session-123'
      };

      const response = buildChatResponse(params);

      expect(response).toEqual({
        message: 'Analysis complete',
        selectedAgent: 'market-analysis',
        analysis: {
          intent: 'market-analysis',
          confidence: 0.95,
          reasoning: 'User requested market analysis',
          analysisDepth: 'deep',
          isProposalMode: false,
          proposalType: null,
        },
        execution: {
          success: true,
          executionTime: 1234,
          memoryContext: 'available',
        },
        data: { result: 'analysis data' },
        metadata: {
          sessionId: 'session-123',
          timestamp: expect.any(String),
          a2aEnabled: true,
          agentType: 'market-analysis',
        }
      });
    });

    it('should include proposalGroup when provided', () => {
      const proposalGroup = {
        proposals: [
          { id: 1, type: 'trendline' }
        ]
      };

      const params: ChatResponseParams = {
        message: 'Proposal generated',
        orchestratorResult: {
          analysis: {
            intent: 'proposal-generation',
            confidence: 0.9,
            reasoning: 'Generated proposals',
            analysisDepth: 'standard',
            isProposalMode: true,
            proposalType: 'trendline',
          },
          success: true,
          executionTime: 2000,
          memoryContext: null,
          executionResult: {}
        },
        proposalGroup,
        sessionId: 'proposal-session'
      };

      const response = buildChatResponse(params);

      expect(response.proposalGroup).toEqual(proposalGroup);
      expect(response.analysis.isProposalMode).toBe(true);
      expect(response.analysis.proposalType).toBe('trendline');
    });

    it('should handle missing sessionId', () => {
      const params: ChatResponseParams = {
        message: 'Test',
        orchestratorResult: {
          analysis: {
            intent: 'test',
            confidence: 1,
            reasoning: 'Test',
            analysisDepth: 'basic',
          },
          success: true,
          executionTime: 100,
          memoryContext: null,
          executionResult: {}
        }
      };

      const response = buildChatResponse(params);

      expect(response.metadata.sessionId).toBe('auto-generated');
    });

    it('should handle missing executionResult data', () => {
      const params: ChatResponseParams = {
        message: 'No data',
        orchestratorResult: {
          analysis: {
            intent: 'test',
            confidence: 0.5,
            reasoning: 'No data test',
            analysisDepth: 'basic',
          },
          success: false,
          executionTime: 50,
          memoryContext: null,
          executionResult: null
        },
        sessionId: 'no-data-session'
      };

      const response = buildChatResponse(params);

      expect(response.data).toBeNull();
      expect(response.execution.success).toBe(false);
      expect(response.execution.memoryContext).toBe('none');
    });
  });

  describe('createSuccessResponse', () => {
    it('should create NextResponse with JSON data', async () => {
      const data = { status: 'success', value: 42 };
      const response = createSuccessResponse(data);

      expect(response).toBeInstanceOf(NextResponse);
      
      const responseData = await response.json();
      expect(responseData).toEqual(data);
    });

    it('should apply CORS and security headers', () => {
      const { applyCorsHeaders, applySecurityHeaders } = require('@/lib/api/middleware');
      
      createSuccessResponse({ test: true });

      expect(applySecurityHeaders).toHaveBeenCalled();
      expect(applyCorsHeaders).toHaveBeenCalled();
    });

    it('should handle different data types', async () => {
      // Array
      const arrayResponse = createSuccessResponse([1, 2, 3]);
      expect(await arrayResponse.json()).toEqual([1, 2, 3]);

      // String
      const stringResponse = createSuccessResponse('success');
      expect(await stringResponse.json()).toBe('success');

      // Null
      const nullResponse = createSuccessResponse(null);
      expect(await nullResponse.json()).toBeNull();
    });
  });

  describe('processOrchestratorResult', () => {
    it('should extract message from executionResult.response', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'test',
          confidence: 0.9,
          isProposalMode: false,
        },
        executionResult: {
          response: 'This is the response message'
        }
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result).toEqual({
        message: 'This is the response message',
        proposalGroup: null
      });
    });

    it('should extract message from nested executionResult', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'test',
          confidence: 0.8,
          isProposalMode: false,
        },
        executionResult: {
          executionResult: {
            response: 'Nested response'
          }
        }
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result).toEqual({
        message: 'Nested response',
        proposalGroup: null
      });
    });

    it('should extract message from executionResult.message', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'test',
          confidence: 0.7,
          isProposalMode: false,
        },
        executionResult: {
          message: 'Message field response'
        }
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result).toEqual({
        message: 'Message field response',
        proposalGroup: null
      });
    });

    it('should use default message for proposal mode without response', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'proposal',
          confidence: 0.85,
          isProposalMode: true,
        },
        executionResult: {}
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result).toEqual({
        message: 'トレンドラインの提案を生成しました。',
        proposalGroup: null
      });
    });

    it('should use fallback message when no response found', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'unknown',
          confidence: 0.3,
          isProposalMode: false,
        },
        executionResult: {}
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result).toEqual({
        message: 'Intent: unknown (0.3)',
        proposalGroup: null
      });
    });

    it('should handle null executionResult', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'test',
          confidence: 0.5,
          isProposalMode: false,
        },
        executionResult: null
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result.message).toBe('Intent: test (0.5)');
      expect(result.proposalGroup).toBeNull();
    });

    it('should prioritize direct response over nested ones', () => {
      const orchestratorResult = {
        analysis: {
          intent: 'test',
          confidence: 0.9,
          isProposalMode: false,
        },
        executionResult: {
          response: 'Direct response',
          executionResult: {
            response: 'Nested response'
          },
          message: 'Message field'
        }
      };

      const result = processOrchestratorResult(orchestratorResult);

      expect(result.message).toBe('Direct response');
    });
  });
});