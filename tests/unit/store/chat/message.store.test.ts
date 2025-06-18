/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useChatStoreBase, useChatActions, useChatMessages, useChatMessagesBySession } from '@/store/chat';

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
    addMessage: jest.fn(),
    updateSessionTitle: jest.fn(),
  }
}));

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('Chat Message Store', () => {
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
    const { result } = renderHook(() => useChatMessagesBySession());
    
    expect(result.current).toEqual({});
  });

  it('should add messages to a session', async () => {
    const { result: messagesResult } = renderHook(() => useChatMessagesBySession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const sessionId = 'test-session';
    const message = {
      role: 'user' as const,
      content: 'Hello, world!',
    };
    
    await act(async () => {
      await actionsResult.current.addMessage(sessionId, message);
    });
    
    expect(messagesResult.current[sessionId]).toHaveLength(1);
    expect(messagesResult.current[sessionId][0]).toMatchObject({
      role: 'user',
      content: 'Hello, world!',
    });
    expect(messagesResult.current[sessionId][0].id).toBeDefined();
    expect(messagesResult.current[sessionId][0].timestamp).toBeDefined();
  });

  it('should update the last message in a session', async () => {
    const { result: messagesResult } = renderHook(() => useChatMessagesBySession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const sessionId = 'test-session';
    
    // First add a message
    await act(async () => {
      await actionsResult.current.addMessage(sessionId, {
        role: 'assistant' as const,
        content: 'Initial content',
      });
    });
    
    // Then update it
    act(() => {
      actionsResult.current.updateLastMessage(sessionId, 'Updated content');
    });
    
    expect(messagesResult.current[sessionId][0].content).toBe('Updated content');
  });

  it('should clear messages for a session', async () => {
    const { result: messagesResult } = renderHook(() => useChatMessagesBySession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const sessionId = 'test-session';
    
    // Add some messages
    await act(async () => {
      await actionsResult.current.addMessage(sessionId, {
        role: 'user' as const,
        content: 'Message 1',
      });
      await actionsResult.current.addMessage(sessionId, {
        role: 'assistant' as const,
        content: 'Message 2',
      });
    });
    
    expect(messagesResult.current[sessionId]).toHaveLength(2);
    
    // Clear messages
    act(() => {
      actionsResult.current.clearMessages(sessionId);
    });
    
    expect(messagesResult.current[sessionId]).toHaveLength(0);
  });

  it('should handle multiple sessions independently', async () => {
    const { result: messagesResult } = renderHook(() => useChatMessagesBySession());
    const { result: actionsResult } = renderHook(() => useChatActions());
    
    const session1 = 'session-1';
    const session2 = 'session-2';
    
    await act(async () => {
      await actionsResult.current.addMessage(session1, {
        role: 'user' as const,
        content: 'Session 1 message',
      });
      await actionsResult.current.addMessage(session2, {
        role: 'user' as const,
        content: 'Session 2 message',
      });
    });
    
    expect(messagesResult.current[session1]).toHaveLength(1);
    expect(messagesResult.current[session2]).toHaveLength(1);
    expect(messagesResult.current[session1][0].content).toBe('Session 1 message');
    expect(messagesResult.current[session2][0].content).toBe('Session 2 message');
  });
});
