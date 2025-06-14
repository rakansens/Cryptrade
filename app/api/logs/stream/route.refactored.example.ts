/**
 * Example: Refactored Log Streaming API using the new streaming utilities
 * 
 * This demonstrates how to use the StreamingResponseBuilder for SSE endpoints
 */

import { createStreamingHandler } from '@/lib/api/create-api-handler';
import { StreamingResponseBuilder, streamJSON } from '@/lib/api/streaming';
import { z } from 'zod';
import { enhancedLogger } from '@/lib/logs/enhanced-logger';
import { LogFilter, LogEntry, LogLevel } from '@/lib/logs/types';

// Define query parameters schema
const LogStreamQuerySchema = z.object({
  level: z.string().optional(),
  source: z.string().optional(),
  agentName: z.string().optional(),
  toolName: z.string().optional(),
  search: z.string().optional(),
});

type LogStreamQuery = z.infer<typeof LogStreamQuerySchema>;

// Create streaming GET handler
export const GET = createStreamingHandler<LogStreamQuery>({
  schema: LogStreamQuerySchema,
  
  streamHandler: async function* ({ data, request, context }) {
    // Build filter from validated query parameters
    const filter: LogFilter = {};
    
    if (data.level) {
      filter.level = data.level.includes(',') 
        ? data.level.split(',') as LogLevel[] 
        : data.level as LogLevel;
    }
    
    if (data.source) {
      filter.source = data.source.includes(',') 
        ? data.source.split(',') 
        : data.source;
    }
    
    if (data.agentName) filter.agentName = data.agentName;
    if (data.toolName) filter.toolName = data.toolName;
    if (data.search) filter.search = data.search;
    
    // Send connection event
    yield {
      event: 'connected',
      data: {
        timestamp: Date.now(),
        filter,
      },
    };
    
    // Set up log subscription
    const logs: LogEntry[] = [];
    let closed = false;
    
    const subscription = enhancedLogger.subscribe(filter, (log: LogEntry) => {
      if (!closed) {
        logs.push(log);
      }
    });
    
    // Clean up on abort
    request.signal.addEventListener('abort', () => {
      closed = true;
      subscription.unsubscribe();
    });
    
    try {
      // Stream logs as they arrive
      while (!closed) {
        if (logs.length > 0) {
          const batch = logs.splice(0, logs.length);
          for (const log of batch) {
            yield {
              event: 'log',
              data: log,
            };
          }
        }
        
        // Small delay to prevent busy waiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      subscription.unsubscribe();
    }
  },
});

/**
 * Alternative implementation using StreamingResponseBuilder directly
 */
export async function GET_ALTERNATIVE(request: Request) {
  const builder = new StreamingResponseBuilder({
    keepAliveInterval: 30000, // 30 second heartbeat
  });
  
  const { searchParams } = new URL(request.url);
  
  // Build filter
  const filter: LogFilter = {};
  // ... same filter building logic ...
  
  // Create event generator
  const eventGenerator = async function* () {
    yield {
      event: 'connected',
      data: { timestamp: Date.now(), filter },
    };
    
    const logs: LogEntry[] = [];
    let closed = false;
    
    const subscription = enhancedLogger.subscribe(filter, (log: LogEntry) => {
      if (!closed) {
        logs.push(log);
      }
    });
    
    request.signal.addEventListener('abort', () => {
      closed = true;
      subscription.unsubscribe();
    });
    
    try {
      while (!closed) {
        if (logs.length > 0) {
          const batch = logs.splice(0, logs.length);
          yield* streamJSON(batch, 'log');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      subscription.unsubscribe();
    }
  };
  
  // Create SSE stream
  const stream = builder.createSSEStream(eventGenerator());
  
  return new Response(stream, {
    headers: builder.getSSEHeaders(),
  });
}

/**
 * Benefits of using the streaming utilities:
 * 
 * 1. **Automatic SSE Formatting**: Properly formatted SSE messages
 * 2. **Keep-Alive Handling**: Automatic heartbeat to prevent disconnections
 * 3. **Error Handling**: Graceful error events sent to client
 * 4. **Type Safety**: Full TypeScript support for events
 * 5. **Clean Abstraction**: Focus on business logic, not SSE details
 */