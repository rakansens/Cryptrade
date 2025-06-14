// Zustand debug helpers
export const createStoreDebugger = (storeName: string) => {
  return (action: string) => {
    // Use process.env directly for client-side code (safe for NODE_ENV)
    if (process.env.NODE_ENV === 'development') {
      try {
        console.debug(`[${storeName}] ${action}`);
      } catch (error) {
        // Silently catch any errors in console.debug
      }
    }
  };
};