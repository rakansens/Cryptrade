import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  Logger,
  ConsoleTransport,
  NoopTransport,
  SentryTransport,
  createLogger,
  type LogLevel,
  type LoggerConfig,
  type ILogTransport,
  type LogEntry
} from '@/lib/utils/logger';

// Mock console methods
const mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleTime = jest.spyOn(console, 'time').mockImplementation();
const mockConsoleTimeEnd = jest.spyOn(console, 'timeEnd').mockImplementation();

describe('Logger', () => {
  let logger: Logger;
  let mockTransport: ILogTransport;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransport = {
      log: jest.fn(),
      configure: jest.fn()
    };
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
        log: jest.fn().mockImplementation(() => {
          throw new Error('Transport failed');
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
      const meta = { userId: 123, action: 'test' };
      logger.debug('Debug message', meta);
      
      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          message: 'Debug message',
          meta,
          timestamp: expect.any(Date)
        })
      );
    });
    
    it('should log info messages with error', () => {
      const error = new Error('Test error');
      logger.info('Info message', { context: 'test' }, error);
      
      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Info message',
          meta: { context: 'test' },
          error,
          timestamp: expect.any(Date)
        })
      );
    });
    
    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Warning message',
          timestamp: expect.any(Date)
        })
      );
    });
    
    it('should log error messages with custom error', () => {
      const customError = { code: 'ERR001', details: 'Custom error' };
      logger.error('Error message', { requestId: 'abc' }, customError);
      
      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'Error message',
          meta: { requestId: 'abc' },
          error: customError,
          timestamp: expect.any(Date)
        })
      );
    });
  });
  
  describe('throttling', () => {
    it('should throttle repeated messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 1000
      };
      logger = new Logger([mockTransport], config);
      
      logger.debug('Repeated message');
      logger.debug('Repeated message');
      logger.debug('Repeated message');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(1);
    });
    
    it('should not throttle different messages', () => {
      const config: LoggerConfig = {
        level: 'debug',
        enableConsole: true,
        enableThrottling: true,
        throttleInterval: 1000
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
        throttleInterval: 1000
      };
      logger = new Logger([mockTransport], config);
      
      logger.debug('Repeated message');
      logger.debug('Repeated message');
      logger.clearThrottle();
      logger.debug('Repeated message');
      
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('utility methods', () => {
    beforeEach(() => {
      const config: LoggerConfig = {
        level: 'info',
        enableConsole: true,
        enableThrottling: false,
        throttleInterval: 5000
      };
      logger = new Logger([mockTransport], config);
    });
    
    it('should check if level will log', () => {
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(true);
      expect(logger.willLog('warn')).toBe(true);
      expect(logger.willLog('error')).toBe(true);
    });
    
    it('should set log level', () => {
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
      expect(logger.willLog('warn')).toBe(false);
      expect(logger.willLog('error')).toBe(true);
    });
    
    it('should handle time/timeEnd', () => {
      logger.time('test-operation');
      logger.timeEnd('test-operation');
      
      expect(mockConsoleTime).toHaveBeenCalledWith('test-operation');
      expect(mockConsoleTimeEnd).toHaveBeenCalledWith('test-operation');
    });
  });
  
  describe('ConsoleTransport', () => {
    it('should log to console with correct level', () => {
      const transport = new ConsoleTransport(true);
      
      transport.log({
        level: 'debug',
        message: 'Debug test',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleDebug).toHaveBeenCalled();
    });
    
    it('should format messages with metadata', () => {
      const transport = new ConsoleTransport(true);
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        meta: { userId: 123 },
        timestamp: new Date(),
        environment: 'test'
      };
      
      transport.log(entry);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        undefined
      );
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
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred'),
        expect.objectContaining({
          name: 'Error',
          message: 'Test error'
        })
      );
    });
  });
  
  describe('NoopTransport', () => {
    it('should not log anything', () => {
      const transport = new NoopTransport();
      
      transport.log({
        level: 'info',
        message: 'Test',
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
  
  describe('SentryTransport', () => {
    it('should log error level to sentry stub', () => {
      const transport = new SentryTransport(true);
      const error = new Error('Sentry test');
      
      transport.log({
        level: 'error',
        message: 'Error for Sentry',
        error,
        timestamp: new Date(),
        environment: 'test'
      });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[SENTRY STUB] Would send to Sentry:',
        expect.objectContaining({
          message: 'Error for Sentry',
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