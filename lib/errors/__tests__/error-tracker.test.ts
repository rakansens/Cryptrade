// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv({
  ENABLE_SENTRY: 'false',
  TELEMETRY_ENDPOINT: '',
  TELEMETRY_API_KEY: ''
});

import { ErrorTracker, errorTracker, trackException, trackAgentError, trackToolError, trackApiError } from '../error-tracker';
import { MastraBaseError, ApiError, AgentError, ToolError, ValidationError, RateLimitError, AuthError } from '../base-error';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;

  beforeEach(() => {
    // Clear singleton instance
    (ErrorTracker as any).instance = undefined;
    tracker = ErrorTracker.getInstance();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    tracker.destroy();
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorTracker.getInstance();
      const instance2 = ErrorTracker.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should not set up flush interval in test environment', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      // Force recreation
      (ErrorTracker as any).instance = undefined;
      ErrorTracker.getInstance();
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });
  });

  describe('trackException', () => {
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

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        name: 'ApiError',
        message: 'API failed',
        code: 'API_500',
        category: 'API_ERROR',
        severity: 'ERROR',
        context: expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
          endpoint: '/api/test'
        })
      }));
    });

    it('should track regular Error', () => {
      const error = new Error('Regular error');
      
      tracker.trackException(error);

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        name: 'Error',
        message: 'Regular error',
        code: 'UNKNOWN_ERROR',
        category: 'UNKNOWN',
        severity: 'ERROR',
        stack: expect.any(String)
      }));
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
      (env as any).TELEMETRY_ENDPOINT = 'http://telemetry.test';

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
      const circularRef: any = { prop: null };
      circularRef.prop = circularRef;
      
      const problematicError = new Error('Test');
      (problematicError as any).circular = circularRef;

      // Mock logger.error to throw
      const originalError = logger.error;
      (logger.error as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      expect(() => tracker.trackException(problematicError)).not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith('Failed to track exception', expect.objectContaining({
        originalError: 'Test',
        trackingError: 'Error: Logging failed'
      }));

      // Restore
      logger.error = originalError;
    });

    it('should log to console in development', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (env as any).NODE_ENV = 'development';

      const error = new Error('Dev error');
      tracker.trackException(error);

      expect(consoleSpy).toHaveBeenCalledWith('🚨 Error Tracked:', error);

      // Restore
      (env as any).NODE_ENV = 'test';
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
      expect(stats.recent[0].message).toBe('Error 5');
      expect(stats.recent[9].message).toBe('Error 14');
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
      (env as any).TELEMETRY_ENDPOINT = 'http://telemetry.test';
      (env as any).TELEMETRY_API_KEY = 'test-key';
    });

    it('should flush errors to telemetry endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      tracker.trackException(new Error('Error 1'));
      tracker.trackException(new Error('Error 2'));

      // Manually trigger flush
      await (tracker as any).flush();

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
      await (tracker as any).flush();

      expect(logger.warn).toHaveBeenCalledWith('Failed to flush errors', {
        error: 'Error: Network error'
      });

      // Buffer should be restored
      const stats = tracker.getStats();
      expect(stats.total).toBe(2);
    });

    it('should skip flush if buffer is empty', async () => {
      await (tracker as any).flush();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not flush if no telemetry endpoint', async () => {
      (env as any).TELEMETRY_ENDPOINT = '';

      tracker.trackException(new Error('Error 1'));
      await (tracker as any).flush();

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

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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
      retryableErrors.forEach(error => {
        expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
          retryable: true,
          retryAfter: error.retryAfter
        }));
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
      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        severity: 'CRITICAL'
      }));

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';

      tracker.trackException(new Error('Production error'));

      expect(consoleSpy).not.toHaveBeenCalled();

      // Restore
      (env as any).NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should attempt Sentry integration in production', () => {
      const originalEnv = env.NODE_ENV;
      const originalSentry = env.ENABLE_SENTRY;
      (env as any).NODE_ENV = 'production';
      (env as any).ENABLE_SENTRY = true;

      // Note: Actual Sentry integration would be mocked
      tracker.trackException(new Error('Sentry error'));

      // Just verify it doesn't throw
      expect(logger.error).toHaveBeenCalled();

      // Restore
      (env as any).NODE_ENV = originalEnv;
      (env as any).ENABLE_SENTRY = originalSentry;
    });
  });

  describe('destroy', () => {
    it('should flush remaining errors on destroy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      // Set telemetry endpoint for flushing
      (env as any).TELEMETRY_ENDPOINT = 'http://test.com';

      tracker.trackException(new Error('Error'));
      tracker.destroy();
      
      // Should have flushed
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(global.fetch).toHaveBeenCalled();

      // Restore
      (env as any).TELEMETRY_ENDPOINT = '';
    });
  });

  describe('Helper functions', () => {
    it('should track exception using global function', () => {
      const error = new Error('Test error');
      const context = { userId: 'user-123' };

      trackException(error, context);

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
        message: 'Test error',
        context
      }));
    });

    it('should track agent error with agent name', () => {
      const error = new Error('Agent failed');
      
      trackAgentError(error, 'TradingAgent', { action: 'buy' });

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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

      expect(logger.error).toHaveBeenCalledWith('Exception tracked', expect.objectContaining({
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
      expect(stats.recent[0].message).toContain('Ordered 0');
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

      expect(logger.warn).toHaveBeenCalledWith('Failed to track exception', expect.any(Object));
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