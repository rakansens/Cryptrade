'use client';

import { useEffect } from 'react';
import { initializeDbStores } from '@/lib/store/initialize-db-stores';
import { logger } from '@/lib/utils/logger';

interface DbStoreProviderProps {
  children: React.ReactNode;
}

/**
 * Database Store Provider
 * 
 * Ensures all stores are initialized with database sync enabled
 * This should wrap the application at a high level
 */
export function DbStoreProvider({ children }: DbStoreProviderProps) {
  useEffect(() => {
    // Initialize database stores on mount
    initializeDbStores().catch(error => {
      logger.error('[DbStoreProvider] Failed to initialize stores', { error });
    });
  }, []);

  return <>{children}</>;
}