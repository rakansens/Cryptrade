import { ChatAPI } from '@/lib/api/chat-api';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';
import type { ChatMessage, ChatSession } from './types';

export interface SessionSlice {
  sessions: Record<string, ChatSession>;
  currentSessionId: string | null;
  isDbEnabled: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  createSession: () => Promise<string>;
  switchSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
  enableDbSync: () => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

const debug = createStoreDebugger('ChatSessionSlice');

const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const generateSessionTitle = (firstMessage: string) => {
  return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
};

const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const createSessionSlice = (set: any, get: any): SessionSlice => ({
  // State
  sessions: {},
  currentSessionId: null,
  isDbEnabled: true,
  isSyncing: false,
  lastSyncTime: null,

  // Actions
  createSession: async () => {
    debug('createSession');
    const state = get();

    try {
      if (state.isDbEnabled) {
        const chatSession = await ChatAPI.createSession();

        set((state: SessionSlice & { messagesBySession: Record<string, ChatMessage[]> }) => ({
          sessions: {
            ...state.sessions,
            [chatSession.id]: chatSession,
          },
          messagesBySession: {
            ...state.messagesBySession,
            [chatSession.id]: [],
          },
          currentSessionId: chatSession.id,
        }));

        logger.info('[ChatStore] Session created in DB', { sessionId: chatSession.id });
        return chatSession.id;
      } else {
        const sessionId = generateSessionId();
        const session: ChatSession = {
          id: sessionId,
          title: 'New Conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state: SessionSlice & { messagesBySession: Record<string, ChatMessage[]> }) => ({
          sessions: {
            ...state.sessions,
            [sessionId]: session,
          },
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: [],
          },
          currentSessionId: sessionId,
          error: 'Failed to create session in database. Working offline.',
        }));

        logger.info('[ChatStore] Session created locally', { sessionId });
        return sessionId;
      }
    } catch (error) {
      logger.error('[ChatStore] Failed to create session', { error });
      const sessionId = generateSessionId();
      const session: ChatSession = {
        id: sessionId,
        title: 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set((state: SessionSlice & { messagesBySession: Record<string, ChatMessage[]> }) => ({
        sessions: {
          ...state.sessions,
          [sessionId]: session,
        },
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: [],
        },
        currentSessionId: sessionId,
        error: 'Failed to create session in database. Working offline.',
      }));

      return sessionId;
    }
  },

  switchSession: async (sessionId) => {
    debug('switchSession');
    const state = get();

    if (state.sessions[sessionId]) {
      set({ currentSessionId: sessionId });

      if (state.isDbEnabled && isValidUUID(sessionId) && (!state.messagesBySession[sessionId] || state.messagesBySession[sessionId].length === 0)) {
        try {
          const sessionData = await ChatAPI.getSessionWithMessages(sessionId);
          if (sessionData) {
            const messages = sessionData.messages.map(msg => msg as ChatMessage);

            set((state: SessionSlice & { messagesBySession: Record<string, ChatMessage[]> }) => ({
              messagesBySession: {
                ...state.messagesBySession,
                [sessionId]: messages,
              },
            }));
          }
        } catch (error) {
          logger.error('[ChatStore] Failed to load messages from DB', { error, sessionId });
        }
      }

      logger.info('[ChatStore] Session switched', { sessionId });
    }
  },

  selectSession: async (sessionId) => {
    debug('selectSession');
    get().switchSession(sessionId);
  },

  renameSession: async (sessionId, title) => {
    debug('renameSession');
    const state = get();

    set((state: SessionSlice) => {
      if (!state.sessions[sessionId]) return state;

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...state.sessions[sessionId],
            title,
            updatedAt: Date.now(),
          },
        },
      } as SessionSlice;
    });

    if (state.isDbEnabled && isValidUUID(sessionId)) {
      try {
        await ChatAPI.updateSessionTitle(sessionId, title);
      } catch (error) {
        logger.error('[ChatStore] Failed to update session title in DB', { error, sessionId });
      }
    }

    logger.info('[ChatStore] Session renamed', { sessionId, title });
  },

  deleteSession: async (sessionId) => {
    debug('deleteSession');
    const state = get();

    set((state: SessionSlice & { messagesBySession: Record<string, ChatMessage[]> }) => {
      const newSessions = { ...state.sessions } as Record<string, ChatSession>;
      const newMessagesBySession = { ...state.messagesBySession } as Record<string, ChatMessage[]>;

      delete newSessions[sessionId];
      delete newMessagesBySession[sessionId];

      const remainingSessions = Object.keys(newSessions);
      const newCurrentSessionId = state.currentSessionId === sessionId
        ? (remainingSessions.length > 0 ? remainingSessions[0] : null)
        : state.currentSessionId;

      return {
        sessions: newSessions,
        messagesBySession: newMessagesBySession,
        currentSessionId: newCurrentSessionId,
      } as SessionSlice & { messagesBySession: Record<string, ChatMessage[]> };
    });

    if (state.isDbEnabled && isValidUUID(sessionId)) {
      try {
        await ChatAPI.deleteSession(sessionId);
      } catch (error) {
        logger.error('[ChatStore] Failed to delete session from DB', { error, sessionId });
      }
    }

    logger.info('[ChatStore] Session deleted', { sessionId });
  },

  deleteAllSessions: async () => {
    debug('deleteAllSessions');
    const state = get();

    if (state.isDbEnabled) {
      const sessionIds = Object.keys(state.sessions).filter(isValidUUID);
      for (const sessionId of sessionIds) {
        try {
          await ChatAPI.deleteSession(sessionId);
        } catch (error) {
          logger.error('[ChatStore] Failed to delete session from DB', { error, sessionId });
        }
      }
    }

    set({
      sessions: {},
      messagesBySession: {},
      currentSessionId: null,
    });

    logger.info('[ChatStore] All sessions deleted');
  },

  enableDbSync: async () => {
    debug('enableDbSync');
    set({ isDbEnabled: true });

    const state = get();
    if (Object.keys(state.sessions).length > 0) {
      try {
        await ChatAPI.migrateFromLocalStorage({
          sessions: state.sessions,
          messages: state.messagesBySession,
        });
        set({ lastSyncTime: Date.now() });
        logger.info('[ChatStore] DB sync enabled and data migrated');
      } catch (error) {
        logger.error('[ChatStore] Failed to migrate data to DB', { error });
        set({ error: 'Failed to enable database sync' } as any);
      }
    }
  },

  disableDbSync: () => {
    debug('disableDbSync');
    set({ isDbEnabled: false });
    logger.info('[ChatStore] DB sync disabled');
  },

  syncWithDatabase: async () => {
    debug('syncWithDatabase');
    const state = get();

    if (!state.isDbEnabled) return;

    set({ isSyncing: true });

    try {
      await ChatAPI.migrateFromLocalStorage({
        sessions: state.sessions,
        messages: state.messagesBySession,
      });

      set({ lastSyncTime: Date.now(), isSyncing: false });
      logger.info('[ChatStore] Data synced with database');
    } catch (error) {
      logger.error('[ChatStore] Failed to sync with database', { error });
      set({ isSyncing: false, error: 'Failed to sync with database' } as any);
    }
  },

  loadFromDatabase: async () => {
    debug('loadFromDatabase');
    const state = get();

    if (!state.isDbEnabled) return;

    set({ isLoading: true } as any);

    try {
      const dbSessions = await ChatAPI.getUserSessions();
      const sessions: Record<string, ChatSession> = {};
      const messagesBySession: Record<string, ChatMessage[]> = {};

      for (const dbSession of dbSessions) {
        sessions[dbSession.id] = dbSession;
        const sessionData = await ChatAPI.getSessionWithMessages(dbSession.id);
        if (sessionData) {
          messagesBySession[dbSession.id] = sessionData.messages;
        }
      }

      set({
        sessions,
        messagesBySession,
        currentSessionId: dbSessions.length > 0 ? dbSessions[0].id : null,
        isLoading: false,
        lastSyncTime: Date.now(),
      } as any);

      logger.info('[ChatStore] Data loaded from database', {
        sessionCount: dbSessions.length
      });
    } catch (error) {
      logger.error('[ChatStore] Failed to load from database', { error });
      set({ isLoading: false, error: 'Failed to load from database' } as any);
    }
  },
});

