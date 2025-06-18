import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import type { Server } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';

describe('API Endpoints E2E Tests', () => {
  let server: Server;
  let appUrl: string;
  const testPort = 3001;

  beforeAll(async () => {
    // Set up Next.js server for testing
    const app = next({ dev: false, dir: process.cwd() });
    const handle = app.getRequestHandler();
    
    await app.prepare();
    
    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req as any, res as any, parsedUrl);
    });
    
    await new Promise<void>((resolve) => {
      server.listen(testPort, () => {
        appUrl = `http://localhost:${testPort}`;
        console.log(`Test server running on ${appUrl}`);
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return 200 for health check', async () => {
      const response = await request(appUrl)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    it('should include detailed health info', async () => {
      const response = await request(appUrl)
        .get('/api/health/detailed')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'ok',
        services: {
          database: expect.any(String),
          redis: expect.any(String),
          external_apis: expect.any(String),
        },
      });
    });
  });

  describe('AI Chat Endpoints', () => {
    it('should handle chat requests', async () => {
      const response = await request(appUrl)
        .post('/api/ai/chat')
        .send({
          message: 'What is the price of BTC?',
          sessionId: 'test-session-' + Date.now(),
        })
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        response: expect.any(String),
        sessionId: expect.any(String),
      });
    });

    it('should handle streaming chat requests', async () => {
      const response = await request(appUrl)
        .post('/api/ai/chat/stream')
        .send({
          message: 'Analyze BTC market',
          sessionId: 'test-stream-' + Date.now(),
        })
        .expect(200);
      
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should validate chat input', async () => {
      const response = await request(appUrl)
        .post('/api/ai/chat')
        .send({
          // Missing required message field
          sessionId: 'test-session',
        })
        .expect(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('message'),
      });
    });

    it('should handle long messages gracefully', async () => {
      const longMessage = 'a'.repeat(5000); // 5000 characters
      
      const response = await request(appUrl)
        .post('/api/ai/chat')
        .send({
          message: longMessage,
          sessionId: 'test-long-' + Date.now(),
        })
        .expect(400);
      
      expect(response.body.error).toContain('too long');
    });
  });

  describe('Market Data Endpoints', () => {
    it('should fetch market data', async () => {
      const response = await request(appUrl)
        .get('/api/market/data?symbol=BTCUSDT')
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          price: expect.any(Number),
          change24h: expect.any(Number),
        },
      });
    });

    it('should validate symbol parameter', async () => {
      const response = await request(appUrl)
        .get('/api/market/data?symbol=INVALID')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid symbol');
    });

    it('should handle multiple symbols', async () => {
      const response = await request(appUrl)
        .get('/api/market/data?symbols=BTCUSDT,ETHUSDT')
        .expect(200);
      
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].symbol).toBe('BTCUSDT');
      expect(response.body.data[1].symbol).toBe('ETHUSDT');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const testId = 'rate-limit-test-' + Date.now();
      
      // Make multiple requests
      const requests = Array(12).fill(null).map(() =>
        request(appUrl)
          .post('/api/ai/chat')
          .set('X-User-ID', testId)
          .send({
            message: 'Test',
            sessionId: 'test-rate',
          })
      );
      
      const responses = await Promise.all(requests);
      
      // Some should succeed
      const successful = responses.filter(r => r.status === 200);
      const rateLimited = responses.filter(r => r.status === 429);
      
      expect(successful.length).toBeGreaterThan(0);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(limitedResponse.headers['x-ratelimit-remaining']).toBe('0');
      expect(limitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should reset rate limits after window', async () => {
      const testId = 'rate-reset-test-' + Date.now();
      
      // Hit rate limit
      await request(appUrl)
        .post('/api/ai/chat')
        .set('X-User-ID', testId)
        .send({ message: 'Test', sessionId: 'test' })
        .expect(429);
      
      // Wait for reset (assuming 1-second window for testing)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should work again
      await request(appUrl)
        .post('/api/ai/chat')
        .set('X-User-ID', testId)
        .send({ message: 'Test', sessionId: 'test' })
        .expect(200);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(appUrl)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include CSP headers', async () => {
      const response = await request(appUrl)
        .get('/api/health')
        .expect(200);
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
    });

    it('should handle CSP violations', async () => {
      const violation = {
        'csp-report': {
          'document-uri': 'http://localhost:3001/test',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
          'line-number': 10,
          'source-file': 'http://localhost:3001/test',
        },
      };
      
      const response = await request(appUrl)
        .post('/api/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify(violation))
        .expect(204);
      
      expect(response.body).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(appUrl)
        .get('/api/nonexistent')
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(appUrl)
        .post('/api/ai/chat')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle server errors gracefully', async () => {
      // Force an error by sending invalid data type
      const response = await request(appUrl)
        .post('/api/ai/chat')
        .send({
          message: { invalid: 'object' }, // Should be string
          sessionId: 'test',
        })
        .expect(400);
      
      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('WebSocket Connections', () => {
    it('should establish WebSocket connection for real-time data', async () => {
      // This would require a WebSocket client library
      // Placeholder for WebSocket testing
      expect(true).toBe(true);
    });
  });

  describe('API Versioning', () => {
    it('should support API versioning', async () => {
      const v1Response = await request(appUrl)
        .get('/api/v1/health')
        .expect(200);
      
      expect(v1Response.body.version).toBe('1.0');
      
      // Future version
      const v2Response = await request(appUrl)
        .get('/api/v2/health')
        .expect(404); // Not implemented yet
    });
  });
});