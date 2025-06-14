// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  withErrorBoundary,
  withStreamingErrorBoundary,
  withValidation,
  withAuth,
  withMiddleware,
  withFallback,
  ApiHandler
} from '../error-boundary';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError
} from '@/lib/errors';
import { enhancedLogger as logger } from '@/lib/logs/enhanced-logger';
import { env } from '@/config/env';

// Mock dependencies
jest.mock('@/lib/logs/enhanced-logger', () => ({
  enhancedLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }
}));

describe('Error Boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).NODE_ENV = 'test';
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('withErrorBoundary', () => {
    it('should handle successful requests', async () => {
      const handler: ApiHandler = async (request) => {
        return NextResponse.json({ success: true, data: 'test' });
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, data: 'test' });
      expect(response.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should handle AppError with operational flag', async () => {
      const handler: ApiHandler = async () => {
        throw new ValidationError('Invalid input', 'email', 'not-email');
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST'
      });
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: {
            field: 'email',
            value: 'not-email'
          }
        },
        metadata: {
          timestamp: expect.any(String),
          requestId: expect.any(String),
          path: '/api/test',
          method: 'POST'
        }
      });

      expect(logger.warn).toHaveBeenCalledWith('Client Error', expect.objectContaining({
        statusCode: 400,
        operational: true
      }));
    });

    it('should handle non-operational errors', async () => {
      const handler: ApiHandler = async () => {
        throw new AppError('Programming error', 'CODE_ERROR', 500, {}, false);
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith('API Error', expect.any(Error), expect.objectContaining({
        operational: false
      }));
    });

    it('should handle unknown errors', async () => {
      const handler: ApiHandler = async () => {
        throw new Error('Unknown error');
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('UNKNOWN_ERROR');
      expect(data.error.message).toBe('Unknown error');
      expect(logger.error).toHaveBeenCalledWith('Uncaught API Error', expect.any(Error), expect.any(Object));
    });

    it('should handle RateLimitError with special headers', async () => {
      const handler: ApiHandler = async () => {
        throw new RateLimitError(100, 60000, 30000);
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Window')).toBe('60');
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('should extract client information', async () => {
      const handler: ApiHandler = async () => {
        throw new AppError('Test error', 'TEST_ERROR', 400);
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'TestAgent/1.0',
          'referer': 'http://test.com'
        }
      });
      
      await wrappedHandler(request);

      expect(logger.warn).toHaveBeenCalledWith('Client Error', expect.objectContaining({
        client: {
          ip: '192.168.1.1',
          userAgent: 'TestAgent/1.0',
          referer: 'http://test.com'
        }
      }));
    });

    it('should sanitize errors in production', async () => {
      (env as any).NODE_ENV = 'production';
      
      const handler: ApiHandler = async () => {
        throw new Error('Sensitive internal error');
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.error.message).toBe('An unexpected error occurred');
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should preserve operational errors in production', async () => {
      (env as any).NODE_ENV = 'production';
      
      const handler: ApiHandler = async () => {
        throw new ValidationError('User validation failed');
      };

      const wrappedHandler = withErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.error.message).toBe('User validation failed');
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('withStreamingErrorBoundary', () => {
    it('should handle successful streaming responses', async () => {
      const handler: ApiHandler = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"test": true}\n\n'));
            controller.close();
          }
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream'
          }
        });
      };

      const wrappedHandler = withStreamingErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/stream');
      
      const response = await wrappedHandler(request);

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should handle streaming errors', async () => {
      const handler: ApiHandler = async () => {
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"start": true}\n\n'));
            // Simulate an async error during streaming
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new AppError('Stream error', 'STREAM_ERROR', 500);
          }
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream'
          }
        });
      };

      const wrappedHandler = withStreamingErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/stream');
      
      const response = await wrappedHandler(request);
      
      // If the stream creation throws synchronously, it should return an error response
      if (!response.body) {
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error.message).toContain('Stream error');
      } else {
        // If the error happens during streaming, it should be sent as an SSE event
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks: string[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(decoder.decode(value));
          }
        } catch (error) {
          // Stream might error out
        }

        const output = chunks.join('');
        expect(output).toContain('event: error');
        expect(output).toContain('Stream error');
      }
    });

    it('should handle non-streaming responses', async () => {
      const handler: ApiHandler = async () => {
        return NextResponse.json({ data: 'test' });
      };

      const wrappedHandler = withStreamingErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data).toEqual({ data: 'test' });
      expect(response.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should handle handler errors for non-streaming', async () => {
      const handler: ApiHandler = async () => {
        throw new ValidationError('Invalid request');
      };

      const wrappedHandler = withStreamingErrorBoundary(handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid request');
    });
  });

  describe('withValidation', () => {
    it('should validate with Zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });

      const handler = jest.fn().mockImplementation(async (data) => {
        return NextResponse.json({ validated: data });
      });

      const wrappedHandler = withValidation(schema, handler);
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 25 })
      });
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.validated).toEqual({ name: 'John', age: 25 });
      expect(handler).toHaveBeenCalledWith({ name: 'John', age: 25 }, request, undefined);
    });

    it('should handle Zod validation errors', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const handler = jest.fn();
      const wrappedHandler = withValidation(schema, handler);
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 'invalid' })
      });
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle custom validation function', async () => {
      const validator = jest.fn().mockResolvedValue({
        valid: true
      });

      const handler = jest.fn().mockImplementation(async (data) => {
        return NextResponse.json({ data });
      });

      const wrappedHandler = withValidation(validator, handler);
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });
      
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(validator).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle custom validation failures', async () => {
      const validator = jest.fn().mockResolvedValue({
        valid: false,
        message: 'Custom validation failed',
        field: 'email',
        value: 'invalid-email'
      });

      const handler = jest.fn();
      const wrappedHandler = withValidation(validator, handler);
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' })
      });
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Custom validation failed');
    });

    it('should handle invalid JSON', async () => {
      const schema = z.object({ test: z.string() });
      const handler = jest.fn();
      const wrappedHandler = withValidation(schema, handler);
      
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid JSON in request body');
    });
  });

  describe('withAuth', () => {
    it('should authenticate successfully', async () => {
      const authHandler = jest.fn().mockResolvedValue({
        userId: 'user-123',
        role: 'admin'
      });

      const handler = jest.fn().mockImplementation(async (request, context, auth) => {
        return NextResponse.json({ user: auth.userId });
      });

      const wrappedHandler = withAuth(authHandler, handler);
      const request = new NextRequest('http://localhost/api/protected');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBe('user-123');
      expect(authHandler).toHaveBeenCalledWith(request);
      expect(handler).toHaveBeenCalledWith(request, undefined, { userId: 'user-123', role: 'admin' });
    });

    it('should handle authentication failure', async () => {
      const authHandler = jest.fn().mockResolvedValue(null);
      const handler = jest.fn();
      
      const wrappedHandler = withAuth(authHandler, handler);
      const request = new NextRequest('http://localhost/api/protected');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle auth handler errors', async () => {
      const authHandler = jest.fn().mockRejectedValue(new Error('Auth service down'));
      const handler = jest.fn();
      
      const wrappedHandler = withAuth(authHandler, handler);
      const request = new NextRequest('http://localhost/api/protected');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.message).toBe('Authentication failed');
    });

    it('should preserve specific auth errors', async () => {
      const authHandler = jest.fn().mockRejectedValue(
        new AuthorizationError('Insufficient permissions')
      );
      const handler = jest.fn();
      
      const wrappedHandler = withAuth(authHandler, handler);
      const request = new NextRequest('http://localhost/api/protected');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.message).toBe('Insufficient permissions');
    });
  });

  describe('withMiddleware', () => {
    it('should execute middlewares in sequence', async () => {
      const executionOrder: string[] = [];
      
      const middleware1 = jest.fn().mockImplementation(async (request, context) => {
        executionOrder.push('middleware1');
        return { step1: true };
      });

      const middleware2 = jest.fn().mockImplementation(async (request, context) => {
        executionOrder.push('middleware2');
        return { step2: true };
      });

      const handler = jest.fn().mockImplementation(async (request, context) => {
        executionOrder.push('handler');
        return NextResponse.json({ context });
      });

      const wrappedHandler = withMiddleware([middleware1, middleware2], handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(executionOrder).toEqual(['middleware1', 'middleware2', 'handler']);
      expect(data.context).toEqual({ step1: true, step2: true });
    });

    it('should short-circuit on middleware response', async () => {
      const middleware1 = jest.fn().mockResolvedValue({ data: 'from middleware' });
      const middleware2 = jest.fn().mockResolvedValue(NextResponse.json({ early: true }));
      const handler = jest.fn();

      const wrappedHandler = withMiddleware([middleware1, middleware2], handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.early).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle middleware errors', async () => {
      const middleware = jest.fn().mockRejectedValue(new Error('Middleware error'));
      const handler = jest.fn();

      const wrappedHandler = withMiddleware([middleware], handler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Middleware error');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('withFallback', () => {
    it('should use fallback on handler error', async () => {
      const handler: ApiHandler = async () => {
        throw new AppError('Primary handler failed', 'HANDLER_ERROR', 500);
      };

      const fallbackHandler = jest.fn().mockImplementation(async (error, request) => {
        return NextResponse.json({ 
          fallback: true, 
          originalError: error.message 
        }, { status: 200 });
      });

      const wrappedHandler = withFallback(handler, fallbackHandler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fallback).toBe(true);
      expect(data.originalError).toBe('Primary handler failed');
      expect(fallbackHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Primary handler failed' }),
        request,
        undefined
      );
    });

    it('should succeed with primary handler', async () => {
      const handler: ApiHandler = async () => {
        return NextResponse.json({ primary: true });
      };

      const fallbackHandler = jest.fn();
      const wrappedHandler = withFallback(handler, fallbackHandler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.primary).toBe(true);
      expect(fallbackHandler).not.toHaveBeenCalled();
    });

    it('should handle fallback handler errors', async () => {
      const handler: ApiHandler = async () => {
        throw new AppError('Primary error', 'PRIMARY_ERROR', 500);
      };

      const fallbackHandler = jest.fn().mockRejectedValue(
        new Error('Fallback also failed')
      );

      const wrappedHandler = withFallback(handler, fallbackHandler);
      const request = new NextRequest('http://localhost/api/test');
      
      // The function should throw the original error when fallback fails
      await expect(wrappedHandler(request)).rejects.toThrow('Primary error');
      expect(fallbackHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Primary error' }),
        request,
        undefined
      );
    });

    it('should convert unknown errors to AppError', async () => {
      const handler: ApiHandler = async () => {
        throw new Error('Unknown error');
      };

      const fallbackHandler = jest.fn().mockImplementation(async (error) => {
        return NextResponse.json({ 
          errorType: error.constructor.name,
          isAppError: error instanceof AppError
        });
      });

      const wrappedHandler = withFallback(handler, fallbackHandler);
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(data.errorType).toBe('AppError');
      expect(data.isAppError).toBe(true);
    });
  });
});