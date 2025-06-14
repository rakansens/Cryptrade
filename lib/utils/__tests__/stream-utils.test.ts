import { streamToLines } from '../stream-utils';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  }
}));

describe('stream-utils', () => {
  describe('streamToLines', () => {
    function createMockResponse(chunks: string[]): Response {
      const encoder = new TextEncoder();
      let index = 0;
      
      const stream = new ReadableStream({
        start(controller) {
          function push() {
            if (index < chunks.length) {
              controller.enqueue(encoder.encode(chunks[index]));
              index++;
              // Use setTimeout to simulate async behavior
              setTimeout(push, 10);
            } else {
              controller.close();
            }
          }
          push();
        }
      });

      return {
        body: stream,
        headers: new Headers(),
        ok: true,
        redirected: false,
        status: 200,
        statusText: 'OK',
        type: 'basic',
        url: '',
        clone: jest.fn(),
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        json: jest.fn(),
        text: jest.fn(),
      } as unknown as Response;
    }

    it('should yield lines from a streaming response', async () => {
      const response = createMockResponse([
        'line1\n',
        'line2\n',
        'line3'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual(['line1', 'line2']);
    });

    it('should remove data: prefix by default', async () => {
      const response = createMockResponse([
        'data: {"event": "start"}\n',
        'data: {"event": "data"}\n',
        '\n',
        'data: {"event": "end"}\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual([
        '{"event": "start"}',
        '{"event": "data"}',
        '{"event": "end"}'
      ]);
    });

    it('should keep data: prefix when removeDataPrefix is false', async () => {
      const response = createMockResponse([
        'data: {"event": "start"}\n',
        'data: {"event": "end"}\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response, { removeDataPrefix: false })) {
        lines.push(line);
      }

      expect(lines).toEqual([
        'data: {"event": "start"}',
        'data: {"event": "end"}'
      ]);
    });

    it('should handle multi-byte characters correctly', async () => {
      const response = createMockResponse([
        'data: こんにちは\n',
        'data: 世界\n',
        'data: 🌍🚀\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual(['こんにちは', '世界', '🌍🚀']);
    });

    it('should skip empty lines', async () => {
      const response = createMockResponse([
        'line1\n',
        '\n',
        'line2\n',
        '   \n',
        'line3\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle chunks that split across lines', async () => {
      const response = createMockResponse([
        'data: part',
        'ial line 1\n',
        'data: line ',
        '2\ndata: li',
        'ne 3\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual(['partial line 1', 'line 2', 'line 3']);
    });

    it('should handle SSE format with various prefixes', async () => {
      const response = createMockResponse([
        'event: start\n',
        'data: {"type": "init"}\n',
        'id: 123\n',
        ':heartbeat\n',
        'data: {"type": "update"}\n',
        'event: end\n'
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(lines).toEqual([
        'event: start',
        '{"type": "init"}',
        'id: 123',
        ':heartbeat',
        '{"type": "update"}',
        'event: end'
      ]);
    });

    it('should throw error if response body is not readable', async () => {
      const response = {
        body: null
      } as Response;

      await expect(async () => {
        const lines: string[] = [];
        for await (const line of streamToLines(response)) {
          lines.push(line);
        }
      }).rejects.toThrow('Response body is not readable');
    });

    it('should handle stream errors gracefully', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('line1\n'));
          // Simulate an error after first chunk
          setTimeout(() => {
            controller.error(new Error('Stream error'));
          }, 10);
        }
      });

      const response = {
        body: stream
      } as Response;

      const lines: string[] = [];
      await expect(async () => {
        for await (const line of streamToLines(response)) {
          lines.push(line);
        }
      }).rejects.toThrow('Stream error');

      expect(lines).toEqual(['line1']);
      expect(logger.error).toHaveBeenCalledWith(
        '[stream-utils] streamToLines failed',
        { error: 'Error: Stream error' }
      );
    });

    it('should release reader lock on completion', async () => {
      const response = createMockResponse(['line1\n', 'line2\n']);
      const releaseLockSpy = jest.fn();
      
      // Override getReader to spy on releaseLock
      const originalGetReader = response.body!.getReader;
      response.body!.getReader = function() {
        const reader = originalGetReader.call(this);
        const originalReleaseLock = reader.releaseLock;
        reader.releaseLock = function() {
          releaseLockSpy();
          return originalReleaseLock.call(this);
        };
        return reader;
      };

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      expect(releaseLockSpy).toHaveBeenCalledTimes(1);
    });

    it('should release reader lock on error', async () => {
      const encoder = new TextEncoder();
      const releaseLockSpy = jest.fn();
      
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('line1\n'));
          setTimeout(() => {
            controller.error(new Error('Test error'));
          }, 10);
        }
      });

      const response = {
        body: stream
      } as Response;

      // Override getReader to spy on releaseLock
      const originalGetReader = response.body!.getReader;
      response.body!.getReader = function() {
        const reader = originalGetReader.call(this);
        const originalReleaseLock = reader.releaseLock;
        reader.releaseLock = function() {
          releaseLockSpy();
          return originalReleaseLock.call(this);
        };
        return reader;
      };

      await expect(async () => {
        const lines: string[] = [];
        for await (const line of streamToLines(response)) {
          lines.push(line);
        }
      }).rejects.toThrow('Test error');

      expect(releaseLockSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle incomplete last line', async () => {
      const response = createMockResponse([
        'line1\n',
        'line2\n',
        'incomplete' // No newline at the end
      ]);

      const lines: string[] = [];
      for await (const line of streamToLines(response)) {
        lines.push(line);
      }

      // Only complete lines should be yielded
      expect(lines).toEqual(['line1', 'line2']);
    });
  });
});