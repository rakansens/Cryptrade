import { ChatAPI } from '@/lib/api/chat-api';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';
import type { ChatMessage, ChatSession } from './types';

export interface MessageSlice {
  messagesBySession: Record<string, ChatMessage[]>;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  updateLastMessage: (sessionId: string, contentOrMessage: string | Partial<ChatMessage>) => void;
  clearMessages: (sessionId: string) => void;
}

const debug = createStoreDebugger('ChatMessageSlice');

const generateSessionTitle = (firstMessage: string) => {
  return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
};

const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const createMessageSlice = (set: any, get: any): MessageSlice => ({
  messagesBySession: {},

  addMessage: async (sessionId, message) => {
    debug('addMessage');
    const state = get();
    const timestamp = Date.now();
    const newMessage: ChatMessage = {
      ...message,
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
    };

    set((state: any) => {
      const currentMessages = state.messagesBySession[sessionId] || [];
      const newMessages = [...currentMessages, newMessage];

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

    if (state.isDbEnabled && isValidUUID(sessionId)) {
      try {
        const dbMessage = await ChatAPI.addMessage(sessionId, message);

        set((state: any) => {
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
        set({ error: 'Failed to save message. Working offline.' } as any);
      }
    }

    logger.info('[ChatStore] Message added', { sessionId, role: message.role });
  },

  updateLastMessage: (sessionId, contentOrMessage) => {
    debug('updateLastMessage');
    set((state: any) => {
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
            type: (contentOrMessage as ChatMessage).type,
            hasProposalGroup: !!(contentOrMessage as ChatMessage).proposalGroup,
            proposalGroupId: (contentOrMessage as ChatMessage).proposalGroup?.id,
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
    set((state: any) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [],
      },
    }));
    logger.info('[ChatStore] Messages cleared', { sessionId });
  },
});

