import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/utils/logger';

/**
 * Authentication middleware
 * Validates that the request has a valid session
 */
export async function withAuth<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options?: {
    requireAdmin?: boolean;
    allowApiKey?: boolean;
  }
) {
  return async (req: NextRequest, context?: any) => {
    try {
      // Check for API key if allowed
      if (options?.allowApiKey) {
        const apiKey = req.headers.get('x-api-key');
        if (apiKey && apiKey === process.env.API_KEY) {
          logger.info('API key authentication successful', {
            path: req.url,
          });
          return handler(req, context);
        }
      }

      // Check session
      const session = await getServerSession();
      
      if (!session) {
        logger.warn('Unauthorized access attempt', {
          path: req.url,
          method: req.method,
        });
        
        throw new AppError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Check admin requirement
      if (options?.requireAdmin && !session.user?.isAdmin) {
        logger.warn('Admin access denied', {
          path: req.url,
          userId: session.user?.id,
        });
        
        throw new AppError(
          'Admin access required',
          'FORBIDDEN',
          403
        );
      }

      // Add session to request context
      if (context) {
        context.session = session;
      }

      return handler(req, context);
    } catch (error) {
      // Re-throw AppErrors to be handled by error handler
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap other errors
      throw new AppError(
        'Authentication failed',
        'AUTH_ERROR',
        401,
        { originalError: error }
      );
    }
  };
}

/**
 * Optional authentication middleware
 * Adds session to context if available but doesn't require it
 */
export async function withOptionalAuth<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const session = await getServerSession();
      
      if (session && context) {
        context.session = session;
      }
      
      return handler(req, context);
    } catch (error) {
      // Log error but continue without session
      logger.error('Failed to get session', {
        path: req.url,
        error: String(error),
      });
      
      return handler(req, context);
    }
  };
}

/**
 * Rate limiting middleware
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options: {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (req: NextRequest) => string;
  } = {}
) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 60,
    keyGenerator = (req) => {
      // Default: Use IP address or session ID
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
      return ip;
    },
  } = options;

  return async (req: NextRequest, context?: any) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Clean up old entries
    for (const [k, v] of requestCounts.entries()) {
      if (v.resetTime < now) {
        requestCounts.delete(k);
      }
    }
    
    // Get or create rate limit entry
    let rateLimit = requestCounts.get(key);
    
    if (!rateLimit || rateLimit.resetTime < now) {
      rateLimit = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestCounts.set(key, rateLimit);
    }
    
    rateLimit.count++;
    
    if (rateLimit.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        count: rateLimit.count,
        limit: maxRequests,
        path: req.url,
      });
      
      throw new AppError(
        'Too many requests',
        'RATE_LIMIT_EXCEEDED',
        429,
        {
          retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000),
        }
      );
    }
    
    return handler(req, context);
  };
}