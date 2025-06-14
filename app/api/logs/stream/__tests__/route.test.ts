// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { enhancedLogger } from '@/lib/logging';
import { responseHelpers } from '@/app/api/__tests__/test-utils';
import { type LogEntry } from '@/lib/logging';

// Mock the enhanced logger
jest.mock('@/lib/logging', () => ({
  enhancedLogger: {
    subscribe: jest.fn(),
  }
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Logs Stream API Route', () => {
  const mockSubscribe = enhancedLogger.subscribe as jest.Mock;
  let mockCallback: (log: LogEntry) => void;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    
    // Capture the callback when subscribe is called
    mockSubscribe.mockImplementation((filter, callback) => {
      mockCallback = callback;
      return { unsubscribe: mockUnsubscribe };
    });
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/logs/stream', () => {
    it('should establish SSE connection and send initial message', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      const response = await GET(request);

      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');

      const events = await responseHelpers.collectSSEEvents(response, 100);
      
      expect(events).toContainEqual({ type: 'connected' });
    });

    it('should subscribe to logs with no filter', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        {},
        expect.any(Function)
      );
    });

    it('should subscribe with level filter', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream?level=error');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        { level: 'error' },
        expect.any(Function)
      );
    });

    it('should subscribe with multiple level filters', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream?level=error,warn');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        { level: ['error', 'warn'] },
        expect.any(Function)
      );
    });

    it('should subscribe with source filter', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream?source=api,websocket');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        { source: ['api', 'websocket'] },
        expect.any(Function)
      );
    });

    it('should subscribe with agent and tool filters', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream?agentName=orchestrator&toolName=chart-control');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        { 
          agentName: 'orchestrator',
          toolName: 'chart-control'
        },
        expect.any(Function)
      );
    });

    it('should subscribe with search filter', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream?search=error%20message');
      await GET(request);

      expect(mockSubscribe).toHaveBeenCalledWith(
        { search: 'error message' },
        expect.any(Function)
      );
    });

    it('should stream log entries when received', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      const response = await GET(request);

      const testLog: LogEntry = {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test log message',
        source: 'test',
        context: {}
      };

      // Simulate log entry
      await mockCallback(testLog);

      const events = await responseHelpers.collectSSEEvents(response, 200);
      
      expect(events).toContainEqual(
        expect.objectContaining({
          id: 'log-1',
          level: 'info',
          message: 'Test log message'
        })
      );
    });

    it('should handle multiple log entries', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      const response = await GET(request);

      const logs: LogEntry[] = [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'First log',
          source: 'test',
          context: {}
        },
        {
          id: 'log-2',
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Second log',
          source: 'test',
          context: {}
        }
      ];

      // Simulate multiple log entries
      for (const log of logs) {
        await mockCallback(log);
      }

      const events = await responseHelpers.collectSSEEvents(response, 200);
      
      // Should have connected event + 2 logs
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events).toContainEqual(expect.objectContaining({ id: 'log-1' }));
      expect(events).toContainEqual(expect.objectContaining({ id: 'log-2' }));
    });

    it('should unsubscribe when client disconnects', async () => {
      const abortController = new AbortController();
      const request = new NextRequest('http://localhost/api/logs/stream', {
        signal: abortController.signal
      });

      await GET(request);
      expect(mockSubscribe).toHaveBeenCalled();

      // Simulate client disconnect
      abortController.abort();

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle write errors gracefully', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      const response = await GET(request);

      // Close the stream to cause write errors
      const reader = response.body!.getReader();
      reader.cancel();

      // This should not throw
      const errorLog: LogEntry = {
        id: 'error-log',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'This will fail to write',
        source: 'test',
        context: {}
      };

      // Should handle the error internally
      await expect(mockCallback(errorLog)).resolves.not.toThrow();
    });
  });
});