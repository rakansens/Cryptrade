import {
  UIEventDispatcher,
  uiEventDispatcher,
  dispatchTypedUIEvent,
  type ProposalUIEvent,
  type ChartUIEvent,
  type UIEvent,
} from '@/lib/utils/ui-event-dispatcher';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UIEventDispatcher', () => {
  let dispatcher: UIEventDispatcher;
  let originalWindow: Window & typeof globalThis;
  let mockWindow: any;

  beforeEach(() => {
    dispatcher = UIEventDispatcher.getInstance();
    dispatcher.clearAllListeners();
    
    originalWindow = global.window;
    mockWindow = {
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn((callback: Function) => {
        callback();
        return 1;
      }),
      removeEventListener: vi.fn(),
    };
    global.window = mockWindow as any;
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UIEventDispatcher.getInstance();
      const instance2 = UIEventDispatcher.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('dispatch', () => {
    it('should dispatch event to window in browser environment', () => {
      const event: ProposalUIEvent = {
        type: 'proposal:generated',
        detail: { proposalGroup: { proposals: [] } },
      };

      dispatcher.dispatch(event);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal:generated',
          detail: { proposalGroup: { proposals: [] } },
          bubbles: true,
          cancelable: true,
        })
      );
    });

    it('should dispatch to internal listeners', () => {
      const listener = vi.fn();
      dispatcher.addEventListener('proposal:selected', listener);

      const event: ProposalUIEvent = {
        type: 'proposal:selected',
        detail: { proposalId: '123' },
      };

      dispatcher.dispatch(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      dispatcher.addEventListener('proposal:error', errorListener);
      dispatcher.addEventListener('proposal:error', goodListener);

      const event: ProposalUIEvent = {
        type: 'proposal:error',
        detail: { error: 'Test error' },
      };

      dispatcher.dispatch(event);

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });

    it('should work without window object', () => {
      delete (global as any).window;

      const listener = vi.fn();
      dispatcher.addEventListener('chart:clear', listener);

      const event: ChartUIEvent = {
        type: 'chart:clear',
        detail: {},
      };

      // Should not throw
      expect(() => dispatcher.dispatch(event)).not.toThrow();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('dispatchBatch', () => {
    it('should dispatch multiple events in batch', () => {
      const events: UIEvent[] = [
        { type: 'proposal:generated', detail: {} },
        { type: 'chart:drawZone', detail: {} },
        { type: 'market:priceUpdate', detail: {} },
      ];

      dispatcher.dispatchBatch(events);

      expect(mockWindow.requestAnimationFrame).toHaveBeenCalled();
      expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(3);
    });

    it('should dispatch to internal listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      dispatcher.addEventListener('proposal:execute', listener1);
      dispatcher.addEventListener('chart:drawLine', listener2);

      const events: UIEvent[] = [
        { type: 'proposal:execute', detail: { id: '1' } },
        { type: 'chart:drawLine', detail: { price: 100 } },
      ];

      dispatcher.dispatchBatch(events);

      expect(listener1).toHaveBeenCalledWith(events[0]);
      expect(listener2).toHaveBeenCalledWith(events[1]);
    });

    it('should handle empty batch', () => {
      dispatcher.dispatchBatch([]);
      
      expect(mockWindow.requestAnimationFrame).not.toHaveBeenCalled();
      expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should dispatch immediately without browser environment', () => {
      delete (global as any).window;

      const listener = vi.fn();
      dispatcher.addEventListener('proposal:clear', listener);

      const events: UIEvent[] = [
        { type: 'proposal:clear', detail: {} },
      ];

      dispatcher.dispatchBatch(events);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('event listener management', () => {
    it('should add and remove event listeners', () => {
      const listener = vi.fn();
      dispatcher.addEventListener('proposal:checkExpiration', listener);

      const event: ProposalUIEvent = {
        type: 'proposal:checkExpiration',
        detail: {},
      };

      dispatcher.dispatch(event);
      expect(listener).toHaveBeenCalledOnce();

      dispatcher.removeEventListener('proposal:checkExpiration', listener);
      dispatcher.dispatch(event);
      expect(listener).toHaveBeenCalledOnce(); // Not called again
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      dispatcher.addEventListener('proposal:entryZoneReached', listener1);
      dispatcher.addEventListener('proposal:entryZoneReached', listener2);
      dispatcher.addEventListener('proposal:entryZoneReached', listener3);

      const event: ProposalUIEvent = {
        type: 'proposal:entryZoneReached',
        detail: { price: 50000 },
      };

      dispatcher.dispatch(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
      expect(listener3).toHaveBeenCalledWith(event);
    });

    it('should clear all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      dispatcher.addEventListener('proposal:generated', listener1);
      dispatcher.addEventListener('chart:drawZone', listener2);

      dispatcher.clearAllListeners();

      dispatcher.dispatch({ type: 'proposal:generated', detail: {} });
      dispatcher.dispatch({ type: 'chart:drawZone', detail: {} });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const listener = vi.fn();
      dispatcher.addEventListener('proposal:generated', listener);

      dispatcher.destroy();

      // Should clear listeners
      dispatcher.dispatch({ type: 'proposal:generated', detail: {} });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove window event listeners', () => {
      dispatcher.destroy();

      const expectedEventTypes = [
        'proposal:generated',
        'proposal:selected',
        'proposal:execute',
        'proposal:clear',
        'proposal:error',
        'proposal:entryZoneReached',
        'proposal:checkExpiration',
        'chart:drawZone',
        'chart:drawLine',
        'chart:clear',
        'market:priceUpdate',
      ];

      expect(mockWindow.removeEventListener).toHaveBeenCalledTimes(expectedEventTypes.length);
    });

    it('should handle destroy without window', () => {
      delete (global as any).window;
      
      // Should not throw
      expect(() => dispatcher.destroy()).not.toThrow();
    });
  });

  describe('helper methods', () => {
    describe('dispatchProposalGenerated', () => {
      it('should dispatch proposal generated event', () => {
        const proposalGroup = {
          proposals: [
            { id: '1', type: 'long' },
            { id: '2', type: 'short' },
          ],
        };

        dispatcher.dispatchProposalGenerated(proposalGroup);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal:generated',
            detail: { proposalGroup },
          })
        );
      });
    });

    describe('dispatchProposalExecution', () => {
      it('should dispatch execution event with visualization events', () => {
        const proposal = {
          entryZone: { start: 49000, end: 50000 },
          direction: 'long',
          riskParameters: {
            stopLoss: 48000,
            takeProfit: [52000, 54000],
          },
        };

        dispatcher.dispatchProposalExecution(proposal);

        expect(mockWindow.requestAnimationFrame).toHaveBeenCalled();
        
        // Should dispatch 5 events: execute + zone + SL + 2 TPs
        expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(5);
        
        // Check execute event
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal:execute',
            detail: { proposal },
          })
        );

        // Check entry zone event
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawZone',
            detail: expect.objectContaining({
              type: 'entryZone',
              start: 49000,
              end: 50000,
              color: 'rgba(0, 255, 0, 0.2)',
              label: 'Entry Zone',
            }),
          })
        );

        // Check stop loss line
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawLine',
            detail: expect.objectContaining({
              price: 48000,
              color: 'red',
              label: 'Stop Loss',
            }),
          })
        );

        // Check take profit lines
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawLine',
            detail: expect.objectContaining({
              price: 52000,
              label: 'TP1',
            }),
          })
        );
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawLine',
            detail: expect.objectContaining({
              price: 54000,
              label: 'TP2',
            }),
          })
        );
      });

      it('should handle short direction', () => {
        const proposal = {
          entryZone: { start: 51000, end: 52000 },
          direction: 'short',
        };

        dispatcher.dispatchProposalExecution(proposal);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawZone',
            detail: expect.objectContaining({
              color: 'rgba(255, 0, 0, 0.2)', // Red for short
            }),
          })
        );
      });

      it('should handle single take profit', () => {
        const proposal = {
          riskParameters: {
            takeProfit: 55000,
          },
        };

        dispatcher.dispatchProposalExecution(proposal);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'chart:drawLine',
            detail: expect.objectContaining({
              price: 55000,
              label: 'TP1',
            }),
          })
        );
      });

      it('should handle missing optional fields', () => {
        const proposal = {};

        dispatcher.dispatchProposalExecution(proposal);

        // Should only dispatch the execute event
        expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(1);
        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal:execute',
          })
        );
      });
    });

    describe('checkPriceInEntryZone', () => {
      it('should dispatch alert when price enters zone', () => {
        const price = 50500;
        const entryZone = { start: 50000, end: 51000 };

        dispatcher.checkPriceInEntryZone(price, entryZone);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal:entryZoneReached',
            detail: {
              price,
              entryZone,
              message: 'Price has entered the proposed entry zone',
            },
          })
        );
      });

      it('should not dispatch when price is outside zone', () => {
        dispatcher.checkPriceInEntryZone(49000, { start: 50000, end: 51000 });
        dispatcher.checkPriceInEntryZone(52000, { start: 50000, end: 51000 });

        expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
      });

      it('should dispatch when price is at zone boundaries', () => {
        const entryZone = { start: 50000, end: 51000 };

        dispatcher.checkPriceInEntryZone(50000, entryZone);
        expect(mockWindow.dispatchEvent).toHaveBeenCalledOnce();

        dispatcher.checkPriceInEntryZone(51000, entryZone);
        expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(uiEventDispatcher).toBeDefined();
      expect(uiEventDispatcher).toBe(UIEventDispatcher.getInstance());
    });
  });

  describe('legacy compatibility', () => {
    it('should warn when using deprecated dispatchTypedUIEvent', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchTypedUIEvent({ event: 'test', data: {} });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'dispatchTypedUIEvent is deprecated, use UIEventDispatcher instead'
      );

      consoleWarnSpy.mockRestore();
    });
  });
});

export {};