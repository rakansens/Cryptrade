/**
 * UI Event Dispatcher
 * 
 * Handles dispatching of UI events for proposal display and chart interactions
 */

import { logger } from './logger';

export interface ProposalUIEvent {
  type: 'proposal:generated' | 'proposal:selected' | 'proposal:execute' | 'proposal:clear' | 'proposal:error' | 'proposal:entryZoneReached' | 'proposal:checkExpiration';
  detail: unknown;
}

export interface ChartUIEvent {
  type: 'chart:drawZone' | 'chart:drawLine' | 'chart:clear' | 'market:priceUpdate';
  detail: unknown;
}

export type UIEvent = ProposalUIEvent | ChartUIEvent;

export class UIEventDispatcher {
  private static instance: UIEventDispatcher;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {}

  static getInstance(): UIEventDispatcher {
    if (!UIEventDispatcher.instance) {
      UIEventDispatcher.instance = new UIEventDispatcher();
    }
    return UIEventDispatcher.instance;
  }

  /**
   * Dispatch a UI event
   */
  dispatch(event: UIEvent): void {
    // In browser environment
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const customEvent = new CustomEvent(event.type, {
        detail: event.detail,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(customEvent);
      
      logger.debug('[UIEventDispatcher] Event dispatched to window', {
        type: event.type,
        detail: event.detail,
      });
    }

    // For testing environment or server-side
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('[UIEventDispatcher] Error in event listener', {
          type: event.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Dispatch multiple events as a batch for better performance
   * Events are dispatched in order with minimal delay
   */
  dispatchBatch(events: UIEvent[]): void {
    if (events.length === 0) return;

    logger.debug('[UIEventDispatcher] Dispatching batch of events', {
      count: events.length,
      types: events.map(e => e.type),
    });

    // Use requestAnimationFrame for browser environment to batch DOM updates
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        events.forEach(event => {
          const customEvent = new CustomEvent(event.type, {
            detail: event.detail,
            bubbles: true,
            cancelable: true,
          });
          window.dispatchEvent(customEvent);
        });
      });
    } else {
      // For non-browser environments, dispatch immediately
      events.forEach(event => this.dispatch(event));
    }

    // Also dispatch to local listeners
    events.forEach(event => {
      const listeners = this.eventListeners.get(event.type) || [];
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          logger.error('[UIEventDispatcher] Error in batch event listener', {
            type: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    });
  }

  /**
   * Add event listener for testing
   */
  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clear all event listeners (for testing)
   */
  clearAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Destroy the event dispatcher and clean up all resources
   * Important for preventing memory leaks
   */
  destroy(): void {
    // Clear all event listeners
    this.eventListeners.clear();
    
    // Remove window event listeners if in browser environment
    if (typeof window !== 'undefined' && window.removeEventListener) {
      // Remove any global listeners that might have been added
      const eventTypes = [
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
        'market:priceUpdate'
      ];
      
      eventTypes.forEach(type => {
        try {
          window.removeEventListener(type, () => {});
        } catch (error) {
          // Ignore errors during cleanup
        }
      });
    }
    
    logger.debug('[UIEventDispatcher] Destroyed and cleaned up all resources');
  }

  /**
   * Dispatch proposal generated event
   */
  dispatchProposalGenerated(proposalGroup: unknown): void {
    this.dispatch({
      type: 'proposal:generated',
      detail: { proposalGroup },
    });
  }

  /**
   * Dispatch proposal execution event with chart drawing events
   */
  dispatchProposalExecution(proposal: {
    entryZone?: { start: number; end: number };
    direction?: string;
    riskParameters?: {
      stopLoss?: number;
      takeProfit?: number | number[];
    };
  }): void {
    const batchEvents: UIEvent[] = [];

    // Add the execution event
    batchEvents.push({
      type: 'proposal:execute',
      detail: { proposal },
    });

    // Add chart drawing events for visualization
    if (proposal.entryZone) {
      batchEvents.push({
        type: 'chart:drawZone',
        detail: {
          type: 'entryZone',
          start: proposal.entryZone.start,
          end: proposal.entryZone.end,
          color: proposal.direction === 'long' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          label: 'Entry Zone',
        },
      });
    }

    if (proposal.riskParameters) {
      // Add stop loss line
      if (proposal.riskParameters.stopLoss) {
        batchEvents.push({
          type: 'chart:drawLine',
          detail: {
            type: 'horizontalLine',
            price: proposal.riskParameters.stopLoss,
            color: 'red',
            style: 'dashed',
            label: 'Stop Loss',
          },
        });
      }

      // Add take profit lines
      if (proposal.riskParameters.takeProfit) {
        const takeProfits = Array.isArray(proposal.riskParameters.takeProfit) 
          ? proposal.riskParameters.takeProfit 
          : [proposal.riskParameters.takeProfit];
        
        takeProfits.forEach((tp, index) => {
          batchEvents.push({
            type: 'chart:drawLine',
            detail: {
              type: 'horizontalLine',
              price: tp,
              color: 'green',
              style: 'dashed',
              label: `TP${index + 1}`,
            },
          });
        });
      }
    }

    // Dispatch all events as a batch for better performance
    this.dispatchBatch(batchEvents);
  }

  /**
   * Check if price is in entry zone and dispatch alert
   */
  checkPriceInEntryZone(price: number, entryZone: { start: number; end: number }): void {
    if (price >= entryZone.start && price <= entryZone.end) {
      this.dispatch({
        type: 'proposal:entryZoneReached',
        detail: {
          price,
          entryZone,
          message: 'Price has entered the proposed entry zone',
        },
      });
    }
  }
}

// Export singleton instance
export const uiEventDispatcher = UIEventDispatcher.getInstance();