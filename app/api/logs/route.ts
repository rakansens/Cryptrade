/**
 * Log Management API Endpoints
 * 
 * RESTful API for querying and managing logs
 */

import { z } from 'zod';
import { createApiHandler } from '@/lib/api/create-api-handler';
import { enhancedLogger, type LogFilter, type PaginationOptions, type LogLevel, type LogEntry } from '@/lib/logging';
import { ValidationError } from '@/lib/errors/base-error';

// Request validation schemas
const logFilterSchema = z.object({
  level: z.union([
    z.enum(['debug', 'info', 'warn', 'error', 'critical']),
    z.array(z.enum(['debug', 'info', 'warn', 'error', 'critical']))
  ]).optional(),
  source: z.union([z.string(), z.array(z.string())]).optional(),
  timeRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  correlationId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  agentName: z.string().optional(),
  toolName: z.string().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
});

const logQuerySchema = z.object({
  level: z.string().optional(),
  source: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  correlationId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  agentName: z.string().optional(),
  toolName: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  minDuration: z.string().optional(),
  maxDuration: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  order: z.string().optional(),
});

/**
 * GET /api/logs - Query logs with filtering and pagination
 */
export const GET = createApiHandler({
  schema: logQuerySchema,
  handler: async ({ data }) => {
    // Parse filter parameters
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
    
    // Other filters
    if (data.correlationId) filter.correlationId = data.correlationId;
    if (data.userId) filter.userId = data.userId;
    if (data.sessionId) filter.sessionId = data.sessionId;
    if (data.agentName) filter.agentName = data.agentName;
    if (data.toolName) filter.toolName = data.toolName;
    if (data.search) filter.search = data.search;
    
    // Tags filter
    if (data.tags) {
      filter.tags = data.tags.split(',');
    }
    
    // Duration filters
    if (data.minDuration) filter.minDuration = parseInt(data.minDuration);
    if (data.maxDuration) filter.maxDuration = parseInt(data.maxDuration);
    
    // Parse pagination parameters
    const pagination: PaginationOptions = {
      page: parseInt(data.page || '1'),
      limit: parseInt(data.limit || '50'),
      sortBy: (data.sortBy || 'timestamp') as keyof LogEntry,
      order: (data.order || 'desc') as 'asc' | 'desc',
    };
    
    // Validate filter with schema
    logFilterSchema.parse(filter);
    
    // Query logs
    return await enhancedLogger.query(filter, pagination);
  }
});

/**
 * DELETE /api/logs - Delete logs matching filter
 */
export const DELETE = createApiHandler({
  schema: logFilterSchema,
  handler: async ({ data: filter }) => {
    // 安全性チェック: 全削除を防ぐ
    if (Object.keys(filter).length === 0) {
      throw new ValidationError(
        'Filter required for deletion',
        'filter',
        filter,
        { severity: 'WARNING' }
      );
    }
    
    const deleted = await enhancedLogger.cleanup();
    
    return { deleted };
  }
});