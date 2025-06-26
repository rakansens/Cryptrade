import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { metricsCollector } from '@/lib/monitoring/metrics';
import { logger } from '@/lib/utils/logger';
import { applyCorsHeaders, applySecurityHeaders } from '@/lib/api/middleware';
import { createErrorResponse } from '@/lib/api/helpers/error-handler';
import { getServerSession } from '@/lib/auth/server';

// Request validation schema
const metricsQuerySchema = z.object({
  format: z.enum(['prometheus', 'json']).optional(),
});

/**
 * Prometheus metrics endpoint
 * GET /api/metrics
 * 
 * Note: This endpoint doesn't use createApiHandler because it needs
 * to return raw text for Prometheus format, not JSON.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return createErrorResponse('Unauthorized - Please login', 401);
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      format: searchParams.get('format') || undefined,
    };

    // Validate query parameters
    let validated;
    try {
      validated = metricsQuerySchema.parse(queryData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid query parameters', 400, { errors: error.errors });
      }
      throw error;
    }

    const format = validated.format || 'prometheus';

    logger.info('[Metrics] Exporting metrics', { format });

    if (format === 'json') {
      // Return JSON format with standard headers
      const jsonMetrics = metricsCollector.toJSON();
      const response = NextResponse.json(jsonMetrics);
      return applyCorsHeaders(applySecurityHeaders(response));
    }

    // Return Prometheus format as plain text
    const prometheusMetrics = metricsCollector.export();
    const response = new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
    return applySecurityHeaders(response);
  } catch (error) {
    logger.error('[Metrics] Failed to export metrics', { error });
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to export metrics',
      500
    );
  }
}