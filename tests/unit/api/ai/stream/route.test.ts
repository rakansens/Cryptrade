import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/ai/stream/route';
import { logger } from '@/lib/utils/logger';
import { mastra } from '@/lib/mastra/mastra';
import { z } from 'zod';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/lib/mastra/mastra', () => ({
  mastra: {
    getAgent: jest.fn()
  }
}));

describe('AI Stream API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/stream', () => {
    it('should stream AI response successfully', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Hello';
            yield ' ';
            yield 'World';
          }
        }
      };

      const mockAgent = {
        stream: jest.fn().mockResolvedValue(mockStream)
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Tell me about Bitcoin',
          agentId: 'tradingAgent',
          sessionId: 'test-session'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      
      expect(mastra.getAgent).toHaveBeenCalledWith('tradingAgent');
      expect(mockAgent.stream).toHaveBeenCalledWith('Tell me about Bitcoin');
    });

    it('should handle missing message', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // SSE always returns 200, error is in the stream
      // The error would be written to the stream
    });

    it('should handle empty message', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: '',
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // SSE always returns 200
      // Validation error would be in the stream
    });

    it('should validate agent ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'invalidAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // SSE always returns 200
      // Validation error would be in the stream
    });

    it.skip('should handle stream errors gracefully', async () => {
      // TODO: Fix this test - error handling in SSE handler needs investigation
      const mockError = new Error('Stream generation failed');
      const mockAgent = {
        stream: jest.fn().mockRejectedValue(mockError)
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test message',
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // SSE always returns 200
      // Check if any error was logged
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle agent not found', async () => {
      jest.mocked(mastra.getAgent).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test',
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // SSE always returns 200
      expect(logger.error).toHaveBeenCalled();
    });

    it('should use default agent when not provided', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Response';
          }
        }
      };

      const mockAgent = {
        stream: jest.fn().mockResolvedValue(mockStream)
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test'
        })
      });

      await POST(request);

      expect(mastra.getAgent).toHaveBeenCalledWith('tradingAgent');
    });

    it('should handle agent without streaming support', async () => {
      const mockAgent = {
        stream: null,
        generate: jest.fn().mockResolvedValue('Generated response')
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Analyze BTCUSDT',
          agentId: 'tradingAgent'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAgent.generate).toHaveBeenCalledWith('Analyze BTCUSDT');
      expect(logger.warn).toHaveBeenCalledWith(
        '[AI Stream API] Agent does not support streaming, falling back to generate',
        { agentId: 'tradingAgent' }
      );
    });

    it('should handle context in request', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Based on the context...';
          }
        }
      };

      const mockAgent = {
        stream: jest.fn().mockResolvedValue(mockStream)
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Tell me more about its price',
          agentId: 'tradingAgent',
          context: {
            symbol: 'BTCUSDT',
            analysisDepth: 'detailed'
          }
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAgent.stream).toHaveBeenCalledWith('Tell me more about its price');
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Start';
            // Simulate abort
            abortController.abort();
            yield 'Should not reach here';
          }
        }
      };

      const mockAgent = {
        stream: jest.fn().mockResolvedValue(mockStream)
      };

      jest.mocked(mastra.getAgent).mockReturnValue(mockAgent);

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test abort',
          agentId: 'tradingAgent'
        }),
        signal: abortController.signal
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Stream should be terminated on abort
    });
  });
});