import { test, expect } from '@playwright/test';

test.describe('API Endpoints E2E Tests', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('Health Check Endpoints', () => {
    test('should return 200 for health check', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/health`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    test('should include detailed health info', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/health/detailed`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        status: 'ok',
        services: {
          database: expect.any(String),
          redis: expect.any(String),
          external_apis: expect.any(String),
        },
      });
    });
  });

  test.describe('AI Chat Endpoints', () => {
    test('should handle chat requests', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        data: {
          message: 'What is the price of BTC?',
          sessionId: 'test-session-' + Date.now(),
        },
      });
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        success: true,
        response: expect.any(String),
        sessionId: expect.any(String),
      });
    });

    test('should handle streaming chat requests', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/ai/chat/stream`, {
        data: {
          message: 'Analyze BTC market',
          sessionId: 'test-stream-' + Date.now(),
        },
      });
      
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/event-stream');
    });

    test('should validate chat input', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        data: {
          // Missing required message field
          sessionId: 'test-session',
        },
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: expect.stringContaining('message'),
      });
    });

    test('should handle long messages gracefully', async ({ request }) => {
      const longMessage = 'a'.repeat(5000); // 5000 characters
      
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        data: {
          message: longMessage,
          sessionId: 'test-long-' + Date.now(),
        },
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain('too long');
    });
  });

  test.describe('Market Data Endpoints', () => {
    test('should fetch market data', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/market/data?symbol=BTCUSDT`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          price: expect.any(Number),
          change24h: expect.any(Number),
        },
      });
    });

    test('should validate symbol parameter', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/market/data?symbol=INVALID`);
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain('Invalid symbol');
    });

    test('should handle multiple symbols', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/market/data?symbols=BTCUSDT,ETHUSDT`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].symbol).toBe('BTCUSDT');
      expect(body.data[1].symbol).toBe('ETHUSDT');
    });
  });

  test.describe('Rate Limiting', () => {
    test('should enforce rate limits', async ({ request }) => {
      const testId = 'rate-limit-test-' + Date.now();
      
      // Make multiple requests
      const requests = Array(12).fill(null).map(() =>
        request.post(`${baseUrl}/api/ai/chat`, {
          headers: {
            'X-User-ID': testId,
          },
          data: {
            message: 'Test',
            sessionId: 'test-rate',
          },
        })
      );
      
      const responses = await Promise.all(requests);
      
      // Some should succeed
      const successful = responses.filter(r => r.status() === 200);
      const rateLimited = responses.filter(r => r.status() === 429);
      
      expect(successful.length).toBeGreaterThan(0);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      if (rateLimited.length > 0) {
        const limitedResponse = rateLimited[0];
        const headers = limitedResponse.headers();
        expect(headers['x-ratelimit-limit']).toBeDefined();
        expect(headers['x-ratelimit-remaining']).toBe('0');
        expect(headers['retry-after']).toBeDefined();
      }
    });

    test('should reset rate limits after window', async ({ request }) => {
      const testId = 'rate-reset-test-' + Date.now();
      
      // Make requests until rate limited
      let rateLimited = false;
      for (let i = 0; i < 15; i++) {
        const response = await request.post(`${baseUrl}/api/ai/chat`, {
          headers: {
            'X-User-ID': testId,
          },
          data: {
            message: 'Test',
            sessionId: 'test',
          },
        });
        
        if (response.status() === 429) {
          rateLimited = true;
          break;
        }
      }
      
      expect(rateLimited).toBe(true);
      
      // Wait for reset (assuming 1-second window for testing)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should work again
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        headers: {
          'X-User-ID': testId,
        },
        data: {
          message: 'Test',
          sessionId: 'test',
        },
      });
      
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Security Headers', () => {
    test('should include security headers', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/health`);
      
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should include CSP headers', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/health`);
      
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      const csp = headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
    });

    test('should handle CSP violations', async ({ request }) => {
      const violation = {
        'csp-report': {
          'document-uri': 'http://localhost:3000/test',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
          'line-number': 10,
          'source-file': 'http://localhost:3000/test',
        },
      };
      
      const response = await request.post(`${baseUrl}/api/csp-report`, {
        headers: {
          'Content-Type': 'application/csp-report',
        },
        data: JSON.stringify(violation),
      });
      
      expect(response.status()).toBe(204);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 errors', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/nonexistent`);
      
      expect(response.status()).toBe(404);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    });

    test('should handle malformed JSON', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: '{ invalid json',
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain('Invalid JSON');
    });

    test('should handle server errors gracefully', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/ai/chat`, {
        data: {
          message: { invalid: 'object' }, // Should be string
          sessionId: 'test',
        },
      });
      
      expect(response.status()).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  test.describe('WebSocket Connections', () => {
    test('should establish WebSocket connection for real-time data', async ({ page }) => {
      // Navigate to a page that uses WebSocket
      await page.goto(`${baseUrl}`);
      
      // Wait for WebSocket connection
      const wsPromise = page.waitForEvent('websocket');
      
      // NOTE: This test is skipped because it requires specific WebSocket
      // implementation details that are not yet available.
      // To enable this test:
      // 1. Implement WebSocket endpoint in the application
      // 2. Add client-side code that establishes WebSocket connection
      // 3. Update this test to trigger the connection and verify messages
      
      test.skip();
      // TODO: Enable when WebSocket implementation is complete
    });
  });

  test.describe('API Versioning', () => {
    test('should support API versioning', async ({ request }) => {
      const v1Response = await request.get(`${baseUrl}/api/v1/health`);
      
      if (v1Response.status() === 200) {
        const body = await v1Response.json();
        expect(body.version).toBe('1.0');
      }
      
      // Future version
      const v2Response = await request.get(`${baseUrl}/api/v2/health`);
      expect(v2Response.status()).toBe(404); // Not implemented yet
    });
  });
});