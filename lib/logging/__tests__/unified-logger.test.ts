/**
 * Unified Logger Tests
 * 
 * Comprehensive tests for the unified logging system
 */

import { 
  UnifiedLogger, 
  createUnifiedLogger, 
  type UnifiedLoggerConfig,
  type LogLevel 
} from '../unified-logger';

describe('UnifiedLogger', () => {
  let logger: UnifiedLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    const config: Partial<UnifiedLoggerConfig> = {
      level: 'debug',
      enableConsole: true,
      enableThrottling: false,
      enableStorage: false,
      source: 'test',
    };
    
    logger = createUnifiedLogger(config);
    await logger.init(); // Initialize logger before tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Logging', () => {
    test('should log debug messages', () => {
      logger.debug('Debug message', { test: true });
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug message'),
        undefined
      );
    });

    test('should log info messages', () => {
      logger.info('Info message', { test: true });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Info message'),
        undefined
      );
    });

    test('should log warn messages', () => {
      logger.warn('Warning message', { test: true });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message'),
        undefined
      );
    });

    test('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', { test: true }, error);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error message'),
        error
      );
    });

    test('should log critical messages', () => {
      logger.critical('Critical message', { test: true });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('🚨'),
        undefined
      );
    });
  });

  describe('Log Level Filtering', () => {
    test('should respect log level', () => {
      const warnLogger = createUnifiedLogger({ 
        level: 'warn', 
        enableConsole: true,
        enableStorage: false 
      });
      
      warnLogger.debug('Debug message');
      warnLogger.info('Info message');
      warnLogger.warn('Warn message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warn message'),
        undefined
      );
    });

    test('willLog should return correct boolean', () => {
      expect(logger.willLog('debug')).toBe(true);
      expect(logger.willLog('info')).toBe(true);
      expect(logger.willLog('warn')).toBe(true);
      expect(logger.willLog('error')).toBe(true);
      expect(logger.willLog('critical')).toBe(true);
      
      logger.setLevel('error');
      expect(logger.willLog('debug')).toBe(false);
      expect(logger.willLog('info')).toBe(false);
      expect(logger.willLog('warn')).toBe(false);
      expect(logger.willLog('error')).toBe(true);
      expect(logger.willLog('critical')).toBe(true);
    });
  });

  describe('Context Management', () => {
    test('should manage context stack', () => {
      logger.pushContext({ userId: '123' });
      logger.pushContext({ sessionId: 'abc' });
      
      logger.info('Test message');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        undefined
      );
      
      logger.popContext();
      logger.popContext();
    });

    test('should support withContext helper', async () => {
      const result = await logger.withContext(
        { operation: 'test' },
        async () => {
          logger.info('Inside context');
          return 'success';
        }
      );
      
      expect(result).toBe('success');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Inside context'),
        undefined
      );
    });
  });

  describe('Timer Functionality', () => {
    test('should support timer operations', () => {
      logger.time('test-timer');
      logger.timeEnd('test-timer');
      
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('Timer test-timer'),
        undefined
      );
    });
  });

  describe('Configuration', () => {
    test('should allow level changes', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');
      
      logger.debug('Debug message');
      logger.warn('Warn message');
      
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    test('should support throttle clearing', () => {
      logger.clearThrottle();
      // Should not throw
    });
  });

  describe('Subscription System', () => {
    test('should support log subscriptions', () => {
      const callback = jest.fn();
      const subscription = logger.subscribe(
        { level: 'error' },
        callback
      );
      
      logger.info('Info message');
      logger.error('Error message');
      
      expect(callback).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Info message' })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error message' })
      );
      
      subscription.unsubscribe();
    });
  });

  describe('Cleanup', () => {
    test('should close cleanly', async () => {
      await logger.close();
      // Should not throw
    });
  });
});

describe('Logger Helpers', () => {
  test('should support agent logger creation', async () => {
    const { createAgentLogger } = await import('../helpers');
    const agentLogger = createAgentLogger('test-agent');
    
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    agentLogger.debug('Agent message');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[test-agent] Agent message'),
      undefined
    );
    
    consoleSpy.mockRestore();
  });

  test('should support tool logger creation', async () => {
    const { createToolLogger } = await import('../helpers');
    const toolLogger = createToolLogger('test-tool');
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    toolLogger.info('Tool message');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[test-tool] Tool message'),
      undefined
    );
    
    consoleSpy.mockRestore();
  });

  test('should support performance logging', async () => {
    const { logPerformance } = await import('../helpers');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const result = await logPerformance('test-operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'success';
    });
    
    expect(result).toBe('success');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test-operation completed'),
      undefined
    );
    
    consoleSpy.mockRestore();
  });
});

describe('Backward Compatibility', () => {
  test('should export compatible logger interface', async () => {
    const { logger } = await import('../index');
    
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.critical).toBe('function');
    expect(typeof logger.time).toBe('function');
    expect(typeof logger.timeEnd).toBe('function');
    expect(typeof logger.willLog).toBe('function');
    expect(typeof logger.setLevel).toBe('function');
    expect(typeof logger.getLevel).toBe('function');
    expect(typeof logger.clearThrottle).toBe('function');
    expect(typeof logger.pushContext).toBe('function');
    expect(typeof logger.popContext).toBe('function');
    expect(typeof logger.withContext).toBe('function');
  });

  test('should export enhanced logger interface', async () => {
    const { enhancedLogger } = await import('../index');
    
    expect(typeof enhancedLogger.debug).toBe('function');
    expect(typeof enhancedLogger.info).toBe('function');
    expect(typeof enhancedLogger.warn).toBe('function');
    expect(typeof enhancedLogger.error).toBe('function');
    expect(typeof enhancedLogger.critical).toBe('function');
    expect(typeof enhancedLogger.pushContext).toBe('function');
    expect(typeof enhancedLogger.popContext).toBe('function');
    expect(typeof enhancedLogger.withContext).toBe('function');
    expect(typeof enhancedLogger.init).toBe('function');
    expect(typeof enhancedLogger.close).toBe('function');
  });
});