import { createApiHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { getMastraStats } from '@/lib/mastra/mastra';
import { env } from '@/config/env';

interface TelemetryConfig {
  enabled: boolean;
  sampling: 'always_on' | 'always_off' | number;
  samplingRate: number;
  environment: string;
}

/**
 * Telemetry Status API
 * 
 * GET: Get current telemetry configuration and stats
 */

export const GET = createApiHandler({
  handler: async () => {
    const stats = getMastraStats();
    const samplingRate = env.TELEMETRY_SAMPLING_RATE || 0.001;
    const environment = process.env.NODE_ENV || 'development';
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      environment,
      configuration: {
        samplingRate,
        samplingPercentage: `${(samplingRate * 100).toFixed(2)}%`,
        strategy: getTelemetryDescription(stats.telemetry),
      },
      mastra: {
        ...stats,
        telemetry: {
          ...stats.telemetry,
          description: getTelemetryDescription(stats.telemetry),
        }
      }
    };
  }
});

export const OPTIONS = createOptionsHandler();

/**
 * Get human-readable description of telemetry configuration
 */
function getTelemetryDescription(telemetry: TelemetryConfig): string {
  if (!telemetry.enabled) {
    return 'Telemetry is disabled';
  }
  
  if (telemetry.sampling === 'always_on') {
    return 'All requests are being traced (development mode)';
  }
  
  if (telemetry.sampling === 'always_off') {
    return 'Telemetry sampling is turned off';
  }
  
  if (typeof telemetry.sampling === 'number') {
    const percentage = (telemetry.sampling * 100).toFixed(2);
    return `Probabilistic sampling at ${percentage}% (production mode)`;
  }
  
  return 'Unknown telemetry configuration';
}