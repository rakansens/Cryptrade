// Mock for zustand middleware in tests

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
  if (name && global.localStorage && typeof global.localStorage.getItem === 'function') {
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
    if (name && global.localStorage && typeof global.localStorage.setItem === 'function') {
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

// Mock devtools middleware
const devtools = (config) => config;

// Mock immer middleware
const immer = (config) => (set, get, api) => {
  const baseConfig = config(
    (fn) => set((state) => {
      if (typeof fn === 'function') {
        // Simple immer mock - just return the result of the function
        const draft = { ...state };
        fn(draft);
        return draft;
      }
      return fn;
    }),
    get,
    api
  );
  
  return baseConfig;
};

// Export all middleware mocks
module.exports = {
  persist,
  subscribeWithSelector,
  devtools,
  immer,
};