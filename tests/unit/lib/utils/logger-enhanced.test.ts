// Mock dependencies
const mockEnhancedLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  critical: jest.fn(),
  withContext: jest.fn(),
  pushContext: jest.fn(),
  popContext: jest.fn(),
  query: jest.fn(),
  getStats: jest.fn(),
  subscribe: jest.fn(),
};

jest.mock('@/lib/logging', () => ({
  enhancedLogger: mockEnhancedLogger,
}));

import {
  logger,
  createAgentLogger,
  createToolLogger,
  logPerformance,
  createSessionLogger,
} from '@/lib/utils/logger-enhanced';

const mockOriginalLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/utils/logger', () => ({
  logger: mockOriginalLogger,
}));

describe('logger-enhanced', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logger wrapper', () => {
    it('should delegate debug calls to enhanced logger', () => {
      const message = 'Debug message';
      const meta = { key: 'value' };
      
      logger.debug(message, meta);
      
      expect(mockEnhancedLogger.debug).toHaveBeenCalledWith(message, meta);
    });

    it('should delegate info calls to enhanced logger', () => {
      const message = 'Info message';
      const meta = { count: 5 };
      
      logger.info(message, meta);
      
      expect(mockEnhancedLogger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should delegate warn calls to enhanced logger', () => {
      const message = 'Warning message';
      const meta = { warning: true };
      
      logger.warn(message, meta);
      
      expect(mockEnhancedLogger.warn).toHaveBeenCalledWith(message, meta);
    });

    it('should delegate error calls to enhanced logger', () => {
      const message = 'Error message';
      const meta = { error: 'details' };
      
      logger.error(message, meta);
      
      expect(mockEnhancedLogger.error).toHaveBeenCalledWith(message, meta);
    });

    it('should provide critical method', () => {
      const message = 'Critical error';
      const meta = { severity: 'high' };
      
      logger.critical(message, meta);
      
      expect(mockEnhancedLogger.critical).toHaveBeenCalledWith(message, meta);
    });
  });

  describe('context management', () => {
    it('should support withContext', async () => {
      const context = { userId: '123', sessionId: 'abc' };
      const fn = jest.fn().mockResolvedValue('result');
      
      mockEnhancedLogger.withContext.mockImplementation(async (ctx, callback) => {
        return callback();
      });
      
      const result = await logger.withContext(context, fn);
      
      expect(mockEnhancedLogger.withContext).toHaveBeenCalledWith(context, fn);
      expect(result).toBe('result');
    });

    it('should support pushContext', () => {
      const context = { requestId: 'xyz' };
      
      logger.pushContext(context);
      
      expect(mockEnhancedLogger.pushContext).toHaveBeenCalledWith(context);
    });

    it('should support popContext', () => {
      logger.popContext();
      
      expect(mockEnhancedLogger.popContext).toHaveBeenCalled();
    });
  });

  describe('query functionality', () => {
    it('should expose query method', () => {
      const queryParams = { level: 'error', limit: 10 };
      const mockResults = [{ message: 'Error 1' }, { message: 'Error 2' }];
      
      mockEnhancedLogger.query.mockReturnValue(mockResults);
      
      const results = logger.query(queryParams);
      
      expect(mockEnhancedLogger.query).toHaveBeenCalledWith(queryParams);
      expect(results).toBe(mockResults);
    });

    it('should expose getStats method', () => {
      const mockStats = { totalLogs: 100, errors: 5 };
      
      mockEnhancedLogger.getStats.mockReturnValue(mockStats);
      
      const stats = logger.getStats();
      
      expect(mockEnhancedLogger.getStats).toHaveBeenCalled();
      expect(stats).toBe(mockStats);
    });

    it('should expose subscribe method', () => {
      const callback = jest.fn();
      const unsubscribe = jest.fn();
      
      mockEnhancedLogger.subscribe.mockReturnValue(unsubscribe);
      
      const result = logger.subscribe(callback);
      
      expect(mockEnhancedLogger.subscribe).toHaveBeenCalledWith(callback);
      expect(result).toBe(unsubscribe);
    });
  });

  describe('original logger access', () => {
    it('should provide access to original logger', () => {
      // Verify that the original logger property exists and is a logger object
      expect(logger.original).toBeDefined();
      expect(typeof logger.original).toBe('object');
      
      // Verify that the original logger has the expected methods
      expect(typeof logger.original.debug).toBe('function');
      expect(typeof logger.original.info).toBe('function');
      expect(typeof logger.original.warn).toBe('function');
      expect(typeof logger.original.error).toBe('function');
      
      // The original logger is preserved from the actual logger module
      // during the transition period as documented in the implementation
    });
  });
});

