import { MastraBaseError, ErrorCategory, ErrorSeverity, ApiError, AgentError, ToolError, ValidationError, RateLimitError, AuthError } from '../base-error';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('MastraBaseError', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MastraBaseError class', () => {
    it('should create error with all properties', () => {
      const error = new MastraBaseError('Test error', {
        code: 'TEST_ERROR',
        correlationId: 'corr-123',
        data: { field: 'value' },
        context: { userId: 'user-123' },
        category: 'API_ERROR',
        severity: 'ERROR',
        retryable: true,
        retryAfter: 5000
      });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.correlationId).toBe('corr-123');
      expect(error.data).toEqual({ field: 'value' });
      expect(error.context).toEqual({ userId: 'user-123' });
      expect(error.category).toBe('API_ERROR');
      expect(error.severity).toBe('ERROR');
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use default values when not provided', () => {
      const error = new MastraBaseError('Test error', {
        code: 'TEST_ERROR'
      });

      expect(error.name).toBe('MastraBaseError');
      expect(error.category).toBe('UNKNOWN');
      expect(error.severity).toBe('ERROR');
      expect(error.retryable).toBe(false);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should capture stack trace', () => {
      const error = new MastraBaseError('Test error', {
        code: 'TEST_ERROR'
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MastraBaseError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new MastraBaseError('Test error', {
        code: 'TEST_ERROR',
        correlationId: 'corr-123',
        data: { field: 'value' },
        context: { userId: 'user-123' },
        category: 'API_ERROR',
        severity: 'WARNING',
        retryable: true,
        retryAfter: 3000
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'MastraBaseError',
        message: 'Test error',
        code: 'TEST_ERROR',
        timestamp: error.timestamp.toISOString(),
        correlationId: 'corr-123',
        data: { field: 'value' },
        context: { userId: 'user-123' },
        category: 'API_ERROR',
        severity: 'WARNING',
        retryable: true,
        retryAfter: 3000,
        stack: expect.any(String)
      });
    });

    it('should handle generic types correctly', () => {
      interface ErrorData {
        field: string;
        value: number;
      }

      interface ErrorContext {
        userId: string;
        sessionId: string;
      }

      const error = new MastraBaseError<ErrorData, ErrorContext>('Typed error', {
        code: 'TYPED_ERROR',
        data: { field: 'test', value: 42 },
        context: { userId: 'user-123', sessionId: 'session-456' }
      });

      expect(error.data?.field).toBe('test');
      expect(error.data?.value).toBe(42);
      expect(error.context?.userId).toBe('user-123');
      expect(error.context?.sessionId).toBe('session-456');
    });

    describe('log method', () => {
      it('should log with INFO severity', () => {
        const error = new MastraBaseError('Info error', {
          code: 'INFO_ERROR',
          severity: 'INFO'
        });

        error.log();

        expect(logger.info).toHaveBeenCalledWith('Info error', error.toJSON());
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('should log with WARNING severity', () => {
        const error = new MastraBaseError('Warning error', {
          code: 'WARNING_ERROR',
          severity: 'WARNING'
        });

        error.log();

        expect(logger.warn).toHaveBeenCalledWith('Warning error', error.toJSON());
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('should log with ERROR severity', () => {
        const error = new MastraBaseError('Error message', {
          code: 'ERROR_CODE',
          severity: 'ERROR'
        });

        error.log();

        expect(logger.error).toHaveBeenCalledWith('Error message', error.toJSON());
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('should log with CRITICAL severity', () => {
        const error = new MastraBaseError('Critical error', {
          code: 'CRITICAL_ERROR',
          severity: 'CRITICAL'
        });

        error.log();

        expect(logger.error).toHaveBeenCalledWith('[CRITICAL] Critical error', error.toJSON());
      });
    });
  });

  describe('ApiError class', () => {
    it('should create API error with status code', () => {
      const error = new ApiError('API failed', 503);

      expect(error.message).toBe('API failed');
      expect(error.code).toBe('API_503');
      expect(error.category).toBe('API_ERROR');
      expect(error.data).toEqual({ statusCode: 503 });
      expect(error.retryable).toBe(true);
    });

    it('should set retryable for 5xx errors', () => {
      const error500 = new ApiError('Server error', 500);
      const error502 = new ApiError('Bad gateway', 502);

      expect(error500.retryable).toBe(true);
      expect(error502.retryable).toBe(true);
    });

    it('should set retryable for 429 rate limit', () => {
      const error = new ApiError('Rate limited', 429);
      expect(error.retryable).toBe(true);
    });

    it('should not set retryable for 4xx errors', () => {
      const error400 = new ApiError('Bad request', 400);
      const error404 = new ApiError('Not found', 404);

      expect(error400.retryable).toBe(false);
      expect(error404.retryable).toBe(false);
    });

    it('should accept additional options', () => {
      const error = new ApiError('API failed', 500, {
        correlationId: 'corr-123',
        context: { endpoint: '/api/test' }
      });

      expect(error.correlationId).toBe('corr-123');
      expect(error.context).toEqual({ endpoint: '/api/test' });
    });
  });

  describe('AgentError class', () => {
    it('should create agent error with agent name', () => {
      const error = new AgentError('Agent execution failed', 'TradingAgent');

      expect(error.message).toBe('Agent execution failed');
      expect(error.code).toBe('AGENT_EXECUTION_ERROR');
      expect(error.category).toBe('AGENT_ERROR');
      expect(error.data).toEqual({ agentName: 'TradingAgent' });
    });

    it('should accept additional options', () => {
      const error = new AgentError('Agent failed', 'TestAgent', {
        severity: 'CRITICAL',
        context: { action: 'processTrade' }
      });

      expect(error.severity).toBe('CRITICAL');
      expect(error.context).toEqual({ action: 'processTrade' });
    });
  });

  describe('ToolError class', () => {
    it('should create tool error with tool name', () => {
      const error = new ToolError('Tool execution failed', 'ChartTool');

      expect(error.message).toBe('Tool execution failed');
      expect(error.code).toBe('TOOL_EXECUTION_ERROR');
      expect(error.category).toBe('TOOL_ERROR');
      expect(error.data).toEqual({ toolName: 'ChartTool' });
    });

    it('should accept additional options', () => {
      const error = new ToolError('Tool failed', 'TestTool', {
        retryable: true,
        retryAfter: 1000,
        context: { input: { x: 1, y: 2 } }
      });

      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(1000);
      expect(error.context).toEqual({ input: { x: 1, y: 2 } });
    });
  });

  describe('ValidationError class', () => {
    it('should create validation error with field and value', () => {
      const error = new ValidationError('Invalid email format', 'email', 'not-an-email');

      expect(error.message).toBe('Invalid email format');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe('VALIDATION_ERROR');
      expect(error.severity).toBe('WARNING');
      expect(error.data).toEqual({ 
        field: 'email', 
        value: 'not-an-email' 
      });
    });

    it('should handle complex values', () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      const error = new ValidationError('Invalid structure', 'data', complexValue);

      expect(error.data).toEqual({
        field: 'data',
        value: complexValue
      });
    });

    it('should accept additional options', () => {
      const error = new ValidationError('Validation failed', 'age', -5, {
        correlationId: 'req-123',
        context: { form: 'registration' }
      });

      expect(error.correlationId).toBe('req-123');
      expect(error.context).toEqual({ form: 'registration' });
    });
  });

  describe('AuthError class', () => {
    it('should create auth error with defaults', () => {
      const error = new AuthError('Unauthorized access');

      expect(error.message).toBe('Unauthorized access');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.category).toBe('AUTH_ERROR');
      expect(error.severity).toBe('ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should accept additional options', () => {
      const error = new AuthError('Token expired', {
        correlationId: 'auth-123',
        context: { endpoint: '/api/protected', userId: 'user-123' }
      });

      expect(error.correlationId).toBe('auth-123');
      expect(error.context).toEqual({ endpoint: '/api/protected', userId: 'user-123' });
    });
  });

  describe('RateLimitError class', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('Rate limit exceeded', 5000);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.category).toBe('RATE_LIMIT_ERROR');
      expect(error.severity).toBe('WARNING');
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
    });

    it('should accept additional options', () => {
      const error = new RateLimitError('Too many requests', 3000, {
        correlationId: 'rate-123',
        context: { endpoint: '/api/data' }
      });

      expect(error.correlationId).toBe('rate-123');
      expect(error.context).toEqual({ endpoint: '/api/data' });
      expect(error.retryAfter).toBe(3000);
    });
  });

  describe('Error inheritance', () => {
    it('should maintain instanceof relationships', () => {
      const apiError = new ApiError('API failed', 500);
      const agentError = new AgentError('Agent failed', 'TestAgent');
      const toolError = new ToolError('Tool failed', 'TestTool');
      const validationError = new ValidationError('Invalid', 'field', 'value');
      const rateLimitError = new RateLimitError('Rate limited', 1000);

      // All should be instances of MastraBaseError
      expect(apiError).toBeInstanceOf(MastraBaseError);
      expect(agentError).toBeInstanceOf(MastraBaseError);
      expect(toolError).toBeInstanceOf(MastraBaseError);
      expect(validationError).toBeInstanceOf(MastraBaseError);
      expect(rateLimitError).toBeInstanceOf(MastraBaseError);

      // All should be instances of Error
      expect(apiError).toBeInstanceOf(Error);
      expect(agentError).toBeInstanceOf(Error);
      expect(toolError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(Error);
      expect(rateLimitError).toBeInstanceOf(Error);

      // Each should be instance of its own class
      expect(apiError).toBeInstanceOf(ApiError);
      expect(agentError).toBeInstanceOf(AgentError);
      expect(toolError).toBeInstanceOf(ToolError);
      expect(validationError).toBeInstanceOf(ValidationError);
      expect(rateLimitError).toBeInstanceOf(RateLimitError);
    });
  });

  describe('Error classification and categorization', () => {
    it('should correctly classify errors by category', () => {
      const errors = [
        new ApiError('API error', 500),
        new AgentError('Agent error', 'TestAgent'),
        new ToolError('Tool error', 'TestTool'),
        new ValidationError('Validation error', 'field', 'value'),
        new RateLimitError('Rate limit', 1000),
        new AuthError('Auth error')
      ];

      const categories = errors.map(e => e.category);
      expect(categories).toEqual([
        'API_ERROR',
        'AGENT_ERROR',
        'TOOL_ERROR',
        'VALIDATION_ERROR',
        'RATE_LIMIT_ERROR',
        'AUTH_ERROR'
      ]);
    });

    it('should correctly assign severity levels', () => {
      const critical = new MastraBaseError('Critical issue', {
        code: 'CRITICAL',
        severity: 'CRITICAL'
      });
      const warning = new ValidationError('Invalid input', 'field', 'value');
      const error = new ApiError('Server error', 500);
      const info = new MastraBaseError('Info message', {
        code: 'INFO',
        severity: 'INFO'
      });

      expect(critical.severity).toBe('CRITICAL');
      expect(warning.severity).toBe('WARNING');
      expect(error.severity).toBe('ERROR');
      expect(info.severity).toBe('INFO');
    });
  });

  describe('Retry handling', () => {
    it('should correctly identify retryable errors', () => {
      const retryableErrors = [
        new ApiError('Server error', 500),
        new ApiError('Bad gateway', 502),
        new ApiError('Service unavailable', 503),
        new ApiError('Rate limited', 429),
        new RateLimitError('Too many requests', 5000),
        new MastraBaseError('Retryable', { code: 'RETRY', retryable: true })
      ];

      retryableErrors.forEach(error => {
        expect(error.retryable).toBe(true);
      });
    });

    it('should correctly identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new ApiError('Bad request', 400),
        new ApiError('Unauthorized', 401),
        new ApiError('Forbidden', 403),
        new ApiError('Not found', 404),
        new AuthError('Invalid token'),
        new ValidationError('Invalid', 'field', 'value'),
        new AgentError('Agent failed', 'TestAgent'),
        new ToolError('Tool failed', 'TestTool')
      ];

      nonRetryableErrors.forEach(error => {
        expect(error.retryable).toBe(false);
      });
    });

    it('should include retry after information', () => {
      const rateLimitError = new RateLimitError('Rate limited', 30000);
      expect(rateLimitError.retryAfter).toBe(30000);

      const apiError = new ApiError('Too many requests', 429, {
        retryAfter: 60000
      });
      expect(apiError.retryAfter).toBe(60000);
    });
  });

  describe('Error logging integration', () => {
    it('should log errors with different severities correctly', () => {
      const severityMap: Array<[ErrorSeverity, keyof typeof logger]> = [
        ['INFO', 'info'],
        ['WARNING', 'warn'],
        ['ERROR', 'error'],
        ['CRITICAL', 'error']
      ];

      severityMap.forEach(([severity, logMethod]) => {
        jest.clearAllMocks();
        
        const error = new MastraBaseError(`${severity} message`, {
          code: severity,
          severity
        });
        
        error.log();

        if (severity === 'CRITICAL') {
          expect(logger[logMethod]).toHaveBeenCalledWith(
            `[CRITICAL] ${severity} message`,
            error.toJSON()
          );
        } else {
          expect(logger[logMethod]).toHaveBeenCalledWith(
            `${severity} message`,
            error.toJSON()
          );
        }
      });
    });

    it('should include all metadata in log output', () => {
      const error = new MastraBaseError('Complex error', {
        code: 'COMPLEX',
        correlationId: 'corr-xyz',
        data: { key: 'value' },
        context: { user: 'test' },
        category: 'TOOL_ERROR',
        severity: 'WARNING',
        retryable: true,
        retryAfter: 5000
      });

      error.log();

      expect(logger.warn).toHaveBeenCalledWith(
        'Complex error',
        expect.objectContaining({
          code: 'COMPLEX',
          correlationId: 'corr-xyz',
          data: { key: 'value' },
          context: { user: 'test' },
          category: 'TOOL_ERROR',
          severity: 'WARNING',
          retryable: true,
          retryAfter: 5000
        })
      );
    });
  });

  describe('Error context and correlation', () => {
    it('should maintain correlation ID through error chain', () => {
      const correlationId = 'trace-123-xyz';
      
      const apiError = new ApiError('API failed', 500, { correlationId });
      const agentError = new AgentError('Agent failed due to API', 'TestAgent', { correlationId });
      const toolError = new ToolError('Tool failed due to agent', 'TestTool', { correlationId });

      expect(apiError.correlationId).toBe(correlationId);
      expect(agentError.correlationId).toBe(correlationId);
      expect(toolError.correlationId).toBe(correlationId);
    });

    it('should preserve context through error transformations', () => {
      const originalError = new Error('Database connection failed');
      const context = {
        database: 'postgres',
        host: 'localhost',
        port: 5432,
        operation: 'SELECT',
        timestamp: new Date().toISOString()
      };

      const wrappedError = new MastraBaseError(originalError.message, {
        code: 'DB_ERROR',
        category: 'NETWORK_ERROR',
        context,
        data: { originalStack: originalError.stack }
      });

      expect(wrappedError.context).toEqual(context);
      expect(wrappedError.data?.originalStack).toBeDefined();
    });
  });

  describe('Edge cases and error boundaries', () => {
    it('should handle null/undefined in error data gracefully', () => {
      const error = new MastraBaseError('Error with nulls', {
        code: 'NULL_ERROR',
        data: { value: null, optional: undefined },
        context: null as any
      });

      const json = error.toJSON();
      expect(json.data).toEqual({ value: null, optional: undefined });
      expect(json.context).toBeNull();
    });

    it('should handle circular references in toJSON', () => {
      const circular: any = { prop: null };
      circular.prop = circular;

      const error = new MastraBaseError('Circular error', {
        code: 'CIRCULAR',
        data: circular
      });

      // Should not throw when converting to JSON
      expect(() => error.toJSON()).not.toThrow();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new MastraBaseError(longMessage, {
        code: 'LONG_MESSAGE'
      });

      expect(error.message).toBe(longMessage);
      expect(error.toJSON().message).toBe(longMessage);
    });

    it('should handle special characters in error messages', () => {
      const specialMessage = 'Error with \n newlines \t tabs and "quotes" and \'quotes\'';
      const error = new MastraBaseError(specialMessage, {
        code: 'SPECIAL_CHARS'
      });

      expect(error.message).toBe(specialMessage);
      const json = JSON.stringify(error.toJSON());
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('Custom error name handling', () => {
    it('should allow custom error names', () => {
      const error = new MastraBaseError('Custom named error', {
        name: 'CustomErrorType',
        code: 'CUSTOM'
      });

      expect(error.name).toBe('CustomErrorType');
      expect(error.toJSON().name).toBe('CustomErrorType');
    });

    it('should use class name if no custom name provided', () => {
      const baseError = new MastraBaseError('Base', { code: 'BASE' });
      const apiError = new ApiError('API', 500);
      const agentError = new AgentError('Agent', 'Test');

      expect(baseError.name).toBe('MastraBaseError');
      expect(apiError.name).toBe('ApiError');
      expect(agentError.name).toBe('AgentError');
    });
  });
});