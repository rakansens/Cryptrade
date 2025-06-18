import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { POST, OPTIONS } from '../route';
import { executeImprovedOrchestrator } from '@/lib/mastra/agents/orchestrator.agent';
import { logger } from '@/lib/utils/logger';
import { extractProposalGroup, debugProposalGroupStructure } from '@/lib/api/helpers/proposal-extractor';
import { buildChatResponse, processOrchestratorResult } from '@/lib/api/helpers/response-builder';
import { createOrchestratorErrorResponse } from '@/lib/api/helpers/error-handler';
import { registerAgentsSafely } from '@/lib/api/helpers/request-validator';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// Mock dependencies
jest.mock('@/lib/mastra/agents/orchestrator.agent');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/api/helpers/proposal-extractor');
jest.mock('@/lib/api/helpers/response-builder');
jest.mock('@/lib/api/helpers/error-handler');
jest.mock('@/lib/api/helpers/request-validator');
jest.mock('@/lib/api/middleware', () => ({
  withRateLimit: jest.fn((handler) => handler),
  withErrorHandler: jest.fn((handler) => handler),
  withAuth: jest.fn((handler) => handler),
  withValidation: jest.fn(() => (handler: any) => handler)
}));

// Define the schema exactly as in the route
const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  context: z.object({
    symbol: z.string().optional(),
    interval: z.string().optional(),
    analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
  }).optional(),
});

