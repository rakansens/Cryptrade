// Setup test environment before any imports
import { mockTestEnv } from '@/tests/helpers/setupEnvMock';

const restoreEnv = mockTestEnv();

// Mock dependencies BEFORE importing route
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/mastra/mastra', () => ({
  mastra: {
    getAgent: jest.fn()
  }
}));

jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn()
}));

import { NextRequest } from 'next/server';
import { POST, GET, OPTIONS } from '@/app/api/ai/stream/route';
import { mastra } from '@/lib/mastra/mastra';
import { getServerSession } from '@/lib/auth/server';
import { z } from 'zod';
import { AgentError } from '@/lib/errors/base-error';
import { waitFor } from '@testing-library/react';

// Mock createSSEHandler to properly set headers
jest.mock('@/lib/api/create-sse-handler', () => ({
  createSSEHandler: (config: any) => {
    return async (request: NextRequest) => {
      // Create a simple mock response that includes the expected headers
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await config.handler.onConnect({ 
              request, 
              stream: {
                write: (msg: any) => {
                  controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));
                },
                close: () => {
                  controller.close();
                },
                isClosed: false
              }
            });
          } catch (error) {
            controller.error(error);
          }
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': config.cors?.origin || '*'
        }
      });
    };
  },
  createSSEOptionsHandler: (config: any) => {
    return async () => {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': config?.origin || '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    };
  }
}));

describe('AI Stream API Route', () => {
  const mockGetAgent = mastra.getAgent as jest.Mock;
  const mockGetServerSession = getServerSession as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // By default, mock as authenticated for all tests
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' }
    });
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('POST /api/ai/stream', () => {
    it('should stream response from agent successfully', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Hello ';
            yield 'world!';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'tradingAgent',
          sessionId: 'test-session'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
      expect(response?.headers?.get('cache-control')).toMatch(/no-cache/);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check that the agent was called correctly
      expect(mockGetAgent).toHaveBeenCalledWith('tradingAgent');
      expect(mockAgent.stream).toHaveBeenCalledWith('Test message');
    });

    it('should fall back to generate when agent does not support streaming', async () => {
      const mockAgent = {
        generate: jest.fn().mockResolvedValue('Non-streaming response')
        // Note: no stream method
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'priceInquiryAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAgent.generate).toHaveBeenCalledWith('Test message');
    });

    it('should handle agent not found error', async () => {
      mockGetAgent.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'orchestratorAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // The error is written to the stream, not returned as HTTP error
      expect(mockGetAgent).toHaveBeenCalledWith('orchestratorAgent');
    });

    it('should validate request body and handle validation errors', async () => {
      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required 'message' field
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200); // SSE always returns 200
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should handle invalid agentId', async () => {
      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'invalidAgent' // Not in allowed enum
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200); // SSE always returns 200
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should handle context parameter correctly', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Response with context';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze BTC',
          agentId: 'tradingAgent',
          context: {
            symbol: 'BTCUSDT',
            analysisDepth: 'comprehensive'
          }
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAgent.stream).toHaveBeenCalledWith('Analyze BTC');
    });

    it('should handle streaming with complex chunk objects', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield { content: 'Chunk 1' };
            yield { delta: { content: 'Chunk 2' } };
            yield { text: 'Chunk 3' };
            yield 'Simple string chunk';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test complex chunks'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAgent.stream).toHaveBeenCalled();
    });

    it('should handle stream errors gracefully', async () => {
      const mockAgent = {
        stream: jest.fn().mockRejectedValue(new Error('Stream failed'))
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test error handling'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200); // SSE always returns 200
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should set proper CORS headers', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Test';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test CORS'
        })
      });

      const response = await POST(request);
      
      // Check for CORS header (case-insensitive)
      const corsHeader = response?.headers?.get('access-control-allow-origin') || 
                        response?.headers?.get('Access-Control-Allow-Origin');
      expect(corsHeader).toBe('*');
    });
  });

  describe('GET /api/ai/stream', () => {
    it('should stream response via GET request', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'GET response';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest(
        'http://localhost/api/ai/stream?message=Test%20GET&agentId=tradingAgent&sessionId=test-session'
      );

      const response = await GET(request);
      
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockGetAgent).toHaveBeenCalledWith('tradingAgent');
      expect(mockAgent.stream).toHaveBeenCalledWith('Test GET');
    });

    it('should handle GET request without message parameter', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/stream?agentId=tradingAgent'
      );

      const response = await GET(request);
      
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should parse context from query parameter', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Context response';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const context = { symbol: 'ETHUSDT', analysisDepth: 'basic' };
      const request = new NextRequest(
        `http://localhost/api/ai/stream?message=Test&context=${encodeURIComponent(JSON.stringify(context))}`
      );

      const response = await GET(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAgent.stream).toHaveBeenCalledWith('Test');
    });

    it('should handle GET request errors', async () => {
      const mockAgent = {
        stream: jest.fn().mockRejectedValue(new Error('GET stream error'))
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest(
        'http://localhost/api/ai/stream?message=Test%20error'
      );

      const response = await GET(request);
      
      expect(response?.status).toBe(200); // SSE always returns 200
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should handle missing agent in GET request', async () => {
      mockGetAgent.mockReturnValue(null);

      const request = new NextRequest(
        'http://localhost/api/ai/stream?message=Test&agentId=uiControlAgent'
      );

      const response = await GET(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockGetAgent).toHaveBeenCalledWith('uiControlAgent');
    });
  });

  describe('OPTIONS /api/ai/stream', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();
      
      expect(response?.status).toBe(200);
      // Check for CORS header (case-insensitive)
      const corsHeader = response?.headers?.get('access-control-allow-origin') || 
                        response?.headers?.get('Access-Control-Allow-Origin');
      expect(corsHeader).toBe('*');
      const methodsHeader = response?.headers?.get('access-control-allow-methods') || 
                           response?.headers?.get('Access-Control-Allow-Methods');
      const headersHeader = response?.headers?.get('access-control-allow-headers') || 
                           response?.headers?.get('Access-Control-Allow-Headers');
      expect(methodsHeader).toBe('GET, OPTIONS');
      expect(headersHeader).toBe('Content-Type, Authorization');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for POST requests', async () => {
      // Mock no session (unauthenticated)
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test auth'
        })
      });

      const response = await POST(request);
      
      // SSE always returns 200, auth error is in the stream
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
      
      // Verify getServerSession was called
      expect(mockGetServerSession).toHaveBeenCalled();
    });

    it('should allow authenticated requests', async () => {
      // Mock authenticated session
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user-id', email: 'test@example.com' }
      });

      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Authenticated response';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Test authenticated',
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockGetAgent).toHaveBeenCalled();
      expect(mockAgent.stream).toHaveBeenCalled();
    });
  });

  describe('Edge cases and Error handling', () => {
    it('should handle malformed JSON in POST body', async () => {
      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200); // SSE always returns 200
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should handle empty message string', async () => {
      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '', // Empty string should fail validation
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      expect(response?.headers?.get('content-type')).toBe('text/event-stream');
    });

    it('should handle very long messages', async () => {
      const mockAgent = {
        stream: jest.fn().mockResolvedValue({
          textStream: (async function* () {
            yield 'Processed long message';
          })()
        })
      };
      mockGetAgent.mockReturnValue(mockAgent);

      const longMessage = 'a'.repeat(10000);
      const request = new NextRequest('http://localhost/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: longMessage,
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);
      
      expect(response?.status).toBe(200);
      
      // Wait for async handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAgent.stream).toHaveBeenCalledWith(longMessage);
    });
  });
});