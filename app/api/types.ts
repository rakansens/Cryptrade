/**
 * Common types for API routes
 */

import { z } from 'zod';

// Common error response schema
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Common success response wrapper
export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().optional(),
  });

// Common pagination params
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// Common pagination response
export const PaginationResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

// Common filters
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

// Request context type for route handlers
export interface RouteContext<T = Record<string, string>> {
  params: Promise<T>;
}

// Type-safe route handler types
export type RouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: RouteContext<TParams>
) => Promise<Response> | Response;

export type NextRouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: RouteContext<TParams>
) => Promise<Response>;