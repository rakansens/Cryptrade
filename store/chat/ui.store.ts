import { createStoreDebugger } from '@/lib/utils/zustand-helpers';

export interface UISlice {
  isOpen: boolean;
  isStreaming: boolean;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isCollapsed: boolean;
  inputValue: string;
  isInputFromHomeScreen: boolean;
  error: string | null;
  setOpen: (open: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCollapsed: () => void;
  setInputValue: (value: string, fromHomeScreen?: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const debug = createStoreDebugger('ChatUISlice');

export const createUISlice = (set: any, get: any): UISlice => ({
  isOpen: false,
  isStreaming: false,
  isLoading: false,
  isSidebarOpen: true,
  isCollapsed: false,
  inputValue: '',
  isInputFromHomeScreen: false,
  error: null,

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
    set((state: UISlice) => ({ isCollapsed: !state.isCollapsed }));
  },

  setInputValue: (value, fromHomeScreen = false) => {
    set({ inputValue: value, isInputFromHomeScreen: fromHomeScreen });
  },

  setError: (error) => {
    debug('setError');
    set({ error });
  },

  reset: () => {
    debug('reset');
    // Reset UI state
    set({
      isOpen: false,
      isStreaming: false,
      isLoading: false,
      isSidebarOpen: true,
      isCollapsed: false,
      inputValue: '',
      isInputFromHomeScreen: false,
      error: null,
    });
    // Also reset sessions and messages
    const state = get();
    if (state.resetSessions) state.resetSessions();
    if (state.resetMessages) state.resetMessages();
  },
});

