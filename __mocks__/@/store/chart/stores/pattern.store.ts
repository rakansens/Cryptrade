/**
 * Updated: Complete redesign of pattern store mock to match actual implementation
 * Changes: Added Map-based state, async initialization, and proper pattern management
 */

import { create } from 'zustand';

// Define types inline to avoid import issues in mock
interface PatternVisualization {
  points: Array<{ x: number; y: number }>;
  lines: Array<any>;
  areas: Array<any>;
}

interface PatternMetrics {
  accuracy: number;
  strength: number;
  reliability: number;
}

interface PatternData {
  id: string;
  type: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  visualization: PatternVisualization;
  metrics?: PatternMetrics;
  description?: string;
  tradingImplication?: string;
  confidence?: number;
}

interface PatternState {
  patterns: Map<string, PatternData>;
}

interface PatternActions {
  addPattern: (id: string, pattern: PatternData) => void;
  removePattern: (id: string) => void;
  clearPatterns: () => void;
  getPattern: (id: string) => PatternData | undefined;
  initializePatterns: () => Promise<void>;
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

jest.mock('@/components/ui/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@/lib/storage/chart-persistence-wrapper', () => ({
  chartPersistence: {
    loadPatterns: jest.fn(() => Promise.resolve([])),
    savePatterns: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

// Mock UUID generation
const generateUUID = jest.fn(() => `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

// Define initial state
const initialState: PatternState = {
  patterns: new Map<string, PatternData>(),
};

// Mock pattern for testing
const createMockPattern = (id: string = 'test-pattern'): PatternData => ({
  id,
  type: 'head-and-shoulders',
  symbol: 'BTCUSDT',
  interval: '1h',
  startTime: Date.now() - 86400000, // 24 hours ago
  endTime: Date.now(),
  visualization: {
    points: [
      { x: 100, y: 200 },
      { x: 200, y: 150 },
      { x: 300, y: 200 }
    ],
    lines: [],
    areas: []
  },
  metrics: {
    accuracy: 0.85,
    strength: 0.7,
    reliability: 0.8
  },
  description: 'Mock head and shoulders pattern',
  tradingImplication: 'Bearish reversal expected',
  confidence: 0.8
});

// Create mock store that matches the actual implementation structure
export const usePatternStore = create<PatternState & PatternActions>()((set, get) => ({
  // Initial state
  ...initialState,
  patterns: new Map(), // Will be loaded asynchronously

  // Initialize patterns asynchronously
  initializePatterns: jest.fn(async () => {
    try {
      const patternsArray: PatternData[] = [];
      const patterns = new Map(patternsArray.map(p => [p.id || generateUUID(), p]));
      set({ patterns });
    } catch (error) {
      // Handle error silently in mock
    }
  }),

  // Actions
  addPattern: jest.fn((id, pattern) => {
    set((state) => {
      const newPatterns = new Map(state.patterns);
      newPatterns.set(id, pattern);
      return { patterns: newPatterns };
    });
  }),

  removePattern: jest.fn((id) => {
    set((state) => {
      const newPatterns = new Map(state.patterns);
      newPatterns.delete(id);
      return { patterns: newPatterns };
    });
  }),

  clearPatterns: jest.fn(() => {
    const emptyPatterns = new Map<string, PatternData>();
    set({ patterns: emptyPatterns });
  }),

  getPattern: jest.fn((id) => {
    const { patterns } = get();
    return patterns.get(id);
  }),

  reset: jest.fn(() => {
    set(initialState);
  }),
}));

// Mock getState method to return current state
(usePatternStore as any).getState = jest.fn(() => {
  const store = usePatternStore();
  return {
    patterns: store.patterns,
    initializePatterns: store.initializePatterns,
    addPattern: store.addPattern,
    removePattern: store.removePattern,
    clearPatterns: store.clearPatterns,
    getPattern: store.getPattern,
    reset: store.reset,
  };
});

// Mock setState method
(usePatternStore as any).setState = jest.fn((partial) => {
  const currentState = (usePatternStore as any).getState();
  const newState = typeof partial === 'function' ? partial(currentState) : partial;
  Object.assign(currentState, newState);
});

// Mock subscribe method
(usePatternStore as any).subscribe = jest.fn((listener) => {
  return jest.fn(); // Unsubscribe function
});

// Export mock pattern helper for tests
export { createMockPattern, generateUUID };