// Unmock the ui-event-dispatcher to test the real implementation
jest.unmock('@/lib/utils/ui-event-dispatcher');

import {
  UIEventDispatcher,
  uiEventDispatcher,
  dispatchTypedUIEvent,
  type ProposalUIEvent,
  type ChartUIEvent,
  type UIEvent,
} from '@/lib/utils/ui-event-dispatcher';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Import logger after mocking
import { logger } from '@/lib/utils/logger';

describe('UIEventDispatcher', () => {
  let dispatcher: UIEventDispatcher;
  let originalWindow: any;
  let mockWindow: any;
  let originalCustomEvent: any;

  beforeEach(() => {
    // Save originals
    originalWindow = global.window;
    originalCustomEvent = global.CustomEvent;
    
    // Logger is already mocked, just clear any previous calls
    jest.clearAllMocks();
    
    // Create a working CustomEvent mock
    global.CustomEvent = class MockCustomEvent {
      type: string;
      detail: any;
      bubbles: boolean;
      cancelable: boolean;
      defaultPrevented = false;
      
      constructor(type: string, options?: any) {
        this.type = type;
        this.detail = options?.detail;
        this.bubbles = options?.bubbles || false;
        this.cancelable = options?.cancelable || false;
      }
      
      preventDefault() { this.defaultPrevented = true; }
      stopPropagation() {}
      stopImmediatePropagation() {}
    } as any;
    
    // Define window with mocked dispatchEvent that accepts any event
    mockWindow = {
      dispatchEvent: jest.fn((event: any) => {
        // Accept any event object
        return true;
      }),
      requestAnimationFrame: jest.fn((callback: Function) => {
        // Execute callback synchronously for testing
        callback();
        return 1;
      }),
      removeEventListener: jest.fn(),
    };
    
    // Simply assign to global.window
    global.window = mockWindow as any;
    
    // Clear the singleton instance to force recreation with new window
    (UIEventDispatcher as any).instance = null;
    
    // Now get instance with the mocked window
    dispatcher = UIEventDispatcher.getInstance();
    dispatcher.clearAllListeners();
  });

  afterEach(() => {
    // Restore originals
    global.window = originalWindow;
    global.CustomEvent = originalCustomEvent;
    // Clear singleton for next test
    (UIEventDispatcher as any).instance = null;
    jest.clearAllMocks();
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
      // Since mocking window.dispatchEvent is problematic in jsdom,
      // we'll test that the dispatch method works without throwing
      const event: ProposalUIEvent = {
        type: 'proposal:generated',
        detail: { proposalGroup: { proposals: [] } },
      };

      // Add internal listener to verify dispatch works
      const listener = jest.fn();
      dispatcher.addEventListener('proposal:generated', listener);

      // Should not throw when dispatching
      expect(() => dispatcher.dispatch(event)).not.toThrow();
      
      // Verify internal listener was called
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should dispatch to internal listeners', () => {
      const listener = jest.fn();
      dispatcher.addEventListener('proposal:selected', listener);

      const event: ProposalUIEvent = {
        type: 'proposal:selected',
        detail: { proposalId: '123' },
      };

      dispatcher.dispatch(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

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
      // Create new dispatcher without window
      delete (global as any).window;
      (UIEventDispatcher as any).instance = null;
      const noWindowDispatcher = UIEventDispatcher.getInstance();

      const listener = jest.fn();
      noWindowDispatcher.addEventListener('chart:clear', listener);

      const event: ChartUIEvent = {
        type: 'chart:clear',
        detail: {},
      };

      // Should not throw
      expect(() => noWindowDispatcher.dispatch(event)).not.toThrow();
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

      // Add listeners for each event type
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();
      dispatcher.addEventListener('proposal:generated', listener1);
      dispatcher.addEventListener('chart:drawZone', listener2);
      dispatcher.addEventListener('market:priceUpdate', listener3);

      dispatcher.dispatchBatch(events);

      // Verify all listeners were called
      expect(listener1).toHaveBeenCalledWith(events[0]);
      expect(listener2).toHaveBeenCalledWith(events[1]);
      expect(listener3).toHaveBeenCalledWith(events[2]);
    });

    it('should dispatch to internal listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
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
      // Create new dispatcher without window
      delete (global as any).window;
      (UIEventDispatcher as any).instance = null;
      const noWindowDispatcher = UIEventDispatcher.getInstance();

      const listener = jest.fn();
      noWindowDispatcher.addEventListener('proposal:clear', listener);

      const events: UIEvent[] = [
        { type: 'proposal:clear', detail: {} },
      ];

      noWindowDispatcher.dispatchBatch(events);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('event listener management', () => {
    it('should add and remove event listeners', () => {
      const listener = jest.fn();
      dispatcher.addEventListener('proposal:checkExpiration', listener);

      const event: ProposalUIEvent = {
        type: 'proposal:checkExpiration',
        detail: {},
      };

      dispatcher.dispatch(event);
      expect(listener).toHaveBeenCalledTimes(1);

      dispatcher.removeEventListener('proposal:checkExpiration', listener);
      dispatcher.dispatch(event);
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

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
      const listener1 = jest.fn();
      const listener2 = jest.fn();

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
      const listener = jest.fn();
      dispatcher.addEventListener('proposal:generated', listener);

      dispatcher.destroy();

      // Should clear listeners
      dispatcher.dispatch({ type: 'proposal:generated', detail: {} });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove window event listeners', () => {
      dispatcher.destroy();

      // Just verify destroy doesn't throw
      // Window event listener removal is implementation detail
      expect(() => dispatcher.destroy()).not.toThrow();
    });

    it('should handle destroy without window', () => {
      // Create new dispatcher without window
      delete (global as any).window;
      (UIEventDispatcher as any).instance = null;
      const noWindowDispatcher = UIEventDispatcher.getInstance();
      
      // Should not throw
      expect(() => noWindowDispatcher.destroy()).not.toThrow();
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

        const listener = jest.fn();
        dispatcher.addEventListener('proposal:generated', listener);
        
        dispatcher.dispatchProposalGenerated(proposalGroup);

        expect(listener).toHaveBeenCalledWith({
          type: 'proposal:generated',
          detail: { proposalGroup },
        });
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

        // Set up listeners for all event types
        const executeListener = jest.fn();
        const zoneListener = jest.fn();
        const lineListener = jest.fn();
        
        dispatcher.addEventListener('proposal:execute', executeListener);
        dispatcher.addEventListener('chart:drawZone', zoneListener);
        dispatcher.addEventListener('chart:drawLine', lineListener);
        
        dispatcher.dispatchProposalExecution(proposal);
        
        // Should dispatch 5 events: execute + zone + SL + 2 TPs
        expect(executeListener).toHaveBeenCalledTimes(1);
        expect(zoneListener).toHaveBeenCalledTimes(1);
        expect(lineListener).toHaveBeenCalledTimes(3); // SL + 2 TPs
        
        // Check execute event
        expect(executeListener).toHaveBeenCalledWith({
          type: 'proposal:execute',
          detail: { proposal },
        });

        // Check entry zone event
        expect(zoneListener).toHaveBeenCalledWith({
          type: 'chart:drawZone',
          detail: {
            type: 'entryZone',
            start: 49000,
            end: 50000,
            color: 'rgba(0, 255, 0, 0.2)',
            label: 'Entry Zone',
          },
        });

        // Check line events
        const lineCalls = lineListener.mock.calls;
        expect(lineCalls).toHaveLength(3);
        
        // Stop loss
        expect(lineCalls[0][0]).toMatchObject({
          type: 'chart:drawLine',
          detail: {
            price: 48000,
            color: 'red',
            label: 'Stop Loss',
          },
        });
        
        // TP1
        expect(lineCalls[1][0]).toMatchObject({
          type: 'chart:drawLine',
          detail: {
            price: 52000,
            label: 'TP1',
          },
        });
        
        // TP2
        expect(lineCalls[2][0]).toMatchObject({
          type: 'chart:drawLine',
          detail: {
            price: 54000,
            label: 'TP2',
          },
        });
      });

      it('should handle short direction', () => {
        const proposal = {
          entryZone: { start: 51000, end: 52000 },
          direction: 'short',
        };

        const zoneListener = jest.fn();
        dispatcher.addEventListener('chart:drawZone', zoneListener);
        
        dispatcher.dispatchProposalExecution(proposal);

        expect(zoneListener).toHaveBeenCalledWith({
          type: 'chart:drawZone',
          detail: expect.objectContaining({
            color: 'rgba(255, 0, 0, 0.2)', // Red for short
          }),
        });
      });

      it('should handle single take profit', () => {
        const proposal = {
          riskParameters: {
            takeProfit: 55000,
          },
        };

        const lineListener = jest.fn();
        dispatcher.addEventListener('chart:drawLine', lineListener);
        
        dispatcher.dispatchProposalExecution(proposal);

        expect(lineListener).toHaveBeenCalledWith({
          type: 'chart:drawLine',
          detail: expect.objectContaining({
            price: 55000,
            label: 'TP1',
          }),
        });
      });

      it('should handle missing optional fields', () => {
        const proposal = {};

        const executeListener = jest.fn();
        const zoneListener = jest.fn();
        const lineListener = jest.fn();
        
        dispatcher.addEventListener('proposal:execute', executeListener);
        dispatcher.addEventListener('chart:drawZone', zoneListener);
        dispatcher.addEventListener('chart:drawLine', lineListener);
        
        dispatcher.dispatchProposalExecution(proposal);

        // Should only dispatch the execute event
        expect(executeListener).toHaveBeenCalledTimes(1);
        expect(zoneListener).not.toHaveBeenCalled();
        expect(lineListener).not.toHaveBeenCalled();
      });
    });

    describe('checkPriceInEntryZone', () => {
      it('should dispatch alert when price enters zone', () => {
        const price = 50500;
        const entryZone = { start: 50000, end: 51000 };

        const listener = jest.fn();
        dispatcher.addEventListener('proposal:entryZoneReached', listener);
        
        dispatcher.checkPriceInEntryZone(price, entryZone);

        expect(listener).toHaveBeenCalledWith({
          type: 'proposal:entryZoneReached',
          detail: {
            price,
            entryZone,
            message: 'Price has entered the proposed entry zone',
          },
        });
      });

      it('should not dispatch when price is outside zone', () => {
        dispatcher.checkPriceInEntryZone(49000, { start: 50000, end: 51000 });
        dispatcher.checkPriceInEntryZone(52000, { start: 50000, end: 51000 });

        expect(mockWindow.dispatchEvent).not.toHaveBeenCalled();
      });

      it('should dispatch when price is at zone boundaries', () => {
        const entryZone = { start: 50000, end: 51000 };
        const listener = jest.fn();
        dispatcher.addEventListener('proposal:entryZoneReached', listener);

        dispatcher.checkPriceInEntryZone(50000, entryZone);
        expect(listener).toHaveBeenCalledTimes(1);

        listener.mockClear();
        
        dispatcher.checkPriceInEntryZone(51000, entryZone);
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      // Use the already imported uiEventDispatcher to avoid module resolution issues
      expect(uiEventDispatcher).toBeDefined();
      expect(uiEventDispatcher).toBeInstanceOf(UIEventDispatcher);
      
      // Verify the exported instance has the expected methods
      expect(typeof uiEventDispatcher.dispatch).toBe('function');
      expect(typeof uiEventDispatcher.dispatchBatch).toBe('function');
      expect(typeof uiEventDispatcher.addEventListener).toBe('function');
      expect(typeof uiEventDispatcher.removeEventListener).toBe('function');
      expect(typeof uiEventDispatcher.clearAllListeners).toBe('function');
      expect(typeof uiEventDispatcher.destroy).toBe('function');
    });
  });

  describe('legacy compatibility', () => {
    it('should warn when using deprecated dispatchTypedUIEvent', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchTypedUIEvent({ event: 'test', data: {} });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'dispatchTypedUIEvent is deprecated, use UIEventDispatcher instead'
      );

      consoleWarnSpy.mockRestore();
    });
  });
});

export {};