import { compose, createFinalMiddleware, composeWithFetch } from '../compose';
import type { ApiMiddleware, RequestCtx } from '@/types/api';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Middleware Composition', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
  });

  describe('compose', () => {
    it('should execute middlewares in correct order', async () => {
      const executionOrder: string[] = [];

      const middleware1: ApiMiddleware = async (ctx, next) => {
        executionOrder.push('middleware1-start');
        const result = await next();
        executionOrder.push('middleware1-end');
        return result;
      };

      const middleware2: ApiMiddleware = async (ctx, next) => {
        executionOrder.push('middleware2-start');
        const result = await next();
        executionOrder.push('middleware2-end');
        return result;
      };

      const finalMiddleware: ApiMiddleware = async (ctx) => {
        executionOrder.push('final');
        return ctx;
      };

      const composedMiddleware = compose([middleware1, middleware2, finalMiddleware]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      await composedMiddleware(ctx);

      expect(executionOrder).toEqual([
        'middleware1-start',
        'middleware2-start',
        'final',
        'middleware2-end',
        'middleware1-end'
      ]);
    });

    it('should pass context through middleware chain', async () => {
      const addMetaMiddleware: ApiMiddleware = async (ctx, next) => {
        ctx.meta = { ...ctx.meta, middleware1: true };
        return next();
      };

      const addMoreMetaMiddleware: ApiMiddleware = async (ctx, next) => {
        ctx.meta = { ...ctx.meta, middleware2: true };
        return next();
      };

      const finalMiddleware: ApiMiddleware = async (ctx) => {
        return { ...ctx, meta: { ...ctx.meta, final: true } };
      };

      const composedMiddleware = compose([addMetaMiddleware, addMoreMetaMiddleware, finalMiddleware]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      const result = await composedMiddleware(ctx);

      expect(result.meta).toEqual({
        middleware1: true,
        middleware2: true,
        final: true
      });
    });

    it('should handle empty middleware array', async () => {
      const composedMiddleware = compose([]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      const result = await composedMiddleware(ctx);
      expect(result).toBe(ctx);
    });

    it('should propagate errors from middleware', async () => {
      const errorMiddleware: ApiMiddleware = async (ctx, next) => {
        throw new Error('Middleware error');
      };

      const composedMiddleware = compose([errorMiddleware]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      await expect(composedMiddleware(ctx)).rejects.toThrow('Middleware error');
    });
  });

  describe('createFinalMiddleware', () => {
    it('should execute fetch with correct parameters', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: 'OK'
      });
      mockFetch.mockResolvedValue(mockResponse);

      const finalMiddleware = createFinalMiddleware();

      const ctx: RequestCtx = {
        request: {
          url: 'http://test.com/api',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: 'test' })
        },
        attempt: 0
      };

      const result = await finalMiddleware(ctx, async () => ctx);

      expect(mockFetch).toHaveBeenCalledWith('http://test.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });

      expect(result.response).toBe(mockResponse);
    });

    it('should handle fetch errors', async () => {
      const fetchError = new Error('Network error');
      mockFetch.mockRejectedValue(fetchError);

      const finalMiddleware = createFinalMiddleware();

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      await expect(finalMiddleware(ctx, async () => ctx)).rejects.toThrow('Network error');
    });
  });

  describe('composeWithFetch', () => {
    it('should automatically add fetch middleware as final step', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200
      });
      mockFetch.mockResolvedValue(mockResponse);

      const testMiddleware: ApiMiddleware = async (ctx, next) => {
        ctx.meta = { processed: true };
        return next();
      };

      const composedMiddleware = composeWithFetch([testMiddleware]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      const result = await composedMiddleware(ctx);

      expect(result.meta).toEqual({ processed: true });
      expect(result.response).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('http://test.com', { method: 'GET' });
    });

    it('should work with multiple middlewares before fetch', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }));
      mockFetch.mockResolvedValue(mockResponse);

      const middleware1: ApiMiddleware = async (ctx, next) => {
        ctx.meta = { step1: true };
        return next();
      };

      const middleware2: ApiMiddleware = async (ctx, next) => {
        ctx.meta = { ...ctx.meta, step2: true };
        return next();
      };

      const composedMiddleware = composeWithFetch([middleware1, middleware2]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      const result = await composedMiddleware(ctx);

      expect(result.meta).toEqual({
        step1: true,
        step2: true
      });
      expect(result.response).toBe(mockResponse);
    });

    it('should handle middleware errors before fetch', async () => {
      const errorMiddleware: ApiMiddleware = async (ctx, next) => {
        throw new Error('Pre-fetch error');
      };

      const composedMiddleware = composeWithFetch([errorMiddleware]);

      const ctx: RequestCtx = {
        request: { url: 'http://test.com', method: 'GET' },
        attempt: 0
      };

      await expect(composedMiddleware(ctx)).rejects.toThrow('Pre-fetch error');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});