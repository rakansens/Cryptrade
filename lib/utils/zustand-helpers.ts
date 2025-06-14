// Zustand debug helpers
import { isDevelopment } from '@/config/env';

export const createStoreDebugger = (storeName: string) => {
  return (action: string) => {
    if (isDevelopment()) {
      try {
        console.debug(`[${storeName}] ${action}`);
      } catch (error) {
        // Silently catch any errors in console.debug
      }
    }
  };
};