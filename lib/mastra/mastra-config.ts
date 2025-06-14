import { Mastra } from '@mastra/core';
import { env, isDevelopment, isProduction } from '@/config/env';
import { logger } from '@/lib/utils/logger';
import { tradingAgent } from './agents/trading.agent';
import { orchestratorAgent } from './agents/orchestrator.agent';
// Import from agent registry instead of individual files
import { priceInquiryAgent, uiControlAgent } from './network/agent-registry';

/**
 * Enhanced Mastra Configuration with Telemetry
 * 
 * Configurable telemetry sampling and production-ready settings
 */

// Determine sampling strategy based on environment
function getTelemetrySampling(): 'always_on' | 'always_off' | number {
  const samplingRate = env.TELEMETRY_SAMPLING_RATE || 0.001;
  
  if (isDevelopment()) {
    // In development, always sample unless explicitly set to 0
    return samplingRate === 0 ? 'always_off' : 'always_on';
  }
  
  if (isProduction()) {
    // In production, use probabilistic sampling
    return samplingRate;
  }
  
  // In test, turn off sampling
  return 'always_off';
}

// Mastra configuration
const mastraConfig = {
  // Agent registry
  agents: {
    tradingAgent,
    priceInquiryAgent,
    uiControlAgent,
    orchestratorAgent,
  },
  
  // Workflow registry - deprecated, using A2A communication instead
  workflows: {},
  
  // Telemetry configuration simplified
  telemetry: {
    enabled: env.NODE_ENV !== 'test',
  },
  
  // Note: Mastra will use its default logger
  
  // Error handling
  errorHandler: (error: Error, context?: Record<string, unknown>) => {
    logger.error('[Mastra] Unhandled error', {
      error: error.message,
      stack: error.stack,
      context,
    });
    
    // In production, you might want to send to error tracking service
    if (isProduction() && env.ENABLE_SENTRY) {
      // Sentry.captureException(error, { extra: context });
    }
  },
};

/**
 * Create enhanced Mastra instance
 */
export const mastraEnhanced = new Mastra(mastraConfig);

/**
 * Log telemetry configuration on startup
 */
if (env.NODE_ENV !== 'test') {
  logger.info('[Mastra] Initialized with telemetry configuration', {
    sampling: getTelemetrySampling(),
    samplingRate: env.TELEMETRY_SAMPLING_RATE,
    environment: env.NODE_ENV,
    agentCount: Object.keys(mastraConfig.agents || {}).length,
    workflowCount: Object.keys(mastraConfig.workflows || {}).length,
  });
}

/**
 * Get telemetry status for monitoring
 */
export function getTelemetryStatus() {
  return {
    enabled: mastraConfig.telemetry?.enabled ?? true,
    sampling: getTelemetrySampling(),
    samplingRate: env.TELEMETRY_SAMPLING_RATE || 0.001,
    environment: env.NODE_ENV,
  };
}

/**
 * Update telemetry sampling rate (for runtime adjustment)
 * Note: This requires restarting the Mastra instance
 */
export function updateTelemetrySamplingRate(newRate: number): void {
  if (newRate < 0 || newRate > 1) {
    throw new Error('Sampling rate must be between 0 and 1');
  }
  
  logger.warn('[Mastra] Telemetry sampling rate update requested', {
    currentRate: env.TELEMETRY_SAMPLING_RATE,
    newRate,
    note: 'Restart required for changes to take effect',
  });
  
  // In a real implementation, you might:
  // 1. Update a config file or database
  // 2. Trigger a graceful restart
  // 3. Use a configuration service
}

export default mastraEnhanced;