/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';;
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
    createSession: jest.fn().mockImplementation(() => {
      const id = `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return Promise.resolve({
        id,
        title: 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }),
    updateSessionTitle: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    getSessions: jest.fn().mockResolvedValue([]),
    getSessionWithMessages: jest.fn().mockResolvedValue({ messages: [] }),
    getUserSessions: jest.fn().mockResolvedValue([]),
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
    // Reset the store to initial state
    act(() => {
      useChatStoreBase.getState().reset();
    });
  });

  it('should have initial state', () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    
    expect(sessionsResult.current).toEqual({});
    expect(currentSessionResult.current).toBeNull();
  });

  it('should create a new session', async () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    await act(async () => {
      await actionsResult.current.createSession();
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

  it('should switch between sessions', async () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create two sessions
    let session1: string;
    let session2: string;
    
    await act(async () => {
      session1 = await actionsResult.current.createSession();
      session2 = await actionsResult.current.createSession();
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(2);
    expect(currentSessionResult.current).toBe(session2);
    
    // Switch back to first session
    await act(async () => {
      await actionsResult.current.switchSession(session1);
    });
    
    expect(currentSessionResult.current).toBe(session1);
  });

  it('should rename a session', async () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create a session
    let sessionId: string;
    await act(async () => {
      sessionId = await actionsResult.current.createSession();
    });
    
    // Rename it
    const newTitle = 'Updated Conversation';
    await act(async () => {
      await actionsResult.current.renameSession(sessionId!, newTitle);
    });
    
    expect(sessionsResult.current[sessionId!].title).toBe(newTitle);
    expect(sessionsResult.current[sessionId!].updatedAt).toBeGreaterThan(
      sessionsResult.current[sessionId!].createdAt
    );
  });

  it('should delete a session', async () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create two sessions
    let session1: string;
    let session2: string;
    
    await act(async () => {
      session1 = await actionsResult.current.createSession();
      session2 = await actionsResult.current.createSession();
    });
    
    // Delete the current session
    await act(async () => {
      await actionsResult.current.deleteSession(session2);
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(1);
    expect(sessionsResult.current[session2]).toBeUndefined();
    expect(currentSessionResult.current).toBe(session1); // Should switch to remaining session
  });

  it('should delete all sessions', async () => {
    const { result: sessionsResult } = renderHook(() => useChatSessions());
    const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    // Create multiple sessions
    await act(async () => {
      await actionsResult.current.createSession();
      await actionsResult.current.createSession();
      await actionsResult.current.createSession();
    });
    
    expect(Object.keys(sessionsResult.current)).toHaveLength(3);
    
    // Delete all
    await act(async () => {
      await actionsResult.current.deleteAllSessions();
    });
    
    expect(sessionsResult.current).toEqual({});
    expect(currentSessionResult.current).toBeNull();
  });
});
