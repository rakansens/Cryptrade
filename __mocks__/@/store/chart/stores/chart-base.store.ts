/**
 * Updated: 2024-12-27 - 機能的なモック実装に修正、実際の状態変更を実行
 * Changes: Added working state management that actually updates internal state
 */

// Inline type definitions to avoid import issues
type SymbolValue = 'BTCUSDT' | 'ETHUSDT' | 'ADAUSDT' | 'SOLUSDT' | 'DOGEUSDT';
type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

interface ChartBaseState {
  symbol: SymbolValue;
  timeframe: Timeframe;
  isChartReady: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ChartBaseActions {
  setSymbol: (symbol: SymbolValue) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setChartReady: (ready: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

interface ChartBaseStore extends ChartBaseState, ChartBaseActions {}

// Mock state storage that actually updates
let mockState: ChartBaseState = {
  symbol: 'BTCUSDT',
  timeframe: '1h', 
  isChartReady: false,
  isLoading: false,
  error: null,
};

// Store subscribers for updates
let subscribers: Array<(state: ChartBaseState) => void> = [];

const notifySubscribers = () => {
  subscribers.forEach(listener => listener(mockState));
};

// Functional mock actions that actually update state
const mockActions = {
  setSymbol: (symbol: SymbolValue) => {
    mockState = { ...mockState, symbol };
    notifySubscribers();
  },
  setTimeframe: (timeframe: Timeframe) => {
    mockState = { ...mockState, timeframe };
    notifySubscribers();
  },
  setChartReady: (ready: boolean) => {
    mockState = { ...mockState, isChartReady: ready };
    notifySubscribers();
  },
  setLoading: (loading: boolean) => {
    mockState = { ...mockState, isLoading: loading };
    notifySubscribers();
  },
  setError: (error: string | null) => {
    mockState = { ...mockState, error };
    notifySubscribers();
  },
  reset: () => {
    mockState = {
      symbol: 'BTCUSDT',
      timeframe: '1h',
      isChartReady: false,
      isLoading: false,
      error: null,
    };
    notifySubscribers();
  },
};

// Mock store implementation that returns current state + working actions
const useChartBaseStore = jest.fn((selector?: (state: ChartBaseStore) => any) => {
  const store: ChartBaseStore = {
    ...mockState,
    ...mockActions,
  };

  return selector ? selector(store) : store;
});

// Add Zustand-like methods
(useChartBaseStore as any).getState = () => ({
  ...mockState,
  ...mockActions,
});

(useChartBaseStore as any).setState = (partial: any) => {
  const newState = typeof partial === 'function' ? partial(mockState) : partial;
  mockState = { ...mockState, ...newState };
  notifySubscribers();
};

(useChartBaseStore as any).subscribe = (listener: any) => {
  subscribers.push(listener);
  return () => {
    subscribers = subscribers.filter(l => l !== listener);
  };
};

export { useChartBaseStore };