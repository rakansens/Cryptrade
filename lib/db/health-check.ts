import { prisma } from './prisma';
import { logger } from '@/lib/utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  timestamp: string;
}

/**
 * Check database health by executing a simple query
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Execute a simple query to check connection
    await prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - startTime;
    
    logger.debug('[HealthCheck] Database is healthy', { latency });
    
    return {
      status: 'healthy',
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('[HealthCheck] Database is unhealthy', {
      error: errorMessage,
      latency: Date.now() - startTime,
    });
    
    return {
      status: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validate database connection on startup
 */
export async function validateDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('[HealthCheck] Database connection established');
    return true;
  } catch (error) {
    logger.error('[HealthCheck] Failed to connect to database', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('[HealthCheck] Database connection closed');
  } catch (error) {
    logger.error('[HealthCheck] Error disconnecting from database', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Handle process termination
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});