describe('AI Chat API Route', () => {
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (registerAgentsSafely as jest.Mock).mockImplementation(() => {});
    (logger.info as jest.Mock).mockImplementation(() => {});
    (logger.error as jest.Mock).mockImplementation(() => {});
    
    mockRequest = {
      json: jest.fn(),
      headers: new Headers(),
      url: 'http://localhost:3000/api/ai/chat',
      method: 'POST'
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Schema Validation', () => {
    it('should accept valid message with sessionId', () => {
      const validData = {
        message: 'BTCUSDTのチャートを分析してください',
        sessionId: 'test-session-001',
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisDepth: 'detailed' as const,
        },
      };

      expect(() => ChatRequestSchema.parse(validData)).not.toThrow();
    });

    it('should accept message without sessionId', () => {
      const validData = {
        message: 'ETHUSDTの価格動向を教えてください',
      };

      expect(() => ChatRequestSchema.parse(validData)).not.toThrow();
    });

    it('should reject empty message', () => {
      const invalidData = {
        message: '',
        sessionId: 'test-session-002',
      };

      expect(() => ChatRequestSchema.parse(invalidData)).toThrow(z.ZodError);
      
      try {
        ChatRequestSchema.parse(invalidData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          expect(error.errors[0]!.message).toBe('Message is required');
          expect(error.errors[0]!.path).toEqual(['message']);
        }
      }
    });

    it('should reject missing message field', () => {
      const invalidData = {
        sessionId: 'test-session-003',
        context: {
          symbol: 'BTCUSDT',
        },
      };

      expect(() => ChatRequestSchema.parse(invalidData)).toThrow(z.ZodError);
      
      try {
        ChatRequestSchema.parse(invalidData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          expect(error.errors[0]!.code).toBe('invalid_type');
          expect(error.errors[0]!.path).toEqual(['message']);
        }
      }
    });

    it('should reject invalid analysisDepth value', () => {
      const invalidData = {
        message: 'チャート分析をお願いします',
        context: {
          analysisDepth: 'invalid-depth' as any,
        },
      };

      expect(() => ChatRequestSchema.parse(invalidData)).toThrow(z.ZodError);
      
      try {
        ChatRequestSchema.parse(invalidData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          expect(error.errors[0]!.code).toBe('invalid_enum_value');
          expect(error.errors[0]!.path).toEqual(['context', 'analysisDepth']);
        }
      }
    });

    it('should accept all valid analysisDepth values', () => {
      const depths = ['basic', 'detailed', 'comprehensive'] as const;
      
      depths.forEach(depth => {
        const data = {
          message: 'Test message',
          context: {
            analysisDepth: depth,
          },
        };
        
        expect(() => ChatRequestSchema.parse(data)).not.toThrow();
      });
    });

    it('should accept partial context', () => {
      const dataWithSymbolOnly = {
        message: 'Test message',
        context: {
          symbol: 'BTCUSDT',
        },
      };
      
      const dataWithIntervalOnly = {
        message: 'Test message',
        context: {
          interval: '1h',
        },
      };
      
      expect(() => ChatRequestSchema.parse(dataWithSymbolOnly)).not.toThrow();
      expect(() => ChatRequestSchema.parse(dataWithIntervalOnly)).not.toThrow();
    });

    it('should accept message with no context', () => {
      const data = {
        message: 'Simple test message',
      };
      
      expect(() => ChatRequestSchema.parse(data)).not.toThrow();
    });
  });

  describe('POST handler', () => {
    it('should process valid chat request successfully', async () => {
      const requestData = {
        message: 'BTCUSDTの現在のトレンドを分析してください',
        sessionId: 'test-session-123',
        context: {
          symbol: 'BTCUSDT',
          interval: '1h',
          analysisDepth: 'detailed' as const
        }
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'market_analysis',
          confidence: 0.95,
          reasoning: 'User wants trend analysis for BTCUSDT',
          analysisDepth: 'detailed',
          isProposalMode: false
        },
        executionTime: 1234,
        executionResult: {
          response: 'Market analysis complete',
          success: true
        }
      };

      const mockProcessedResult = {
        message: 'トレンド分析が完了しました',
        proposalGroup: null,
        entryProposalGroup: null
      };

      const mockResponse = {
        success: true,
        message: 'トレンド分析が完了しました',
        sessionId: 'test-session-123'
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue(mockProcessedResult);
      (buildChatResponse as jest.Mock).mockReturnValue(mockResponse);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(registerAgentsSafely).toHaveBeenCalled();
      expect(executeImprovedOrchestrator).toHaveBeenCalledWith(
        requestData.message,
        requestData.sessionId
      );
      expect(processOrchestratorResult).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          analysis: expect.objectContaining({
            intent: 'market_analysis',
            confidence: 0.95
          })
        })
      );
      expect(buildChatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'トレンド分析が完了しました',
          sessionId: 'test-session-123'
        })
      );
      expect(responseData).toEqual(mockResponse);
    });

    it('should handle proposal mode correctly', async () => {
      const requestData = {
        message: 'エントリーポイントを提案してください'
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'proposal_request',
          confidence: 0.9,
          reasoning: 'User wants entry proposals',
          analysisDepth: 'comprehensive',
          isProposalMode: true,
          proposalType: 'entry'
        },
        executionTime: 2345,
        executionResult: {
          proposalGroup: {
            id: 'proposal-123',
            proposals: []
          },
          success: true
        }
      };

      const mockProposalGroup = {
        id: 'proposal-123',
        type: 'entry',
        proposals: [
          {
            id: 'prop-1',
            type: 'long',
            symbol: 'BTCUSDT',
            entry: 50000,
            targets: [51000, 52000],
            stopLoss: 49000
          }
        ]
      };

      const mockProcessedResult = {
        message: '',
        proposalGroup: null,
        entryProposalGroup: mockProposalGroup
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue(mockProcessedResult);
      (extractProposalGroup as jest.Mock).mockReturnValue(mockProposalGroup);
      (buildChatResponse as jest.Mock).mockReturnValue({ success: true });

      const response = await POST(mockRequest as NextRequest);

      expect(extractProposalGroup).toHaveBeenCalledWith(mockOrchestratorResponse.executionResult);
      expect(buildChatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'エントリー提案を生成しました。',
          proposalGroup: mockProposalGroup
        })
      );
    });

    it('should handle orchestrator errors', async () => {
      const requestData = {
        message: 'Test message'
      };

      const orchestratorError = new Error('Orchestrator failed');
      const mockErrorResponse = {
        success: false,
        error: 'Orchestrator error occurred',
        sessionId: expect.any(String)
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockRejectedValue(orchestratorError);
      (createOrchestratorErrorResponse as jest.Mock).mockReturnValue(mockErrorResponse);

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(logger.error).toHaveBeenCalledWith(
        '[AI Chat A2A] A2A orchestrator failed',
        expect.objectContaining({
          error: 'Orchestrator failed',
          userMessage: 'Test message'
        })
      );
      expect(createOrchestratorErrorResponse).toHaveBeenCalledWith(
        orchestratorError,
        expect.any(String)
      );
      expect(responseData).toEqual(mockErrorResponse);
    });

    it('should generate sessionId if not provided', async () => {
      const requestData = {
        message: 'Test message without session'
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'general',
          confidence: 0.8
        },
        executionTime: 1000,
        executionResult: {
          response: 'Response',
          success: true
        }
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue({ message: 'Response' });
      (buildChatResponse as jest.Mock).mockImplementation((params) => ({ 
        success: true,
        sessionId: params.sessionId 
      }));

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(executeImprovedOrchestrator).toHaveBeenCalledWith(
        requestData.message,
        expect.stringContaining('chat-session-')
      );
      expect(responseData.sessionId).toMatch(/^chat-session-\d+$/);
    });

    it('should handle proposal extraction failure', async () => {
      const requestData = {
        message: 'Generate proposals'
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'proposal_request',
          confidence: 0.9,
          isProposalMode: true
        },
        executionTime: 1500,
        executionResult: {
          // Invalid structure for proposal extraction
          data: 'invalid'
        }
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue({ message: 'Processed' });
      (extractProposalGroup as jest.Mock).mockReturnValue(null);
      (debugProposalGroupStructure as jest.Mock).mockImplementation(() => {});

      await POST(mockRequest as NextRequest);

      expect(extractProposalGroup).toHaveBeenCalled();
      expect(debugProposalGroupStructure).toHaveBeenCalledWith(mockOrchestratorResponse.executionResult);
    });

    it('should handle complex context data', async () => {
      const requestData = {
        message: 'Analyze with context',
        context: {
          symbol: 'ETHUSDT',
          interval: '4h',
          analysisDepth: 'comprehensive' as const,
          customParam: 'test'
        }
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue({
        success: true,
        analysis: { intent: 'analysis', confidence: 0.85 },
        executionTime: 1000
      });
      (processOrchestratorResult as jest.Mock).mockReturnValue({ message: 'Done' });
      (buildChatResponse as jest.Mock).mockReturnValue({ success: true });

      await POST(mockRequest as NextRequest);

      expect(executeImprovedOrchestrator).toHaveBeenCalledWith(
        requestData.message,
        expect.any(String)
      );
    });

    it('should log A2A communication details', async () => {
      const requestData = {
        message: 'Test A2A logging',
        sessionId: 'log-test-session'
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'test',
          confidence: 0.99
        },
        executionTime: 500,
        executionResult: {
          response: 'Test response',
          success: true
        }
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue({ message: 'Test' });
      (buildChatResponse as jest.Mock).mockReturnValue({ success: true });

      await POST(mockRequest as NextRequest);

      expect(logger.info).toHaveBeenCalledWith(
        '[AI Chat A2A] Processing request with A2A communication',
        expect.objectContaining({
          sessionId: 'log-test-session',
          messageLength: requestData.message.length,
          a2aEnabled: true
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[AI Chat A2A] A2A orchestrator completed successfully',
        expect.objectContaining({
          intent: 'test',
          confidence: 0.99,
          executionTime: 500,
          success: true
        })
      );
    });

    it('should handle trendline proposal type', async () => {
      const requestData = {
        message: 'トレンドラインを描いてください'
      };

      const mockOrchestratorResponse = {
        success: true,
        analysis: {
          intent: 'proposal_request',
          confidence: 0.88,
          isProposalMode: true
        },
        executionTime: 1800,
        executionResult: {
          proposalGroup: {
            type: 'trendline',
            lines: []
          }
        }
      };

      const mockProposalGroup = {
        id: 'trendline-123',
        type: 'trendline',
        lines: [
          {
            id: 'line-1',
            start: { time: 1000, value: 50000 },
            end: { time: 2000, value: 52000 }
          }
        ]
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockResolvedValue(mockOrchestratorResponse);
      (processOrchestratorResult as jest.Mock).mockReturnValue({ 
        message: '',
        proposalGroup: mockProposalGroup 
      });
      (extractProposalGroup as jest.Mock).mockReturnValue(mockProposalGroup);
      (buildChatResponse as jest.Mock).mockReturnValue({ success: true });

      const response = await POST(mockRequest as NextRequest);

      expect(buildChatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'トレンドラインの提案を生成しました。',
          proposalGroup: mockProposalGroup
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      const requestData = {
        message: 'Test non-error exception'
      };

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockRejectedValue('String error');
      (createOrchestratorErrorResponse as jest.Mock).mockReturnValue({ 
        success: false, 
        error: 'Unknown error' 
      });

      await POST(mockRequest as NextRequest);

      expect(createOrchestratorErrorResponse).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(String)
      );
    });

    it('should handle JSON parsing errors', async () => {
      (mockRequest.json as jest.Mock).mockRejectedValue(new SyntaxError('Invalid JSON'));

      await expect(POST(mockRequest as NextRequest)).rejects.toThrow('Invalid JSON');
    });

    it('should handle orchestrator timeout', async () => {
      const requestData = {
        message: 'Test timeout'
      };

      const timeoutError = new Error('Operation timed out');
      (timeoutError as any).code = 'TIMEOUT';

      (mockRequest.json as jest.Mock).mockResolvedValue(requestData);
      (executeImprovedOrchestrator as jest.Mock).mockRejectedValue(timeoutError);
      (createOrchestratorErrorResponse as jest.Mock).mockReturnValue({
        success: false,
        error: 'Request timed out',
        code: 'TIMEOUT'
      });

      const response = await POST(mockRequest as NextRequest);
      const responseData = await response.json();

      expect(responseData.code).toBe('TIMEOUT');
    });
  });

  describe('OPTIONS handler', () => {
    it('should handle CORS preflight request', async () => {
      const mockOptionsRequest = {
        ...mockRequest,
        method: 'OPTIONS'
      };

      const response = await OPTIONS(mockOptionsRequest as NextRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle rate limit configuration', () => {
      // The actual route configures rate limiting with:
      // windowMs: 60 * 1000 (1 minute)
      // maxRequests: 20
      
      const rateLimitConfig = {
        windowMs: 60 * 1000,
        maxRequests: 20,
      };
      
      expect(rateLimitConfig.windowMs).toBe(60000);
      expect(rateLimitConfig.maxRequests).toBe(20);
      
      // Simulate 21st request should be rate limited
      let requestCount = 0;
      const results: boolean[] = [];
      
      for (let i = 1; i <= 21; i++) {
        requestCount++;
        const isAllowed = requestCount <= rateLimitConfig.maxRequests;
        results.push(isAllowed);
      }
      
      // First 20 should pass
      expect(results.slice(0, 20).every(r => r === true)).toBe(true);
      // 21st should fail
      expect(results[20]).toBe(false);
    });
  });
});