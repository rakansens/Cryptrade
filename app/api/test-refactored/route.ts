import { createApiHandler, createStreamingHandler, createOptionsHandler } from '@/lib/api/create-api-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

// Schema definition
const TestRequestSchema = z.object({
  message: z.string().min(1).max(100),
  type: z.enum(['echo', 'reverse', 'uppercase']).optional().default('echo'),
});

// Regular API handler
export const POST = createApiHandler({
  schema: TestRequestSchema,
  rateLimitOptions: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  handler: async ({ data, context }) => {
    // Process based on type
    let result: string;
    switch (data.type) {
      case 'reverse':
        result = data.message.split('').reverse().join('');
        break;
      case 'uppercase':
        result = data.message.toUpperCase();
        break;
      case 'echo':
      default:
        result = data.message;
    }

    return {
      original: data.message,
      processed: result,
      type: data.type,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
    };
  },
});

// Streaming handler
export const GET = createStreamingHandler({
  streamHandler: async function* ({ request, context }) {
    const searchParams = new URL(request.url).searchParams;
    const count = parseInt(searchParams.get('count') || '5');
    
    if (count < 1 || count > 100) {
      throw new ValidationError('Count must be between 1 and 100');
    }

    yield { event: 'start', data: { count, timestamp: Date.now() } };

    for (let i = 1; i <= count; i++) {
      yield {
        event: 'count',
        data: {
          current: i,
          total: count,
          progress: i / count,
        },
      };
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    yield { event: 'complete', data: { finalCount: count, timestamp: Date.now() } };
  },
});

// OPTIONS handler for CORS
export const OPTIONS = createOptionsHandler();