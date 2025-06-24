import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiMiddleware, createCorsPreflightResponse } from './middleware';
import { logger } from '@/lib/utils/logger';
import { createErrorResponse, ValidationError } from './helpers/error-handler';
import { createSuccessResponse } from './helpers/response-builder';
import type { StreamEvent } from '@/lib/api/types';

export type ApiHandlerConfig<TInput = unknown, TOutput = unknown> = {
  middleware?: ReturnType<typeof createApiMiddleware> | Array<ReturnType<typeof createApiMiddleware>>;
  schema?: z.ZodSchema<TInput>;
  handler: (params: {
    data: TInput;
    request: NextRequest;
    context: {
      sessionId?: string;
      headers: Record<string, string>;
    };
  }) => Promise<TOutput>;
  streaming?: boolean;
  enableCors?: boolean;
  rateLimitOptions?: {
    windowMs?: number;
    maxRequests?: number;
  };
};

export type StreamingHandlerConfig<TInput = unknown> = Omit<ApiHandlerConfig<TInput>, 'handler' | 'streaming'> & {
  streamHandler: (params: {
    data: TInput;
    request: NextRequest;
    context: {
      sessionId?: string;
      headers: Record<string, string>;
    };
  }) => AsyncGenerator<StreamEvent, void, unknown> | ReadableStream;
};

/**
 * Factory function to create standardized API handlers
 * 
 * @example
 * ```typescript
 * export const POST = createApiHandler({
 *   middleware: rateLimitMiddleware,
 *   schema: ChatRequestSchema,
 *   handler: async ({ data, context }) => {
 *     return await chatService.process(data, context);
 *   }
 * });
 * ```
 */
export function createApiHandler<TInput = unknown, TOutput = unknown>(
  config: ApiHandlerConfig<TInput, TOutput>
) {
  const {
    middleware,
    schema,
    handler,
    // enableCors = true, // unused
    rateLimitOptions,
  } = config;

  // Create rate limit middleware if options provided
  const rateLimitMiddleware = rateLimitOptions && rateLimitOptions.windowMs && rateLimitOptions.maxRequests
    ? createApiMiddleware({
        windowMs: rateLimitOptions.windowMs,
        maxRequests: rateLimitOptions.maxRequests
      })
    : null;

  // Combine middlewares
  const middlewares = Array.isArray(middleware) ? middleware : (middleware ? [middleware] : []);
  if (rateLimitMiddleware) {
    middlewares.unshift(rateLimitMiddleware);
  }

  return async function apiHandler(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    const requestId = `${request.method}-${request.url}-${startTime}`;

    try {
      // Apply middlewares
      for (const mw of middlewares) {
        const response = await mw(request);
        if (response) return response;
      }

      // Parse and validate request body
      let data: TInput;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const body = await request.json().catch(() => null);
        
        if (schema) {
          try {
            data = schema.parse(body);
          } catch (error) {
            if (error instanceof z.ZodError) {
              logger.warn('[API Handler] Validation failed', {
                requestId,
                errors: error.errors,
              });
              return createErrorResponse(
                'Invalid request data',
                400,
                { errors: error.errors }
              );
            }
            throw error;
          }
        } else {
          data = body as TInput;
        }
      } else {
        // For GET requests, parse query params
        const searchParams = new URL(request.url).searchParams;
        const queryData: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          queryData[key] = value;
        });
        
        if (schema) {
          try {
            data = schema.parse(queryData);
          } catch (error) {
            if (error instanceof z.ZodError) {
              logger.warn('[API Handler] Query validation failed', {
                requestId,
                errors: error.errors,
              });
              return createErrorResponse(
                'Invalid query parameters',
                400,
                { errors: error.errors }
              );
            }
            throw error;
          }
        } else {
          data = queryData as TInput;
        }
      }

      // Extract context
      const sessionId = request.headers.get('x-session-id');
      const context = {
        ...(sessionId && { sessionId }),
        headers: Object.fromEntries(request.headers.entries()),
      };

      logger.info('[API Handler] Processing request', {
        requestId,
        method: request.method,
        url: request.url,
        hasData: !!data,
        sessionId: context.sessionId,
      });

      // Execute handler
      const result = await handler({ data, request, context });

      // Log success
      const duration = Date.now() - startTime;
      logger.info('[API Handler] Request completed', {
        requestId,
        duration,
        success: true,
      });

      // Return success response
      return createSuccessResponse(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('[API Handler] Request failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Import base errors for type checking first
      const { MastraBaseError, ApiError, ValidationError: BaseValidationError } = await import('@/lib/errors/base-error');
      
      // Handle known error types
      if (error instanceof ValidationError) {
        return createErrorResponse(error.message, 400, error.details);
      }
      
      // Handle BaseValidationError from base-error.ts
      if (error instanceof BaseValidationError) {
        return createErrorResponse(error.message, 400, error.data as Record<string, unknown>);
      }
      
      // Handle MastraBaseError instances
      if (error instanceof MastraBaseError) {
        // Extract status code from ApiError
        let statusCode = 500;
        if (error instanceof ApiError && error.data && typeof error.data === 'object' && 'statusCode' in error.data) {
          statusCode = error.data.statusCode as number;
        }
        
        // Return just the message with the serialized error as details
        const errorDetails = error.toJSON();
        return createErrorResponse(
          error.message,
          statusCode,
          errorDetails as unknown as Record<string, unknown>
        );
      }

      // Generic error response
      return createErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  };
}

/**
 * Factory function to create streaming API handlers
 * 
 * @example
 * ```typescript
 * export const POST = createStreamingHandler({
 *   schema: StreamRequestSchema,
 *   streamHandler: async function* ({ data, context }) {
 *     yield { event: 'start', data: { id: context.sessionId } };
 *     
 *     for await (const chunk of processStream(data)) {
 *       yield { event: 'data', data: chunk };
 *     }
 *     
 *     yield { event: 'done', data: { success: true } };
 *   }
 * });
 * ```
 */
export function createStreamingHandler<TInput = unknown>(
  config: StreamingHandlerConfig<TInput>
) {
  // const baseHandler = createApiHandler({ // unused
  //   ...config,
  //   handler: async ({ data, request, context }) => {
  //     // This will be overridden, but TypeScript needs it
  //     return {} as unknown;
  //   },
  // });

  return async function streamingHandler(request: NextRequest): Promise<Response> {
    // Use base handler for middleware and validation
    const mockHandler = createApiHandler({
      ...config,
      handler: async ({ data, request, context }) => {
        // Create streaming response
        const stream = config.streamHandler({ data, request, context });
        
        // Convert to Response based on stream type
        if (stream instanceof ReadableStream) {
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } else {
          // Handle AsyncGenerator
          const encoder = new TextEncoder();
          const readableStream = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  const data = typeof chunk === 'string'
                    ? chunk
                    : `data: ${JSON.stringify(chunk)}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
                controller.close();
              } catch (error) {
                controller.error(error);
              }
            },
          });

          return new Response(readableStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }
      },
    });

    // Execute with streaming response handling
    const response = await mockHandler(request);
    
    // If it's already a streaming response, return it
    if (response.headers.get('content-type') === 'text/event-stream') {
      return response;
    }
    
    // Otherwise, convert NextResponse to Response
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  };
}

/**
 * Create OPTIONS handler for CORS preflight
 */
export function createOptionsHandler() {
  return async function optionsHandler() {
    return createCorsPreflightResponse();
  };
}