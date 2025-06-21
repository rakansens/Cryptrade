// Mock for conversation memory store
import { create } from 'zustand';

export const useConversationMemoryStore = create((set, get) => ({
  messages: [],
  addMessage: jest.fn((message) => {
    set(state => ({ messages: [...state.messages, message] }));
  }),
  clearMessages: jest.fn(() => {
    set({ messages: [] });
  }),
  updateMessage: jest.fn(),
  removeMessage: jest.fn(),
  getMessages: jest.fn(() => get().messages),
  getMessageById: jest.fn(),
  setMessages: jest.fn((messages) => set({ messages })),
}));