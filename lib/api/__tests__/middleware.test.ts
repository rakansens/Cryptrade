import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ApiClient } from '../client';
import { 
  createTimeoutMiddleware,
  createRateLimitMiddleware,
  createRetryMiddleware,
  createErrorHandlerMiddleware
} from '../middlewares';
import type { ApiMiddleware, RequestCtx } from '@/types/api';

// Test server setup
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API Middleware Integration Tests', () => {
  const baseConfig = {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retries: 3,
    retryDelay: 100,
    rateLimit: {
      requests: 5,
      window: 1000
    }
  };

  describe('Timeout Middleware', () => {
    it('should timeout after specified duration', async () => {
      // Mock a slow endpoint
      server.use(
        http.get('http://localhost:3000/slow', async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return HttpResponse.json({ message: 'slow response' });
        })
      );

      const client = new ApiClient(baseConfig, [
        createTimeoutMiddleware({ duration: 1000 }) // 1 second timeout
      ]);

      await expect(client.get('/slow')).rejects.toMatchObject({
        message: expect.stringContaining('timeout')
      });
    });

    it('should not timeout for fast responses', async () => {
      server.use(
        http.get('http://localhost:3000/fast', () => {
          return HttpResponse.json({ message: 'fast response' });
        })
      );

      const client = new ApiClient(baseConfig, [
        createTimeoutMiddleware({ duration: 1000 })
      ]);

      const response = await client.get('/fast');
      expect(response.data).toEqual({ message: 'fast response' });
    });
  });

  describe('Rate Limit Middleware', () => {
    it('should delay requests to enforce rate limit', async () => {
      let requestTimes: number[] = [];

      server.use(
        http.get('http://localhost:3000/api/data', () => {
          requestTimes.push(Date.now());
          return HttpResponse.json({ timestamp: Date.now() });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRateLimitMiddleware({ requests: 2, window: 1000 }) // 2 requests per second
      ]);

      // Make 3 requests quickly
      await Promise.all([
        client.get('/api/data'),
        client.get('/api/data'),
        client.get('/api/data')
      ]);

      expect(requestTimes).toHaveLength(3);
      
      // Third request should be delayed by at least 500ms from the first
      const timeDiff = requestTimes[2] - requestTimes[0];
      expect(timeDiff).toBeGreaterThanOrEqual(400); // Allow some margin for test timing
    });
  });

  describe('Retry Middleware', () => {
    it('should retry on server errors (5xx)', async () => {
      let attemptCount = 0;

      server.use(
        http.get('http://localhost:3000/unreliable', () => {
          attemptCount++;
          if (attemptCount <= 2) {
            return HttpResponse.json({ error: 'Server error' }, { status: 500 });
          }
          return HttpResponse.json({ message: 'success', attempts: attemptCount });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRetryMiddleware({
          maxAttempts: 3,
          delay: 50,
          exponentialBackoff: false
        }),
        createErrorHandlerMiddleware()
      ]);

      const response = await client.get('/unreliable');
      expect(response.data).toEqual({ message: 'success', attempts: 3 });
      expect(attemptCount).toBe(3);
    });

    it('should retry on rate limit errors (429)', async () => {
      let attemptCount = 0;

      server.use(
        http.get('http://localhost:3000/rate-limited', () => {
          attemptCount++;
          if (attemptCount === 1) {
            return HttpResponse.json({ error: 'Rate limited' }, { status: 429 });
          }
          return HttpResponse.json({ message: 'success', attempts: attemptCount });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRetryMiddleware({
          maxAttempts: 2,
          delay: 50,
          exponentialBackoff: false
        }),
        createErrorHandlerMiddleware()
      ]);

      const response = await client.get('/rate-limited');
      expect(response.data).toEqual({ message: 'success', attempts: 2 });
      expect(attemptCount).toBe(2);
    });

    it('should not retry client errors (4xx except 429)', async () => {
      let attemptCount = 0;

      server.use(
        http.get('http://localhost:3000/not-found', () => {
          attemptCount++;
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRetryMiddleware({
          maxAttempts: 3,
          delay: 50,
          exponentialBackoff: false
        }),
        createErrorHandlerMiddleware()
      ]);

      await expect(client.get('/not-found')).rejects.toMatchObject({
        status: 404
      });
      expect(attemptCount).toBe(1); // Should not retry
    });

    it('should respect max attempts', async () => {
      let attemptCount = 0;

      server.use(
        http.get('http://localhost:3000/always-fails', () => {
          attemptCount++;
          return HttpResponse.json({ error: 'Always fails' }, { status: 500 });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRetryMiddleware({
          maxAttempts: 2,
          delay: 50,
          exponentialBackoff: false
        }),
        createErrorHandlerMiddleware()
      ]);

      await expect(client.get('/always-fails')).rejects.toMatchObject({
        status: 500
      });
      expect(attemptCount).toBe(2);
    });

    it('should use exponential backoff when enabled', async () => {
      let requestTimes: number[] = [];

      server.use(
        http.get('http://localhost:3000/backoff-test', () => {
          requestTimes.push(Date.now());
          if (requestTimes.length <= 2) {
            return HttpResponse.json({ error: 'Server error' }, { status: 500 });
          }
          return HttpResponse.json({ message: 'success' });
        })
      );

      const client = new ApiClient(baseConfig, [
        createRetryMiddleware({
          maxAttempts: 3,
          delay: 100,
          exponentialBackoff: true
        }),
        createErrorHandlerMiddleware()
      ]);

      await client.get('/backoff-test');

      expect(requestTimes).toHaveLength(3);
      
      // Second retry should have ~200ms delay (2^1 * 100)
      const delay1 = requestTimes[1] - requestTimes[0];
      const delay2 = requestTimes[2] - requestTimes[1];
      
      expect(delay1).toBeGreaterThanOrEqual(80); // Allow some margin
      expect(delay2).toBeGreaterThanOrEqual(180); // Should be ~2x the first delay
      expect(delay2).toBeGreaterThan(delay1);
    });
  });

  describe('Middleware Chain Composition', () => {
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

      server.use(
        http.get('http://localhost:3000/order-test', () => {
          executionOrder.push('fetch');
          return HttpResponse.json({ message: 'test' });
        })
      );

      const client = new ApiClient(baseConfig, [middleware1, middleware2]);

      await client.get('/order-test');

      expect(executionOrder).toEqual([
        'middleware1-start',
        'middleware2-start',
        'fetch',
        'middleware2-end',
        'middleware1-end'
      ]);
    });

    it('should work with default middleware setup', async () => {
      server.use(
        http.get('http://localhost:3000/default-test', () => {
          return HttpResponse.json({ message: 'success with defaults' });
        })
      );

      // Use default middlewares (timeout, rate limit, retry)
      const client = new ApiClient(baseConfig);

      const response = await client.get('/default-test');
      expect(response.data).toEqual({ message: 'success with defaults' });
    });

    it('should handle middleware errors gracefully', async () => {
      const errorMiddleware: ApiMiddleware = async (ctx, next) => {
        if (ctx.request.url.includes('trigger-middleware-error')) {
          throw new Error('Middleware error');
        }
        return next();
      };

      server.use(
        http.get('http://localhost:3000/trigger-middleware-error', () => {
          return HttpResponse.json({ message: 'should not reach here' });
        })
      );

      const client = new ApiClient(baseConfig, [errorMiddleware]);

      await expect(client.get('/trigger-middleware-error')).rejects.toMatchObject({
        message: 'Middleware error'
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same API surface for HTTP methods', async () => {
      server.use(
        http.get('http://localhost:3000/get-test', () => {
          return HttpResponse.json({ method: 'GET' });
        }),
        http.post('http://localhost:3000/post-test', async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ method: 'POST', body });
        }),
        http.put('http://localhost:3000/put-test', async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ method: 'PUT', body });
        }),
        http.delete('http://localhost:3000/delete-test', () => {
          return HttpResponse.json({ method: 'DELETE' });
        })
      );

      const client = new ApiClient(baseConfig);

      // Test all HTTP methods
      const getResponse = await client.get('/get-test');
      expect(getResponse.data).toEqual({ method: 'GET' });

      const postResponse = await client.post('/post-test', { data: 'test' });
      expect(postResponse.data.method).toBe('POST');

      const putResponse = await client.put('/put-test', { data: 'test' });
      expect(putResponse.data.method).toBe('PUT');

      const deleteResponse = await client.delete('/delete-test');
      expect(deleteResponse.data).toEqual({ method: 'DELETE' });
    });

    it('should maintain queue functionality', async () => {
      server.use(
        http.get('http://localhost:3000/queue-test', () => {
          return HttpResponse.json({ timestamp: Date.now() });
        })
      );

      const client = new ApiClient(baseConfig);

      const queuedResult = await client.queueRequest(async () => {
        return client.get('/queue-test');
      });

      expect(queuedResult).toHaveProperty('timestamp');
      expect(typeof queuedResult.timestamp).toBe('number');
    });
  });
});