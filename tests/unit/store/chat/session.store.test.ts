/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useChatStoreBase, useChatActions, useChatSessions, useChatCurrentSession } from '@/store/chat';

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

// Mock chat API
jest.mock('@/lib/api/chat-api', () => ({
  ChatAPI: {
    createSession: jest.fn(),
    updateSessionTitle: jest.fn(),
    deleteSession: jest.fn(),
    getSessions: jest.fn(),
  }
}));

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('Chat Session Store', () => {
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
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    
    expect(sessionsResult.current).toEqual({});
    expect(currentSessionResult.current).toBeNull();
  });

  it('should create a new session', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    act(() => {
      actionsResult.current.createSession();
    });
    
    const sessions = Object.keys(sessionsResult.current);
    expect(sessions).toHaveLength(1);
    expect(currentSessionResult.current).toBe(sessions[0]);
    expect(sessionsResult.current[sessions[0]]).toMatchObject({
      title: 'New Conversation',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });
  });

  it('should switch between sessions', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create two sessions
    let session1: string;
    let session2: string;
    
    act(() => {
      actionsResult.current.createSession();
      session1 = currentSessionResult.current!;
      actionsResult.current.createSession();
      session2 = currentSessionResult.current!;
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(2);
    expect(currentSessionResult.current).toBe(session2);
    
    // Switch back to first session
    act(() => {
      actionsResult.current.switchSession(session1);
    });
    
    expect(currentSessionResult.current).toBe(session1);
  });

  it('should rename a session', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create a session
    let sessionId: string;
    act(() => {
      actionsResult.current.createSession();
      sessionId = Object.keys(sessionsResult.current)[0];
    });
    
    // Rename it
    const newTitle = 'Updated Conversation';
    act(() => {
      actionsResult.current.renameSession(sessionId, newTitle);
    });
    
    expect(sessionsResult.current[sessionId].title).toBe(newTitle);
    expect(sessionsResult.current[sessionId].updatedAt).toBeGreaterThan(
      sessionsResult.current[sessionId].createdAt
    );
  });

  it('should delete a session', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create two sessions
    let session1: string;
    let session2: string;
    
    act(() => {
      actionsResult.current.createSession();
      session1 = currentSessionResult.current!;
      actionsResult.current.createSession();
      session2 = currentSessionResult.current!;
    });
    
    // Delete the current session
    act(() => {
      actionsResult.current.deleteSession(session2);
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(1);
    expect(sessionsResult.current[session2]).toBeUndefined();
    expect(currentSessionResult.current).toBe(session1); // Should switch to remaining session
  });

  it('should delete all sessions', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create multiple sessions
    act(() => {
      actionsResult.current.createSession();
      actionsResult.current.createSession();
      actionsResult.current.createSession();
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(3);
    
    // Delete all
    act(() => {
      actionsResult.current.deleteAllSessions();
    });
    
    expect(sessionsResult.current).toEqual({});
    expect(currentSessionResult.current).toBeNull();
  });
});
