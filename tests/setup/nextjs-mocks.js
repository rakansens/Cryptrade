// tests/setup/nextjs-mocks.js
// Next.js specific mocks for test environment

// Mock Next.js specific modules for API routes
jest.mock('next/server', () => {
  class MockNextRequest {
    constructor(url, init) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers || {});
      this.nextUrl = new URL(url);
      
      // Mock body parsing methods
      this.json = jest.fn().mockImplementation(async () => {
        if (init?.body) {
          try {
            return JSON.parse(init.body);
          } catch {
            throw new Error('Invalid JSON');
          }
        }
        return {};
      });
      
      this.text = jest.fn().mockResolvedValue(init?.body || '');
      this.formData = jest.fn().mockResolvedValue(new FormData());
    }
  }
  
  class MockNextResponse {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Headers(init?.headers || {});
      
      // Mock response methods
      this.json = jest.fn().mockImplementation(async () => {
        if (typeof this.body === 'string') {
          try {
            return JSON.parse(this.body);
          } catch {
            return this.body;
          }
        }
        return this.body;
      });
      
      this.text = jest.fn().mockResolvedValue(
        typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
      );
    }
  }
  
  MockNextResponse.json = jest.fn((data, init) => {
    return new MockNextResponse(data, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
  });
  
  MockNextResponse.error = jest.fn(() => {
    return new MockNextResponse(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  });
  
  MockNextResponse.redirect = jest.fn((url, status = 307) => {
    return new MockNextResponse(null, {
      status,
      headers: { Location: url },
    });
  });
  
  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

// Mock API handler creation utilities
jest.mock('@/lib/api/create-api-handler', () => {
  const { z } = require('zod');
  
  return {
    createApiHandler: jest.fn((config) => {
      return jest.fn(async (request) => {
        try {
          // Apply middleware if provided
          if (config.middleware) {
            const middlewares = Array.isArray(config.middleware) ? config.middleware : [config.middleware];
            for (const middleware of middlewares) {
              const response = await middleware(request);
              if (response) {
                return response; // Middleware returned early response
              }
            }
          }
          
          // Parse request data
          let data = {};
          if (request.method === 'GET' || request.method === 'HEAD') {
            // For GET requests, parse query params
            const searchParams = new URL(request.url).searchParams;
            const queryData = {};
            searchParams.forEach((value, key) => {
              queryData[key] = value;
            });
            data = queryData;
          } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE') {
            try {
              data = await request.json();
            } catch {
              // Ignore JSON parsing errors in tests
            }
          }
          
          // Validate with schema if provided
          if (config.schema) {
            try {
              data = config.schema.parse(data);
            } catch (error) {
              if (error instanceof z.ZodError) {
                return new (require('next/server').NextResponse)(
                  JSON.stringify({ 
                    error: { 
                      message: 'Invalid query parameters',
                      errors: error.errors 
                    },
                    timestamp: new Date().toISOString()
                  }),
                  { status: 400 }
                );
              }
              throw error;
            }
          }
          
          // Extract session ID from headers
          const sessionId = request.headers.get('x-session-id');
          
          // Call the handler
          const result = await config.handler({
            data,
            request,
            context: {
              sessionId,
              headers: Object.fromEntries(request.headers.entries()),
            },
          });
          
          // Wrap result in success response format
          const successResponse = {
            success: true,
            ...(result !== undefined && { data: result }),
            timestamp: new Date().toISOString(),
          };
          
          // Return NextResponse
          return new (require('next/server').NextResponse)(
            JSON.stringify(successResponse),
            { 
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          );
        } catch (error) {
          // Handle different error types
          let status = 500;
          let errorResponse = { error: { message: error.message || 'Internal server error' } };
          
          // Check for specific error types
          if (error.constructor.name === 'AuthError' || error.message?.includes('Unauthorized')) {
            status = 401;
          } else if (error.constructor.name === 'ValidationError') {
            status = 400;
            // ValidationError from base-error.ts has field and value in data property
            if (error.data && error.data.field) {
              errorResponse = { 
                error: { 
                  message: error.message,
                  field: error.data.field,
                  value: error.data.value 
                },
                message: error.message,
                timestamp: new Date().toISOString()
              };
            } else {
              // ValidationError from error-handler.ts
              errorResponse = { 
                error: { 
                  message: error.message
                },
                message: error.message,
                timestamp: new Date().toISOString()
              };
            }
          } else if (error.constructor.name === 'ApiError') {
            // ApiError stores statusCode in data field
            status = (error.data && error.data.statusCode) || error.statusCode || 500;
            
            // Extract retryable and other properties from error
            const errorObject = {
              message: error.message,
              ...(error.retryable !== undefined && { retryable: error.retryable }),
              ...(error.context !== undefined && { context: error.context }),
            };
            
            errorResponse = { 
              error: errorObject,
              timestamp: new Date().toISOString()
            };
          } else {
            // Generic error
            errorResponse = { 
              error: { message: error.message || 'Internal server error' },
              timestamp: new Date().toISOString()
            };
          }
          
          return new (require('next/server').NextResponse)(
            JSON.stringify(errorResponse),
            { status }
          );
        }
      });
    }),
  createOptionsHandler: jest.fn(() => {
    return jest.fn(async () => {
      return new (require('next/server').NextResponse)(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    });
  }),
  createStreamingHandler: jest.fn((config) => {
    return jest.fn(async (request) => {
      try {
        // Parse request data
        let data = {};
        if (request.method === 'POST' || request.method === 'PUT') {
          try {
            data = await request.json();
          } catch {
            // Ignore JSON parsing errors in tests
          }
        }
        
        // Validate with schema if provided
        if (config.schema) {
          data = config.schema.parse(data);
        }
        
        // Call the stream handler
        const context = {
          sessionId: request.headers.get('x-session-id'),
          headers: Object.fromEntries(request.headers.entries()),
        };
        
        const stream = config.streamHandler({ data, request, context });
        
        // Create a mock SSE response
        return new Response(new ReadableStream({
          async start(controller) {
            try {
              if (stream instanceof ReadableStream) {
                // Handle ReadableStream directly
                const reader = stream.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(value);
                }
              } else {
                // Handle AsyncGenerator
                for await (const chunk of stream) {
                  const data = typeof chunk === 'string'
                    ? chunk
                    : `data: ${JSON.stringify(chunk)}\\n\\n`;
                  controller.enqueue(new TextEncoder().encode(data));
                }
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        }), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error) {
        // Return error response
        return new (require('next/server').NextResponse)(
          JSON.stringify({ error: { message: error.message } }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    });
  }),
  };
});

// Mock SSE handler utilities
jest.mock('@/lib/api/create-sse-handler', () => {
  const mockSSEStream = {
    write: jest.fn(),
    close: jest.fn(),
    isClosed: false,
  };

  class MockSSEBroadcast {
    constructor() {
      this.subscribers = new Set();
      this.messageHistory = [];
    }
    
    subscribe(stream) {
      this.subscribers.add(stream);
      return () => {
        this.subscribers.delete(stream);
      };
    }
    
    broadcast(message) {
      this.messageHistory.push(message);
      for (const stream of this.subscribers) {
        if (!stream.isClosed) {
          stream.write(message);
        }
      }
    }
    
    getSubscriberCount() {
      return this.subscribers.size;
    }
    
    close() {
      for (const stream of this.subscribers) {
        if (!stream.isClosed) {
          stream.close();
        }
      }
      this.subscribers.clear();
      this.messageHistory = [];
    }
  }

  return {
    SSEBroadcast: MockSSEBroadcast,
    createSSEHandler: jest.fn((config) => {
      return jest.fn(async (request) => {
        // Create a mock response for SSE
        const stream = new ReadableStream({
          start(controller) {
            const sseStream = { ...mockSSEStream };
            
            // Call onConnect if provided
            if (config.handler.onConnect) {
              config.handler.onConnect({
                request,
                data: {},
                stream: sseStream,
              });
            }
            
            // Send initial connected event
            const message = JSON.stringify({
              event: 'connected',
              data: {
                message: 'SSE connection established',
                timestamp: Date.now(),
              },
            });
            controller.enqueue(`event: connected\\ndata: ${message}\\n\\n`);
          },
        });
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      });
    }),
    createSSEOptionsHandler: jest.fn(() => {
      return jest.fn(async () => {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Origin': '*',
          },
        });
      });
    }),
  };
});