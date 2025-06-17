import { describe, it, expect } from '@jest/globals';
import {
  ApiErrorSchema,
  ApiSuccessSchema,
  PaginationParamsSchema,
  PaginationResponseSchema,
  DateRangeSchema,
  type ApiError,
  type PaginationParams,
  type DateRange,
  type RouteContext,
  type RouteHandler,
  type NextRouteHandler,
} from '../../../app/api/types';
import { z } from 'zod';

describe('API Types Regression Tests', () => {
  describe('ApiErrorSchema', () => {
    it('should validate error responses correctly', () => {
      const validError = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: { field: 'email', reason: 'Invalid format' },
        timestamp: '2025-06-17T10:00:00Z',
      };

      expect(ApiErrorSchema.parse(validError)).toEqual(validError);
    });

    it('should handle minimal error object', () => {
      const minimalError = {
        error: 'UNKNOWN_ERROR',
        timestamp: '2025-06-17T10:00:00Z',
      };

      expect(ApiErrorSchema.parse(minimalError)).toEqual(minimalError);
    });

    it('should reject invalid error structures', () => {
      const invalidError = {
        error: 123, // Should be string
        timestamp: '2025-06-17T10:00:00Z',
      };

      expect(() => ApiErrorSchema.parse(invalidError)).toThrow();
    });
  });

  describe('ApiSuccessSchema', () => {
    it('should wrap data with success metadata', () => {
      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const SuccessSchema = ApiSuccessSchema(UserSchema);
      const validResponse = {
        success: true as const,
        data: { id: '123', name: 'Test User' },
        timestamp: '2025-06-17T10:00:00Z',
      };

      expect(SuccessSchema.parse(validResponse)).toEqual(validResponse);
    });

    it('should work without timestamp', () => {
      const DataSchema = z.string();
      const SuccessSchema = ApiSuccessSchema(DataSchema);
      const response = {
        success: true as const,
        data: 'Operation completed',
      };

      expect(SuccessSchema.parse(response)).toEqual(response);
    });
  });

  describe('PaginationParamsSchema', () => {
    it('should parse valid pagination params', () => {
      const params = {
        page: '2',
        limit: '50',
        sort: 'createdAt',
        order: 'asc' as const,
      };

      const parsed = PaginationParamsSchema.parse(params);
      expect(parsed).toEqual({
        page: 2,
        limit: 50,
        sort: 'createdAt',
        order: 'asc',
      });
    });

    it('should apply defaults for missing params', () => {
      const parsed = PaginationParamsSchema.parse({});
      expect(parsed).toEqual({
        page: 1,
        limit: 20,
        order: 'desc',
      });
    });

    it('should enforce limit maximum', () => {
      const params = { limit: '200' };
      expect(() => PaginationParamsSchema.parse(params)).toThrow();
    });

    it('should coerce string numbers', () => {
      const params = { page: '3', limit: '30' };
      const parsed = PaginationParamsSchema.parse(params);
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(30);
    });
  });

  describe('PaginationResponseSchema', () => {
    it('should validate paginated responses', () => {
      const ItemSchema = z.object({ id: z.string(), value: z.number() });
      const ResponseSchema = PaginationResponseSchema(ItemSchema);

      const response = {
        items: [
          { id: '1', value: 100 },
          { id: '2', value: 200 },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        },
      };

      expect(ResponseSchema.parse(response)).toEqual(response);
    });

    it('should handle empty items array', () => {
      const ResponseSchema = PaginationResponseSchema(z.any());
      const response = {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      expect(ResponseSchema.parse(response)).toEqual(response);
    });
  });

  describe('DateRangeSchema', () => {
    it('should validate date ranges', () => {
      const range = {
        startDate: '2025-06-01T00:00:00Z',
        endDate: '2025-06-17T23:59:59Z',
      };

      expect(DateRangeSchema.parse(range)).toEqual(range);
    });

    it('should allow partial date ranges', () => {
      const startOnly = { startDate: '2025-06-01T00:00:00Z' };
      const endOnly = { endDate: '2025-06-17T23:59:59Z' };
      const empty = {};

      expect(DateRangeSchema.parse(startOnly)).toEqual(startOnly);
      expect(DateRangeSchema.parse(endOnly)).toEqual(endOnly);
      expect(DateRangeSchema.parse(empty)).toEqual(empty);
    });

    it('should reject invalid date formats', () => {
      const invalid = { startDate: '2025-06-01' }; // Missing time component
      expect(() => DateRangeSchema.parse(invalid)).toThrow();
    });
  });

  describe('Type definitions', () => {
    it('should correctly type RouteContext', () => {
      const context: RouteContext<{ id: string }> = {
        params: Promise.resolve({ id: '123' }),
      };

      expect(context.params).toBeInstanceOf(Promise);
    });

    it('should correctly type RouteHandler', () => {
      const handler: RouteHandler<{ userId: string }> = async (request, context) => {
        const params = await context.params;
        return new Response(JSON.stringify({ userId: params.userId }));
      };

      expect(typeof handler).toBe('function');
    });

    it('should correctly type NextRouteHandler', () => {
      const handler: NextRouteHandler = async (request, context) => {
        return new Response('OK');
      };

      expect(typeof handler).toBe('function');
    });
  });

  // Snapshot tests for current behavior
  describe('Behavior snapshots', () => {
    it('should maintain current error structure', () => {
      const errorSnapshot: ApiError = {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: {
          stack: 'Error stack trace',
          context: { requestId: 'req-123' },
        },
        timestamp: '2025-06-17T10:00:00Z',
      };

      expect(ApiErrorSchema.parse(errorSnapshot)).toMatchSnapshot();
    });

    it('should maintain current pagination structure', () => {
      const paginationSnapshot: PaginationParams = {
        page: 5,
        limit: 25,
        sort: 'updatedAt',
        order: 'desc',
      };

      expect(PaginationParamsSchema.parse(paginationSnapshot)).toMatchSnapshot();
    });
  });
});