describe('createAgentLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create logger with agent name prefix', () => {
    const agentLogger = createAgentLogger('TestAgent');
    
    agentLogger.debug('Debug message', { extra: 'data' });
    agentLogger.info('Info message');
    agentLogger.warn('Warning message');
    agentLogger.error('Error message');
    
    expect(mockEnhancedLogger.debug).toHaveBeenCalledWith(
      '[TestAgent] Debug message',
      { extra: 'data', agentName: 'TestAgent' }
    );
    expect(mockEnhancedLogger.info).toHaveBeenCalledWith(
      '[TestAgent] Info message',
      { agentName: 'TestAgent' }
    );
    expect(mockEnhancedLogger.warn).toHaveBeenCalledWith(
      '[TestAgent] Warning message',
      { agentName: 'TestAgent' }
    );
    expect(mockEnhancedLogger.error).toHaveBeenCalledWith(
      '[TestAgent] Error message',
      { agentName: 'TestAgent' }
    );
  });

  it('should merge metadata', () => {
    const agentLogger = createAgentLogger('Agent1');
    
    agentLogger.info('Message', { userId: '123', action: 'login' });
    
    expect(mockEnhancedLogger.info).toHaveBeenCalledWith(
      '[Agent1] Message',
      { userId: '123', action: 'login', agentName: 'Agent1' }
    );
  });
});

describe('createToolLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create logger with tool name prefix', () => {
    const toolLogger = createToolLogger('AnalysisTool');
    
    toolLogger.debug('Starting analysis');
    toolLogger.info('Analysis complete', { duration: 1000 });
    toolLogger.warn('Low confidence', { confidence: 0.3 });
    toolLogger.error('Analysis failed', { reason: 'timeout' });
    
    expect(mockEnhancedLogger.debug).toHaveBeenCalledWith(
      '[AnalysisTool] Starting analysis',
      { toolName: 'AnalysisTool' }
    );
    expect(mockEnhancedLogger.info).toHaveBeenCalledWith(
      '[AnalysisTool] Analysis complete',
      { duration: 1000, toolName: 'AnalysisTool' }
    );
    expect(mockEnhancedLogger.warn).toHaveBeenCalledWith(
      '[AnalysisTool] Low confidence',
      { confidence: 0.3, toolName: 'AnalysisTool' }
    );
    expect(mockEnhancedLogger.error).toHaveBeenCalledWith(
      '[AnalysisTool] Analysis failed',
      { reason: 'timeout', toolName: 'AnalysisTool' }
    );
  });
});

describe('logPerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log successful operations with duration', async () => {
    const operation = 'DataProcessing';
    const result = { processed: 100 };
    const fn = jest.fn().mockResolvedValue(result);
    
    const output = await logPerformance(operation, fn);
    
    expect(output).toBe(result);
    expect(fn).toHaveBeenCalled();
    expect(mockEnhancedLogger.info).toHaveBeenCalledWith(
      'DataProcessing completed',
      expect.objectContaining({
        operation,
        duration: expect.any(Number),
        success: true,
      })
    );
  });

  it('should log failed operations with duration', async () => {
    const operation = 'FailingOperation';
    const error = new Error('Operation failed');
    const fn = jest.fn().mockRejectedValue(error);
    
    await expect(logPerformance(operation, fn)).rejects.toThrow('Operation failed');
    
    expect(fn).toHaveBeenCalled();
    expect(mockEnhancedLogger.error).toHaveBeenCalledWith(
      'FailingOperation failed',
      expect.objectContaining({
        operation,
        duration: expect.any(Number),
        success: false,
        error: 'Error: Operation failed',
      })
    );
  });

  it('should measure duration accurately', async () => {
    const operation = 'TimedOperation';
    const delay = 50;
    const fn = () => new Promise(resolve => setTimeout(() => resolve('done'), delay));
    
    await logPerformance(operation, fn);
    
    const call = mockEnhancedLogger.info.mock.calls[0];
    const meta = call[1];
    
    expect(meta.duration).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
    expect(meta.duration).toBeLessThan(delay + 50); // But not too much
  });
});

describe('createSessionLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should push context with session info', () => {
    const sessionId = 'session-123';
    const userId = 'user-456';
    
    const session = createSessionLogger(sessionId, userId);
    
    expect(mockEnhancedLogger.pushContext).toHaveBeenCalledWith({
      sessionId,
      userId,
    });
  });

  it('should work without userId', () => {
    const sessionId = 'session-789';
    
    const session = createSessionLogger(sessionId);
    
    expect(mockEnhancedLogger.pushContext).toHaveBeenCalledWith({
      sessionId,
      userId: undefined,
    });
  });

  it('should pop context on end', () => {
    const session = createSessionLogger('session-abc');
    
    session.end();
    
    expect(mockEnhancedLogger.popContext).toHaveBeenCalled();
  });

  it('should handle multiple sessions', () => {
    const session1 = createSessionLogger('session-1', 'user-1');
    const session2 = createSessionLogger('session-2', 'user-2');
    
    expect(mockEnhancedLogger.pushContext).toHaveBeenCalledTimes(2);
    
    session1.end();
    expect(mockEnhancedLogger.popContext).toHaveBeenCalledTimes(1);
    
    session2.end();
    expect(mockEnhancedLogger.popContext).toHaveBeenCalledTimes(2);
  });
});

export {};