import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db/health-check';
import { getCacheStats } from '@/lib/services/database/chat-cache';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    // Check database health
    const dbHealth = await checkDatabaseHealth();
    
    // Get cache statistics
    const cacheStats = getCacheStats();
    
    // Overall health status
    const isHealthy = dbHealth.status === 'healthy';
    
    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        cache: {
          status: 'healthy',
          stats: cacheStats,
        },
      },
    };
    
    logger.info('[HealthCheck API] Health check completed', {
      status: response.status,
      dbLatency: dbHealth.latency,
    });
    
    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('[HealthCheck API] Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}