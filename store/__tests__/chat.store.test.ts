import { act, renderHook } from '@testing-library/react';
import {
  useChatStore,
  useChatSessions,
  useChatCurrentSession,
  useChatMessages,
  useChatMessagesBySession,
  useChatOpen,
  useChatStreaming,
  useChatLoading,
  useChatSidebarOpen,
  useChatCollapsed,
  useChatInput,
  useChatIsInputFromHomeScreen,
  useChatError,
  useChatActions,
  useChat,
  type ChatMessage,
  type ChatSession,
} from '@/store/chat.store';

// Import the base store for direct access
// @ts-ignore - importing private export for testing
import { useChatStoreBase } from '@/store/chat.store';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock zustand helpers
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: jest.fn(() => jest.fn()),
}));

// Mock localStorage for persist middleware
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Chat Store', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Reset store
    act(() => {
      useChatStoreBase.getState().reset();
    });
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/);

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(Object.keys(sessionsResult.current)).toHaveLength(1);
      expect(sessionsResult.current[sessionId]).toBeDefined();
      expect(sessionsResult.current[sessionId].title).toBe('New Conversation');

      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBe(sessionId);
    });

    it('should switch between sessions', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId1: string = '';
      let sessionId2: string = '';

      act(() => {
        sessionId1 = result.current.createSession();
        sessionId2 = result.current.createSession();
      });

      const { result: currentSessionResult2 } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult2.current).toBe(sessionId2);

      act(() => {
        result.current.switchSession(sessionId1);
      });

      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBe(sessionId1);
    });

    it('should rename a session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.renameSession(sessionId, 'Custom Title');
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(sessionsResult.current[sessionId].title).toBe('Custom Title');
      expect(sessionsResult.current[sessionId].updatedAt).toBeGreaterThan(
        sessionsResult.current[sessionId].createdAt
      );
    });

    it('should delete a session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId1: string = '';
      let sessionId2: string = '';

      act(() => {
        sessionId1 = result.current.createSession();
        sessionId2 = result.current.createSession();
      });

      act(() => {
        result.current.deleteSession(sessionId2);
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(Object.keys(sessionsResult.current)).toHaveLength(1);
      expect(sessionsResult.current[sessionId1]).toBeDefined();
      expect(sessionsResult.current[sessionId2]).toBeUndefined();

      // Should switch to remaining session
      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBe(sessionId1);
    });

    it('should delete all sessions', () => {
      const { result } = renderHook(() => useChatActions());

      act(() => {
        result.current.createSession();
        result.current.createSession();
        result.current.createSession();
      });

      act(() => {
        result.current.deleteAllSessions();
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(Object.keys(sessionsResult.current)).toHaveLength(0);

      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBeNull();
    });

    it('should handle deleting the current session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId1: string = '';
      let sessionId2: string = '';
      let sessionId3: string = '';

      act(() => {
        sessionId1 = result.current.createSession();
        sessionId2 = result.current.createSession();
        sessionId3 = result.current.createSession();
      });

      // Delete current session (sessionId3)
      act(() => {
        result.current.deleteSession(sessionId3);
      });

      // Should switch to first remaining session
      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBe(sessionId1);
    });
  });

  describe('Message Management', () => {
    it('should add messages to a session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'Hello',
          role: 'user',
        });
      });

      const { result: messagesResult } = renderHook(() => useChatMessages());
      expect(messagesResult.current).toHaveLength(1);
      expect(messagesResult.current[0]).toMatchObject({
        content: 'Hello',
        role: 'user',
        id: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('should auto-generate session title from first user message', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'What is the weather like today in Tokyo?',
          role: 'user',
        });
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(sessionsResult.current[sessionId].title).toBe('What is the weather like today...');
    });

    it('should not change title after first message', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'First message',
          role: 'user',
        });
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'Second message that is much longer than the first',
          role: 'user',
        });
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(sessionsResult.current[sessionId].title).toBe('First message');
    });

    it('should update the last message', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'Initial content',
          role: 'assistant',
        });
      });

      act(() => {
        result.current.updateLastMessage(sessionId, 'Updated content');
      });

      const { result: messagesResult } = renderHook(() => useChatMessages());
      expect(messagesResult.current[0].content).toBe('Updated content');
    });

    it('should update last message with proposal data', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, {
          content: 'Initial',
          role: 'assistant',
        });
      });

      const proposalData = {
        content: 'Updated with proposal',
        type: 'proposal' as const,
        proposalGroup: { id: 'proposal-1', drawings: [] },
      };

      act(() => {
        result.current.updateLastMessage(sessionId, proposalData);
      });

      const { result: messagesResult } = renderHook(() => useChatMessages());
      expect(messagesResult.current[0]).toMatchObject({
        content: 'Updated with proposal',
        type: 'proposal',
        proposalGroup: { id: 'proposal-1', drawings: [] },
      });
    });

    it('should clear messages for a session', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId, { content: 'Message 1', role: 'user' });
        result.current.addMessage(sessionId, { content: 'Message 2', role: 'assistant' });
      });

      act(() => {
        result.current.clearMessages(sessionId);
      });

      const { result: messagesResult } = renderHook(() => useChatMessages());
      expect(messagesResult.current).toHaveLength(0);
    });

    it('should handle messages for different sessions independently', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId1: string = '';
      let sessionId2: string = '';

      act(() => {
        sessionId1 = result.current.createSession();
        sessionId2 = result.current.createSession();
      });

      act(() => {
        result.current.addMessage(sessionId1, { content: 'Session 1 Message', role: 'user' });
        result.current.addMessage(sessionId2, { content: 'Session 2 Message', role: 'user' });
      });

      const { result: messagesBySessionResult } = renderHook(() => useChatMessagesBySession());
      expect(messagesBySessionResult.current[sessionId1]).toHaveLength(1);
      expect(messagesBySessionResult.current[sessionId2]).toHaveLength(1);
      expect(messagesBySessionResult.current[sessionId1][0].content).toBe('Session 1 Message');
      expect(messagesBySessionResult.current[sessionId2][0].content).toBe('Session 2 Message');
    });
  });

  describe('UI State Management', () => {
    it('should manage open state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: openResult } = renderHook(() => useChatOpen());

      expect(openResult.current).toBe(false);

      act(() => {
        result.current.setOpen(true);
      });

      expect(openResult.current).toBe(true);
    });

    it('should manage streaming state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: streamingResult } = renderHook(() => useChatStreaming());

      expect(streamingResult.current).toBe(false);

      act(() => {
        result.current.setStreaming(true);
      });

      expect(streamingResult.current).toBe(true);
    });

    it('should manage loading state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: loadingResult } = renderHook(() => useChatLoading());

      expect(loadingResult.current).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(loadingResult.current).toBe(true);
    });

    it('should manage sidebar state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: sidebarResult } = renderHook(() => useChatSidebarOpen());

      expect(sidebarResult.current).toBe(true);

      act(() => {
        result.current.setSidebarOpen(false);
      });

      expect(sidebarResult.current).toBe(false);
    });

    it('should toggle collapsed state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: collapsedResult } = renderHook(() => useChatCollapsed());

      expect(collapsedResult.current).toBe(false);

      act(() => {
        result.current.toggleCollapsed();
      });

      expect(collapsedResult.current).toBe(true);

      act(() => {
        result.current.toggleCollapsed();
      });

      expect(collapsedResult.current).toBe(false);
    });
  });

  describe('Input Management', () => {
    it('should manage input value', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: inputResult } = renderHook(() => useChatInput());

      expect(inputResult.current).toBe('');

      act(() => {
        result.current.setInputValue('Test input');
      });

      expect(inputResult.current).toBe('Test input');
    });

    it('should track input source from home screen', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: fromHomeResult } = renderHook(() => useChatIsInputFromHomeScreen());

      expect(fromHomeResult.current).toBe(false);

      act(() => {
        result.current.setInputValue('From home', true);
      });

      expect(fromHomeResult.current).toBe(true);

      act(() => {
        result.current.setInputValue('Not from home');
      });

      expect(fromHomeResult.current).toBe(false);
    });
  });

  describe('Error Management', () => {
    it('should manage error state', () => {
      const { result } = renderHook(() => useChatActions());
      const { result: errorResult } = renderHook(() => useChatError());

      expect(errorResult.current).toBeNull();

      act(() => {
        result.current.setError('Test error');
      });

      expect(errorResult.current).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });

      expect(errorResult.current).toBeNull();
    });

    it('should clear error when adding a message', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
        result.current.setError('Previous error');
      });

      act(() => {
        result.current.addMessage(sessionId, { content: 'New message', role: 'user' });
      });

      const { result: errorResult } = renderHook(() => useChatError());
      expect(errorResult.current).toBeNull();
    });
  });

  describe('Combined Hook', () => {
    it('should provide all state and actions through useChat', () => {
      const { result } = renderHook(() => useChat());

      expect(result.current).toHaveProperty('sessions');
      expect(result.current).toHaveProperty('currentSessionId');
      expect(result.current).toHaveProperty('messages');
      expect(result.current).toHaveProperty('messagesBySession');
      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('isStreaming');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isSidebarOpen');
      expect(result.current).toHaveProperty('isCollapsed');
      expect(result.current).toHaveProperty('inputValue');
      expect(result.current).toHaveProperty('isInputFromHomeScreen');
      expect(result.current).toHaveProperty('error');

      // Actions
      expect(result.current).toHaveProperty('createSession');
      expect(result.current).toHaveProperty('switchSession');
      expect(result.current).toHaveProperty('deleteSession');
      expect(result.current).toHaveProperty('addMessage');
      expect(result.current).toHaveProperty('updateLastMessage');
      expect(result.current).toHaveProperty('setOpen');
      expect(result.current).toHaveProperty('setStreaming');
      expect(result.current).toHaveProperty('setLoading');
      expect(result.current).toHaveProperty('reset');
    });

    it('should handle complex chat workflow', () => {
      const { result } = renderHook(() => useChat());

      // Create session and send message
      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
        result.current.setOpen(true);
        result.current.setInputValue('Hello AI!');
      });

      // Send message
      act(() => {
        result.current.addMessage(sessionId, {
          content: result.current.inputValue,
          role: 'user',
        });
        result.current.setInputValue('');
        result.current.setLoading(true);
      });

      // Simulate AI response
      act(() => {
        result.current.setLoading(false);
        result.current.setStreaming(true);
        result.current.addMessage(sessionId, {
          content: '',
          role: 'assistant',
        });
      });

      // Stream response
      act(() => {
        result.current.updateLastMessage(sessionId, 'Hello');
      });

      act(() => {
        result.current.updateLastMessage(sessionId, 'Hello! How can I help you today?');
      });

      act(() => {
        result.current.setStreaming(false);
      });

      // Verify final state
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toMatchObject({
        content: 'Hello AI!',
        role: 'user',
      });
      expect(result.current.messages[1]).toMatchObject({
        content: 'Hello! How can I help you today?',
        role: 'assistant',
      });
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useChat());

      // Set up some state
      act(() => {
        const sessionId = result.current.createSession();
        result.current.addMessage(sessionId, { content: 'Test', role: 'user' });
        result.current.setOpen(true);
        result.current.setStreaming(true);
        result.current.setLoading(true);
        result.current.setSidebarOpen(false);
        result.current.toggleCollapsed();
        result.current.setInputValue('Some input');
        result.current.setError('Some error');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify initial state
      expect(result.current.sessions).toEqual({});
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSidebarOpen).toBe(true);
      expect(result.current.isCollapsed).toBe(false);
      expect(result.current.inputValue).toBe('');
      expect(result.current.error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid session IDs gracefully', () => {
      const { result } = renderHook(() => useChatActions());

      act(() => {
        result.current.switchSession('non-existent-session');
      });

      const { result: currentSessionResult } = renderHook(() => useChatCurrentSession());
      expect(currentSessionResult.current).toBeNull();
    });

    it('should handle empty message updates', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.createSession();
      });

      // Try to update last message when no messages exist
      act(() => {
        result.current.updateLastMessage(sessionId, 'Updated content');
      });

      const { result: messagesResult } = renderHook(() => useChatMessages());
      expect(messagesResult.current).toHaveLength(0);
    });

    it('should handle very long session titles', () => {
      const { result } = renderHook(() => useChatActions());

      let sessionId: string = '';
      const longMessage = 'This is a very long message that exceeds the 30 character limit for session titles and should be truncated';

      act(() => {
        sessionId = result.current.createSession();
        result.current.addMessage(sessionId, {
          content: longMessage,
          role: 'user',
        });
      });

      const { result: sessionsResult } = renderHook(() => useChatSessions());
      expect(sessionsResult.current[sessionId].title).toBe('This is a very long message th...');
      expect(sessionsResult.current[sessionId].title.length).toBe(33); // 30 chars + "..."
    });
  });
});