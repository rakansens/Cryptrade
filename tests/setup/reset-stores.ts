// Store Reset Utility - Centralized Zustand store cleanup

let storeResetFns: (() => void)[] = [];

// Register a store reset function
export const registerStoreReset = (resetFn: () => void) => {
  storeResetFns.push(resetFn);
};

// Reset all registered stores
export const resetAllStores = () => {
  storeResetFns.forEach(resetFn => {
    try {
      resetFn();
    } catch (error) {
      // Silently ignore errors during store reset
      console.debug('[Store Reset] Error resetting store:', error);
    }
  });
};

// Clear all registered reset functions
export const clearStoreResets = () => {
  storeResetFns = [];
};

console.log('[Store Reset] Store cleanup utility initialized');