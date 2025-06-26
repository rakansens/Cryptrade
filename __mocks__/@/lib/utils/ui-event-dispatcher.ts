import { jest } from '@jest/globals';

export interface UIEvent {
  type: string;
  detail?: any;
}

export interface ProposalUIEvent {
  type: 'proposal:generated' | 'proposal:selected' | 'proposal:execute' | 'proposal:clear' | 'proposal:error' | 'proposal:entryZoneReached' | 'proposal:checkExpiration';
  detail: unknown;
}

export interface ChartUIEvent {
  type: 'chart:drawZone' | 'chart:drawLine' | 'chart:clear' | 'market:priceUpdate';
  detail: unknown;
}

// Mock UIEventDispatcher class
export class UIEventDispatcher {
  private static instance: UIEventDispatcher | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private eventQueue: UIEvent[] = [];

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): UIEventDispatcher {
    if (!UIEventDispatcher.instance) {
      UIEventDispatcher.instance = new UIEventDispatcher();
    }
    return UIEventDispatcher.instance;
  }

  static resetInstance(): void {
    UIEventDispatcher.instance = null;
  }

  dispatch(event: UIEvent): void {
    this.eventQueue.push(event);
    
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
  }

  dispatchBatch(events: UIEvent[]): void {
    events.forEach(event => this.dispatch(event));
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  clearAllListeners(): void {
    this.eventListeners.clear();
  }

  destroy(): void {
    this.eventListeners.clear();
    this.eventQueue = [];
  }

  dispatchProposalGenerated(proposalGroup: unknown): void {
    this.dispatch({
      type: 'proposal:generated',
      detail: { proposalGroup },
    });
  }

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

// Legacy compatibility function
export function dispatchTypedUIEvent(_event: CustomEvent | { event: string; data?: unknown }): void {
  console.warn('dispatchTypedUIEvent is deprecated, use UIEventDispatcher instead');
}

export default UIEventDispatcher;