import { generateNonce, buildCSPHeader, applyCSPHeaders, CSP_DIRECTIVES, PRODUCTION_CSP_OVERRIDES } from '@/lib/security/csp';
import { NextResponse } from 'next/server';

// Mock the production config module to return actual CSP directives
jest.mock('@/config/csp-production.config', () => ({
  validateProductionConfig: () => [],
  getProductionCSPDirectives: () => {
    // Return a combination of CSP_DIRECTIVES and PRODUCTION_CSP_OVERRIDES
    const baseDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'", "https:", "'unsafe-inline'", "https://*.sentry.io", "https://*.sentry-cdn.com"],
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'img-src': ["'self'", "data:", "blob:", "https:", "https://*.vercel.app", "https://*.vercel.sh"],
      'font-src': ["'self'", "https://fonts.gstatic.com"],
      'connect-src': ["'self'", "wss://stream.binance.com:*", "https://api.binance.com", "https://*.supabase.co", "wss://*.supabase.co", "https://*.sentry.io", "https://*.ingest.sentry.io", "https://*.vercel-insights.com", "https://vitals.vercel-insights.com"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'frame-ancestors': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': []
    };
    return baseDirectives;
  }
}));

describe('CSP Security Module', () => {
  describe('generateNonce', () => {
    it('should generate a valid base64 nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      // Base64 pattern
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('buildCSPHeader', () => {
    const testNonce = 'test-nonce-123';

    it('should build CSP header for development', () => {
      const header = buildCSPHeader(testNonce, true);
      expect(header).toContain("default-src 'self'");
      expect(header).toContain(`'nonce-${testNonce}'`);
      expect(header).toContain("'unsafe-eval'"); // For webpack HMR
      expect(header).not.toContain('upgrade-insecure-requests');
      // Development specific checks
      expect(header).toContain("script-src");
      expect(header).toContain("connect-src 'self'");
      expect(header).toContain("ws://localhost:*"); // Dev WebSocket
      expect(header).toContain("http://localhost:*"); // Dev HTTP
    });

    it('should build CSP header for production', () => {
      const header = buildCSPHeader(testNonce, false);
      expect(header).toContain("default-src 'self'");
      expect(header).toContain(`'nonce-${testNonce}'`);
      expect(header).not.toContain("'unsafe-eval'");
      expect(header).toContain('upgrade-insecure-requests');
      // Production specific checks
      expect(header).toContain("https://*.sentry.io");
      expect(header).toContain("https://*.vercel-insights.com");
    });

    it('should replace nonce placeholder correctly', () => {
      const header = buildCSPHeader(testNonce, true);
      expect(header).not.toContain('{{nonce}}');
      expect(header).toContain(`'nonce-${testNonce}'`);
    });
  });

  describe('applyCSPHeaders', () => {
    let response: NextResponse;

    beforeEach(() => {
      response = new NextResponse();
    });

    it('should apply all security headers in development', () => {
      const nonce = 'test-nonce';
      applyCSPHeaders(response, nonce, true);

      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
      expect(typeof response.headers.get('Content-Security-Policy')).toBe('string');
      expect(response.headers.get('Content-Security-Policy')).toContain('script-src');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers.get('Strict-Transport-Security')).toBeNull();
    });

    it('should apply HSTS header in production', () => {
      const nonce = 'test-nonce';
      applyCSPHeaders(response, nonce, false);

      expect(response.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should include production-specific directives', () => {
      const nonce = 'test-nonce';
      applyCSPHeaders(response, nonce, false);

      const cspHeader = response.headers.get('Content-Security-Policy');
      expect(cspHeader).toBeDefined();
      expect(typeof cspHeader).toBe('string');
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("connect-src 'self'");
      // Check for production overrides
      expect(cspHeader).toContain("https://*.sentry.io");
      expect(cspHeader).toContain("https://api.binance.com");
      expect(cspHeader).toContain("wss://stream.binance.com");
    });
  });

  describe('CSP Error Cases and Edge Cases', () => {
    it('should handle missing crypto API gracefully', () => {
      // Save original crypto
      const originalGlobalCrypto = (global as any).crypto;
      const originalCrypto = (global as any).crypto;
      
      // Remove crypto API
      delete (global as any).crypto;
      delete (globalThis as any).crypto;
      
      // Should throw when crypto is not available
      expect(() => generateNonce()).toThrow('Crypto API not available');
      
      // Restore crypto
      (global as any).crypto = originalGlobalCrypto;
      (globalThis as any).crypto = originalCrypto;
    });

    it('should handle empty directives', () => {
      const header = buildCSPHeader('test-nonce', true);
      // Directives with empty arrays should be included without sources
      expect(header).toMatch(/[a-z-]+\s+[a-z-]+/);
    });

    it('should handle very long nonces', () => {
      const longNonce = 'a'.repeat(1000);
      const header = buildCSPHeader(longNonce, true);
      expect(header).toContain(`'nonce-${longNonce}'`);
    });

    it('should handle special characters in nonce', () => {
      const specialNonce = 'test+/=nonce';
      const header = buildCSPHeader(specialNonce, true);
      expect(header).toContain(`'nonce-${specialNonce}'`);
    });

    it('should not duplicate sources when merging production overrides', () => {
      const header = buildCSPHeader('test-nonce', false);
      // Count occurrences of specific sources
      const sentrioMatches = (header.match(/https:\/\/\*\.sentry\.io/g) || []).length;
      // Should appear once in script-src and once in connect-src
      expect(sentrioMatches).toBe(2);
    });

    it('should handle production config validation errors', () => {
      // Mock console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock the entire config module
      jest.doMock('@/config/csp-production.config', () => ({
        ...jest.requireActual('@/config/csp-production.config'),
        validateProductionConfig: jest.fn(() => ['Error 1', 'Error 2'])
      }));
      
      // Clear the module cache and re-import to get the mocked version
      jest.resetModules();
      const { buildCSPHeader } = require('@/lib/security/csp');
      
      buildCSPHeader('test-nonce', false);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Production CSP configuration errors:',
        ['Error 1', 'Error 2']
      );
      
      consoleSpy.mockRestore();
    });

    it('should apply all security headers correctly', () => {
      const response = new NextResponse();
      const nonce = 'test-nonce';
      
      applyCSPHeaders(response, nonce, true);
      
      // Verify all security headers are set
      const headers = {
        'Content-Security-Policy': response.headers.get('Content-Security-Policy'),
        'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
        'X-Frame-Options': response.headers.get('X-Frame-Options'),
        'X-XSS-Protection': response.headers.get('X-XSS-Protection'),
        'Referrer-Policy': response.headers.get('Referrer-Policy'),
        'Permissions-Policy': response.headers.get('Permissions-Policy'),
      };
      
      Object.entries(headers).forEach(([key, value]) => {
        expect(value).toBeDefined();
        expect(value).not.toBe('');
      });
    });

    it('should handle directives with no sources', () => {
      const header = buildCSPHeader('test-nonce', false);
      // upgrade-insecure-requests has empty array and should appear in header
      expect(header).toContain('upgrade-insecure-requests');
      // Should not have extra spaces around directive names
      expect(header).not.toContain(' upgrade-insecure-requests ');
    });

    it('should replace all nonce placeholders', () => {
      const testNonce = 'unique-nonce-123';
      const header = buildCSPHeader(testNonce, true);
      
      // Should not contain any unreplaced placeholders
      expect(header).not.toContain('{{nonce}}');
      
      // Should contain the actual nonce
      const nonceCount = (header.match(new RegExp(`'nonce-${testNonce}'`, 'g')) || []).length;
      expect(nonceCount).toBeGreaterThan(0);
    });

    it('should handle development mode with all localhost sources', () => {
      const header = buildCSPHeader('test-nonce', true);
      
      // Check for development-specific sources
      expect(header).toContain('http://localhost:*');
      expect(header).toContain('ws://localhost:*');
      expect(header).toContain("'unsafe-eval'"); // Webpack HMR
    });
  });
});