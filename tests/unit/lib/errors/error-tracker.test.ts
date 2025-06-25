// Import test environment setup first
import '@/tests/setup/test-env';

// Import modules first
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';
import { ErrorTracker, trackException, trackAgentError, trackToolError, trackApiError } from '@/lib/errors/error-tracker';

// Type definitions for error options
interface BaseErrorOptions {
  name?: string;
  code: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  context?: Record<string, unknown>;
  category?: string;
  severity?: string;
  retryable?: boolean;
  retryAfter?: number;
}

// Create mock error classes that match the expected interface
class MastraBaseError extends Error {
  code: string;
  timestamp: Date;
  correlationId?: string;
  data?: Record<string, unknown>;
  context?: Record<string, unknown>;
  category: string;
  severity: string;
  retryable: boolean;
  retryAfter?: number;

  constructor(message: string, options: BaseErrorOptions) {
    super(message);
    this.name = options.name || this.constructor.name;
    this.code = options.code;
    this.timestamp = new Date();
    this.correlationId = options.correlationId;
    this.data = options.data;
    this.context = options.context;
    this.category = options.category || 'UNKNOWN';
    this.severity = options.severity || 'ERROR';
    this.retryable = options.retryable || false;
    this.retryAfter = options.retryAfter;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      ...(this.correlationId !== undefined && { correlationId: this.correlationId }),
      ...(this.data !== undefined && { data: this.data }),
      ...(this.context !== undefined && { context: this.context }),
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
      ...(this.stack !== undefined && { stack: this.stack }),
    };
  }
}

class ApiError extends MastraBaseError {
  constructor(message: string, statusCode: number, options?: Partial<BaseErrorOptions>) {
    const { correlationId, ...restOptions } = options || {};
    super(message, {
      code: `API_${statusCode}`,
      category: 'API_ERROR',
      data: { statusCode },
      retryable: statusCode >= 500 || statusCode === 429,
      correlationId,
      context: correlationId ? { correlationId } : undefined,
      ...restOptions,
    });
  }
}

class AgentError extends MastraBaseError {
  constructor(message: string, agentName: string, options?: Partial<BaseErrorOptions>) {
    super(message, {
      code: 'AGENT_EXECUTION_ERROR',
      category: 'AGENT_ERROR',
      data: { agentName },
      ...options,
    });
  }
}

class ToolError extends MastraBaseError {
  constructor(message: string, toolName: string, options?: Partial<BaseErrorOptions>) {
    super(message, {
      code: 'TOOL_EXECUTION_ERROR',
      category: 'TOOL_ERROR',
      data: { toolName },
      ...options,
    });
  }
}

class ValidationError extends MastraBaseError {
  constructor(message: string, field: string, value: unknown, options?: Partial<BaseErrorOptions>) {
    super(message, {
      code: 'VALIDATION_ERROR',
      category: 'VALIDATION_ERROR',
      data: { field, value },
      severity: 'WARNING',
      ...options,
    });
  }
}

class RateLimitError extends MastraBaseError {
  constructor(message: string, retryAfter: number, options?: Partial<BaseErrorOptions>) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      category: 'RATE_LIMIT_ERROR',
      retryable: true,
      retryAfter,
      severity: 'WARNING',
      ...options,
    });
  }
}

class AuthError extends MastraBaseError {
  constructor(message: string, options?: Partial<BaseErrorOptions>) {
    super(message, {
      code: 'AUTH_ERROR',
      category: 'AUTH_ERROR',
      severity: 'ERROR',
      retryable: false,
      ...options,
    });
  }
}

// Mock logger methods using spyOn
const mockLogger = {
  error: jest.spyOn(logger, 'error').mockImplementation(),
  warn: jest.spyOn(logger, 'warn').mockImplementation(),
  info: jest.spyOn(logger, 'info').mockImplementation(),
  debug: jest.spyOn(logger, 'debug').mockImplementation(),
};

