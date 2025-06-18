// Mock the unified logger first
const mockUnifiedLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
  pushContext: jest.fn(),
  popContext: jest.fn(),
};

jest.mock('@/lib/logging/unified-logger', () => ({
  unifiedLogger: mockUnifiedLogger,
  UnifiedLogger: jest.fn(),
}));

// Import after mocking
import {
  createAgentLogger,
  createToolLogger,
  logPerformance,
  createSessionLogger,
  createCorrelationLogger,
  BatchLogger,
  createStructuredLogger,
  logErrorChain,
  conditionalLog,
  RateLimitedLogger,
} from '@/lib/logging/helpers';
import { UnifiedLogger } from '@/lib/logging/unified-logger';

describe('logging helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAgentLogger', () => {
    it('should create logger with agent name prefix and metadata', () => {
      const agentLogger = createAgentLogger('TestAgent');
      const meta = { userId: '123', action: 'process' };

      agentLogger.debug('Debug message', meta);
      agentLogger.info('Info message', meta);
      agentLogger.warn('Warn message', meta);
      agentLogger.error('Error message', meta);
      agentLogger.critical('Critical message', meta);

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith(
        '[TestAgent] Debug message',
        { ...meta, agentName: 'TestAgent' }
      );
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        '[TestAgent] Info message',
        { ...meta, agentName: 'TestAgent' }
      );
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith(
        '[TestAgent] Warn message',
        { ...meta, agentName: 'TestAgent' }
      );
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        '[TestAgent] Error message',
        { ...meta, agentName: 'TestAgent' }
      );
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith(
        '[TestAgent] Critical message',
        { ...meta, agentName: 'TestAgent' }
      );
    });

    it('should use custom logger if provided', () => {
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        critical: jest.fn(),
      };

      const agentLogger = createAgentLogger('CustomAgent', customLogger as any);
      agentLogger.info('Test message');

      expect(customLogger.info).toHaveBeenCalledWith(
        '[CustomAgent] Test message',
        { agentName: 'CustomAgent' }
      );
      expect(mockUnifiedLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('createToolLogger', () => {
    it('should create logger with tool name prefix and metadata', () => {
      const toolLogger = createToolLogger('AnalysisTool');
      const meta = { duration: 1000, result: 'success' };

      toolLogger.debug('Debug', meta);
      toolLogger.info('Info', meta);
      toolLogger.warn('Warn', meta);
      toolLogger.error('Error', meta);
      toolLogger.critical('Critical', meta);

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith(
        '[AnalysisTool] Debug',
        { ...meta, toolName: 'AnalysisTool' }
      );
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        '[AnalysisTool] Info',
        { ...meta, toolName: 'AnalysisTool' }
      );
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith(
        '[AnalysisTool] Warn',
        { ...meta, toolName: 'AnalysisTool' }
      );
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        '[AnalysisTool] Error',
        { ...meta, toolName: 'AnalysisTool' }
      );
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith(
        '[AnalysisTool] Critical',
        { ...meta, toolName: 'AnalysisTool' }
      );
    });
  });

  describe('logPerformance', () => {
    it('should log successful operations with timing', async () => {
      const operation = 'DataProcessing';
      const result = { processed: 100 };
      const fn = jest.fn().mockResolvedValue(result);

      const output = await logPerformance(operation, fn);

      expect(output).toBe(result);
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        'DataProcessing completed',
        expect.objectContaining({
          operation,
          duration: expect.any(Number),
          success: true,
        })
      );
    });

    it('should log failed operations and rethrow error', async () => {
      const operation = 'FailingOperation';
      const error = new Error('Operation failed');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(logPerformance(operation, fn)).rejects.toThrow('Operation failed');

      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        'FailingOperation failed',
        expect.objectContaining({
          operation,
          duration: expect.any(Number),
          success: false,
          error: 'Error: Operation failed',
        })
      );
    });

    it('should use custom logger', async () => {
      const customLogger = {
        info: jest.fn(),
        error: jest.fn(),
      };

      await logPerformance('Test', () => Promise.resolve(), customLogger as any);

      expect(customLogger.info).toHaveBeenCalled();
      expect(mockUnifiedLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('createSessionLogger', () => {
    it('should push context and provide end method', () => {
      const sessionId = 'session-123';
      const userId = 'user-456';

      const session = createSessionLogger(sessionId, userId);

      expect(mockUnifiedLogger.pushContext).toHaveBeenCalledWith({
        sessionId,
        userId,
      });

      session.end();

      expect(mockUnifiedLogger.popContext).toHaveBeenCalled();
    });

    it('should work without userId', () => {
      const session = createSessionLogger('session-789');

      expect(mockUnifiedLogger.pushContext).toHaveBeenCalledWith({
        sessionId: 'session-789',
        userId: undefined,
      });
    });
  });

  describe('createCorrelationLogger', () => {
    it('should create logger with correlation context', () => {
      const correlationId = 'corr-123';
      const corrLogger = createCorrelationLogger(correlationId);

      expect(mockUnifiedLogger.pushContext).toHaveBeenCalledWith({
        correlationId,
      });

      const meta = { action: 'test' };
      corrLogger.debug('Debug', meta);
      corrLogger.info('Info', meta);
      corrLogger.warn('Warn', meta);
      corrLogger.error('Error', meta);
      corrLogger.critical('Critical', meta);

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith('Debug', meta);
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith('Info', meta);
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith('Warn', meta);
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith('Error', meta);
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith('Critical', meta);

      corrLogger.end();
      expect(mockUnifiedLogger.popContext).toHaveBeenCalled();
    });
  });

  describe('BatchLogger', () => {
    it('should batch log entries and flush them', async () => {
      const batchLogger = new BatchLogger();

      batchLogger
        .addContext({ requestId: 'req-123' })
        .debug('Debug message')
        .info('Info message', { extra: 'data' })
        .warn('Warning')
        .error('Error occurred')
        .critical('Critical issue');

      expect(batchLogger.getEntryCount()).toBe(5);
      expect(mockUnifiedLogger.debug).not.toHaveBeenCalled();

      await batchLogger.flush();

      expect(mockUnifiedLogger.pushContext).toHaveBeenCalledWith({ requestId: 'req-123' });
      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith(
        'Debug message',
        { requestId: 'req-123' }
      );
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        'Info message',
        { requestId: 'req-123', extra: 'data' }
      );
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith(
        'Warning',
        { requestId: 'req-123' }
      );
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        { requestId: 'req-123' }
      );
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith(
        'Critical issue',
        { requestId: 'req-123' }
      );
      expect(mockUnifiedLogger.popContext).toHaveBeenCalled();
      expect(batchLogger.getEntryCount()).toBe(0);
    });

    it('should handle empty flush', async () => {
      const batchLogger = new BatchLogger();
      await batchLogger.flush();

      expect(mockUnifiedLogger.pushContext).not.toHaveBeenCalled();
    });

    it('should clear entries and context', () => {
      const batchLogger = new BatchLogger();
      
      batchLogger
        .addContext({ test: 'value' })
        .info('Test message')
        .clear();

      expect(batchLogger.getEntryCount()).toBe(0);
    });

    it('should use custom logger', async () => {
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        critical: jest.fn(),
        pushContext: jest.fn(),
        popContext: jest.fn(),
      };

      const batchLogger = new BatchLogger(customLogger as any);
      batchLogger.info('Test');
      await batchLogger.flush();

      expect(customLogger.info).toHaveBeenCalled();
      expect(mockUnifiedLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('createStructuredLogger', () => {
    it('should create logger with base context', () => {
      const baseContext = { service: 'api', version: '1.0' };
      const logger = createStructuredLogger(baseContext);

      logger.debug('Debug', { action: 'test' });
      logger.info('Info', { user: '123' });
      logger.warn('Warn');

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith(
        'Debug',
        { service: 'api', version: '1.0', action: 'test' }
      );
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        'Info',
        { service: 'api', version: '1.0', user: '123' }
      );
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith(
        'Warn',
        { service: 'api', version: '1.0' }
      );
    });

    it('should handle error logging', () => {
      const logger = createStructuredLogger({ app: 'test' });
      const error = new Error('Test error');

      logger.error('Error occurred', error, { code: 'E001' });
      logger.critical('Critical error', error);

      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        { app: 'test', code: 'E001' },
        error
      );
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith(
        'Critical error',
        { app: 'test' },
        error
      );
    });

    it('should support withData for nested contexts', () => {
      const logger = createStructuredLogger({ level1: 'value1' });
      const nestedLogger = logger.withData({ level2: 'value2' });

      nestedLogger.info('Nested log');

      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        'Nested log',
        { level1: 'value1', level2: 'value2' }
      );
    });
  });

  describe('logErrorChain', () => {
    it('should log error chain with causes', () => {
      const rootCause = new Error('Root cause');
      const middleError = new Error('Middle error');
      (middleError as any).cause = rootCause;
      const topError = new Error('Top error');
      (topError as any).cause = middleError;

      logErrorChain(topError, 'TestContext');

      expect(mockUnifiedLogger.error).toHaveBeenCalledTimes(3);
      expect(mockUnifiedLogger.error).toHaveBeenNthCalledWith(1,
        '[TestContext] Error: Top error',
        expect.objectContaining({
          errorName: 'Error',
          errorDepth: 0,
          context: 'TestContext',
        })
      );
      expect(mockUnifiedLogger.error).toHaveBeenNthCalledWith(2,
        '[TestContext] Caused by (1): Middle error',
        expect.objectContaining({
          errorDepth: 1,
        })
      );
      expect(mockUnifiedLogger.error).toHaveBeenNthCalledWith(3,
        '[TestContext] Caused by (2): Root cause',
        expect.objectContaining({
          errorDepth: 2,
        })
      );
    });

    it('should handle errors without cause', () => {
      const error = new Error('Simple error');
      logErrorChain(error);

      expect(mockUnifiedLogger.error).toHaveBeenCalledOnce();
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith(
        'Error: Simple error',
        expect.objectContaining({
          errorName: 'Error',
          errorDepth: 0,
        })
      );
    });

    it('should prevent infinite loops', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      (error1 as any).cause = error2;
      (error2 as any).cause = error1; // Circular reference

      logErrorChain(error1);

      // Should stop at depth 10
      expect(mockUnifiedLogger.error).toHaveBeenCalledTimes(10);
    });
  });

  describe('conditionalLog', () => {
    it('should log when condition is true', () => {
      conditionalLog(true, 'info', 'Should log', { test: true });
      
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith(
        'Should log',
        { test: true }
      );
    });

    it('should not log when condition is false', () => {
      conditionalLog(false, 'warn', 'Should not log');
      
      expect(mockUnifiedLogger.warn).not.toHaveBeenCalled();
    });

    it('should evaluate condition function', () => {
      const condition = jest.fn().mockReturnValue(true);
      conditionalLog(condition, 'error', 'Conditional error');

      expect(condition).toHaveBeenCalled();
      expect(mockUnifiedLogger.error).toHaveBeenCalled();
    });

    it('should support all log levels', () => {
      conditionalLog(true, 'debug', 'Debug');
      conditionalLog(true, 'info', 'Info');
      conditionalLog(true, 'warn', 'Warn');
      conditionalLog(true, 'error', 'Error');
      conditionalLog(true, 'critical', 'Critical');

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith('Debug', undefined);
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith('Info', undefined);
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith('Warn', undefined);
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith('Error', undefined);
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith('Critical', undefined);
    });
  });

  describe('RateLimitedLogger', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow logs within rate limit', () => {
      const logger = new RateLimitedLogger(60000, 3);

      expect(logger.info('Message 1')).toBe(true);
      expect(logger.info('Message 1')).toBe(true);
      expect(logger.info('Message 1')).toBe(true);

      expect(mockUnifiedLogger.info).toHaveBeenCalledTimes(3);
    });

    it('should deny logs exceeding rate limit', () => {
      const logger = new RateLimitedLogger(60000, 2);

      expect(logger.error('Error message')).toBe(true);
      expect(logger.error('Error message')).toBe(true);
      expect(logger.error('Error message')).toBe(false);
      expect(logger.error('Error message')).toBe(false);

      expect(mockUnifiedLogger.error).toHaveBeenCalledTimes(2);
    });

    it('should reset window after time period', () => {
      const logger = new RateLimitedLogger(1000, 1); // 1 second window

      expect(logger.warn('Warning')).toBe(true);
      expect(logger.warn('Warning')).toBe(false);

      jest.advanceTimersByTime(1001);

      expect(logger.warn('Warning')).toBe(true);
      expect(mockUnifiedLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should track different messages independently', () => {
      const logger = new RateLimitedLogger(60000, 1);

      expect(logger.info('Message A')).toBe(true);
      expect(logger.info('Message B')).toBe(true);
      expect(logger.info('Message A')).toBe(false);
      expect(logger.info('Message B')).toBe(false);

      expect(mockUnifiedLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should support all log methods', () => {
      const logger = new RateLimitedLogger(60000, 10);

      logger.debug('Debug', { data: 1 });
      logger.info('Info', { data: 2 });
      logger.warn('Warn', { data: 3 });
      logger.error('Error', { data: 4 });
      logger.critical('Critical', { data: 5 });

      expect(mockUnifiedLogger.debug).toHaveBeenCalledWith('Debug', { data: 1 });
      expect(mockUnifiedLogger.info).toHaveBeenCalledWith('Info', { data: 2 });
      expect(mockUnifiedLogger.warn).toHaveBeenCalledWith('Warn', { data: 3 });
      expect(mockUnifiedLogger.error).toHaveBeenCalledWith('Error', { data: 4 });
      expect(mockUnifiedLogger.critical).toHaveBeenCalledWith('Critical', { data: 5 });
    });

    it('should use custom logger', () => {
      const customLogger = {
        info: jest.fn(),
      };

      const logger = new RateLimitedLogger(60000, 10, customLogger as any);
      logger.info('Test');

      expect(customLogger.info).toHaveBeenCalled();
      expect(mockUnifiedLogger.info).not.toHaveBeenCalled();
    });
  });
});

export {};