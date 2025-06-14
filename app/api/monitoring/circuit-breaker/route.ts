import { z } from 'zod';
import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { getMarketDataCircuitBreakerStatus, resetMarketDataCircuitBreaker } from '@/lib/mastra/tools/market-data-resilient.tool';
import { AuthError } from '@/lib/errors/base-error';

/**
 * Circuit Breaker Status API
 * 
 * GET: Get current circuit breaker status
 * POST: Reset circuit breaker (admin action)
 */

// Schema for POST request (no body validation needed, but we check headers)
const resetSchema = z.object({});

export const GET = createApiHandler({
  handler: async () => {
    const status = getMarketDataCircuitBreakerStatus();
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      circuitBreaker: {
        marketData: status
      }
    };
  }
});

export const POST = createApiHandler({
  schema: resetSchema,
  handler: async ({ request }) => {
    // Check for admin authorization (simplified for demo)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer admin-secret') {
      throw new AuthError('Unauthorized: Admin access required');
    }

    // Reset circuit breaker
    resetMarketDataCircuitBreaker();
    
    return {
      success: true,
      message: 'Circuit breaker reset successfully'
    };
  }
});

export const OPTIONS = createOptionsHandler();