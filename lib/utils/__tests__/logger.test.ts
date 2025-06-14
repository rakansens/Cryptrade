import {
  Logger,
  ConsoleTransport,
  NoopTransport,
  SentryTransport,
  createLogger,
  type ILogTransport,
  type LogEntry,
  type LogLevel
} from '../logger';

// Mock console to avoid actual console output during tests
const mockConsole = {
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
};

// Save original console
const originalConsole = global.console;

// Mock transport for testing
class MockTransport implements ILogTransport {
  public logs: LogEntry[] = [];

  log(entry: LogEntry): void {
    this.logs.push(entry);
  }

  clear(): void {
    this.logs = [];
  }

  getLastLog(): LogEntry | undefined {
    return this.logs[this.logs.length - 1];
  }

  getLogsForLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
}

describe('Logger Transport System', () => {
  beforeEach(() => {
    // Replace console with mock
    global.console = mockConsole as any;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
  });

  describe('Transport Implementations', () => {
    describe('ConsoleTransport', () => {
      it('should log to console when enabled', () => {
        const transport = new ConsoleTransport(true);
        const entry: LogEntry = {
          level: 'info',
          message: 'test message',
          meta: { key: 'value' },
          timestamp: new Date(),
          environment: 'test'
        };

        transport.log(entry);

        expect(mockConsole.log).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]'),
          undefined
        );
      });

      it('should not log when disabled', () => {
        const transport = new ConsoleTransport(false);
        const entry: LogEntry = {
          level: 'info',
          message: 'test message',
          timestamp: new Date(),
          environment: 'test'
        };

        transport.log(entry);

        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('should use correct console method for each log level', () => {
        const transport = new ConsoleTransport(true);
        const baseEntry = {
          message: 'test',
          timestamp: new Date(),
          environment: 'test'
        };

        transport.log({ ...baseEntry, level: 'debug' });
        expect(mockConsole.debug).toHaveBeenCalled();

        transport.log({ ...baseEntry, level: 'info' });
        expect(mockConsole.log).toHaveBeenCalled();

        transport.log({ ...baseEntry, level: 'warn' });
        expect(mockConsole.warn).toHaveBeenCalled();

        transport.log({ ...baseEntry, level: 'error' });
        expect(mockConsole.error).toHaveBeenCalled();
      });
    });

    describe('NoopTransport', () => {
      it('should do nothing when logging', () => {
        const transport = new NoopTransport();
        const entry: LogEntry = {
          level: 'error',
          message: 'critical error',
          timestamp: new Date(),
          environment: 'test'
        };

        // Should not throw and should not call console
        expect(() => transport.log(entry)).not.toThrow();
        expect(mockConsole.error).not.toHaveBeenCalled();
      });
    });

    describe('SentryTransport', () => {
      it('should handle error logs when enabled', () => {
        const transport = new SentryTransport(true);
        const entry: LogEntry = {
          level: 'error',
          message: 'test error',
          error: new Error('test'),
          meta: { context: 'test' },
          timestamp: new Date(),
          environment: 'test'
        };

        transport.log(entry);

        // Should log the Sentry stub message
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[SENTRY STUB] Would send to Sentry:',
          expect.objectContaining({
            message: 'test error',
            level: 'error'
          })
        );
      });

      it('should not log when disabled', () => {
        const transport = new SentryTransport(false);
        const entry: LogEntry = {
          level: 'error',
          message: 'test error',
          error: new Error('test'),
          timestamp: new Date(),
          environment: 'test'
        };

        transport.log(entry);

        expect(mockConsole.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Logger Core', () => {
    let mockTransport: MockTransport;
    let logger: Logger;

    beforeEach(() => {
      mockTransport = new MockTransport();
      logger = new Logger([mockTransport], {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 1000
      });
    });

    it('should send log entries to all transports', () => {
      const mockTransport2 = new MockTransport();
      const multiLogger = new Logger([mockTransport, mockTransport2], {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 1000
      });

      multiLogger.info('test message');

      expect(mockTransport.logs).toHaveLength(1);
      expect(mockTransport2.logs).toHaveLength(1);
      expect(mockTransport.getLastLog()?.message).toBe('test message');
      expect(mockTransport2.getLastLog()?.message).toBe('test message');
    });

    it('should respect log levels', () => {
      const warnLogger = new Logger([mockTransport], {
        level: 'warn',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 1000
      });

      warnLogger.debug('debug message');
      warnLogger.info('info message');
      warnLogger.warn('warn message');
      warnLogger.error('error message');

      expect(mockTransport.logs).toHaveLength(2);
      expect(mockTransport.getLogsForLevel('warn')).toHaveLength(1);
      expect(mockTransport.getLogsForLevel('error')).toHaveLength(1);
    });

    it('should include metadata in log entries', () => {
      const metadata = { userId: 123, action: 'login' };
      logger.info('user action', metadata);

      const logEntry = mockTransport.getLastLog();
      expect(logEntry?.meta).toEqual(metadata);
      expect(logEntry?.level).toBe('info');
      expect(logEntry?.message).toBe('user action');
    });

    it('should handle errors in log entries', () => {
      const error = new Error('test error');
      logger.error('something failed', { context: 'test' }, error);

      const logEntry = mockTransport.getLastLog();
      expect(logEntry?.error).toBe(error);
      expect(logEntry?.level).toBe('error');
    });

    it('should continue logging even if a transport fails', () => {
      const failingTransport: ILogTransport = {
        log: () => {
          throw new Error('Transport failed');
        }
      };
      
      const resilientLogger = new Logger([failingTransport, mockTransport], {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 1000
      });

      resilientLogger.info('test message');

      // Should still log to the working transport
      expect(mockTransport.logs).toHaveLength(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Transport failed:',
        expect.any(Error)
      );
    });

    it('should support throttling', () => {
      const throttledLogger = new Logger([mockTransport], {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 1000
      });

      // Log the same message multiple times quickly
      throttledLogger.debug('repeated message');
      throttledLogger.debug('repeated message');
      throttledLogger.debug('repeated message');

      // Should only log once due to throttling
      expect(mockTransport.logs).toHaveLength(1);
    });
  });

  describe('Logger Factory', () => {
    it('should create logger with console transport by default', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should create logger with noop transport when configured', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('API Compatibility', () => {
    let mockTransport: MockTransport;
    let logger: Logger;

    beforeEach(() => {
      mockTransport = new MockTransport();
      logger = new Logger([mockTransport], {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 1000
      });
    });

    it('should maintain the same API as the original logger', () => {
      // Test all methods exist and work as expected
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.time).toBe('function');
      expect(typeof logger.timeEnd).toBe('function');
      expect(typeof logger.willLog).toBe('function');
      expect(typeof logger.setLevel).toBe('function');
      expect(typeof logger.getLevel).toBe('function');
      expect(typeof logger.clearThrottle).toBe('function');

      // Test basic functionality
      logger.info('test');
      expect(mockTransport.logs).toHaveLength(1);
    });

    it('should support willLog method', () => {
      logger.setLevel('warn');
      
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(false);
      expect(logger.willLog('warn')).toBe(true);
      expect(logger.willLog('error')).toBe(true);
    });

    it('should support level configuration', () => {
      expect(logger.getLevel()).toBe('debug');
      
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });
  });
});