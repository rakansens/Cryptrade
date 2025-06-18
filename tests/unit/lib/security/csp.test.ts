import { generateNonce, buildCSPHeader, applyCSPHeaders } from '@/lib/security/csp';
import { NextResponse } from 'next/server';

// Mock the production config module
jest.mock('@/config/csp-production.config', () => ({
  validateProductionConfig: () => [],
  getProductionCSPDirectives: () => ({
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:"],
    'connect-src': ["'self'", "https://api.binance.com"],
  })
}));

describe('CSP Security Module', () => {
  describe('generateNonce', () => {
    it('should generate a valid base64 nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe('string');
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
    });

    it('should build CSP header for production', () => {
      const header = buildCSPHeader(testNonce, false);
      expect(header).toContain("default-src 'self'");
      expect(header).toContain(`'nonce-${testNonce}'`);
      expect(header).not.toContain("'unsafe-eval'");
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

      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
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
      expect(cspHeader).toBeTruthy();
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("connect-src 'self'");
    });
  });
});