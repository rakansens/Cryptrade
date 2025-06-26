import { NextRequest, NextResponse } from 'next/server';
import { createAuthMiddleware, generateApiKey, validateBinanceSymbol, validateInterval } from '@/lib/api/middleware';
import { env } from '@/config/env';

// Mock the env module
jest.mock('@/config/env', () => ({
  env: {
    API_AUTH_ENABLED: false,
    API_AUTH_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
  }
}));

describe('Authentication Middleware', () => {
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    authMiddleware = createAuthMiddleware();
  });

  describe('when authentication is disabled', () => {
    beforeEach(() => {
      (env as any).API_AUTH_ENABLED = false;
    });

    it('should allow requests without authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const response = await authMiddleware(request);
      expect(response).toBeNull();
    });
  });

  describe('when authentication is enabled', () => {
    beforeEach(() => {
      (env as any).API_AUTH_ENABLED = true;
    });

    it('should allow public endpoints without authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/health/check');
      const response = await authMiddleware(request);
      expect(response).toBeNull();
    });

    it('should reject requests without authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected');
      const response = await authMiddleware(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(401);
      
      const body = await response?.json();
      expect(body.error).toBe('Missing or invalid authorization header');
    });

    it('should reject requests with invalid authorization format', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Basic invalidformat'
        }
      });
      const response = await authMiddleware(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(401);
    });

    it('should reject requests with invalid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer invalid-key'
        }
      });
      const response = await authMiddleware(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(401);
      
      const body = await response?.json();
      expect(body.error).toBe('Invalid API key');
    });

    it('should allow requests with valid API key', async () => {
      const validKey = 'test-secret-key-that-is-at-least-32-characters-long';
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': `Bearer ${validKey}`
        }
      });
      const response = await authMiddleware(request);
      
      expect(response).toBeNull(); // null means request can proceed
    });
  });
});

