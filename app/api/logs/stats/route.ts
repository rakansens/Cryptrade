/**
 * Log Statistics API Endpoint
 * 
 * Provides aggregated log statistics
 */

import { z } from 'zod';
import { createApiHandler } from '@/lib/api/create-api-handler';
import { enhancedLogger, type LogFilter, type LogLevel } from '@/lib/logging';

// Request validation schema
const logStatsQuerySchema = z.object({
  level: z.string().optional(),
  source: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  agentName: z.string().optional(),
  toolName: z.string().optional(),
});

/**
 * GET /api/logs/stats - Get log statistics
 */
export const GET = createApiHandler({
  schema: logStatsQuerySchema,
  handler: async ({ data }) => {
    // Build filter from query parameters
    const filter: LogFilter = {};
    
    // Level filter
    if (data.level) {
      filter.level = data.level.includes(',') 
        ? data.level.split(',') as LogLevel[] 
        : data.level as LogLevel;
    }
    
    // Source filter
    if (data.source) {
      filter.source = data.source.includes(',') ? data.source.split(',') : data.source;
    }
    
    // Time range
    if (data.from || data.to) {
      filter.timeRange = {};
      if (data.from) filter.timeRange.from = data.from;
      if (data.to) filter.timeRange.to = data.to;
    }
    
    // Agent/Tool filters
    if (data.agentName) filter.agentName = data.agentName;
    if (data.toolName) filter.toolName = data.toolName;
    
    // Get statistics
    const stats = await enhancedLogger.getStats(filter);
    
    // Add current timestamp
    return {
      ...stats,
      timestamp: new Date().toISOString(),
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    };
  }
});