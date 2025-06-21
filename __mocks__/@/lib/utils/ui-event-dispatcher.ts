// Mock for UI Event Dispatcher
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
  private eventListeners = new Map();

  static getInstance = jest.fn(() => {
    if (!UIEventDispatcher.instance) {
      UIEventDispatcher.instance = new UIEventDispatcher();
    }
    return UIEventDispatcher.instance;
  });

  dispatch = jest.fn();
  subscribe = jest.fn((eventType, callback) => {
    return {
      unsubscribe: jest.fn(),
    };
  });
  unsubscribe = jest.fn();
  clear = jest.fn();
  emit = jest.fn();
}