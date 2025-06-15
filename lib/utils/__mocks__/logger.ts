// Mock logger for testing
export const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
  willLog: jest.fn(() => true),
  setLevel: jest.fn(),
  getLevel: jest.fn(() => 'info'),
  clearThrottle: jest.fn(),
};