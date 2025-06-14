// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler, createStreamingHandler, createOptionsHandler, type ApiHandlerConfig, type StreamingHandlerConfig } from '../create-api-handler';
import { createApiMiddleware } from '../middleware';
import { ValidationError } from '../helpers/error-handler';
import { createSuccessResponse, createErrorResponse } from '../helpers/response-builder';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('create-api-handler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('createApiHandler', () => {
    it('should create a handler that processes requests successfully', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ result: 'success' });
      
      const handler = createApiHandler({
        handler: mockHandler
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: { result: 'success' }
      });
      expect(mockHandler).toHaveBeenCalledWith({
        data: { data: 'test' },
        request,
        context: expect.objectContaining({
          headers: expect.any(Object)
        })
      });
    });

    it('should validate request body with Zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });

      const mockHandler = jest.fn().mockResolvedValue({ validated: true });
      
      const handler = createApiHandler({
        schema,
        handler: mockHandler
      });

      const validRequest = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 25 })
      });

      const response = await handler(validRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith({
        data: { name: 'John', age: 25 },
        request: validRequest,
        context: expect.any(Object)
      });
    });

    it('should return 400 for invalid request data', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const handler = createApiHandler({
        schema,
        handler: jest.fn()
      });

      const invalidRequest = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 'invalid' })
      });

      const response = await handler(invalidRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: {
          message: 'Invalid request data',
          code: 'BAD_REQUEST',
          details: {
            errors: expect.arrayContaining([
              expect.objectContaining({
                path: ['age'],
                message: expect.any(String)
              })
            ])
          }
        }
      });
    });

    it('should parse query parameters for GET requests', async () => {
      const schema = z.object({
        page: z.string(),
        limit: z.string()
      });

      const mockHandler = jest.fn().mockResolvedValue({ items: [] });
      
      const handler = createApiHandler({
        schema,
        handler: mockHandler
      });

      const request = new NextRequest('http://localhost/api/test?page=1&limit=10', {
        method: 'GET'
      });

      const response = await handler(request);
      
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith({
        data: { page: '1', limit: '10' },
        request,
        context: expect.any(Object)
      });
    });

    it('should apply middleware in correct order', async () => {
      const executionOrder: string[] = [];
      
      const middleware1 = createApiMiddleware({
        name: 'middleware1',
        handler: async (req, next) => {
          executionOrder.push('middleware1-start');
          const result = await next();
          executionOrder.push('middleware1-end');
          return result;
        }
      });

      const middleware2 = createApiMiddleware({
        name: 'middleware2',
        handler: async (req, next) => {
          executionOrder.push('middleware2-start');
          const result = await next();
          executionOrder.push('middleware2-end');
          return result;
        }
      });

      const handler = createApiHandler({
        middleware: [middleware1, middleware2],
        handler: async () => {
          executionOrder.push('handler');
          return { result: 'success' };
        }
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'GET'
      });

      await handler(request);

      expect(executionOrder).toEqual([
        'middleware1-start',
        'middleware2-start',
        'handler',
        'middleware2-end',
        'middleware1-end'
      ]);
    });

    it('should apply rate limiting when options provided', async () => {
      const handler = createApiHandler({
        rateLimitOptions: {
          windowMs: 1000,
          maxRequests: 2
        },
        handler: async () => ({ result: 'success' })
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'GET'
      });

      // First two requests should succeed
      const response1 = await handler(request);
      const response2 = await handler(request);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should extract session ID from headers', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ result: 'success' });
      
      const handler = createApiHandler({
        handler: mockHandler
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': 'test-session-123'
        },
        body: JSON.stringify({})
      });

      await handler(request);

      expect(mockHandler).toHaveBeenCalledWith({
        data: {},
        request,
        context: expect.objectContaining({
          sessionId: 'test-session-123',
          headers: expect.objectContaining({
            'x-session-id': 'test-session-123'
          })
        })
      });
    });

    it('should handle handler errors gracefully', async () => {
      const handler = createApiHandler({
        handler: async () => {
          throw new Error('Handler error');
        }
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: {
          message: 'Handler error',
          code: 'INTERNAL_SERVER_ERROR'
        }
      });
    });

    it('should handle ValidationError specifically', async () => {
      const handler = createApiHandler({
        handler: async () => {
          throw new ValidationError('Invalid field', { field: 'email' });
        }
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: {
          message: 'Invalid field',
          code: 'BAD_REQUEST',
          details: { field: 'email' }
        }
      });
    });

    it('should handle invalid JSON gracefully', async () => {
      const handler = createApiHandler({
        handler: jest.fn()
      });

      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const response = await handler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: null
      });
    });
  });

  describe('createStreamingHandler', () => {
    it('should create SSE stream from async generator', async () => {
      const streamHandler = async function* () {
        yield { event: 'start', data: { id: 1 } };
        yield { event: 'data', data: { value: 42 } };
        yield { event: 'end', data: { success: true } };
      };

      const handler = createStreamingHandler({
        streamHandler
      });

      const request = new NextRequest('http://localhost/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);

      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
    });

    it('should handle ReadableStream directly', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"test": true}\n\n'));
          controller.close();
        }
      });

      const handler = createStreamingHandler({
        streamHandler: async () => stream
      });

      const request = new NextRequest('http://localhost/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);

      expect(response.headers.get('content-type')).toBe('text/event-stream');
    });

    it('should apply schema validation to streaming handlers', async () => {
      const schema = z.object({
        stream: z.boolean()
      });

      const handler = createStreamingHandler({
        schema,
        streamHandler: async function* ({ data }) {
          yield { event: 'data', data };
        }
      });

      const request = new NextRequest('http://localhost/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: 'invalid' })
      });

      const response = await handler(request);
      
      // Should return error response, not streaming
      expect(response.headers.get('content-type')).not.toBe('text/event-stream');
      expect(response.status).toBe(400);
    });

    it('should handle string chunks in async generator', async () => {
      const streamHandler = async function* () {
        yield 'Hello';
        yield ' ';
        yield 'World';
      };

      const handler = createStreamingHandler({
        streamHandler
      });

      const request = new NextRequest('http://localhost/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);

      expect(response.headers.get('content-type')).toBe('text/event-stream');
    });

    it('should handle stream errors gracefully', async () => {
      const streamHandler = async function* () {
        yield { event: 'start', data: {} };
        throw new Error('Stream error');
      };

      const handler = createStreamingHandler({
        streamHandler
      });

      const request = new NextRequest('http://localhost/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handler(request);
      const reader = response.body!.getReader();
      
      let errorThrown = false;
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(true);
    });
  });

  describe('createOptionsHandler', () => {
    it('should create CORS preflight response', async () => {
      const handler = createOptionsHandler();
      const response = await handler();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toBeTruthy();
    });
  });
});