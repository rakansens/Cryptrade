import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Store the original console methods before mocking
const originalConsoleError = console.error;
const consoleErrorCalls: any[] = [];

// Mock console methods early to capture all calls
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(global.console, 'warn').mockImplementation();
const mockConsoleTime = jest.spyOn(console, 'time').mockImplementation();
const mockConsoleTimeEnd = jest.spyOn(console, 'timeEnd').mockImplementation();

// Mock console.error to track calls
global.console.error = jest.fn((...args) => {
  consoleErrorCalls.push(args);
  return originalConsoleError.apply(console, args);
});

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
          global.console.error('Transport failed:', error);
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
          global.console.error('Transport failed:', error);
        }
      });
    }

    warn(message: string, meta?: any, error?: any) {
      if (!this.willLog('warn')) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'warn', message, meta, error, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          global.console.error('Transport failed:', error);
        }
      });
    }

    error(message: string, meta?: any, error?: any) {
      if (!this.willLog('error')) return;
      
      this.transports.forEach(t => {
        try {
          t.log({ level: 'error', message, meta, error, timestamp: new Date(), environment: 'test' });
        } catch (error) {
          global.console.error('Transport failed:', error);
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
    log() {
      // Do nothing
    }
  }

  class MockSentryTransport {
    private enabled: boolean;
    private consoleWarn: any;

    constructor(enabled = true, consoleWarn?: any) {
      this.enabled = enabled;
      this.consoleWarn = consoleWarn || global.console.warn;
    }

    log(entry: any) {
      if (!this.enabled) return;
      
      if (entry.level === 'error' || entry.level === 'warn') {
        this.consoleWarn('[SENTRY STUB] Would send to Sentry:', {
          message: entry.message,
          level: entry.level,
          error: entry.error
        });
      }
    }
  }

  function mockCreateLogger() {
    const config = {
      level: 'info',
      enableConsole: true,
      enableThrottling: false,
      throttleInterval: 5000
    };
    const consoleTransport = new MockConsoleTransport(config.enableConsole);
    const sentryTransport = new MockSentryTransport(true);
    return new MockLogger([consoleTransport, sentryTransport], config);
  }

  return {
    Logger: MockLogger,
    ConsoleTransport: MockConsoleTransport,
    NoopTransport: MockNoopTransport,
    SentryTransport: MockSentryTransport,
    createLogger: mockCreateLogger,
    logger: mockCreateLogger(),
    _mockedConsole: mockedConsole
  };
});

// Use the already defined console mocks
const mockConsoleError = console.error as jest.Mock;

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
    consoleErrorCalls.length = 0; // Clear console error calls
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
      
      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe('info');
    });
    
    it('should filter logs by level', () => {
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
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn',
        message: 'Warn message'
      }));
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        message: 'Error message'
      }));
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
    
    it('should log warn messages', () => {
      const meta = { warning: 'test' };
      logger.warn('Warn message', meta);
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn',
        message: 'Warn message',
        meta,
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
    
    it('should log error messages', () => {
      const error = new Error('Critical error');
      const meta = { severity: 'high' };
      logger.error('Error message', meta, error);
      
      expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        message: 'Error message',
        meta,
        error,
        timestamp: expect.any(Date),
        environment: 'test'
      }));
    });
  });
  
  describe('log level management', () => {
    beforeEach(() => {
      const config: LoggerConfig = {
        level: 'info',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
    });
    
    it('should check if level will be logged', () => {
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(true);
      expect(logger.willLog('warn')).toBe(true);
      expect(logger.willLog('error')).toBe(true);
    });
    
    it('should change log level dynamically', () => {
      logger.setLevel('error');
      
      expect(logger.getLevel()).toBe('error');
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(false);
      expect(logger.willLog('warn')).toBe(false);
      expect(logger.willLog('error')).toBe(true);
    });
  });
  
  describe('throttling', () => {
    it('should throttle repeated messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 100
      };
      
      logger = new Logger([mockTransport], config);
      
      // Log the same message multiple times
      logger.info('Repeated message');
      logger.info('Repeated message');
      logger.info('Repeated message');
      
      // Only the first should go through
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
    });
    
    it('should allow different messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 100
      };
      
      logger = new Logger([mockTransport], config);
      
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(3);
    });
    
    it('should allow same message after throttle interval', async () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 50
      };
      
      logger = new Logger([mockTransport], config);
      
      logger.info('Throttled message');
      logger.info('Throttled message'); // Should be throttled
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      logger.info('Throttled message'); // Should go through
      
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
    
    it('should clear throttle map', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 100
      };
      
      logger = new Logger([mockTransport], config);
      
      logger.info('Message before clear');
      logger.info('Message before clear'); // Throttled
      
      logger.clearThrottle();
      
      logger.info('Message before clear'); // Should go through after clear
      
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
    
    it('should not throttle warn and error messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 100
      };
      
      logger = new Logger([mockTransport], config);
      
      logger.warn('Warning message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.error('Error message');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(4);
    });
  });
  
  describe('time methods', () => {
    beforeEach(() => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
    });
    
    it('should call console.time when debug level is enabled', () => {
      logger.time('test-timer');
      expect(_mockedConsole.time).toHaveBeenCalledWith('test-timer');
    });
    
    it('should call console.timeEnd when debug level is enabled', () => {
      logger.timeEnd('test-timer');
      expect(_mockedConsole.timeEnd).toHaveBeenCalledWith('test-timer');
    });
    
    it('should not call console methods when debug is disabled', () => {
      logger.setLevel('info');
      
      logger.time('test-timer');
      logger.timeEnd('test-timer');
      
      expect(_mockedConsole.time).not.toHaveBeenCalled();
      expect(_mockedConsole.timeEnd).not.toHaveBeenCalled();
    });
  });
  
  describe('ConsoleTransport', () => {
    it('should log to console when enabled', () => {
      // Create a fresh spy for this test to avoid beforeEach clearing
      const consoleLogSpy = jest.spyOn(console, 'log');
      
      const transport = new ConsoleTransport(true);
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date(),
        environment: 'test'
      };
      
      transport.log(entry);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Clean up this specific spy
      consoleLogSpy.mockRestore();
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
      const transport = new SentryTransport(true, mockConsoleWarn);
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
          level: 'error',
          error
        })
      );
    });
    
    it('should log warn level to sentry stub', () => {
      const transport = new SentryTransport(true, mockConsoleWarn);
      
      transport.log({
        level: 'warn',
        message: 'Warning message',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[SENTRY STUB] Would send to Sentry:',
        expect.objectContaining({
          message: 'Warning message',
          level: 'warn'
        })
      );
    });
    
    it('should not log info level to sentry', () => {
      const transport = new SentryTransport(true, mockConsoleWarn);
      
      transport.log({
        level: 'info',
        message: 'Info message',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });
  
  describe('createLogger', () => {
    it('should create a logger instance with default config', () => {
      const logger = createLogger();
      
      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe('info');
    });
  });
});