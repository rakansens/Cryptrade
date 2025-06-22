import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { ChatMessage } from './types';
import { createSessionSlice, SessionSlice } from './session.store';
import { createMessageSlice, MessageSlice } from './message.store';
import { createUISlice, UISlice } from './ui.store';

export type ChatStore = SessionSlice & MessageSlice & UISlice;

export const useChatStoreBase = create<ChatStore>()(
  persist(
    subscribeWithSelector<ChatStore>((set, get) => ({
      ...createSessionSlice(set, get),
      ...createMessageSlice(set, get),
      ...createUISlice(set, get),
    })),
    {
      name: 'chat-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          const migratedState = { ...persistedState };
          if (migratedState.messagesBySession) {
            Object.keys(migratedState.messagesBySession).forEach(sessionId => {
              migratedState.messagesBySession[sessionId] = migratedState.messagesBySession[sessionId].map((msg: ChatMessage) => ({
                ...msg,
                type: msg.type || 'text',
              }));
            });
          }
          return migratedState;
        }
        if (version === 1) {
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

export const useChatStore = <T>(selector: (state: ChatStore) => T) => {
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

export * from './types';

