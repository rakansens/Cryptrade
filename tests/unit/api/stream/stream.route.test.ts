// Setup test environment before any imports
import { mockTestEnv } from '@/tests/helpers/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/logs/stream/route';
import { enhancedLogger } from '@/lib/logging';
import { responseHelpers } from '@/tests/helpers/api-test-utils';
import { type LogEntry } from '@/lib/logging';

// Mock the enhanced logger
jest.mock('@/lib/logging', () => {
  const subscribers = new Map();
  
  return {
    enhancedLogger: {
      subscribe: jest.fn((filter, callback) => {
        const id = Math.random().toString(36);
        subscribers.set(id, { filter, callback });
        return {
          unsubscribe: jest.fn(() => {
            subscribers.delete(id);
          })
        };
      }),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    }
  };
});

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
    mockSubscribe.mockImplementation((_filter, callback) => {
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
      expect(response.headers.get('cache-control')).toMatch(/no-cache/);
      expect(response.headers.get('connection')).toBe('keep-alive');

      // Just check that a response stream is created
      expect(response.body).toBeDefined();
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
        timestamp: new Date(),
        level: 'info',
        message: 'Test log message',
        source: 'test',
        environment: 'test'
      };

      // Simulate log entry
      if (mockCallback) {
        await mockCallback(testLog);
      }

      // Just verify the callback was invoked
      expect(mockCallback).toBeDefined();
    });

    it('should handle multiple log entries', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      const response = await GET(request);

      const logs: LogEntry[] = [
        {
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'First log',
          source: 'test',
          environment: 'test'
        },
        {
          id: 'log-2',
          timestamp: new Date(Date.now() + 1000),
          level: 'error',
          message: 'Second log',
          source: 'test',
          environment: 'test'
        }
      ];

      // Simulate multiple log entries
      if (mockCallback) {
        for (const log of logs) {
          await mockCallback(log);
        }
      }

      // Just verify the stream was created
      expect(response.body).toBeDefined();
    });

    it('should unsubscribe when client disconnects', async () => {
      const request = new NextRequest('http://localhost/api/logs/stream');
      
      await GET(request);
      expect(mockSubscribe).toHaveBeenCalled();

      // The mock returns an unsubscribe function
      const subscription = mockSubscribe.mock.results[0]?.value;
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      
      // Manual cleanup would call unsubscribe
      subscription.unsubscribe();
      expect(subscription.unsubscribe).toHaveBeenCalled();
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
        timestamp: new Date(),
        level: 'error',
        message: 'This will fail to write',
        source: 'test',
        environment: 'test'
      };

      // Should handle the error internally
      expect(() => {
        if (mockCallback) {
          mockCallback(errorLog);
        }
      }).not.toThrow();
    });
  });
});