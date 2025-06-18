// Mock for zustand store in tests
const { create: actualCreate, createStore: actualCreateStore } = jest.requireActual('zustand');

// Determine if we're in a DOM environment
const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

// Mock persist middleware
const persist = (config, options) => (set, get, api) => {
  const baseConfig = config(set, get, api);
  
  // Skip persistence in non-DOM environments
  if (!hasDOM) {
    return baseConfig;
  }
  
  // Simple persistence implementation for tests
  const { name, partialize = (state) => state, version = 0 } = options || {};
  
  // Load initial state if available
  let persistedState = null;
  if (name && global.localStorage) {
    try {
      const item = global.localStorage.getItem(name);
      if (item) {
        const parsed = JSON.parse(item);
        persistedState = parsed.state;
        
        // Run migration if needed
        if (options?.migrate && parsed.version !== version) {
          persistedState = options.migrate(persistedState, parsed.version);
        }
      }
    } catch (e) {
      // Ignore errors in tests
    }
  }
  
  // Apply persisted state
  if (persistedState) {
    set(persistedState, true);
  }
  
  // Setup persistence
  api.subscribe((state) => {
    if (name && global.localStorage) {
      try {
        const stateToPersist = partialize(state);
        global.localStorage.setItem(name, JSON.stringify({
          state: stateToPersist,
          version
        }));
      } catch (e) {
        // Ignore errors in tests
      }
    }
  });
  
  return {
    ...baseConfig,
    persist: {
      getOptions: () => options || {},
      rehydrate: () => Promise.resolve(),
      onRehydrateStorage: () => undefined,
      onFinishHydration: () => undefined,
      hasHydrated: () => true,
      setOptions: () => {},
    },
  };
};

// Mock subscribeWithSelector middleware
const subscribeWithSelector = (config) => (set, get, api) => {
  const baseConfig = config(set, get, api);
  const listeners = new Set();
  
  // Override subscribe to support selector subscriptions
  const subscribe = (listener, selector, equalityFn) => {
    if (selector) {
      let currentState = selector(get());
      const wrappedListener = (state) => {
        const nextState = selector(state);
        if (!equalityFn || !equalityFn(currentState, nextState)) {
          currentState = nextState;
          listener(nextState, currentState);
        }
      };
      listeners.add(wrappedListener);
      const unsubscribe = api.subscribe(wrappedListener);
      return () => {
        listeners.delete(wrappedListener);
        unsubscribe();
      };
    }
    return api.subscribe(listener);
  };
  
  return {
    ...baseConfig,
    subscribe,
  };
};

// Export mocked zustand
module.exports = {
  create: (stateCreator) => {
    // Handle cases where stateCreator is wrapped with middleware
    const store = actualCreate(stateCreator);
    
    // Add setState wrapper for test compatibility with react
    const setState = store.setState;
    store.setState = (...args) => {
      // Only use act if we're in a DOM environment and act is available
      if (hasDOM && typeof require !== 'undefined') {
        try {
          const { act } = require('@testing-library/react');
          act(() => setState(...args));
        } catch (e) {
          // If act is not available, just call setState directly
          setState(...args);
        }
      } else {
        setState(...args);
      }
    };
    
    return store;
  },
  createStore: actualCreateStore,
  persist,
  subscribeWithSelector,
};