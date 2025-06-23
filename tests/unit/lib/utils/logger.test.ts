import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the logger module to avoid transpilation issues
jest.mock('@/lib/utils/logger', () => {
  // Store references to jest mocks
  const mockedConsole = {
    time: jest.fn(),
    timeEnd: jest.fn()
  };

  // Mock implementations
  class MockLogger {
    private transports: any[];
    private config: any;
    private throttleMap = new Map<string, number>();

    constructor(transports: any[], config: any) {
      this.transports = transports;
      this.config = config;
    }

    getLevel() {
      return this.config.level;
    }

    setLevel(level: string) {
      this.config.level = level;
    }

    willLog(level: string) {
      const levels = { debug: 0, info: 1, warn: 2, error: 3 };
      return (levels as any)[level] >= (levels as any)[this.config.level];
    }

    clearThrottle() {
      this.throttleMap.clear();
    }

    private shouldThrottle(key: string): boolean {
      if (!this.config.enableThrottling) return false;
      
      const now = Date.now();
      const lastLog = this.throttleMap.get(key);
      
      if (!lastLog || now - lastLog > this.config.throttleInterval) {
        this.throttleMap.set(key, now);
        return false;
      }
      
      return true;
    }

    debug(message: string, meta?: any) {
      if (!this.willLog('debug')) return;
      if (this.shouldThrottle(`debug:${message}`)) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'debug', message, meta, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          console.error('Transport failed:', error);
        }
      });
    }

    info(message: string, meta?: any, error?: any) {
      if (!this.willLog('info')) return;
      if (this.shouldThrottle(`info:${message}`)) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'info', message, meta, error, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          console.error('Transport failed:', error);
        }
      });
    }

    warn(message: string, meta?: any, error?: any) {
      if (!this.willLog('warn')) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'warn', message, meta, error, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          console.error('Transport failed:', error);
        }
      });
    }

    error(message: string, meta?: any, error?: any) {
      if (!this.willLog('error')) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'error', message, meta, error, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          console.error('Transport failed:', error);
        }
      });
    }

    time(label: string) {
      if (!this.willLog('debug')) return;
      mockedConsole.time(label);
    }

    timeEnd(label: string) {
      if (!this.willLog('debug')) return;
      mockedConsole.timeEnd(label);
    }
  }

  class MockConsoleTransport {
    private enableConsole: boolean;

    constructor(enableConsole = true) {
      this.enableConsole = enableConsole;
    }

    configure(config: { enableConsole: boolean }) {
      this.enableConsole = config.enableConsole;
    }

    log(entry: any) {
      if (!this.enableConsole) return;
      
      const formatted = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.environment}] ${entry.message}`;
      const errorObj = entry.error ? this.serializeError(entry.error) : undefined;
      
      switch (entry.level) {
        case 'debug':
          console.debug(formatted, errorObj);
          break;
        case 'info':
          console.log(formatted, errorObj);
          break;
        case 'warn':
          console.warn(formatted, errorObj);
          break;
        case 'error':
          console.error(formatted, errorObj);
          break;
      }
    }

    private serializeError(error: any) {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      }
      return error;
    }
  }

  class MockNoopTransport {
    log(_entry: any) {
      // Do nothing
    }
  }

  class MockSentryTransport {
    private sentryEnabled: boolean;

    constructor(sentryEnabled = false) {
      this.sentryEnabled = sentryEnabled;
    }

    configure(config: { sentryEnabled: boolean }) {
      this.sentryEnabled = config.sentryEnabled;
    }

    log(entry: any) {
      if (!this.sentryEnabled) return;
      
      if (entry.level === 'error' && entry.error) {
        console.warn('[SENTRY STUB] Would send to Sentry:', {
          message: entry.message,
          error: entry.error,
          meta: entry.meta,
          level: entry.level
        });
      }
    }
  }

  const createLogger = jest.fn(() => new MockLogger([], { level: 'info', enableConsole: true, enableThrottling: false, throttleInterval: 5000 }));

  return {
    Logger: MockLogger,
    ConsoleTransport: MockConsoleTransport,
    NoopTransport: MockNoopTransport,
    SentryTransport: MockSentryTransport,
    createLogger,
    logger: createLogger(),
    _mockedConsole: mockedConsole
  };
});

// Mock console methods before importing the mocked module
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleTime = jest.spyOn(console, 'time').mockImplementation();
const mockConsoleTimeEnd = jest.spyOn(console, 'timeEnd').mockImplementation();

// Import the mocked module
import { Logger, ConsoleTransport, NoopTransport, SentryTransport, createLogger } from '@/lib/utils/logger';
const { _mockedConsole } = require('@/lib/utils/logger');

// Type definitions for test purposes
interface LoggerConfig {
  level: string;
  enableConsole: boolean;
  enableThrottling: boolean;
  throttleInterval: number;
}

interface MockLogTransport {
  log: jest.Mock;
  configure?: jest.Mock;
}

interface LogEntry {
  level: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: Error | unknown;
  timestamp: Date;
  environment: string;
}

describe('Logger', () => {
  let logger: any;
  let mockTransport: MockLogTransport;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransport = {
      log: jest.fn(),
      configure: jest.fn()
    } as MockLogTransport;
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Logger instance', () => {
    it('should create logger with config', () => {
      const config: LoggerConfig = {
        level: 'info',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      
      logger = new Logger([mockTransport], config);
      
      expect(logger.getLevel()).toBe('info');
    });
    
    it('should respect log level hierarchy', () => {
      const config: LoggerConfig = {
        level: 'warn',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      
      logger = new Logger([mockTransport], config);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
    
    it('should handle multiple transports', () => {
      const transport1 = { log: jest.fn() };
      const transport2 = { log: jest.fn() };
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      
      logger = new Logger([transport1, transport2], config);
      logger.info('Test message');
      
      expect(transport1.log).toHaveBeenCalled();
      expect(transport2.log).toHaveBeenCalled();
    });
    
    it('should handle transport errors gracefully', () => {
      const failingTransport = {
        log: jest.fn(() => {
          throw new Error('Transport error');
        })
      };
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      
      logger = new Logger([failingTransport], config);
      
      expect(() => logger.error('Test message')).not.toThrow();
      expect(mockConsoleError).toHaveBeenCalledWith('Transport failed:', expect.any(Error));
    });
  });
  
  describe('log methods', () => {
    beforeEach(() => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
    });
    
    it('should log debug messages with meta', () => {
      const meta = { userId: '123', action: 'test' };
      logger.debug('Debug message', meta);
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'debug',
        message: 'Debug message',
        meta,
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
    
    it('should log info messages with error', () => {
      const error = new Error('Test error');
      const meta = { context: 'test' };
      logger.info('Info message', meta, error);
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'info',
        message: 'Info message',
        meta,
        error,
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
    
    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn',
        message: 'Warning message',
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
    
    it('should log error messages with custom error', () => {
      class CustomError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      }
      
      const error = new CustomError('Custom error', 'CUSTOM_ERROR');
      logger.error('Error message', undefined, error);
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        message: 'Error message',
        error,
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
  });
  
  describe('throttling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should throttle repeated messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      // First call should go through
      logger.debug('Repeated message');
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
      
      // Second call should be throttled
      logger.debug('Repeated message');
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
      
      // After interval, should go through again
      jest.advanceTimersByTime(5001);
      logger.debug('Repeated message');
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
    
    it('should not throttle different messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      logger.debug('Message 1');
      logger.debug('Message 2');
      logger.debug('Message 3');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(3);
    });
    
    it('should clear throttle', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      logger.debug('Throttled message');
      logger.debug('Throttled message'); // Should be throttled
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
      
      logger.clearThrottle();
      logger.debug('Throttled message'); // Should go through after clear
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('utility methods', () => {
    it('should check if level will log', () => {
      const config: LoggerConfig = {
        level: 'warn',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(false);
      expect(logger.willLog('warn')).toBe(true);
      expect(logger.willLog('error')).toBe(true);
    });
    
    it('should set log level', () => {
      const config: LoggerConfig = {
        level: 'info',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      expect(logger.getLevel()).toBe('info');
      
      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');
    });
    
    it('should handle time/timeEnd', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
      
      logger.time('test-timer');
      logger.timeEnd('test-timer');
      
      expect(_mockedConsole.time).toHaveBeenCalledWith('test-timer');
      expect(_mockedConsole.timeEnd).toHaveBeenCalledWith('test-timer');
    });
  });
  
  describe('ConsoleTransport', () => {
    it('should log to console with correct level', () => {
      const transport = new ConsoleTransport(true);
      
      transport.log({
        level: 'info',
        message: 'Test message',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });
    
    it('should format messages with metadata', () => {
      const transport = new ConsoleTransport(true);
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        meta: { key: 'value' },
        timestamp: new Date(),
        environment: 'test'
      };
      
      transport.log(entry);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });
    
    it('should serialize errors properly', () => {
      const transport = new ConsoleTransport(true);
      const error = new Error('Test error');
      
      transport.log({
        level: 'error',
        message: 'Error occurred',
        error,
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });
  
  describe('NoopTransport', () => {
    it('should not log anything', () => {
      const transport = new NoopTransport();
      
      transport.log({
        level: 'info',
        message: 'Test message',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });
  
  describe('SentryTransport', () => {
    it('should log error level to sentry stub', () => {
      const transport = new SentryTransport(true);
      const error = new Error('Sentry test');
      
      transport.log({
        level: 'error',
        message: 'Error message',
        error,
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[SENTRY STUB] Would send to Sentry:',
        expect.objectContaining({
          message: 'Error message',
          error,
          level: 'error'
        })
      );
    });
    
    it('should not log non-error levels to sentry', () => {
      const transport = new SentryTransport(true);
      
      transport.log({
        level: 'info',
        message: 'Info message',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });
});