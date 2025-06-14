/**
 * Log Streaming API Endpoint
 *
 * Server-Sent Events for real-time log streaming
 */

import { enhancedLogger, type LogFilter, type LogEntry, type LogLevel } from '@/lib/logging';
import { createSSEHandler, createSSEOptionsHandler } from '@/lib/api/create-sse-handler';

export const GET = createSSEHandler({
  handler: {
    onConnect({ request, stream }) {
      const { searchParams } = new URL(request.url);
      const filter: LogFilter = {};

      const level = searchParams.get('level');
      if (level) {
        filter.level = level.includes(',') ? level.split(',') as LogLevel[] : level as LogLevel;
      }

      const source = searchParams.get('source');
      if (source) {
        filter.source = source.includes(',') ? source.split(',') : source;
      }

      if (searchParams.has('agentName')) filter.agentName = searchParams.get('agentName')!;
      if (searchParams.has('toolName')) filter.toolName = searchParams.get('toolName')!;
      if (searchParams.has('search')) filter.search = searchParams.get('search')!;

      const subscription = enhancedLogger.subscribe(filter, (log: LogEntry) => {
        stream.write({ data: log });
      });

      off = () => subscription.unsubscribe();
    },
    onDisconnect() {
      off();
    }
  },
  cors: { origin: '*' }
});

let off: () => void = () => {};

export const OPTIONS = createSSEOptionsHandler({ origin: '*' });
