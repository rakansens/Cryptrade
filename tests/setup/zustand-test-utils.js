// tests/setup/zustand-test-utils.js
// Zustand test utilities with proper store mocking support

/**
 * Creates a mock Zustand store with full functionality
 * Supports getInitialState, reset, and proper selector caching
 */
const createZustandMock = () => {
  // Global cache to persist stores across tests
  if (!global.__zustand_store_cache__) {
    global.__zustand_store_cache__ = new Map();
  }
  const storeCache = global.__zustand_store_cache__;
  
  // Store instances cache for singleton behavior
  const storeInstances = new Map();
  
  const createStore = (stateCreator) => {
    let currentState = {};
    let initialState = {};
    const listeners = new Set();
    
    // Create a hook function that returns the current state
    const useStore = jest.fn((selector) => {
      if (selector) {
        return selector(currentState);
      }
      return currentState;
    });
    
    const setState = jest.fn((updater) => {
      const previousState = currentState;
      
      if (typeof updater === 'function') {
        // Handle function updater
        const draft = { ...currentState };
        const result = updater(draft);
        // If the updater returns something, use it; otherwise use the mutated draft
        currentState = result !== undefined ? result : draft;
      } else {
        // Handle partial state update - merge with existing state and functions
        currentState = { ...currentState, ...updater };
      }
      
      // Notify listeners
      listeners.forEach(listener => {
        try {
          listener(currentState, previousState);
        } catch (error) {
          console.error('Listener error:', error);
        }
      });
      
      // Update the hook's internal state to trigger re-renders
      useStore.mockImplementation((selector) => {
        if (selector) {
          return selector(currentState);
        }
        return currentState;
      });
    });
    
    const getState = jest.fn(() => currentState);
    
    const subscribe = jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });
    
    const destroy = jest.fn(() => {
      listeners.clear();
    });
    
    const api = {
      getState,
      setState,
      subscribe,
      destroy,
    };
    
    // Initialize state with proper function handling
    if (typeof stateCreator === 'function') {
      const createdState = stateCreator(setState, getState, api);
      currentState = createdState;
      
      // Store the initial state for reset functionality
      initialState = {};
      for (const key in createdState) {
        if (typeof createdState[key] !== 'function') {
          initialState[key] = createdState[key];
        }
      }
      
      // Set initial implementation with the full state including functions
      useStore.mockImplementation((selector) => {
        if (selector) {
          return selector(currentState);
        }
        return currentState;
      });
    }
    
    // Add store methods to the hook
    useStore.getState = getState;
    useStore.setState = setState;
    useStore.subscribe = subscribe;
    useStore.destroy = destroy;
    
    // Add getInitialState method
    useStore.getInitialState = jest.fn(() => {
      // Return only non-function properties from initial state
      const state = {};
      for (const key in initialState) {
        state[key] = initialState[key];
      }
      return state;
    });
    
    // Also expose them as properties for direct access
    Object.defineProperty(useStore, 'getState', {
      value: getState,
      writable: false,
      enumerable: true
    });
    Object.defineProperty(useStore, 'setState', {
      value: setState,
      writable: false,
      enumerable: true
    });
    Object.defineProperty(useStore, 'getInitialState', {
      value: useStore.getInitialState,
      writable: false,
      enumerable: true
    });
    
    return useStore;
  };
  
  return {
    create: jest.fn((stateCreatorOrConfig) => {
      // Handle curried version of create (TypeScript style)
      if (typeof stateCreatorOrConfig === 'undefined' || typeof stateCreatorOrConfig === 'object') {
        // This is the curried version: create<T>()(...) or create(config)(...)
        return (stateCreator) => {
          if (!stateCreator) {
            throw new Error('Zustand create called without state creator');
          }
          
          // Create a unique key for this creator function
          const creatorKey = `curried_${stateCreator.toString()}`;
          
          // Return cached store if it exists (for singleton stores)
          if (storeInstances.has(creatorKey)) {
            return storeInstances.get(creatorKey);
          }
          
          const store = createStore(stateCreator);
          storeInstances.set(creatorKey, store);
          return store;
        };
      }
      
      // Direct version: create(stateCreator)
      if (!stateCreatorOrConfig) {
        throw new Error('Zustand create called without state creator');
      }
      
      // Create a unique key for this creator function
      const creatorKey = `direct_${stateCreatorOrConfig.toString()}`;
      
      // Return cached store if it exists (for singleton stores)
      if (storeInstances.has(creatorKey)) {
        return storeInstances.get(creatorKey);
      }
      
      const store = createStore(stateCreatorOrConfig);
      storeInstances.set(creatorKey, store);
      return store;
    }),
  };
};

// Middleware mocks
const middlewareMocks = {
  createJSONStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
  persist: jest.fn((stateCreator, options) => {
    // Persist middleware just returns the state creator
    return stateCreator;
  }),
  subscribeWithSelector: jest.fn((stateCreator) => stateCreator),
  devtools: jest.fn((stateCreator, options) => stateCreator),
};

const immerMiddlewareMock = {
  immer: jest.fn((stateCreator) => stateCreator),
};

module.exports = {
  createZustandMock,
  middlewareMocks,
  immerMiddlewareMock,
};