// Ensure fetch is properly mocked before any tests
beforeAll(() => {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('OK'),
      status: 200,
      statusText: 'OK',
    })
  );
});

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;

  beforeEach(() => {
    // Clear singleton instance using type assertion to access private property
    (ErrorTracker as unknown as { instance?: ErrorTracker }).instance = undefined;
    tracker = ErrorTracker.getInstance();
    jest.clearAllMocks();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    
    // Reset and setup fetch mock
    if (global.fetch) {
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
          text: () => Promise.resolve('OK'),
          status: 200,
          statusText: 'OK',
        })
      );
    }
  });

  afterEach(() => {
    tracker.destroy();
  });

  afterAll(() => {
    // Clean up
    tracker.destroy();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorTracker.getInstance();
      const instance2 = ErrorTracker.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should not set up flush interval in test environment', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      // Force recreation using type assertion to access private property
      (ErrorTracker as unknown as { instance?: ErrorTracker }).instance = undefined;
      ErrorTracker.getInstance();
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });
  });

  describe('trackException', () => {
    it('should call logger directly', () => {
      // Direct logger test
      logger.error('test message', { test: true });
      expect(mockLogger.error).toHaveBeenCalledWith('test message', { test: true });
    });

    it('should track MastraBaseError with context', () => {
      const error = new ApiError('API failed', 500, {
        correlationId: 'corr-123'
      });

      const context = {
        userId: 'user-123',
        sessionId: 'session-456',
        endpoint: '/api/test'
      };

      tracker.trackException(error, context);

      // Instead of checking logger calls, check the buffer
      const stats = tracker.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byCategory['API_ERROR']).toBe(1);
      expect(stats.bySeverity['ERROR']).toBe(1);
      
      const recentError = stats.recent[0];
      expect(recentError).toMatchObject({
        name: 'ApiError',
        message: 'API failed',
        code: 'API_500',
        category: 'API_ERROR',
        severity: 'ERROR',
        context: expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
          endpoint: '/api/test',
          correlationId: 'corr-123'
        })
      });
    });

    it('should track regular Error', () => {
      const error = new Error('Regular error');
      
      tracker.trackException(error);

      const stats = tracker.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byCategory['UNKNOWN']).toBe(1);
      
      const recentError = stats.recent[0];
      expect(recentError).toMatchObject({
        name: 'Error',
        message: 'Regular error',
        code: 'UNKNOWN_ERROR',
        category: 'UNKNOWN',
        severity: 'ERROR'
      });
      expect(recentError.stack).toBeDefined();
    });

    it('should add error to buffer', () => {
      const error = new Error('Test error');
      tracker.trackException(error);

      const stats = tracker.getStats();
      expect(stats.total).toBe(1);
    });

    it('should flush immediately for critical errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      // Set telemetry endpoint to enable flushing
      const envWithTelemetry = env as typeof env & { TELEMETRY_ENDPOINT: string };
      envWithTelemetry.TELEMETRY_ENDPOINT = 'http://telemetry.test';

      const error = new MastraBaseError('Critical error', {
        code: 'CRITICAL_ERROR',
        severity: 'CRITICAL'
      });

      tracker.trackException(error);

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalledWith(
        'http://telemetry.test/errors',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle tracking errors gracefully', () => {
      // Create an error that will cause issues when serializing
      interface CircularReference {
        prop: CircularReference | null;
      }
      const circularRef = { prop: null } as CircularReference;
      circularRef.prop = circularRef;
      
      const problematicError = new Error('Test');
      (problematicError as Error & { circular: CircularReference }).circular = circularRef;

      // Mock logger.error to throw
      const originalError = logger.error;
      (logger.error as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      expect(() => tracker.trackException(problematicError)).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to track exception', expect.objectContaining({
        originalError: 'Test',
        trackingError: 'Error: Logging failed'
      }));

      // Restore
      logger.error = originalError;
    });

    it('should log to console in development', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const envWithNodeEnv = env as typeof env & { NODE_ENV: string };
      const originalNodeEnv = envWithNodeEnv.NODE_ENV;
      envWithNodeEnv.NODE_ENV = 'development';

      const error = new Error('Dev error');
      tracker.trackException(error);

      expect(consoleSpy).toHaveBeenCalledWith('🚨 Error Tracked:', error);

      // Restore
      envWithNodeEnv.NODE_ENV = originalNodeEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('trackBatch', () => {
    it('should track multiple errors', () => {
      const errors = [
        { error: new Error('Error 1'), context: { id: 1 } },
        { error: new ApiError('API Error', 500), context: { id: 2 } },
        { error: new AgentError('Agent Error', 'TestAgent') }
      ];

      tracker.trackBatch(errors);

      expect(logger.error).toHaveBeenCalledTimes(3);
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(3);
    });
  });

  describe('getStats', () => {
    it('should return error statistics', () => {
      tracker.trackException(new ApiError('API 1', 500));
      tracker.trackException(new ApiError('API 2', 404));
      tracker.trackException(new AgentError('Agent 1', 'Agent1'));
      tracker.trackException(new MastraBaseError('Warning', {
        code: 'WARN',
        category: 'VALIDATION_ERROR',
        severity: 'WARNING'
      }));

      const stats = tracker.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byCategory).toEqual({
        'API_ERROR': 2,
        'AGENT_ERROR': 1,
        'VALIDATION_ERROR': 1
      });
      expect(stats.bySeverity).toEqual({
        'ERROR': 3,
        'WARNING': 1
      });
      expect(stats.recent).toHaveLength(4);
    });

    it('should limit recent errors to last 10', () => {
      // Track 15 errors
      for (let i = 0; i < 15; i++) {
        tracker.trackException(new Error(`Error ${i}`));
      }

      const stats = tracker.getStats();
      expect(stats.total).toBe(15);
      expect(stats.recent).toHaveLength(10);
      expect(stats.recent[0]?.message).toBe('Error 5');
      expect(stats.recent[9]?.message).toBe('Error 14');
    });
  });

  describe('clear', () => {
    it('should clear error buffer', () => {
      tracker.trackException(new Error('Error 1'));
      tracker.trackException(new Error('Error 2'));

      let stats = tracker.getStats();
      expect(stats.total).toBe(2);

      tracker.clear();

      stats = tracker.getStats();
      expect(stats.total).toBe(0);
      expect(stats.recent).toHaveLength(0);
    });
  });

  describe('flush', () => {
    beforeEach(() => {
      const envWithTelemetry = env as typeof env & { 
        TELEMETRY_ENDPOINT: string;
        TELEMETRY_API_KEY: string; 
      };
      envWithTelemetry.TELEMETRY_ENDPOINT = 'http://telemetry.test';
      envWithTelemetry.TELEMETRY_API_KEY = 'test-key';
    });

    it('should flush errors to telemetry endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      tracker.trackException(new Error('Error 1'));
      tracker.trackException(new Error('Error 2'));

      // Manually trigger flush
      await (tracker as unknown as { flush(): Promise<void> }).flush();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://telemetry.test/errors',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key'
          },
          body: expect.stringContaining('"errors"')
        })
      );

      // Buffer should be cleared after successful flush
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
    });

    it('should restore buffer on flush failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      tracker.trackException(new Error('Error 1'));
      tracker.trackException(new Error('Error 2'));

      // Manually trigger flush
      await (tracker as unknown as { flush(): Promise<void> }).flush();

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to flush errors', {
        error: 'Error: Network error'
      });

      // Buffer should be restored
      const stats = tracker.getStats();
      expect(stats.total).toBe(2);
    });

    it('should skip flush if buffer is empty', async () => {
      await (tracker as unknown as { flush(): Promise<void> }).flush();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not flush if no telemetry endpoint', async () => {
      const envWithTelemetry = env as typeof env & { TELEMETRY_ENDPOINT: string };
      envWithTelemetry.TELEMETRY_ENDPOINT = '';

      tracker.trackException(new Error('Error 1'));
      await (tracker as unknown as { flush(): Promise<void> }).flush();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error classification tracking', () => {
    it('should track errors by category correctly', () => {
      const errors = [
        new ApiError('API error', 500),
        new ApiError('Not found', 404),
        new AgentError('Agent failed', 'TestAgent'),
        new ToolError('Tool failed', 'TestTool'),
        new ValidationError('Invalid', 'field', 'value'),
        new RateLimitError('Limited', 5000),
        new AuthError('Unauthorized')
      ];

      errors.forEach(error => tracker.trackException(error));

      const stats = tracker.getStats();
      expect(stats.byCategory).toEqual({
        'API_ERROR': 2,
        'AGENT_ERROR': 1,
        'TOOL_ERROR': 1,
        'VALIDATION_ERROR': 1,
        'RATE_LIMIT_ERROR': 1,
        'AUTH_ERROR': 1
      });
    });

    it('should track network errors separately', () => {
      const networkError = new MastraBaseError('Connection timeout', {
        code: 'NETWORK_TIMEOUT',
        category: 'NETWORK_ERROR',
        retryable: true
      });

      tracker.trackException(networkError);

      const stats = tracker.getStats();
      expect(stats.byCategory['NETWORK_ERROR']).toBe(1);
    });

    it('should track workflow errors', () => {
      const workflowError = new MastraBaseError('Workflow step failed', {
        code: 'WORKFLOW_STEP_FAILED',
        category: 'WORKFLOW_ERROR',
        context: { workflowId: 'wf-123', step: 3 }
      });

      tracker.trackException(workflowError, { workflowId: 'wf-123' });

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        category: 'WORKFLOW_ERROR',
        context: expect.objectContaining({
          workflowId: 'wf-123',
          step: 3
        })
      }));
    });
  });

  describe('Retry handling tracking', () => {
    it('should track retryable errors with retry information', () => {
      const retryableErrors = [
        new ApiError('Server error', 500),
        new RateLimitError('Rate limited', 60000),
        new MastraBaseError('Temporary failure', {
          code: 'TEMP_FAILURE',
          retryable: true,
          retryAfter: 5000
        })
      ];

      retryableErrors.forEach(error => tracker.trackException(error));

      expect(logger.error).toHaveBeenCalledTimes(3);
      
      // Verify retry information is tracked
      const calls = (logger.error as jest.Mock).mock.calls;
      
      // First error (ApiError 500) - should be retryable but no retryAfter
      expect(calls[0][1]).toMatchObject({
        retryable: true,
        message: 'Server error'
      });
      
      // Second error (RateLimitError) - should have retryAfter
      expect(calls[1][1]).toMatchObject({
        retryable: true,
        retryAfter: 60000,
        message: 'Rate limited'
      });
      
      // Third error (MastraBaseError) - should have retryAfter
      expect(calls[2][1]).toMatchObject({
        retryable: true,
        retryAfter: 5000,
        message: 'Temporary failure'
      });
    });

    it('should distinguish retryable from non-retryable errors', () => {
      tracker.trackException(new ApiError('Server error', 503)); // Retryable
      tracker.trackException(new ApiError('Bad request', 400)); // Non-retryable
      tracker.trackException(new AuthError('Invalid token')); // Non-retryable

      const calls = (logger.error as jest.Mock).mock.calls;
      
      expect(calls[0][1].retryable).toBe(true);
      expect(calls[1][1].retryable).toBe(false);
      expect(calls[2][1].retryable).toBe(false);
    });
  });

  describe('Logging integration', () => {
    it('should respect error severity when logging', () => {
      const criticalError = new MastraBaseError('System failure', {
        code: 'SYSTEM_FAILURE',
        severity: 'CRITICAL'
      });

      const warningError = new ValidationError('Invalid input', 'email', 'bad-email');
      
      tracker.trackException(criticalError);
      tracker.trackException(warningError);

      // Critical errors should trigger immediate flush
      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        severity: 'CRITICAL'
      }));

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        severity: 'WARNING'
      }));
    });

    it('should include timestamp in tracked errors', () => {
      const beforeTime = new Date();
      tracker.trackException(new Error('Test'));
      const afterTime = new Date();

      const trackedError = (logger.error as jest.Mock).mock.calls[0][1];
      const errorTime = new Date(trackedError.timestamp);

      expect(errorTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Context enrichment', () => {
    it('should merge error context with tracking context', () => {
      const error = new ToolError('Tool failed', 'DataProcessor', {
        context: { input: 'test-data', attempt: 1 }
      });

      const trackingContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789'
      };

      tracker.trackException(error, trackingContext);

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        context: expect.objectContaining({
          input: 'test-data',
          attempt: 1,
          userId: 'user-123',
          sessionId: 'session-456',
          requestId: 'req-789'
        })
      }));
    });

    it('should preserve error stack traces', () => {
      const error = new Error('Test error with stack');
      tracker.trackException(error);

      const trackedError = (logger.error as jest.Mock).mock.calls[0][1];
      expect(trackedError.stack).toBeDefined();
      expect(trackedError.stack).toContain('Test error with stack');
    });
  });

  describe('Batch operations', () => {
    it('should handle large batch of errors efficiently', () => {
      const errors = Array.from({ length: 100 }, (_, i) => ({
        error: new Error(`Error ${i}`),
        context: { index: i }
      }));

      const startTime = Date.now();
      tracker.trackBatch(errors);
      const duration = Date.now() - startTime;

      expect(logger.error).toHaveBeenCalledTimes(100);
      expect(duration).toBeLessThan(100); // Should be fast
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(100);
    });

    it('should handle mixed error types in batch', () => {
      const mixedErrors = [
        { error: new ApiError('API', 500), context: { type: 'api' } },
        { error: new AgentError('Agent', 'Test'), context: { type: 'agent' } },
        { error: new Error('Regular'), context: { type: 'regular' } },
        { error: new ValidationError('Invalid', 'field', null), context: { type: 'validation' } }
      ];

      tracker.trackBatch(mixedErrors);

      const stats = tracker.getStats();
      expect(stats.byCategory).toMatchObject({
        'API_ERROR': 1,
        'AGENT_ERROR': 1,
        'UNKNOWN': 1,
        'VALIDATION_ERROR': 1
      });
    });
  });

  describe('Error deduplication', () => {
    it('should track duplicate errors separately', () => {
      const error1 = new Error('Duplicate error');
      const error2 = new Error('Duplicate error');

      tracker.trackException(error1);
      tracker.trackException(error2);

      const stats = tracker.getStats();
      expect(stats.total).toBe(2);
    });

    it('should maintain separate contexts for duplicate errors', () => {
      const error = new ApiError('Same error', 500);

      tracker.trackException(error, { request: 1 });
      tracker.trackException(error, { request: 2 });

      const calls = (logger.error as jest.Mock).mock.calls;
      expect(calls[0][1].context.request).toBe(1);
      expect(calls[1][1].context.request).toBe(2);
    });
  });

  describe('Memory management', () => {
    it('should handle buffer overflow gracefully', () => {
      // Track many errors to test buffer behavior
      for (let i = 0; i < 1000; i++) {
        tracker.trackException(new Error(`Error ${i}`));
      }

      const stats = tracker.getStats();
      expect(stats.total).toBe(1000);
      expect(stats.recent).toHaveLength(10); // Should still limit recent to 10
    });

    it('should clear buffer properly', () => {
      // Add errors
      for (let i = 0; i < 50; i++) {
        tracker.trackException(new Error(`Error ${i}`));
      }

      expect(tracker.getStats().total).toBe(50);

      tracker.clear();

      expect(tracker.getStats().total).toBe(0);
      expect(tracker.getStats().byCategory).toEqual({});
      expect(tracker.getStats().bySeverity).toEqual({});
    });
  });

  describe('Production mode behavior', () => {
    it('should not log to console in production', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const envWithNodeEnv = env as typeof env & { NODE_ENV: string };
      const originalEnv = envWithNodeEnv.NODE_ENV;
      envWithNodeEnv.NODE_ENV = 'production';

      tracker.trackException(new Error('Production error'));

      expect(consoleSpy).not.toHaveBeenCalled();

      // Restore
      envWithNodeEnv.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should attempt Sentry integration in production', () => {
      const envWithSentry = env as typeof env & { 
        NODE_ENV: string;
        ENABLE_SENTRY: boolean;
      };
      const originalEnv = envWithSentry.NODE_ENV;
      const originalSentry = envWithSentry.ENABLE_SENTRY;
      envWithSentry.NODE_ENV = 'production';
      envWithSentry.ENABLE_SENTRY = true;

      // Note: Actual Sentry integration would be mocked
      tracker.trackException(new Error('Sentry error'));

      // Just verify it doesn't throw
      expect(logger.error).toHaveBeenCalled();

      // Restore
      envWithSentry.NODE_ENV = originalEnv;
      envWithSentry.ENABLE_SENTRY = originalSentry;
    });
  });

  describe('destroy', () => {
    it('should flush remaining errors on destroy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      // Set telemetry endpoint for flushing
      const envWithTelemetry = env as typeof env & { TELEMETRY_ENDPOINT: string };
      const originalEndpoint = envWithTelemetry.TELEMETRY_ENDPOINT;
      envWithTelemetry.TELEMETRY_ENDPOINT = 'http://test.com';

      tracker.trackException(new Error('Error'));
      tracker.destroy();
      
      // Should have flushed
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(global.fetch).toHaveBeenCalled();

      // Restore
      envWithTelemetry.TELEMETRY_ENDPOINT = originalEndpoint || '';
    });
  });

  describe('Helper functions', () => {
    it('should track exception using global function', () => {
      const error = new Error('Test error');
      const context = { userId: 'user-123' };

      trackException(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        message: 'Test error',
        context
      }));
    });

    it('should track agent error with agent name', () => {
      const error = new Error('Agent failed');
      
      trackAgentError(error, 'TradingAgent', { action: 'buy' });

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        message: 'Agent failed',
        context: expect.objectContaining({
          agentName: 'TradingAgent',
          action: 'buy'
        })
      }));
    });

    it('should track tool error with tool name', () => {
      const error = new Error('Tool failed');
      
      trackToolError(error, 'ChartTool', { operation: 'draw' });

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        message: 'Tool failed',
        context: expect.objectContaining({
          toolName: 'ChartTool',
          operation: 'draw'
        })
      }));
    });

    it('should track API error with endpoint and status', () => {
      const error = new Error('Request failed');
      
      trackApiError(error, '/api/data', 500, { method: 'GET' });

      expect(mockLogger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        message: 'Request failed',
        context: expect.objectContaining({
          endpoint: '/api/data',
          statusCode: 500,
          type: 'API_ERROR',
          method: 'GET'
        })
      }));
    });
  });

  describe('Concurrent error tracking', () => {
    it('should handle concurrent error tracking safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve().then(() => 
          tracker.trackException(new Error(`Concurrent ${i}`))
        )
      );

      await Promise.all(promises);

      const stats = tracker.getStats();
      expect(stats.total).toBe(10);
    });

    it('should maintain error order in concurrent scenarios', async () => {
      const errors: Error[] = [];
      for (let i = 0; i < 5; i++) {
        const error = new Error(`Ordered ${i}`);
        errors.push(error);
        tracker.trackException(error);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const stats = tracker.getStats();
      expect(stats.recent[0]?.message).toContain('Ordered 0');
    });
  });

  describe('Error recovery and resilience', () => {
    it('should continue tracking after logger failure', () => {
      const originalError = logger.error;
      let callCount = 0;

      (logger.error as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Logger failed');
        }
      });

      tracker.trackException(new Error('First'));
      tracker.trackException(new Error('Second')); // This will fail
      tracker.trackException(new Error('Third'));

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to track exception', expect.any(Object));
      expect(callCount).toBe(3);

      // Restore
      logger.error = originalError;
    });

    it('should handle malformed error objects', () => {
      const malformedError = Object.create(null);
      malformedError.message = 'Malformed';
      
      // Should not throw
      expect(() => tracker.trackException(malformedError as Error)).not.toThrow();
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(1);
    });
  });
});