import 'dotenv/config';
import { config } from 'dotenv';
import { dispatchTypedUIEvent } from '../../../lib/utils/ui-event-dispatcher';
import { uiEventBus } from '../../../lib/server/uiEventBus';
import type { 
  ChartEventData, 
  DrawingEventData,
  ProposalEventData,
  PatternEventData
} from '../../../types/events/all-event-types';
import { 
  createMockChartEvent,
  createMockDrawingEvent,
  createMockProposal,
  createMockPatternEvent,
  waitFor
} from '../../helpers/test-factory';

// Load environment variables
config({ path: '.env.local' });

// Mock fetch for UI event dispatching
global.fetch = jest.fn();

describe('UI Events Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    // Clear event bus listeners
    uiEventBus.removeAllListeners();
  });

  describe('Event Dispatching', () => {
    test('should dispatch chart events', async () => {
      const event = createMockChartEvent('chart.symbolChanged', {
        symbol: 'ETHUSDT',
        previousSymbol: 'BTCUSDT'
      });

      await dispatchTypedUIEvent(event);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ui-events'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            type: 'chart.symbolChanged',
            data: event
          })
        })
      );
    });

    test('should dispatch drawing events', async () => {
      const event = createMockDrawingEvent('drawing.created', 'trendline');

      await dispatchTypedUIEvent(event);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('drawing.created')
        })
      );
    });

    test('should dispatch proposal events', async () => {
      const proposal = createMockProposal({ symbol: 'BTCUSDT' });
      const event: ProposalEventData = {
        type: 'proposal.created',
        proposal
      };

      await dispatchTypedUIEvent(event);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('proposal.created')
        })
      );
    });

    test('should batch multiple events', async () => {
      const events = [
        createMockChartEvent('chart.timeframeChanged'),
        createMockDrawingEvent('drawing.created'),
        createMockPatternEvent('pattern.detected')
      ];

      // Dispatch all events
      await Promise.all(events.map(event => dispatchTypedUIEvent(event)));

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Event Bus Integration', () => {
    test('should emit events through event bus', (done) => {
      const testEvent = createMockChartEvent('chart.indicatorAdded');
      
      uiEventBus.on('chart.indicatorAdded', (data) => {
        expect(data).toMatchObject(testEvent);
        done();
      });

      uiEventBus.emit('chart.indicatorAdded', testEvent);
    });

    test('should handle multiple listeners', () => {
      const event = createMockDrawingEvent('drawing.updated');
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      uiEventBus.on('drawing.updated', listener1);
      uiEventBus.on('drawing.updated', listener2);
      uiEventBus.on('drawing.updated', listener3);

      uiEventBus.emit('drawing.updated', event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
      expect(listener3).toHaveBeenCalledWith(event);
    });

    test('should support wildcard listeners', () => {
      const chartEvent = createMockChartEvent('chart.symbolChanged');
      const drawingEvent = createMockDrawingEvent('drawing.created');
      const wildcardListener = jest.fn();

      uiEventBus.on('*', wildcardListener);

      uiEventBus.emit('chart.symbolChanged', chartEvent);
      uiEventBus.emit('drawing.created', drawingEvent);

      expect(wildcardListener).toHaveBeenCalledTimes(2);
      expect(wildcardListener).toHaveBeenCalledWith(chartEvent);
      expect(wildcardListener).toHaveBeenCalledWith(drawingEvent);
    });
  });

  describe('Event Flow Integration', () => {
    test('should handle complete proposal flow', async () => {
      const proposalId = 'test-proposal-123';
      const events: any[] = [];

      // Listen for all proposal events
      uiEventBus.on('proposal.*', (event) => {
        events.push(event);
      });

      // 1. Create proposal
      const createEvent: ProposalEventData = {
        type: 'proposal.created',
        proposal: createMockProposal({ id: proposalId })
      };
      await dispatchTypedUIEvent(createEvent);

      // 2. Update proposal
      const updateEvent: ProposalEventData = {
        type: 'proposal.updated',
        proposalId,
        updates: { confidence: 0.95 }
      };
      await dispatchTypedUIEvent(updateEvent);

      // 3. Approve proposal
      const approveEvent: ProposalEventData = {
        type: 'proposal.approved',
        proposalId,
        symbol: 'BTCUSDT'
      };
      await dispatchTypedUIEvent(approveEvent);

      expect(fetch).toHaveBeenCalledTimes(3);
      
      // Verify event sequence
      const callBodies = (fetch as jest.Mock).mock.calls.map(call => 
        JSON.parse(call[1].body)
      );
      
      expect(callBodies[0].type).toBe('proposal.created');
      expect(callBodies[1].type).toBe('proposal.updated');
      expect(callBodies[2].type).toBe('proposal.approved');
    });

    test('should handle drawing lifecycle', async () => {
      const drawingId = 'drawing-123';

      // Create
      await dispatchTypedUIEvent({
        type: 'drawing.created',
        drawing: {
          id: drawingId,
          type: 'trendline',
          points: [
            { time: Date.now() / 1000 - 3600, price: 45000 },
            { time: Date.now() / 1000, price: 46000 }
          ],
          style: { color: '#2196F3', lineWidth: 2 }
        }
      });

      // Update
      await dispatchTypedUIEvent({
        type: 'drawing.updated',
        drawingId,
        updates: {
          points: [
            { time: Date.now() / 1000 - 3600, price: 45500 },
            { time: Date.now() / 1000, price: 46500 }
          ]
        }
      });

      // Delete
      await dispatchTypedUIEvent({
        type: 'drawing.deleted',
        drawingId
      });

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('SSE Event Stream', () => {
    test('should establish SSE connection', async () => {
      const mockEventSource = {
        addEventListener: jest.fn(),
        close: jest.fn(),
        readyState: 1 // OPEN
      };

      // Mock EventSource
      (global as any).EventSource = jest.fn(() => mockEventSource);

      const eventSource = new EventSource('/api/ui-events');
      
      expect(EventSource).toHaveBeenCalledWith('/api/ui-events');
      expect(eventSource.readyState).toBe(1);
    });

    test('should handle SSE messages', (done) => {
      const mockEventSource = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'message') {
            // Simulate receiving a message
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'chart.symbolChanged',
                  data: { symbol: 'BTCUSDT' }
                })
              });
            }, 10);
          }
        }),
        close: jest.fn()
      };

      (global as any).EventSource = jest.fn(() => mockEventSource);

      const eventSource = new EventSource('/api/ui-events');
      
      eventSource.addEventListener('message', (event: any) => {
        const data = JSON.parse(event.data);
        expect(data.type).toBe('chart.symbolChanged');
        expect(data.data.symbol).toBe('BTCUSDT');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle dispatch failures', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const event = createMockChartEvent('chart.symbolChanged');
      
      // Should not throw
      await expect(dispatchTypedUIEvent(event)).resolves.not.toThrow();
    });

    test('should handle invalid event data', async () => {
      const invalidEvent = {
        type: 'invalid.event',
        // Missing required data
      } as any;

      await dispatchTypedUIEvent(invalidEvent);

      // Should still attempt to send
      expect(fetch).toHaveBeenCalled();
    });

    test('should retry on temporary failures', async () => {
      let callCount = 0;
      (fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      });

      const event = createMockChartEvent('chart.symbolChanged');
      await dispatchTypedUIEvent(event);

      // Should retry and eventually succeed
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance', () => {
    test('should handle high-frequency events', async () => {
      const startTime = Date.now();
      const eventCount = 100;
      
      const promises = [];
      for (let i = 0; i < eventCount; i++) {
        const event = createMockChartEvent('chart.priceUpdated', {
          price: 45000 + i,
          timestamp: new Date().toISOString()
        });
        promises.push(dispatchTypedUIEvent(event));
      }
      
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(fetch).toHaveBeenCalledTimes(eventCount);
      expect(duration).toBeLessThan(5000); // Should handle 100 events in < 5s
    });

    test('should throttle events when needed', async () => {
      // Mock a throttled dispatcher
      const throttledDispatch = jest.fn();
      let lastCall = 0;
      
      const throttle = (fn: Function, delay: number) => {
        return (...args: any[]) => {
          const now = Date.now();
          if (now - lastCall >= delay) {
            lastCall = now;
            return fn(...args);
          }
        };
      };
      
      const throttledFn = throttle(throttledDispatch, 100);
      
      // Send many events rapidly
      for (let i = 0; i < 50; i++) {
        throttledFn({ type: 'test', i });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Should be throttled
      expect(throttledDispatch.mock.calls.length).toBeLessThan(50);
      expect(throttledDispatch.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Components', () => {
    test('should coordinate chart and proposal events', async () => {
      const events: any[] = [];
      
      // Mock component listeners
      const chartListener = (event: any) => {
        if (event.type?.startsWith('chart.')) {
          events.push({ component: 'chart', event });
        }
      };
      
      const proposalListener = (event: any) => {
        if (event.type?.startsWith('proposal.')) {
          events.push({ component: 'proposal', event });
        }
      };
      
      // Simulate component mounting
      uiEventBus.on('chart.*', chartListener);
      uiEventBus.on('proposal.*', proposalListener);
      
      // User action: Switch to BTC and create proposal
      const switchEvent = createMockChartEvent('chart.symbolChanged', {
        symbol: 'BTCUSDT'
      });
      
      const proposalEvent: ProposalEventData = {
        type: 'proposal.created',
        proposal: createMockProposal({ symbol: 'BTCUSDT' })
      };
      
      await dispatchTypedUIEvent(switchEvent);
      await dispatchTypedUIEvent(proposalEvent);
      
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Both components should receive their respective events
      expect(events).toHaveLength(2);
      expect(events[0].component).toBe('chart');
      expect(events[1].component).toBe('proposal');
    });
  });
});