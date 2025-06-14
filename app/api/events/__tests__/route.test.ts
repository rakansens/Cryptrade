// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, OPTIONS, broadcastEvent } from '../route';
import { responseHelpers } from '@/app/api/__tests__/test-utils';

// Mock console methods
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Events SSE API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear global client streams
    if (globalThis.__clientStreams) {
      globalThis.__clientStreams.clear();
    }
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('GET /api/events', () => {
    it('should establish SSE connection and send initial connected event', async () => {
      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);

      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');

      // Collect initial events
      const events = await responseHelpers.collectSSEEvents(response, 100);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'connected',
        message: 'SSE connection established',
        timestamp: expect.any(Number)
      });
    });

    it('should add client to global streams collection', async () => {
      expect(globalThis.__clientStreams).toBeUndefined();

      const request = new NextRequest('http://localhost/api/events');
      await GET(request);

      expect(globalThis.__clientStreams).toBeDefined();
      expect(globalThis.__clientStreams.size).toBe(1);
    });

    it('should handle multiple concurrent connections', async () => {
      const requests = [
        new NextRequest('http://localhost/api/events'),
        new NextRequest('http://localhost/api/events'),
        new NextRequest('http://localhost/api/events')
      ];

      const responses = await Promise.all(requests.map(req => GET(req)));

      expect(globalThis.__clientStreams.size).toBe(3);
      
      // All should be SSE streams
      responses.forEach(response => {
        expect(response.headers.get('content-type')).toBe('text/event-stream');
      });
    });

    it('should broadcast events to all connected clients', async () => {
      // Connect multiple clients
      const requests = [
        new NextRequest('http://localhost/api/events'),
        new NextRequest('http://localhost/api/events')
      ];

      const responses = await Promise.all(requests.map(req => GET(req)));

      // Broadcast an event
      const testEvent = {
        type: 'test-event',
        data: { message: 'Hello clients' }
      };

      broadcastEvent(testEvent);

      // Collect events from both streams
      const eventsPromises = responses.map(response => 
        responseHelpers.collectSSEEvents(response, 200)
      );

      const allEvents = await Promise.all(eventsPromises);

      // Each client should receive the initial connected event and the broadcast event
      allEvents.forEach(events => {
        expect(events).toHaveLength(2);
        expect(events[1]).toMatchObject({
          type: 'test-event',
          data: { message: 'Hello clients' },
          timestamp: expect.any(Number)
        });
      });
    });

    it('should handle client disconnection gracefully', async () => {
      const abortController = new AbortController();
      const request = new NextRequest('http://localhost/api/events', {
        signal: abortController.signal
      });

      const response = await GET(request);
      expect(globalThis.__clientStreams.size).toBe(1);

      // Simulate client disconnection
      abortController.abort();

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Client should be removed
      expect(globalThis.__clientStreams.size).toBe(0);
    });

    it('should send heartbeat events', async () => {
      jest.useFakeTimers();

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);

      // Fast forward 31 seconds to trigger heartbeat
      jest.advanceTimersByTime(31000);

      const events = await responseHelpers.collectSSEEvents(response, 100);

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'heartbeat',
          timestamp: expect.any(Number)
        })
      );

      jest.useRealTimers();
    });

    it('should handle broadcast errors gracefully', async () => {
      const request = new NextRequest('http://localhost/api/events');
      await GET(request);

      // Mock a client that throws an error
      const badClient = jest.fn().mockImplementation(() => {
        throw new Error('Client error');
      });
      globalThis.__clientStreams.add(badClient);

      const initialSize = globalThis.__clientStreams.size;

      // Broadcast should remove the bad client
      broadcastEvent({ type: 'test', data: {} });

      expect(globalThis.__clientStreams.size).toBe(initialSize - 1);
      expect(badClient).toHaveBeenCalled();
    });

    it('should handle missing timestamp in broadcast', () => {
      const mockPushEvent = jest.fn();
      globalThis.__clientStreams = new Set([mockPushEvent]);

      broadcastEvent({
        type: 'test-event',
        data: { value: 42 }
      });

      expect(mockPushEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-event',
          data: { value: 42 },
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle broadcast when no clients connected', () => {
      globalThis.__clientStreams = undefined;

      // Should not throw
      expect(() => {
        broadcastEvent({ type: 'test', data: {} });
      }).not.toThrow();
    });
  });

  describe('OPTIONS /api/events', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });
});