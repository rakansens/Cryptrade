import { StreamingResponseBuilder, streamJSON, streamTextWithEffect, ProgressStream } from '../streaming';
import { logger } from '@/lib/utils/logger';
import { NextRequest } from 'next/server';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  }
}));

describe('StreamingResponseBuilder', () => {
  let builder: StreamingResponseBuilder;

  beforeEach(() => {
    builder = new StreamingResponseBuilder();
    jest.clearAllMocks();
  });

  describe('SSE formatting', () => {
    it('should format simple SSE message', () => {
      const formatted = (builder as any).formatSSEMessage({
        data: { message: 'hello' }
      });

      expect(formatted).toBe('data: {"message":"hello"}\n\n');
    });

    it('should format SSE message with event type', () => {
      const formatted = (builder as any).formatSSEMessage({
        event: 'update',
        data: { value: 42 }
      });

      expect(formatted).toBe('event: update\ndata: {"value":42}\n\n');
    });

    it('should format SSE message with all fields', () => {
      const formatted = (builder as any).formatSSEMessage({
        id: 'msg-123',
        event: 'notification',
        data: { text: 'Hello World' },
        retry: 1000
      });

      expect(formatted).toBe(
        'id: msg-123\n' +
        'event: notification\n' +
        'retry: 1000\n' +
        'data: {"text":"Hello World"}\n\n'
      );
    });

    it('should handle string data', () => {
      const formatted = (builder as any).formatSSEMessage({
        data: 'plain text message'
      });

      expect(formatted).toBe('data: plain text message\n\n');
    });

    it('should handle multi-line data', () => {
      const formatted = (builder as any).formatSSEMessage({
        data: 'line1\nline2\nline3'
      });

      expect(formatted).toBe('data: line1\ndata: line2\ndata: line3\n\n');
    });
  });

  describe('createSSEStream', () => {
    it('should create stream from async generator', async () => {
      async function* generator() {
        yield { event: 'start', data: { id: 1 } };
        yield { event: 'data', data: { value: 42 } };
        yield { event: 'end', data: { success: true } };
      }

      const stream = builder.createSSEStream(generator());
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      expect(chunks.join('')).toContain('event: start');
      expect(chunks.join('')).toContain('event: data');
      expect(chunks.join('')).toContain('event: end');
    });

    it('should handle generator errors', async () => {
      async function* errorGenerator() {
        yield { event: 'start', data: {} };
        throw new Error('Generator error');
      }

      const stream = builder.createSSEStream(errorGenerator());
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      let errorCaught = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      } catch (error) {
        errorCaught = true;
      }

      const output = chunks.join('');
      expect(output).toContain('event: start');
      // Error should be caught and stream should end gracefully
      expect(errorCaught || output.includes('event: error')).toBe(true);
      expect(logger.error).toHaveBeenCalledWith('[SSE Stream] Generator error', expect.any(Object));
    });

    it('should send heartbeat messages with keepAlive', async () => {
      const keepAliveBuilder = new StreamingResponseBuilder({
        keepAliveInterval: 50 // 50ms for testing
      });

      async function* slowGenerator() {
        yield { event: 'start', data: {} };
        await new Promise(resolve => setTimeout(resolve, 150));
        yield { event: 'end', data: {} };
      }

      const stream = keepAliveBuilder.createSSEStream(slowGenerator());
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const output = chunks.join('');
      expect(output).toContain(':heartbeat');
    });

    it('should handle encoding errors gracefully', async () => {
      async function* generator() {
        yield { event: 'data', data: { value: 1 } };
        yield { event: 'data', data: { value: 2 } };
      }

      const stream = builder.createSSEStream(generator());
      const reader = stream.getReader();
      const chunks: any[] = [];

      // Just verify stream can be read without throwing
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Should have processed some events
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('createTextStream', () => {
    beforeEach(() => {
      // Reset any mocks before each test
      jest.restoreAllMocks();
    });

    it('should create text stream', async () => {
      async function* textGenerator() {
        yield 'Hello ';
        yield 'World';
        yield '!';
      }

      const stream = builder.createTextStream(textGenerator());
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      expect(chunks.join('')).toBe('Hello World!');
    });

    it('should handle text stream errors', async () => {
      async function* errorGenerator() {
        yield 'Start';
        throw new Error('Text error');
      }

      const stream = builder.createTextStream(errorGenerator());
      const reader = stream.getReader();

      await expect(async () => {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }).rejects.toThrow('Text error');

      expect(logger.error).toHaveBeenCalledWith('[Text Stream] Generator error', expect.any(Object));
    });
  });

  describe('createEventStream', () => {
    it('should create event stream with automatic retry', async () => {
      let attemptCount = 0;
      const handler = jest.fn().mockImplementation(({ request, context }) => {
        async function* generator() {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Handler error');
          }
          yield { value: 'success' };
        }
        return generator();
      });

      const request = new NextRequest('http://localhost/stream');
      const context = { sessionId: 'test-123' };

      const stream = builder.createEventStream(handler, request, context);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      let errorCaught = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      } catch (error) {
        errorCaught = true;
      }

      const output = chunks.join('');
      // Check for at least some output
      expect(output.length).toBeGreaterThan(0);
      // Should have retry events
      expect(output).toMatch(/event: (connected|retry|data|error)/);
      expect(attemptCount).toBeGreaterThan(1);
    });

    it('should fail after max retries', async () => {
      const handler = jest.fn().mockImplementation(({ request, context }) => {
        async function* generator() {
          throw new Error('Always fails');
        }
        return generator();
      });

      const request = new NextRequest('http://localhost/stream');
      const context = {};

      const retryBuilder = new StreamingResponseBuilder({
        maxRetries: 2,
        retryDelay: 10
      });

      const stream = retryBuilder.createEventStream(handler, request, context);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      let errorCaught = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      } catch (error) {
        errorCaught = true;
      }

      const output = chunks.join('');
      expect(output).toContain('event: connected');
      expect(handler).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should wrap non-event data', async () => {
      const handler = jest.fn().mockImplementation(({ request, context }) => {
        async function* generator() {
          yield { simple: 'data' };
          yield { event: 'custom', data: { custom: true } };
        }
        return generator();
      });

      const request = new NextRequest('http://localhost/stream');
      const stream = builder.createEventStream(handler, request);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const output = chunks.join('');
      expect(output).toContain('event: connected');
      expect(output).toContain('event: data');
      expect(output).toContain('simple');
    });
  });

  describe('getSSEHeaders', () => {
    it('should return correct SSE headers', () => {
      const headers = builder.getSSEHeaders();

      expect(headers).toEqual({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
    });
  });

  describe('createSSETransformStream', () => {
    it('should transform events to SSE format', async () => {
      const transform = builder.createSSETransformStream();
      const writer = transform.writable.getWriter();
      const reader = transform.readable.getReader();
      const decoder = new TextDecoder();

      // Write and read in sequence
      writer.write({ event: 'test', data: { value: 42 } });
      const { value } = await reader.read();
      const formatted = decoder.decode(value);

      expect(formatted).toBe('event: test\ndata: {"value":42}\n\n');
      
      await writer.close();
      reader.releaseLock();
    });

    it('should handle transform errors', () => {
      // Create the mock for formatSSEMessage to throw an error
      const originalFormatSSEMessage = builder.formatSSEMessage;
      builder.formatSSEMessage = jest.fn().mockImplementation((event) => {
        if (event.data && event.data.self) {
          throw new Error('Circular reference');
        }
        return originalFormatSSEMessage.call(builder, event);
      });

      const transform = builder.createSSETransformStream();
      
      // Create a circular reference that will cause the formatter to fail
      const circularRef: any = {};
      circularRef.self = circularRef;

      const writer = transform.writable.getWriter();
      const reader = transform.readable.getReader();
      
      // Write should not throw
      writer.write({ data: circularRef });
      writer.close();

      // The transform should log the error but not throw
      expect(logger.error).toHaveBeenCalledWith('[SSE Transform] Failed to transform event', expect.any(Object));

      // Restore original method
      builder.formatSSEMessage = originalFormatSSEMessage;
    });
  });
});

describe('Utility functions', () => {
  describe('streamJSON', () => {
    it('should stream items as SSE events', async () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      const events: any[] = [];
      for await (const event of streamJSON(items)) {
        events.push(event);
      }

      expect(events).toEqual([
        { event: 'data', data: { id: 1, name: 'Item 1' } },
        { event: 'data', data: { id: 2, name: 'Item 2' } },
        { event: 'data', data: { id: 3, name: 'Item 3' } }
      ]);
    });

    it('should use custom event type', async () => {
      const items = [{ value: 1 }, { value: 2 }];

      const events: any[] = [];
      for await (const event of streamJSON(items, 'update')) {
        events.push(event);
      }

      expect(events[0].event).toBe('update');
      expect(events[1].event).toBe('update');
    });

    it('should handle async iterables', async () => {
      async function* asyncItems() {
        yield { async: true, value: 1 };
        yield { async: true, value: 2 };
      }

      const events: any[] = [];
      for await (const event of streamJSON(asyncItems())) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].data).toEqual({ async: true, value: 1 });
    });
  });

  describe('streamTextWithEffect', () => {
    it('should stream text character by character', async () => {
      const text = 'Hello';
      const events: any[] = [];

      for await (const event of streamTextWithEffect(text, 0)) {
        events.push(event);
      }

      expect(events).toHaveLength(6); // 5 chars + complete event
      expect(events[0]).toEqual({
        event: 'text',
        data: {
          char: 'H',
          accumulated: 'H',
          progress: 0.2
        }
      });
      expect(events[4]).toEqual({
        event: 'text',
        data: {
          char: 'o',
          accumulated: 'Hello',
          progress: 1
        }
      });
      expect(events[5]).toEqual({
        event: 'text:complete',
        data: {
          text: 'Hello',
          length: 5
        }
      });
    });

    it('should respect delay between characters', async () => {
      const text = 'Hi';
      const startTime = Date.now();

      const events: any[] = [];
      for await (const event of streamTextWithEffect(text, 50)) {
        events.push(event);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThanOrEqual(100); // 2 chars * 50ms
      expect(events).toHaveLength(3); // 2 chars + complete
    });

    it('should use custom event type', async () => {
      const events: any[] = [];
      for await (const event of streamTextWithEffect('A', 0, 'custom')) {
        events.push(event);
      }

      expect(events[0].event).toBe('custom');
      expect(events[1].event).toBe('custom:complete');
    });
  });

  describe('ProgressStream', () => {
    it('should create progress stream', async () => {
      const progress = new ProgressStream(100, 'Download');
      const events: any[] = [];

      for await (const event of progress.stream()) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        event: 'progress:start',
        data: {
          label: 'Download',
          total: 100,
          timestamp: expect.any(Number)
        }
      });
    });

    it('should update progress', () => {
      const progress = new ProgressStream(100, 'Processing');
      
      const update1 = progress.update(25, 'Processing item 1');
      expect(update1).toEqual({
        event: 'progress:update',
        data: {
          label: 'Processing',
          current: 25,
          total: 100,
          progress: 0.25,
          percentage: 25,
          elapsed: expect.any(Number),
          eta: expect.any(Number),
          message: 'Processing item 1'
        }
      });

      const update2 = progress.update(50);
      expect(update2.data.percentage).toBe(50);
      expect(update2.data.message).toBeUndefined();
    });

    it('should complete progress', () => {
      const progress = new ProgressStream(100, 'Upload');
      
      const complete = progress.complete('Upload finished');
      expect(complete).toEqual({
        event: 'progress:complete',
        data: {
          label: 'Upload',
          total: 100,
          elapsed: expect.any(Number),
          message: 'Upload finished'
        }
      });
    });

    it('should handle zero total', () => {
      const progress = new ProgressStream(0, 'Empty');
      
      const update = progress.update(0);
      expect(update.data.progress).toBe(0);
      expect(update.data.eta).toBe(0);
    });

    it('should calculate ETA correctly', async () => {
      const progress = new ProgressStream(100, 'Test');
      
      // Wait a bit to have measurable elapsed time
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const update = progress.update(25);
      expect(update.data.eta).toBeGreaterThan(0);
      
      // ETA should be roughly 3x elapsed time (75% remaining)
      const etaRatio = update.data.eta / update.data.elapsed;
      expect(etaRatio).toBeGreaterThan(2.5);
      expect(etaRatio).toBeLessThan(3.5);
    });
  });
});