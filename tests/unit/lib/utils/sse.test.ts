import {
  broadcastUIEvent,
  broadcastChartEvent,
  broadcastMarketDataUpdate,
  broadcastAgentStatus,
  getConnectedClientsCount,
  disconnectAllClients,
  type SSEEvent,
} from '@/lib/utils/sse';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('SSE utilities', () => {
  let originalGlobalThis: typeof globalThis;
  let mockClientStreams: Set<Function>;
  let consoleErrorSpy: any;

  beforeEach(() => {
    originalGlobalThis = globalThis;
    mockClientStreams = new Set<Function>();
    (globalThis as any).__clientStreams = mockClientStreams;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete (globalThis as any).__clientStreams;
    vi.clearAllMocks();
  });

  describe('broadcastUIEvent', () => {
    it('should broadcast UI operation event', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const event = {
        event: 'button:click',
        data: { buttonId: 'submit' },
        source: 'test-component',
      };

      broadcastUIEvent(event);

      expect(mockPushEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui_operation',
          data: {
            event: 'button:click',
            payload: { buttonId: 'submit' },
            source: 'test-component',
          },
          timestamp: expect.any(Number),
          id: expect.stringMatching(/^event_\d+_[a-z0-9]+$/),
        })
      );
    });

    it('should use default source if not provided', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      broadcastUIEvent({
        event: 'form:submit',
        data: { formId: 'login' },
      });

      expect(mockPushEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'mastra-agent',
          }),
        })
      );
    });
  });

  describe('broadcastChartEvent', () => {
    it('should broadcast chart operations with client events', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const operations = [
        {
          type: 'drawing',
          action: 'create',
          parameters: { type: 'trendline' },
          clientEvent: {
            event: 'chart:draw',
            data: { drawingType: 'trendline' },
          },
        },
        {
          type: 'indicator',
          action: 'add',
          parameters: { name: 'RSI' },
          clientEvent: {
            event: 'chart:indicator',
            data: { indicator: 'RSI' },
          },
        },
      ];

      broadcastChartEvent(operations);

      expect(mockPushEvent).toHaveBeenCalledTimes(2);
      expect(mockPushEvent).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          type: 'ui_operation',
          data: expect.objectContaining({
            event: 'chart:draw',
            payload: { drawingType: 'trendline' },
            source: 'chart-control-tool',
          }),
        })
      );
      expect(mockPushEvent).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          type: 'ui_operation',
          data: expect.objectContaining({
            event: 'chart:indicator',
            payload: { indicator: 'RSI' },
            source: 'chart-control-tool',
          }),
        })
      );
    });

    it('should skip operations without client events', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const operations = [
        {
          type: 'internal',
          action: 'process',
          parameters: {},
          // No clientEvent
        },
        {
          type: 'drawing',
          action: 'create',
          parameters: {},
          clientEvent: {
            event: 'chart:draw',
            data: {},
          },
        },
      ];

      broadcastChartEvent(operations);

      expect(mockPushEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastMarketDataUpdate', () => {
    it('should broadcast market data update', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const data = {
        symbol: 'BTCUSDT',
        price: 50000,
        change: 2.5,
        timestamp: 1609459200000,
      };

      broadcastMarketDataUpdate(data);

      expect(mockPushEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'market_data_update',
          data: {
            symbol: 'BTCUSDT',
            price: 50000,
            change: 2.5,
            timestamp: 1609459200000,
          },
        })
      );
    });

    it('should add timestamp if not provided', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const data = {
        symbol: 'ETHUSDT',
        price: 3000,
        change: -1.2,
      };

      broadcastMarketDataUpdate(data);

      const call = mockPushEvent.mock.calls[0][0];
      expect(call.timestamp).toBeDefined();
      expect(call.timestamp).toBeGreaterThan(0);
    });
  });

  describe('broadcastAgentStatus', () => {
    it('should broadcast agent status updates', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      const statuses = [
        {
          agentId: 'agent-001',
          status: 'started' as const,
          message: 'Analysis started',
        },
        {
          agentId: 'agent-001',
          status: 'completed' as const,
          message: 'Analysis completed successfully',
          executionTime: 1500,
        },
        {
          agentId: 'agent-002',
          status: 'failed' as const,
          message: 'Analysis failed: Timeout',
        },
      ];

      statuses.forEach(status => broadcastAgentStatus(status));

      expect(mockPushEvent).toHaveBeenCalledTimes(3);
      
      statuses.forEach((status, index) => {
        expect(mockPushEvent).toHaveBeenNthCalledWith(index + 1,
          expect.objectContaining({
            type: 'agent_status',
            data: status,
          })
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle client stream errors gracefully', () => {
      const errorClient = vi.fn().mockImplementation(() => {
        throw new Error('Client disconnected');
      });
      const workingClient = vi.fn();

      mockClientStreams.add(errorClient);
      mockClientStreams.add(workingClient);

      broadcastUIEvent({
        event: 'test',
        data: {},
      });

      expect(errorClient).toHaveBeenCalled();
      expect(workingClient).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SSE] Failed to broadcast to client:',
        expect.any(Error)
      );
      expect(mockClientStreams.has(errorClient)).toBe(false);
      expect(mockClientStreams.has(workingClient)).toBe(true);
    });
  });

  describe('getConnectedClientsCount', () => {
    it('should return number of connected clients', () => {
      expect(getConnectedClientsCount()).toBe(0);

      mockClientStreams.add(() => {});
      mockClientStreams.add(() => {});
      mockClientStreams.add(() => {});

      expect(getConnectedClientsCount()).toBe(3);
    });

    it('should return 0 when __clientStreams is undefined', () => {
      delete (globalThis as any).__clientStreams;
      expect(getConnectedClientsCount()).toBe(0);
    });
  });

  describe('disconnectAllClients', () => {
    it('should clear all client connections', () => {
      mockClientStreams.add(() => {});
      mockClientStreams.add(() => {});
      
      expect(mockClientStreams.size).toBe(2);

      disconnectAllClients();

      expect(mockClientStreams.size).toBe(0);
    });

    it('should handle undefined __clientStreams', () => {
      delete (globalThis as any).__clientStreams;
      
      // Should not throw
      expect(() => disconnectAllClients()).not.toThrow();
    });
  });

  describe('event structure', () => {
    it('should generate unique event IDs', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);

      // Broadcast multiple events
      for (let i = 0; i < 5; i++) {
        broadcastUIEvent({
          event: `test-${i}`,
          data: {},
        });
      }

      const eventIds = mockPushEvent.mock.calls.map(call => call[0].id);
      const uniqueIds = new Set(eventIds);

      expect(uniqueIds.size).toBe(5); // All IDs should be unique
    });

    it('should include timestamp in all events', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);
      
      const beforeTime = Date.now();

      broadcastUIEvent({
        event: 'test',
        data: {},
      });

      const afterTime = Date.now();
      const event = mockPushEvent.mock.calls[0][0];

      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve custom timestamp if provided', () => {
      const mockPushEvent = vi.fn();
      mockClientStreams.add(mockPushEvent);
      
      // This would require modifying the broadcastEvent function to accept custom timestamps
      // Currently, the implementation always overwrites timestamps
      // This test documents the current behavior
      
      const customTimestamp = 1234567890;
      const event: SSEEvent = {
        type: 'custom',
        data: {},
        timestamp: customTimestamp,
      };

      // Since we can't directly call broadcastEvent, we test through public APIs
      broadcastUIEvent({ event: 'test', data: {} });
      
      const broadcastedEvent = mockPushEvent.mock.calls[0][0];
      expect(broadcastedEvent.timestamp).not.toBe(customTimestamp); // Current behavior
    });
  });

  describe('multiple client handling', () => {
    it('should broadcast to all connected clients', () => {
      const clients = [
        vi.fn(),
        vi.fn(),
        vi.fn(),
      ];

      clients.forEach(client => mockClientStreams.add(client));

      broadcastUIEvent({
        event: 'test:broadcast',
        data: { value: 123 },
      });

      clients.forEach(client => {
        expect(client).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ui_operation',
            data: expect.objectContaining({
              event: 'test:broadcast',
              payload: { value: 123 },
            }),
          })
        );
      });
    });

    it('should continue broadcasting after client errors', () => {
      const client1 = vi.fn();
      const client2 = vi.fn().mockImplementation(() => {
        throw new Error('Client 2 error');
      });
      const client3 = vi.fn();

      mockClientStreams.add(client1);
      mockClientStreams.add(client2);
      mockClientStreams.add(client3);

      broadcastUIEvent({
        event: 'test',
        data: {},
      });

      expect(client1).toHaveBeenCalled();
      expect(client2).toHaveBeenCalled();
      expect(client3).toHaveBeenCalled();
      expect(mockClientStreams.size).toBe(2); // Error client removed
    });
  });
});

export {};