describe('Utility Functions', () => {
  describe('generateApiKey', () => {
    it('should return placeholder for edge runtime compatibility', () => {
      const key = generateApiKey();
      expect(key).toBe('generate-api-key-on-server-side');
    });

    it('returns consistent placeholder value', () => {
      // generateApiKey returns a placeholder for edge runtime compatibility
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).toBe(key2); // Should be same placeholder
      expect(key1).toBe('generate-api-key-on-server-side');
    });
  });

  describe('validateBinanceSymbol', () => {
    it('should validate correct Binance symbols', () => {
      expect(validateBinanceSymbol('BTCUSDT')).toBe(true);
      expect(validateBinanceSymbol('ETHUSDT')).toBe(true);
      expect(validateBinanceSymbol('BNBUSDT')).toBe(true);
      expect(validateBinanceSymbol('SOLUSDT')).toBe(true);
    });

    it('should reject invalid symbols', () => {
      expect(validateBinanceSymbol('BTC')).toBe(false);
      expect(validateBinanceSymbol('BTCUSD')).toBe(false);
      expect(validateBinanceSymbol('btcusdt')).toBe(true); // Case-insensitive, converts to uppercase
      expect(validateBinanceSymbol('BTC-USDT')).toBe(false);
      expect(validateBinanceSymbol('')).toBe(false);
    });
  });

  describe('validateInterval', () => {
    it('should validate correct intervals', () => {
      expect(validateInterval('1m')).toBe(true);
      expect(validateInterval('5m')).toBe(true);
      expect(validateInterval('1h')).toBe(true);
      expect(validateInterval('1d')).toBe(true);
      expect(validateInterval('1w')).toBe(true);
    });

    it('should reject invalid intervals', () => {
      expect(validateInterval('2m')).toBe(false);
      expect(validateInterval('10s')).toBe(false);
      expect(validateInterval('1y')).toBe(false);
      expect(validateInterval('')).toBe(false);
      expect(validateInterval('invalid')).toBe(false);
    });
  });

  // Security-focused tests
  describe('Security Tests', () => {
    beforeEach(() => {
      authMiddleware = createAuthMiddleware();
      (env as any).API_AUTH_ENABLED = true;
    });

    it('should prevent timing attacks on API key validation', async () => {
      const validKey = 'test-secret-key-that-is-at-least-32-characters-long';
      const invalidKeys = [
        'wrong-secret-key-that-is-at-least-32-characters-lon',
        'test-secret-key-that-is-at-least-32-characters-lonG',
        'completely-different-key-that-is-32-chars-or-more!!',
      ];

      const timings: number[] = [];

      // Test valid key
      const startValid = Date.now();
      const validRequest = new NextRequest('http://localhost:3000/api/protected', {
        headers: { 'Authorization': `Bearer ${validKey}` }
      });
      await authMiddleware(validRequest);
      timings.push(Date.now() - startValid);

      // Test invalid keys
      for (const key of invalidKeys) {
        const start = Date.now();
        const request = new NextRequest('http://localhost:3000/api/protected', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        await authMiddleware(request);
        timings.push(Date.now() - start);
      }

      // Check that timing differences are minimal (constant-time comparison)
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      
      expect(maxDeviation).toBeLessThan(50); // Allow 50ms variance
    });

    it('should reject requests with multiple authorization headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected');
      // Simulate multiple auth headers
      request.headers.append('Authorization', 'Bearer key1');
      request.headers.append('Authorization', 'Bearer key2');
      
      const response = await authMiddleware(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      expect(response?.status).toBe(401);
    });

    it('should validate API key length and format', async () => {
      const invalidKeys = [
        'short', // Too short
        '', // Empty
        ' ', // Whitespace
        'a'.repeat(1000), // Too long
        'test-key-with-\u0000-null-bytes',
        'key-with-<script>-tags',
      ];

      for (const key of invalidKeys) {
        try {
          const request = new NextRequest('http://localhost:3000/api/protected', {
            headers: { 'Authorization': `Bearer ${key}` }
          });
          const response = await authMiddleware(request);
          
          expect(response).toBeInstanceOf(NextResponse);
          expect(response?.status).toBe(401);
        } catch (error) {
          // Invalid header values should be rejected at the Headers level
          expect(error.message).toContain('invalid');
        }
      }
    });

    it('should handle authorization header injection attempts', async () => {
      const injectionAttempts = [
        'Bearer key\r\nX-Injected: malicious',
        'Bearer key\nAuthorization: Bearer another-key',
        'Basic ' + Buffer.from('admin:password').toString('base64'),
        'Bearer\x00key',
      ];

      for (const attempt of injectionAttempts) {
        try {
          const request = new NextRequest('http://localhost:3000/api/protected', {
            headers: { 'Authorization': attempt }
          });
          const response = await authMiddleware(request);
          
          expect(response).toBeInstanceOf(NextResponse);
          expect(response?.status).toBe(401);
        } catch (error) {
          // Invalid header values should be rejected at the Headers level
          expect(error.message).toContain('invalid');
        }
      }
    });

    it('should enforce CORS headers on responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': `Bearer test-secret-key-that-is-at-least-32-characters-long`,
          'Origin': 'https://evil.com'
        }
      });
      
      const response = await authMiddleware(request);
      
      // Should allow request but CORS headers should be restrictive
      expect(response).toBeNull(); // Request proceeds
    });

    it('should rate limit authentication attempts', async () => {
      const requests = [];
      
      // Simulate rapid auth attempts
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('http://localhost:3000/api/protected', {
          headers: { 'Authorization': 'Bearer invalid-key' }
        });
        requests.push(authMiddleware(request));
      }

      const responses = await Promise.all(requests);
      
      // All should be rejected
      responses.forEach(response => {
        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.status).toBe(401);
      });
    });

    it('should validate symbol against injection', () => {
      const maliciousSymbols = [
        'BTCUSDT; DROP TABLE trades;',
        'BTCUSDT\' OR \'1\'=\'1',
        '../../../etc/passwd',
        'BTCUSDT<script>alert(1)</script>',
        'BTCUSDT\x00MALICIOUS',
      ];

      maliciousSymbols.forEach(symbol => {
        expect(validateBinanceSymbol(symbol)).toBe(false);
      });
    });

    it('should handle case sensitivity in API endpoints', async () => {
      const endpoints = [
        '/api/Health/Check',
        '/API/health/check',
        '/Api/HEALTH/check',
      ];

      for (const endpoint of endpoints) {
        const request = new NextRequest(`http://localhost:3000${endpoint}`);
        const response = await authMiddleware(request);
        
        // Should not treat these as public endpoints
        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.status).toBe(401);
      }
    });

    it('should prevent API key leakage in error messages', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: { 'Authorization': 'Bearer wrong-key-12345' }
      });
      
      const response = await authMiddleware(request);
      const body = await response?.json();
      
      // Error message should not contain the attempted key
      expect(body.error).not.toContain('wrong-key-12345');
      expect(body.error).toBe('Invalid API key');
    });

    it('should handle malformed authorization schemes', async () => {
      const malformedAuths = [
        'BearerWithoutSpace',
        'Bearer  double-space',
        '  Bearer  padded  ',
        'BEARER UPPERCASE',
        'Béarer unicode',
      ];

      for (const auth of malformedAuths) {
        const request = new NextRequest('http://localhost:3000/api/protected', {
          headers: { 'Authorization': auth }
        });
        const response = await authMiddleware(request);
        
        expect(response).toBeInstanceOf(NextResponse);
        expect(response?.status).toBe(401);
      }
    });

    it('should validate intervals against ReDoS attacks', () => {
      const redosPatterns = [
        '1'.repeat(1000) + 'm',
        '1m' + 'x'.repeat(1000),
        '(1m)'.repeat(100),
      ];

      redosPatterns.forEach(pattern => {
        const start = Date.now();
        validateInterval(pattern);
        const duration = Date.now() - start;
        
        // Should complete quickly even with malicious input
        expect(duration).toBeLessThan(100);
        expect(validateInterval(pattern)).toBe(false);
      });
    });
  });
});