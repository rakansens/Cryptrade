import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/utils/logger';

/**
 * Request validation options
 */
export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Validation middleware
 * Validates request data against Zod schemas
 */
export function withValidation<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  schemas: ValidationOptions
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const validatedData: any = {};

      // Validate body
      if (schemas.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          const body = await req.json();
          validatedData.body = await schemas.body.parseAsync(body);
        } catch (error) {
          if (error instanceof ZodError) {
            throw error;
          }
          throw new AppError(
            'Invalid request body',
            'INVALID_BODY',
            400,
            { error: String(error) }
          );
        }
      }

      // Validate query parameters
      if (schemas.query) {
        const { searchParams } = new URL(req.url);
        const query = Object.fromEntries(searchParams.entries());
        validatedData.query = await schemas.query.parseAsync(query);
      }

      // Validate route params
      if (schemas.params && context?.params) {
        validatedData.params = await schemas.params.parseAsync(context.params);
      }

      // Validate headers
      if (schemas.headers) {
        const headers = Object.fromEntries(req.headers.entries());
        validatedData.headers = await schemas.headers.parseAsync(headers);
      }

      // Add validated data to context
      if (context) {
        context.validatedData = validatedData;
      }

      logger.debug('Request validation successful', {
        path: req.url,
        method: req.method,
        hasBody: !!validatedData.body,
        hasQuery: !!validatedData.query,
        hasParams: !!validatedData.params,
      });

      return handler(req, context);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.url,
          method: req.method,
          errors: error.errors,
        });
        throw error; // Will be handled by error middleware
      }
      
      throw error;
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // Sort
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().min(1),
  }),

  // Search
  search: z.object({
    q: z.string().optional(),
    searchFields: z.array(z.string()).optional(),
  }),
};

/**
 * Compose multiple schemas
 */
export function composeSchemas(...schemas: ZodSchema[]): ZodSchema {
  if (schemas.length === 0) {
    return z.object({});
  }
  
  if (schemas.length === 1) {
    return schemas[0];
  }
  
  return schemas.reduce((acc, schema) => {
    if (acc instanceof z.ZodObject && schema instanceof z.ZodObject) {
      return acc.merge(schema);
    }
    // If not objects, create intersection
    return z.intersection(acc, schema);
  });
}

/**
 * Create paginated response schema
 */
export function paginatedResponse<T extends ZodSchema>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });
}

/**
 * Validate request body helper
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json();
    return await schema.parseAsync(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new AppError(
      'Invalid request body',
      'INVALID_BODY',
      400,
      { error: String(error) }
    );
  }
}

/**
 * Validate query parameters helper
 */
export function validateQuery<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): T {
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());
  return schema.parse(query);
}