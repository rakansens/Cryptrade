import { z } from 'zod';
import { createApiHandler } from '@/lib/api/create-api-handler';
import { metricsCollector } from '@/lib/monitoring/metrics';
import { NextResponse } from 'next/server';

// Request validation schema
const metricsQuerySchema = z.object({
  format: z.enum(['prometheus', 'json']).optional(),
});

/**
 * Prometheus metrics endpoint
 * GET /api/metrics
 */
export const GET = createApiHandler({
  schema: metricsQuerySchema,
  handler: async ({ data, request }) => {
    const format = data.format || 'prometheus';

    if (format === 'json') {
      return metricsCollector.toJSON();
    }

    // For Prometheus format, we need to return a raw NextResponse
    // since createApiHandler wraps responses in JSON by default
    const metrics = metricsCollector.export();
    
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
});