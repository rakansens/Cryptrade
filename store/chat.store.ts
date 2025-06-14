import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';
import { ChatAPI } from '@/lib/api/chat-api';
import type { ProposalGroup, EntryProposalGroup } from '@/types/store.types';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  type?: 'text' | 'proposal' | 'entry';
  proposalGroup?: ProposalGroup;
  entryProposalGroup?: EntryProposalGroup;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  // Sessions
  sessions: Record<string, ChatSession>;
  currentSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  
  // UI state
  isOpen: boolean;
  isStreaming: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isCollapsed: boolean;
  
  // Input
  inputValue: string;
  isInputFromHomeScreen: boolean;
  
  // Error state
  error: string | null;
  
  // DB sync state
  isDbEnabled: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
}

interface ChatActions {
  // Sessions
  createSession: () => Promise<string>;
  switchSession: (sessionId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
  
  // Messages
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  updateLastMessage: (sessionId: string, contentOrMessage: string | Partial<ChatMessage>) => void;
  clearMessages: (sessionId: string) => void;
  
  // UI state
  setOpen: (open: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCollapsed: () => void;
  
  // Input
  setInputValue: (value: string, fromHomeScreen?: boolean) => void;
  
  // Error
  setError: (error: string | null) => void;
  
  // DB sync
  enableDbSync: () => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
  
  // Reset
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

const debug = createStoreDebugger('ChatStore');

const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const generateSessionTitle = (firstMessage: string) => {
  return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
};

const useChatStoreBase = create<ChatStore>()(
  persist(
    subscribeWithSelector<ChatStore>((set, get) => ({
      // Initial state
      sessions: {},
      currentSessionId: null,
      messagesBySession: {},
      isOpen: false,
      isStreaming: false,
      isLoading: false,
      isSidebarOpen: true,
      isCollapsed: false,
      inputValue: '',
      isInputFromHomeScreen: false,
      error: null,
      isDbEnabled: true,
      isSyncing: false,
      lastSyncTime: null,
      
      // Session actions with DB integration
      createSession: async () => {
        debug('createSession');
        const state = get();
        
        try {
          if (state.isDbEnabled) {
            // Create in database
            const chatSession = await ChatAPI.createSession();
            
            set((state) => ({
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
            // Local-only mode (fallback)
            const sessionId = generateSessionId();
            const session: ChatSession = {
              id: sessionId,
              title: 'New Conversation',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            
            set((state) => ({
              sessions: {
                ...state.sessions,
                [sessionId]: session,
              },
              messagesBySession: {
                ...state.messagesBySession,
                [sessionId]: [],
              },
              currentSessionId: sessionId,
            }));
            
            logger.info('[ChatStore] Session created locally', { sessionId });
            return sessionId;
          }
        } catch (error) {
          logger.error('[ChatStore] Failed to create session', { error });
          // Fallback to local creation
          const sessionId = generateSessionId();
          const session: ChatSession = {
            id: sessionId,
            title: 'New Conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          
          set((state) => ({
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
          
          // Load messages from DB if needed
          if (state.isDbEnabled && (!state.messagesBySession[sessionId] || state.messagesBySession[sessionId].length === 0)) {
            try {
              const sessionData = await ChatAPI.getSessionWithMessages(sessionId);
              if (sessionData) {
                const messages = sessionData.messages.map(msg => 
                  ChatAPI.convertToChatMessage(msg)
                );
                
                set((state) => ({
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
        
        set((state) => {
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
          };
        });
        
        // Update in database if enabled
        if (state.isDbEnabled) {
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
        
        set((state) => {
          const newSessions = { ...state.sessions };
          const newMessagesBySession = { ...state.messagesBySession };
          
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
          };
        });
        
        // Delete from database if enabled
        if (state.isDbEnabled) {
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
        
        // Delete all sessions from DB if enabled
        if (state.isDbEnabled) {
          const sessionIds = Object.keys(state.sessions);
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
      
      // Message actions with DB integration
      addMessage: async (sessionId, message) => {
        debug('addMessage');
        const state = get();
        const timestamp = Date.now();
        const newMessage: ChatMessage = {
          ...message,
          id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp,
        };
        
        // Update local state immediately
        set((state) => {
          const currentMessages = state.messagesBySession[sessionId] || [];
          const newMessages = [...currentMessages, newMessage];
          
          // Auto-generate title from first user message
          const shouldUpdateTitle = message.role === 'user' && 
            currentMessages.length === 0 && 
            state.sessions[sessionId]?.title === 'New Conversation';
          
          return {
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: newMessages,
            },
            sessions: shouldUpdateTitle ? {
              ...state.sessions,
              [sessionId]: {
                ...state.sessions[sessionId],
                title: generateSessionTitle(message.content),
                updatedAt: Date.now(),
              },
            } : state.sessions,
            error: null,
          };
        });
        
        // Save to database if enabled
        if (state.isDbEnabled) {
          try {
            const dbMessage = await ChatAPI.addMessage(sessionId, message);
            
            // Update message ID to match DB
            set((state) => {
              const messages = [...(state.messagesBySession[sessionId] || [])];
              const lastIndex = messages.length - 1;
              if (lastIndex >= 0 && messages[lastIndex].timestamp === timestamp) {
                messages[lastIndex] = {
                  ...messages[lastIndex],
                  id: dbMessage.id,
                };
              }
              
              return {
                messagesBySession: {
                  ...state.messagesBySession,
                  [sessionId]: messages,
                },
              };
            });
            
            // Update title in DB if needed
            const updatedState = get();
            if (message.role === 'user' && 
                state.messagesBySession[sessionId]?.length === 1 &&
                updatedState.sessions[sessionId]?.title !== 'New Conversation') {
              await ChatAPI.updateSessionTitle(
                sessionId, 
                updatedState.sessions[sessionId].title
              );
            }
          } catch (error) {
            logger.error('[ChatStore] Failed to save message to DB', { error, sessionId });
            set({ error: 'Failed to save message. Working offline.' });
          }
        }
        
        logger.info('[ChatStore] Message added', { sessionId, role: message.role });
      },
      
      updateLastMessage: (sessionId, contentOrMessage) => {
        debug('updateLastMessage');
        set((state) => {
          const messages = [...(state.messagesBySession[sessionId] || [])];
          if (messages.length > 0) {
            if (typeof contentOrMessage === 'string') {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content: contentOrMessage,
              };
            } else {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                ...contentOrMessage,
              };
              
              logger.info('[ChatStore] Updated message with proposal data', {
                sessionId,
                messageId: messages[messages.length - 1].id,
                type: contentOrMessage.type,
                hasProposalGroup: !!contentOrMessage.proposalGroup,
                proposalGroupId: contentOrMessage.proposalGroup?.id,
              });
            }
          }
          return {
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: messages,
            },
          };
        });
      },
      
      clearMessages: (sessionId) => {
        debug('clearMessages');
        set((state) => ({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: [],
          },
        }));
        logger.info('[ChatStore] Messages cleared', { sessionId });
      },
      
      // UI actions (unchanged)
      setOpen: (open) => {
        debug('setOpen');
        set({ isOpen: open });
      },
      
      setStreaming: (streaming) => {
        debug('setStreaming');
        set({ isStreaming: streaming });
      },
      
      setLoading: (loading) => {
        debug('setLoading');
        set({ isLoading: loading });
      },
      
      setSidebarOpen: (open) => {
        debug('setSidebarOpen');
        set({ isSidebarOpen: open });
      },
      
      toggleCollapsed: () => {
        debug('toggleCollapsed');
        set((state) => ({ isCollapsed: !state.isCollapsed }));
      },
      
      setInputValue: (value, fromHomeScreen = false) => {
        set({ inputValue: value, isInputFromHomeScreen: fromHomeScreen });
      },
      
      setError: (error) => {
        debug('setError');
        set({ error });
      },
      
      // DB sync actions
      enableDbSync: async () => {
        debug('enableDbSync');
        set({ isDbEnabled: true });
        
        // Migrate existing data to DB
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
            set({ error: 'Failed to enable database sync' });
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
          // Sync current data to DB
          await ChatAPI.migrateFromLocalStorage({
            sessions: state.sessions,
            messages: state.messagesBySession,
          });
          
          set({ lastSyncTime: Date.now(), isSyncing: false });
          logger.info('[ChatStore] Data synced with database');
        } catch (error) {
          logger.error('[ChatStore] Failed to sync with database', { error });
          set({ isSyncing: false, error: 'Failed to sync with database' });
        }
      },
      
      loadFromDatabase: async () => {
        debug('loadFromDatabase');
        const state = get();
        
        if (!state.isDbEnabled) return;
        
        set({ isLoading: true });
        
        try {
          const dbSessions = await ChatAPI.getUserSessions();
          const sessions: Record<string, ChatSession> = {};
          const messagesBySession: Record<string, ChatMessage[]> = {};
          
          for (const dbSession of dbSessions) {
            sessions[dbSession.id] = dbSession;
            
            // Load messages for each session
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
          });
          
          logger.info('[ChatStore] Data loaded from database', { 
            sessionCount: dbSessions.length 
          });
        } catch (error) {
          logger.error('[ChatStore] Failed to load from database', { error });
          set({ isLoading: false, error: 'Failed to load from database' });
        }
      },
      
      reset: () => {
        debug('reset');
        set({
          sessions: {},
          currentSessionId: null,
          messagesBySession: {},
          isOpen: false,
          isStreaming: false,
          isLoading: false,
          isSidebarOpen: true,
          isCollapsed: false,
          inputValue: '',
          error: null,
        });
      },
    })),
    {
      name: 'chat-storage',
      version: 2, // Increment version for DB integration
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // Migration from version 0 to 1
          const migratedState = { ...persistedState };
          
          if (migratedState.messagesBySession) {
            Object.keys(migratedState.messagesBySession).forEach(sessionId => {
              migratedState.messagesBySession[sessionId] = 
                migratedState.messagesBySession[sessionId].map((msg: ChatMessage) => ({
                  ...msg,
                  type: msg.type || 'text',
                }));
            });
          }
          
          return migratedState;
        }
        
        if (version === 1) {
          // Migration from version 1 to 2
          return {
            ...persistedState,
            isDbEnabled: true,
            isSyncing: false,
            lastSyncTime: null,
          };
        }
        
        return persistedState;
      },
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        messagesBySession: state.messagesBySession,
        isDbEnabled: state.isDbEnabled,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);

// Export the base store for internal use
export { useChatStoreBase };

// Export all the same hooks as before
export const useChatStore = <T>(
  selector: (state: ChatStore) => T
) => {
  return useChatStoreBase(selector);
};

export const useChatSessions = () => 
  useChatStore(state => state.sessions);

export const useChatCurrentSession = () => 
  useChatStore(state => state.currentSessionId);

export const useChatMessages = () => {
  const currentSessionId = useChatCurrentSession();
  const messagesBySession = useChatStore(state => state.messagesBySession);
  return currentSessionId ? messagesBySession[currentSessionId] || [] : [];
};

export const useChatMessagesBySession = () => 
  useChatStore(state => state.messagesBySession);

export const useChatOpen = () => 
  useChatStore(state => state.isOpen);

export const useChatStreaming = () => 
  useChatStore(state => state.isStreaming);

export const useChatLoading = () => 
  useChatStore(state => state.isLoading);

export const useChatSidebarOpen = () => 
  useChatStore(state => state.isSidebarOpen);

export const useChatCollapsed = () => 
  useChatStore(state => state.isCollapsed);

export const useChatInput = () => 
  useChatStore(state => state.inputValue);

export const useChatIsInputFromHomeScreen = () =>
  useChatStore(state => state.isInputFromHomeScreen);

export const useChatError = () => 
  useChatStore(state => state.error);

export const useChatDbEnabled = () =>
  useChatStore(state => state.isDbEnabled);

export const useChatSyncing = () =>
  useChatStore(state => state.isSyncing);

// Actions hook
export const useChatActions = () => {
  const createSession = useChatStoreBase(state => state.createSession);
  const switchSession = useChatStoreBase(state => state.switchSession);
  const selectSession = useChatStoreBase(state => state.selectSession);
  const renameSession = useChatStoreBase(state => state.renameSession);
  const deleteSession = useChatStoreBase(state => state.deleteSession);
  const deleteAllSessions = useChatStoreBase(state => state.deleteAllSessions);
  const addMessage = useChatStoreBase(state => state.addMessage);
  const updateLastMessage = useChatStoreBase(state => state.updateLastMessage);
  const clearMessages = useChatStoreBase(state => state.clearMessages);
  const setOpen = useChatStoreBase(state => state.setOpen);
  const setStreaming = useChatStoreBase(state => state.setStreaming);
  const setLoading = useChatStoreBase(state => state.setLoading);
  const setSidebarOpen = useChatStoreBase(state => state.setSidebarOpen);
  const toggleCollapsed = useChatStoreBase(state => state.toggleCollapsed);
  const setInputValue = useChatStoreBase(state => state.setInputValue);
  const setError = useChatStoreBase(state => state.setError);
  const enableDbSync = useChatStoreBase(state => state.enableDbSync);
  const disableDbSync = useChatStoreBase(state => state.disableDbSync);
  const syncWithDatabase = useChatStoreBase(state => state.syncWithDatabase);
  const loadFromDatabase = useChatStoreBase(state => state.loadFromDatabase);
  const reset = useChatStoreBase(state => state.reset);
  
  return {
    createSession,
    switchSession,
    selectSession,
    renameSession,
    deleteSession,
    deleteAllSessions,
    addMessage,
    updateLastMessage,
    clearMessages,
    setOpen,
    setStreaming,
    setLoading,
    setSidebarOpen,
    toggleCollapsed,
    setInputValue,
    setError,
    enableDbSync,
    disableDbSync,
    syncWithDatabase,
    loadFromDatabase,
    reset,
  };
};

// Combined hook
export const useChat = () => {
  const sessions = useChatSessions();
  const currentSessionId = useChatCurrentSession();
  const messages = useChatMessages();
  const messagesBySession = useChatMessagesBySession();
  const isOpen = useChatOpen();
  const isStreaming = useChatStreaming();
  const isLoading = useChatLoading();
  const isSidebarOpen = useChatSidebarOpen();
  const isCollapsed = useChatCollapsed();
  const inputValue = useChatInput();
  const isInputFromHomeScreen = useChatIsInputFromHomeScreen();
  const error = useChatError();
  const isDbEnabled = useChatDbEnabled();
  const isSyncing = useChatSyncing();
  const actions = useChatActions();
  
  return {
    sessions,
    currentSessionId,
    messages,
    messagesBySession,
    isOpen,
    isStreaming,
    isLoading,
    isSidebarOpen,
    isCollapsed,
    inputValue,
    isInputFromHomeScreen,
    error,
    isDbEnabled,
    isSyncing,
    ...actions,
  };
};