/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';;
import { 
  useChatStoreBase, 
  useChatActions, 
  useChatOpen, 
  useChatStreaming, 
  useChatLoading,
  useChatSidebarOpen,
  useChatCollapsed,
  useChatInput,
  useChatError
} from '@/store/chat';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock zustand helpers
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: () => jest.fn()
}));

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('Chat UI Store', () => {
  // Helper to get initial state
  const getInitialState = (store) => {
    const state = store.getState();
    const initialState = {};
    for (const key in state) {
      if (typeof state[key] !== 'function') {
        initialState[key] = state[key];
      }
    }
    return initialState;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAllStores();
  });
  });

  it('should have initial state', () => {
    const { result: openResult } = renderHook(() => useChatOpen());
    const { result: streamingResult } = renderHook(() => useChatStreaming());
    const { result: loadingResult } = renderHook(() => useChatLoading());
    const { result: sidebarResult } = renderHook(() => useChatSidebarOpen());
    const { result: collapsedResult } = renderHook(() => useChatCollapsed());
    const { result: inputResult } = renderHook(() => useChatInput());
    const { result: errorResult } = renderHook(() => useChatError());
    
    expect(openResult.current).toBe(false);
    expect(streamingResult.current).toBe(false);
    expect(loadingResult.current).toBe(false);
    expect(sidebarResult.current).toBe(false);
    expect(collapsedResult.current).toBe(false);
    expect(inputResult.current).toBe('');
    expect(errorResult.current).toBeNull();
  });

  it('should toggle chat open state', () => {
    const { result: openResult } = renderHook(() => useChatOpen());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    expect(openResult.current).toBe(false);
    
    act(() => {
      actionsResult.current.setOpen(true);
    });
    
    expect(openResult.current).toBe(true);
    
    act(() => {
      actionsResult.current.setOpen(false);
    });
    
    expect(openResult.current).toBe(false);
  });

  it('should update streaming state', () => {
    const { result: streamingResult } = renderHook(() => useChatStreaming());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    act(() => {
      actionsResult.current.setStreaming(true);
    });
    
    expect(streamingResult.current).toBe(true);
    
    act(() => {
      actionsResult.current.setStreaming(false);
    });
    
    expect(streamingResult.current).toBe(false);
  });

  it('should update loading state', () => {
    const { result: loadingResult } = renderHook(() => useChatLoading());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    act(() => {
      actionsResult.current.setLoading(true);
    });
    
    expect(loadingResult.current).toBe(true);
    
    act(() => {
      actionsResult.current.setLoading(false);
    });
    
    expect(loadingResult.current).toBe(false);
  });

  it('should toggle sidebar', () => {
    const { result: sidebarResult } = renderHook(() => useChatSidebarOpen());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    act(() => {
      actionsResult.current.setSidebarOpen(true);
    });
    
    expect(sidebarResult.current).toBe(true);
    
    act(() => {
      actionsResult.current.setSidebarOpen(false);
    });
    
    expect(sidebarResult.current).toBe(false);
  });

  it('should toggle collapsed state', () => {
    const { result: collapsedResult } = renderHook(() => useChatCollapsed());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    expect(collapsedResult.current).toBe(false);
    
    act(() => {
      actionsResult.current.toggleCollapsed();
    });
    
    expect(collapsedResult.current).toBe(true);
    
    act(() => {
      actionsResult.current.toggleCollapsed();
    });
    
    expect(collapsedResult.current).toBe(false);
  });

  it('should update input value', () => {
    const { result: inputResult } = renderHook(() => useChatInput());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const testInput = 'Hello, how can I help you?';
    
    act(() => {
      actionsResult.current.setInputValue(testInput);
    });
    
    expect(inputResult.current).toBe(testInput);
    
    act(() => {
      actionsResult.current.setInputValue('');
    });
    
    expect(inputResult.current).toBe('');
  });

  it('should set and clear errors', () => {
    const { result: errorResult } = renderHook(() => useChatError());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const testError = 'Something went wrong';
    
    act(() => {
      actionsResult.current.setError(testError);
    });
    
    expect(errorResult.current).toBe(testError);
    
    act(() => {
      actionsResult.current.setError(null);
    });
    
    expect(errorResult.current).toBeNull();
  });
});
