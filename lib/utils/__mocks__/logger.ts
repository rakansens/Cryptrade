/**
 * Logger モック実装
 * テスト環境でのロギング動作を制御
 */

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
  
  // Additional mock methods for enhanced testing
  group: jest.fn(),
  groupEnd: jest.fn(),
  table: jest.fn(),
  trace: jest.fn(),
  
  // Test helpers
  reset: () => {
    Object.values(logger).forEach(value => {
      if (typeof value === 'function' && typeof (value as any).mockReset === 'function') {
        (value as jest.Mock).mockReset();
      }
    });
  },
  
  getLastLog: (level: 'debug' | 'info' | 'warn' | 'error') => {
    const mock = logger[level] as jest.Mock;
    const calls = mock.mock.calls;
    return calls.length > 0 ? calls[calls.length - 1] : null;
  },
  
  getAllLogs: (level?: 'debug' | 'info' | 'warn' | 'error') => {
    if (level) {
      return (logger[level] as jest.Mock).mock.calls;
    }
    
    // Return all logs from all levels
    const allLogs: any[] = [];
    ['debug', 'info', 'warn', 'error'].forEach(lvl => {
      const calls = (logger[lvl as keyof typeof logger] as jest.Mock).mock.calls;
      calls.forEach(call => {
        allLogs.push({ level: lvl, args: call, timestamp: Date.now() });
      });
    });
    return allLogs;
  }
};

// Auto-reset logger before each test if in test environment
if (typeof beforeEach !== 'undefined') {
  beforeEach(() => {
    logger.reset();
  });
}