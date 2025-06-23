export const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
  willLog: jest.fn(() => true),
  setLevel: jest.fn(),
  getLevel: jest.fn(() => 'error'),
  clearThrottle: jest.fn(),
};