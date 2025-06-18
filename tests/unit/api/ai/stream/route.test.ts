import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/stream/route';
import { logger } from '@/lib/utils/logger';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn()
}));

jest.mock('ai', () => ({
  streamText: jest.fn()
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

      (streamText as jest.Mock).mockResolvedValueOnce(mockStream);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Tell me about Bitcoin' }
          ],
          temperature: 0.7,
          maxTokens: 1000
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      expect(streamText).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Tell me about Bitcoin' }
        ],
        temperature: 0.7,
        maxTokens: 1000
      });
    });

    it('should handle missing messages', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          temperature: 0.7
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Messages are required');
    });

    it('should handle empty messages array', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: []
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('At least one message is required');
    });

    it('should validate message format', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { content: 'Missing role field' }
          ]
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid message format');
    });

    it('should handle stream errors gracefully', async () => {
      const mockError = new Error('Stream generation failed');
      (streamText as jest.Mock).mockRejectedValueOnce(mockError);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Test message' }
          ]
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate stream');
      expect(logger.error).toHaveBeenCalledWith('[AIStream] Stream generation failed', { error: mockError });
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      (streamText as jest.Mock).mockRejectedValueOnce(rateLimitError);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Test' }
          ]
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should use default parameters when not provided', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Response';
          }
        }
      };

      (streamText as jest.Mock).mockResolvedValueOnce(mockStream);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Test' }
          ]
        })
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: 'Test' }
        ],
        temperature: 0.5,
        maxTokens: 2000
      });
    });

    it('should handle system messages correctly', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Response';
          }
        }
      };

      (streamText as jest.Mock).mockResolvedValueOnce(mockStream);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a trading assistant' },
            { role: 'user', content: 'Analyze BTCUSDT' }
          ]
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a trading assistant' },
            { role: 'user', content: 'Analyze BTCUSDT' }
          ]
        })
      );
    });

    it('should handle conversation history', async () => {
      const mockStream = {
        textStream: {
          [Symbol.asyncIterator]: async function* () {
            yield 'Based on our previous discussion...';
          }
        }
      };

      (streamText as jest.Mock).mockResolvedValueOnce(mockStream);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'What is Bitcoin?' },
            { role: 'assistant', content: 'Bitcoin is a cryptocurrency...' },
            { role: 'user', content: 'Tell me more about its price' }
          ]
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'user', content: 'What is Bitcoin?' },
            { role: 'assistant', content: 'Bitcoin is a cryptocurrency...' },
            { role: 'user', content: 'Tell me more about its price' }
          ])
        })
      );
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

      (streamText as jest.Mock).mockResolvedValueOnce(mockStream);
      (openai as jest.Mock).mockReturnValue('gpt-4-turbo-preview');

      const request = new NextRequest('http://localhost:3000/api/ai/stream', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Test abort' }
          ]
        }),
        signal: abortController.signal
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Stream should be terminated on abort
    });
  });
});