// __mocks__/@/lib/utils/logger.ts
// 変更点: Jest 用のロガーモックを追加して logger.logger.info などのネスト呼び出しを解決する

const createMockLogger = () => {
  const methods = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    critical: jest.fn(),
    time: jest.fn(),
    timeEnd: jest.fn(),
    willLog: jest.fn(() => true),
    setLevel: jest.fn(),
    getLevel: jest.fn(() => 'debug'),
    clearThrottle: jest.fn(),
  } as const;

  // self-reference で logger.logger.info も通るようにする
  return Object.assign({}, methods, { logger: methods });
};

// Create the mocked logger instance
const mockLoggerInstance = createMockLogger();

// Export the logger with original property for tests that expect it
export const logger = mockLoggerInstance;

export default { logger }; 