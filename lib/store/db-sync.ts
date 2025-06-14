import { ConversationMemoryAPI } from '@/lib/api/conversation-memory-api';
import { logger } from '@/lib/utils/logger';
import type { ConversationMessage, ConversationSession } from '@/types/conversation-memory';

interface SyncState {
  currentSessionId?: string | null;
  sessions: Record<string, ConversationSession>;
  isDbEnabled: boolean;
  isSyncing: boolean;
}

type SetFn<T> = (fn: (state: T) => void) => void;
type GetFn<T> = () => T;

export function createDbSyncHandlers<T extends SyncState>(set: SetFn<T>, get: GetFn<T>) {
  return {
    enableDbSync: async () => {
      set((state) => { state.isDbEnabled = true; });
      const state = get();
      if (Object.keys(state.sessions).length > 0) {
        try {
          set((s) => { s.isSyncing = true; });
          for (const session of Object.values(state.sessions)) {
            for (const message of session.messages) {
              await ConversationMemoryAPI.addMessage({
                sessionId: session.id,
                role: message.role,
                content: message.content,
                agentId: message.agentId,
                metadata: message.metadata,
              });
            }
          }
          set((s) => { s.isSyncing = false; });
          logger.info('[ConversationMemory] DB sync enabled and data migrated');
        } catch (error) {
          logger.error('[ConversationMemory] Failed to migrate to DB', { error });
          set((s) => { s.isSyncing = false; });
        }
      }
    },

    disableDbSync: () => {
      set((state) => { state.isDbEnabled = false; });
      logger.info('[ConversationMemory] DB sync disabled');
    },

    syncWithDatabase: async () => {
      const state = get();
      if (!state.isDbEnabled) return;
      set((s) => { s.isSyncing = true; });
      try {
        for (const session of Object.values(state.sessions)) {
          for (const message of session.messages) {
            await ConversationMemoryAPI.addMessage({
              sessionId: session.id,
              role: message.role,
              content: message.content,
              agentId: message.agentId,
              metadata: message.metadata,
            });
          }
        }
        set((s) => { s.isSyncing = false; });
        logger.info('[ConversationMemory] Synced with database');
      } catch (error) {
        logger.error('[ConversationMemory] Sync failed', { error });
        set((s) => { s.isSyncing = false; });
      }
    },

    loadFromDatabase: async () => {
      const state = get();
      if (!state.isDbEnabled) return;
      try {
        const sessions: Record<string, ConversationSession> = {};
        set((s) => {
          s.sessions = sessions;
          if (Object.keys(sessions).length > 0) {
            s.currentSessionId = Object.keys(sessions)[0];
          }
        });
        logger.info('[ConversationMemory] Loaded from database', { sessionCount: Object.keys(sessions).length });
      } catch (error) {
        logger.error('[ConversationMemory] Failed to load from database', { error });
      }
    },
  };
}
