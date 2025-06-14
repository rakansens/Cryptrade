/**
 * Database Store Initialization
 * 
 * Ensures all stores have their database sync enabled by default
 * This should be imported early in the application lifecycle
 */

import { logger } from '@/lib/utils/logger';
import useAnalysisHistoryBase from '@/store/analysis-history.store';
import { useChatStoreBase } from '@/store/chat.store';
import { useConversationMemory } from '@/lib/store/conversation-memory.store';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { chartPersistence } from '@/lib/storage/chart-persistence-wrapper';

/**
 * Initialize all database-enabled stores
 * This function should be called once on app startup
 */
export async function initializeDbStores(): Promise<void> {
  if (typeof window === 'undefined') {
    // Skip initialization on server-side
    return;
  }

  logger.info('[DbStores] Initializing database-enabled stores...');

  try {
    // Initialize stores that are already DB-enabled by default
    const analysisHistory = useAnalysisHistoryBase.getState();
    const chatStore = useChatStoreBase.getState();
    const conversationMemory = useConversationMemory.getState();
    const enhancedMemory = useEnhancedConversationMemory.getState();

    // Load data from database for all stores
    await Promise.all([
      analysisHistory.loadFromDatabase(),
      chatStore.loadFromDatabase(),
      conversationMemory.loadFromDatabase(),
      enhancedMemory.loadFromDatabase(),
    ]);

    // Chart persistence is already initialized by the wrapper
    logger.info('[DbStores] Chart persistence DB status:', {
      enabled: chartPersistence.isDatabaseEnabled(),
      sessionId: chartPersistence.getSessionId(),
    });

    logger.info('[DbStores] All stores initialized with database sync enabled');
  } catch (error) {
    logger.error('[DbStores] Failed to initialize database stores', { error });
  }
}

/**
 * Check database status for all stores
 */
export function checkDbStatus() {
  if (typeof window === 'undefined') {
    return {
      analysisHistory: false,
      chat: false,
      conversationMemory: false,
      enhancedMemory: false,
      chartPersistence: false,
    };
  }

  return {
    analysisHistory: useAnalysisHistoryBase.getState().isDbEnabled,
    chat: useChatStoreBase.getState().isDbEnabled,
    conversationMemory: useConversationMemory.getState().isDbEnabled,
    enhancedMemory: useEnhancedConversationMemory.getState().isDbEnabled,
    chartPersistence: chartPersistence.isDatabaseEnabled(),
  };
}

/**
 * Force sync all stores with database
 */
export async function syncAllStores(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  logger.info('[DbStores] Syncing all stores with database...');

  try {
    await Promise.all([
      useAnalysisHistoryBase.getState().syncWithDatabase(),
      useChatStoreBase.getState().syncWithDatabase(),
      useConversationMemory.getState().syncWithDatabase(),
      useEnhancedConversationMemory.getState().syncWithDatabase(),
    ]);

    logger.info('[DbStores] All stores synced successfully');
  } catch (error) {
    logger.error('[DbStores] Failed to sync stores', { error });
  }
}