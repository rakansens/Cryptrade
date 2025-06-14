// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { GET, OPTIONS, broadcastEvent, eventBroadcast } from '../route';
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
    eventBroadcast.close();
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
        event: 'connected',
        data: {
          message: 'SSE connection established',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should register subscriber', async () => {
      expect(eventBroadcast.getSubscriberCount()).toBe(0);

      const request = new NextRequest('http://localhost/api/events');
      await GET(request);

      expect(eventBroadcast.getSubscriberCount()).toBe(1);
    });

    it('should handle multiple concurrent connections', async () => {
      const requests = [
        new NextRequest('http://localhost/api/events'),
        new NextRequest('http://localhost/api/events'),
        new NextRequest('http://localhost/api/events')
      ];

      const responses = await Promise.all(requests.map(req => GET(req)));

      expect(eventBroadcast.getSubscriberCount()).toBe(3);

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
      expect(eventBroadcast.getSubscriberCount()).toBe(1);

      // Simulate client disconnection
      abortController.abort();

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Client should be removed
      expect(eventBroadcast.getSubscriberCount()).toBe(0);
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
          event: 'heartbeat',
          data: expect.objectContaining({ timestamp: expect.any(Number) })
        })
      );

      jest.useRealTimers();
    });

    it('should handle broadcast errors gracefully', async () => {
      const request = new NextRequest('http://localhost/api/events');
      await GET(request);

      const badStream = {
        write: jest.fn(() => { throw new Error('Client error'); }),
        close: jest.fn(),
        get isClosed() { return false; }
      };
      eventBroadcast.subscribe(badStream);

      const initialSize = eventBroadcast.getSubscriberCount();

      broadcastEvent({ type: 'test', data: {} });

      expect(eventBroadcast.getSubscriberCount()).toBe(initialSize - 1);
      expect(badStream.write).toHaveBeenCalled();
    });

    it('should handle missing timestamp in broadcast', () => {
      const mockStream = {
        write: jest.fn(),
        close: jest.fn(),
        get isClosed() { return false; }
      };
      eventBroadcast.subscribe(mockStream);

      broadcastEvent({ type: 'test-event', data: { value: 42 } });

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'test-event',
            data: { value: 42 },
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should handle broadcast when no clients connected', () => {
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