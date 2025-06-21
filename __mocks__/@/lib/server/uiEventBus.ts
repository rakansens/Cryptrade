// Mock for UI Event Bus
export const emitUIEvent = jest.fn();
export const subscribeToUIEvents = jest.fn(() => ({
  unsubscribe: jest.fn(),
}));
export const getUIEventHistory = jest.fn(() => []);
export const clearUIEventHistory = jest.fn();