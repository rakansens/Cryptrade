import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import { checkRateLimit, getClientIdentifier, type RateLimitConfig } from './rate-limit';

interface MiddlewareRateLimitConfig {
  windowMs: number; // Time window in milliseconds (converted to seconds internally)
  maxRequests: number; // Max requests per window
}

const DEFAULT_RATE_LIMIT: MiddlewareRateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
};

/**
 * Rate limiting middleware using production-ready storage
 */
export function createRateLimiter(config: MiddlewareRateLimitConfig = DEFAULT_RATE_LIMIT) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const identifier = getClientIdentifier(request);
    
    // Convert milliseconds to seconds for rate-limit module
    const rateLimitConfig: RateLimitConfig = {
      windowSec: Math.floor(config.windowMs / 1000),
      maxRequests: config.maxRequests,
    };
    
    try {
      const result = await checkRateLimit(identifier, rateLimitConfig);
      
      if (!result.success) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: result.retryAfter || 60
          },
          { 
            status: 429,
            headers: {
              'Retry-After': (result.retryAfter || 60).toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': result.remainingRequests.toString(),
              'X-RateLimit-Reset': result.resetTime.toString(),
            }
          }
        );
      }
      
      return null; // Allow request
    } catch (error) {
      console.error('[RateLimit] Middleware error:', error);
      // On error, allow request but log for monitoring
      return null;
    }
  };
}


/**
 * CORS headers configuration
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': env.NODE_ENV === 'production' 
    ? env.ALLOWED_ORIGINS || 'https://your-domain.com'
    : '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create CORS preflight response
 */
export function createCorsPreflightResponse(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Security headers for API responses
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return response;
}

/**
 * Input validation helper
 */
export function validateBinanceSymbol(symbol: string): boolean {
  // Binance symbol format: BTCUSDT, ETHUSDT, etc.
  return /^[A-Z]{2,10}USDT?$/i.test(symbol);
}

export function validateInterval(interval: string): boolean {
  const validIntervals = [
    '1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h',
    '1d', '3d', '1w', '1M'
  ];
  return validIntervals.includes(interval);
}

/**
 * Combined middleware for API routes
 */
export function createApiMiddleware(rateLimitConfig?: MiddlewareRateLimitConfig) {
  const rateLimiter = createRateLimiter(rateLimitConfig);
  
  return async (request: NextRequest) => {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return applyCorsHeaders(applySecurityHeaders(rateLimitResponse));
    }
    
    return null; // Request can proceed
  };
}