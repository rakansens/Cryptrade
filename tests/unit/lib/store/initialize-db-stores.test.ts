import { initializeDbStores, checkDbStatus, syncAllStores } from '@/lib/store/initialize-db-stores';
import useAnalysisHistoryBase from '@/store/analysis-history.store';
import { useChatStoreBase } from '@/store/chat.store';
import { useConversationMemory } from '@/lib/store/conversation-memory.store';
import { useEnhancedConversationMemory } from '@/lib/store/enhanced-conversation-memory.store';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock stores
jest.mock('@/store/analysis-history.store');
jest.mock('@/store/chat.store');
jest.mock('@/lib/store/conversation-memory.store');
jest.mock('@/lib/store/enhanced-conversation-memory.store');

describe('Store: initializeDbStores', () => {
  const mockLoadFromDatabase = jest.fn().mockResolvedValue(undefined);
  const mockSyncWithDatabase = jest.fn().mockResolvedValue(undefined);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock stores
    (useAnalysisHistoryBase.getState as jest.Mock).mockReturnValue({
      loadFromDatabase: mockLoadFromDatabase,
      syncWithDatabase: mockSyncWithDatabase,
      isDbEnabled: true,
    });
    
    (useChatStoreBase.getState as jest.Mock).mockReturnValue({
      loadFromDatabase: mockLoadFromDatabase,
      syncWithDatabase: mockSyncWithDatabase,
      isDbEnabled: true,
    });
    
    (useConversationMemory.getState as jest.Mock).mockReturnValue({
      loadFromDatabase: mockLoadFromDatabase,
      syncWithDatabase: mockSyncWithDatabase,
      isDbEnabled: true,
    });
    
    (useEnhancedConversationMemory.getState as jest.Mock).mockReturnValue({
      loadFromDatabase: mockLoadFromDatabase,
      syncWithDatabase: mockSyncWithDatabase,
      isDbEnabled: true,
    });
  });

  it('should initialize all stores and load data from database', async () => {
    await initializeDbStores();
    
    expect(logger.info).toHaveBeenCalledWith('[DbStores] Initializing database-enabled stores...');
    expect(mockLoadFromDatabase).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenCalledWith('[DbStores] All stores initialized with database sync enabled');
  });

  it('should handle initialization errors gracefully', async () => {
    mockLoadFromDatabase.mockRejectedValueOnce(new Error('Database error'));
    
    await initializeDbStores();
    
    expect(logger.error).toHaveBeenCalledWith('[DbStores] Failed to initialize database stores', {
      error: expect.any(Error)
    });
  });

  it('should check database status for all stores', () => {
    const status = checkDbStatus();
    
    expect(status).toEqual({
      analysisHistory: true,
      chat: true,
      conversationMemory: true,
      enhancedMemory: true,
      chartPersistence: true,
    });
  });

  it('should sync all stores with database', async () => {
    await syncAllStores();
    
    expect(logger.info).toHaveBeenCalledWith('[DbStores] Syncing all stores with database...');
    expect(mockSyncWithDatabase).toHaveBeenCalledTimes(4);
    expect(logger.info).toHaveBeenCalledWith('[DbStores] All stores synced successfully');
  });

  it('should handle sync errors gracefully', async () => {
    mockSyncWithDatabase.mockRejectedValueOnce(new Error('Sync error'));
    
    await syncAllStores();
    
    expect(logger.error).toHaveBeenCalledWith('[DbStores] Failed to sync stores', {
      error: expect.any(Error)
    });
  });

  it('should skip initialization on server-side', async () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;
    
    await initializeDbStores();
    
    // Should not call any getState methods when window is undefined
    expect(useAnalysisHistoryBase.getState).not.toHaveBeenCalled();
    expect(useChatStoreBase.getState).not.toHaveBeenCalled();
    expect(useConversationMemory.getState).not.toHaveBeenCalled();
    expect(useEnhancedConversationMemory.getState).not.toHaveBeenCalled();
    
    global.window = originalWindow;
  });
});
