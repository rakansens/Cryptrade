import { NextResponse } from 'next/server';
import { getProductionCSPDirectives, validateProductionConfig } from '@/config/csp-production.config';

/**
 * Content Security Policy configuration for enhanced security
 * Protects against XSS, clickjacking, and other injection attacks
 */
export const CSP_DIRECTIVES = {
  // Default policy: Only allow resources from same origin
  'default-src': ["'self'"],
  
  // Scripts: Allow same origin, inline scripts with nonce, and required CDNs
  'script-src': [
    "'self'",
    "'nonce-{{nonce}}'",
    "'strict-dynamic'",
    "https:",
    "'unsafe-inline'" // Fallback for older browsers
  ],
  
  // Styles: Allow same origin, inline styles, and required style sources
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-jsx and inline styles
    "https://fonts.googleapis.com"
  ],
  
  // Images: Allow same origin, data URIs, and common image CDNs
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "http://localhost:*" // Development only
  ],
  
  // Fonts: Allow same origin and Google Fonts
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  
  // Connect: Allow API calls and WebSocket connections
  'connect-src': [
    "'self'",
    "wss://stream.binance.com:*",
    "https://api.binance.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "http://localhost:*", // Development
    "ws://localhost:*" // Development WebSocket
  ],
  
  // Media: Allow same origin media
  'media-src': ["'self'"],
  
  // Objects: Disallow plugins like Flash
  'object-src': ["'none'"],
  
  // Child frames: Allow same origin only
  'child-src': ["'self'"],
  
  // Frame ancestors: Prevent clickjacking
  'frame-ancestors': ["'self'"],
  
  // Base URI: Restrict base tag usage
  'base-uri': ["'self'"],
  
  // Form actions: Restrict form submissions
  'form-action': ["'self'"],
  
  // Upgrade insecure requests in production
  'upgrade-insecure-requests': []
};

/**
 * Production-specific CSP configuration
 * Additional domains and services that are allowed in production
 */
export const PRODUCTION_CSP_OVERRIDES = {
  // Additional script sources for production (e.g., analytics, monitoring)
  'script-src': [
    "https://*.sentry.io",
    "https://*.sentry-cdn.com"
  ],
  
  // Additional connection sources for production
  'connect-src': [
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com"
  ],
  
  // Additional image sources if using CDN
  'img-src': [
    "https://*.vercel.app",
    "https://*.vercel.sh"
  ]
};

/**
 * Generate a random nonce for inline scripts
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  
  // Use Web Crypto API (available in both Node.js and Edge Runtime)
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(array);
  } else if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    throw new Error('Crypto API not available');
  }
  
  // Convert to base64 (Edge Runtime compatible)
  return btoa(String.fromCharCode(...array));
}

/**
 * Build CSP header string from directives
 */
export function buildCSPHeader(nonce: string, isDevelopment: boolean = false): string {
  let directives: Record<string, string[]>;
  
  if (isDevelopment) {
    // Use default directives for development
    directives = { ...CSP_DIRECTIVES };
    
    // Remove upgrade-insecure-requests in development
    delete directives['upgrade-insecure-requests'];
    
    // Add webpack HMR support
    if (Array.isArray(directives['script-src'])) {
      directives['script-src'].push("'unsafe-eval'");
    }
  } else {
    // Use production configuration
    const productionErrors = validateProductionConfig();
    if (productionErrors.length > 0) {
      console.error('Production CSP configuration errors:', productionErrors);
    }
    
    // Get production directives
    directives = getProductionCSPDirectives();
    
    // Merge with any legacy overrides if needed
    Object.entries(PRODUCTION_CSP_OVERRIDES).forEach(([directive, sources]) => {
      if (Array.isArray(directives[directive]) && Array.isArray(sources)) {
        // Avoid duplicates
        const existing = new Set(directives[directive]);
        sources.forEach(source => {
          if (!existing.has(source)) {
            directives[directive].push(source);
          }
        });
      }
    });
  }
  
  // Build the CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) return directive;
      const sourcesStr = sources.join(' ').replace(/{{nonce}}/g, nonce);
      return `${directive} ${sourcesStr}`;
    })
    .join('; ');
}

/**
 * Apply CSP headers to NextResponse
 */
export function applyCSPHeaders(
  response: NextResponse,
  nonce: string,
  isDevelopment: boolean = false
): NextResponse {
  const cspHeader = buildCSPHeader(nonce, isDevelopment);
  
  // Set CSP header
  response.headers.set('Content-Security-Policy', cspHeader);
  
  // Set additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Production-specific security headers
  if (!isDevelopment) {
    // Strict Transport Security (HSTS)
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  return response;
}