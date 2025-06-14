/**
 * Log Streaming API Endpoint
 * 
 * Server-Sent Events for real-time log streaming
 */

import { NextRequest } from 'next/server';
import { enhancedLogger } from '@/lib/logs/enhanced-logger';
import { LogFilter, LogEntry, LogLevel } from '@/lib/logs/types';

/**
 * GET /api/logs/stream - Stream logs in real-time
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Build filter from query parameters
  const filter: LogFilter = {};
  
  // Level filter
  const level = searchParams.get('level');
  if (level) {
    filter.level = level.includes(',') 
      ? level.split(',') as LogLevel[] 
      : level as LogLevel;
  }
  
  // Source filter
  const source = searchParams.get('source');
  if (source) {
    filter.source = source.includes(',') ? source.split(',') : source;
  }
  
  // Agent/Tool filters
  if (searchParams.has('agentName')) filter.agentName = searchParams.get('agentName')!;
  if (searchParams.has('toolName')) filter.toolName = searchParams.get('toolName')!;
  
  // Search filter
  if (searchParams.has('search')) filter.search = searchParams.get('search')!;
  
  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Subscribe to logs
  const subscription = enhancedLogger.subscribe(filter, async (log: LogEntry) => {
    try {
      const data = JSON.stringify(log);
      const message = `data: ${data}\n\n`;
      await writer.write(encoder.encode(message));
    } catch (error) {
      console.error('[Log Stream] Write error:', error);
    }
  });
  
  // Cleanup on disconnect
  request.signal.addEventListener('abort', () => {
    subscription.unsubscribe();
    writer.close().catch(() => {});
  });
  
  // Send initial connection message
  writer.write(encoder.encode('data: {"type":"connected"}\n\n')).catch(() => {});
  
  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}