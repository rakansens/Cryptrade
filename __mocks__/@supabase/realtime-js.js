// Mock for @supabase/realtime-js
module.exports = {
  RealtimeClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    channel: jest.fn(() => ({
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
  default: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    channel: jest.fn(() => ({
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
};