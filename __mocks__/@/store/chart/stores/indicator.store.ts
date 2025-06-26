/**
 * Updated: Complete redesign of indicator store mock to match actual implementation
 * Changes: Added proper state structure, actions, and default values with inline types
 */

import { create } from 'zustand';

// Define types inline to avoid import issues in mock
type IndicatorOptions = {
  ma: boolean;
  rsi: boolean;
  macd: boolean;
  boll: boolean;
};

type IndicatorSettings = {
  ma: {
    ma1: number;
    ma2: number;
    ma3: number;
  };
  rsi: number;
  rsiUpper: number;
  rsiLower: number;
  macd: {
    short: number;
    long: number;
    signal: number;
  };
  boll: { period: number; stdDev: number };
  lineWidth: {
    ma: number;
    ma1: number;
    ma2: number;
    ma3: number;
    rsi: number;
    macd: number;
    boll: number;
  };
  colors: {
    ma1: string;
    ma2: string;
    ma3: string;
    rsi: string;
    macd: string;
    boll: string;
  };
};

type IndicatorValue = string | number | boolean | object;

interface IndicatorState {
  indicators: IndicatorOptions;
  settings: IndicatorSettings;
}

interface IndicatorActions {
  setIndicators: (indicators: IndicatorOptions) => void;
  updateIndicator: (key: keyof IndicatorOptions, enabled: boolean) => void;
  setIndicatorEnabled: (indicator: keyof IndicatorOptions, enabled: boolean) => void;
  setIndicatorSetting: (indicator: string, key: string, value: IndicatorValue) => void;
  setSettings: (settings: IndicatorSettings) => void;
  updateSetting: <K extends keyof IndicatorSettings>(key: K, value: IndicatorSettings[K]) => void;
  reset: () => void;
}

// Mock the external dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

// Define initial state
const initialState: IndicatorState = {
  indicators: {
    ma: false,
    rsi: false,
    macd: false,
    boll: false,
  },
  settings: {
    ma: {
      ma1: 7,
      ma2: 25,
      ma3: 99,
    },
    rsi: 14,
    rsiUpper: 70,
    rsiLower: 30,
    macd: {
      short: 12,
      long: 26,
      signal: 9,
    },
    boll: { period: 20, stdDev: 2 },
    lineWidth: {
      ma: 2,
      ma1: 2,
      ma2: 2,
      ma3: 2,
      rsi: 2,
      macd: 2,
      boll: 1,
    },
    colors: {
      ma1: '#2962ff',
      ma2: '#ff6d00',
      ma3: '#00e676',
      rsi: '#7b61ff',
      macd: '#2962ff',
      boll: '#2962ff',
    },
  },
};

// Create mock store that matches the actual implementation structure
export const useIndicatorStore = create<IndicatorState & IndicatorActions>()((set) => ({
  // Initial state
  ...initialState,

  // Actions
  setIndicators: jest.fn((indicators) => {
    set({ indicators });
  }),

  updateIndicator: jest.fn((key, enabled) => {
    set((state) => ({
      indicators: {
        ...state.indicators,
        [key]: enabled,
      },
    }));
  }),

  setIndicatorEnabled: jest.fn((indicator, enabled) => {
    set((state) => ({
      indicators: {
        ...state.indicators,
        [indicator]: enabled,
      },
    }));
  }),

  setIndicatorSetting: jest.fn((indicator, key, value) => {
    set((state) => {
      const currentSettings = state.settings[indicator as keyof typeof state.settings];
      
      if (typeof currentSettings === 'object' && currentSettings !== null) {
        return {
          settings: {
            ...state.settings,
            [indicator]: {
              ...currentSettings,
              [key]: value,
            },
          },
        };
      } else {
        return {
          settings: {
            ...state.settings,
            [indicator]: value,
          },
        };
      }
    });
  }),

  setSettings: jest.fn((settings) => {
    set({ settings });
  }),

  updateSetting: jest.fn((key, value) => {
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      },
    }));
  }),

  reset: jest.fn(() => {
    set(initialState);
  }),
}));

// Mock getState method to return current state
(useIndicatorStore as any).getState = jest.fn(() => {
  const store = useIndicatorStore();
  return {
    indicators: store.indicators,
    settings: store.settings,
    setIndicators: store.setIndicators,
    updateIndicator: store.updateIndicator,
    setIndicatorEnabled: store.setIndicatorEnabled,
    setIndicatorSetting: store.setIndicatorSetting,
    setSettings: store.setSettings,
    updateSetting: store.updateSetting,
    reset: store.reset,
  };
});

// Mock setState method
(useIndicatorStore as any).setState = jest.fn((partial) => {
  const currentState = (useIndicatorStore as any).getState();
  const newState = typeof partial === 'function' ? partial(currentState) : partial;
  Object.assign(currentState, newState);
});

// Mock subscribe method
(useIndicatorStore as any).subscribe = jest.fn((listener) => {
  return jest.fn(); // Unsubscribe function
});