/**
 * API Middleware exports
 * 
 * Provides unified middleware for:
 * - Error handling
 * - Authentication
 * - Validation
 * - Rate limiting
 * - Logging
 */

export {
  // Error handling
  createErrorResponse,
  withErrorHandler,
  asyncHandler,
  extractErrorDetails,
  type ErrorResponse,
} from './error-handler';

export {
  // Authentication
  withAuth,
  withOptionalAuth,
  withRateLimit,
} from './auth';

export {
  // Validation
  withValidation,
  commonSchemas,
  composeSchemas,
  paginatedResponse,
  validateBody,
  validateQuery,
  type ValidationOptions,
} from './validation';

// Re-export for convenience
export { z } from 'zod';
export type { ZodError } from 'zod';

/**
 * Compose multiple middleware functions
 */
export function compose<T = any>(
  ...middlewares: Array<
    (handler: any, options?: any) => (req: any, context?: any) => Promise<any>
  >
) {
  return (
    handler: (req: any, context?: any) => Promise<NextResponse<T>>,
    options?: any[]
  ) => {
    return middlewares.reduceRight(
      (acc, middleware, index) => middleware(acc, options?.[index]),
      handler
    );
  };
}

/**
 * Standard API handler with all middleware
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';

export interface StandardApiOptions {
  auth?: boolean | { requireAdmin?: boolean; allowApiKey?: boolean };
  validation?: ValidationOptions;
  rateLimit?: {
    windowMs?: number;
    maxRequests?: number;
  };
}

export function createStandardApiHandler<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options: StandardApiOptions = {}
) {
  let wrappedHandler = handler;

  // Apply validation
  if (options.validation) {
    const { withValidation } = require('./validation');
    wrappedHandler = withValidation(wrappedHandler, options.validation);
  }

  // Apply rate limiting
  if (options.rateLimit) {
    const { withRateLimit } = require('./auth');
    wrappedHandler = withRateLimit(wrappedHandler, options.rateLimit);
  }

  // Apply authentication
  if (options.auth) {
    const { withAuth } = require('./auth');
    const authOptions = typeof options.auth === 'object' ? options.auth : {};
    wrappedHandler = withAuth(wrappedHandler, authOptions);
  }

  // Always apply error handling
  const { withErrorHandler } = require('./error-handler');
  return withErrorHandler(wrappedHandler);
}