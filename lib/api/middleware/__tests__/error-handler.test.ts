import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { 
  createErrorResponse, 
  withErrorHandler, 
  asyncHandler,
  extractErrorDetails 
} from '../error-handler';
import { AppError } from '../../../errors/app-error';

// Helper to get response body
async function getResponseBody(response: NextResponse): Promise<any> {
  // テスト環境では NextResponse の内部構造にアクセス
  // NextResponse.json() で作成されたレスポンスの場合、_bodyプロパティから直接取得
  const responseBody = (response as any)._body;
  if (responseBody) {
    try {
      return JSON.parse(responseBody);
    } catch (error) {
      return responseBody;
    }
  }
  
  // フォールバック: text() メソッドを使用
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  describe('createErrorResponse', () => {
    it('should handle ZodError with validation details', async () => {
      const schema = z.object({ name: z.string() });
      const error = schema.safeParse({ name: 123 }).error!;
      
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(response.status).toBe(400);
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
      expect(body.error.timestamp).toBeDefined();
    });

    it('should handle AppError with custom status code', async () => {
      const error = new AppError('Custom error', 'CUSTOM_ERROR', 403, { foo: 'bar' });
      
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(response.status).toBe(403);
      expect(body.error.message).toBe('Custom error');
      expect(body.error.code).toBe('CUSTOM_ERROR');
      expect(body.error.details).toEqual({ foo: 'bar' });
    });

    it('should handle unauthorized errors', async () => {
      const error = new Error('Unauthorized access');
      
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle not found errors', async () => {
      const error = new Error('Not found');
      
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should hide error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Sensitive error message');
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should include request path when provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const error = new Error('Test error');
      
      const response = createErrorResponse(error, 500, request);
      const body = await getResponseBody(response);
      
      expect(body.error.path).toBe('/api/test');
    });

    it('should handle unknown error types', async () => {
      const error = { weird: 'error' };
      
      const response = createErrorResponse(error);
      const body = await getResponseBody(response);
      
      expect(response.status).toBe(500);
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(body.error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('withErrorHandler', () => {
    it('should return successful response when handler succeeds', async () => {
      const mockResponse = NextResponse.json({ success: true });
      const handler = jest.fn().mockResolvedValue(mockResponse);
      
      const wrapped = withErrorHandler(handler);
      const result = await wrapped();
      
      expect(handler).toHaveBeenCalled();
      expect(result).toBe(mockResponse);
    });

    it('should catch and format errors from handler', async () => {
      const handler = jest.fn().mockRejectedValue(
        new Error('Handler failed')
      );
      
      const wrapped = withErrorHandler(handler);
      const result = await wrapped() as NextResponse;
      const body = await getResponseBody(result);
      
      expect(result.status).toBe(500);
      expect(body.error.message).toContain('Handler failed');
    });

    it('should pass request to error response when available', async () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      const handler = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const wrapped = withErrorHandler(handler);
      const result = await wrapped(request, { other: 'arg' }) as NextResponse;
      const body = await getResponseBody(result);
      
      expect(body.error.path).toBe('/api/test');
    });
  });

  describe('asyncHandler', () => {
    it('should wrap async handlers with error handling', async () => {
      const handler = async (req: NextRequest) => {
        throw new Error('Async error');
      };
      
      const wrapped = asyncHandler(handler);
      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await wrapped(request) as NextResponse;
      const body = await getResponseBody(result);
      
      expect(result.status).toBe(500);
      expect(body.error.message).toContain('Async error');
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract ZodError details', () => {
      const schema = z.object({ name: z.string() });
      const error = schema.safeParse({ name: 123 }).error!;
      
      const details = extractErrorDetails(error);
      
      expect(details.type).toBe('validation');
      expect(details.errors).toBeDefined();
    });

    it('should extract AppError details', () => {
      const error = new AppError('Test', 'TEST_ERROR', 400, { foo: 'bar' });
      
      const details = extractErrorDetails(error);
      
      expect(details.type).toBe('application');
      expect(details.code).toBe('TEST_ERROR');
      expect(details.details).toEqual({ foo: 'bar' });
    });

    it('should extract Error details', () => {
      const error = new Error('Standard error');
      
      const details = extractErrorDetails(error);
      
      expect(details.type).toBe('error');
      expect(details.message).toBe('Standard error');
      expect(details.stack).toBeDefined();
    });

    it('should handle unknown error types', () => {
      const error = 'string error';
      
      const details = extractErrorDetails(error);
      
      expect(details.type).toBe('unknown');
      expect(details.value).toBe('string error');
    });
  });
});