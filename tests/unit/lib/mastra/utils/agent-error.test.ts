import { 
  AgentError, 
  AgentErrorType, 
  AgentErrorContext,
  isAgentError, 
  isRetryableError 
} from '@/lib/mastra/utils/agent-error';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe('AgentError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an error with basic properties', () => {
      const error = new AgentError(
        AgentErrorType.NETWORK_ERROR,
        'Network failed'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.name).toBe('AgentError');
      expect(error.type).toBe(AgentErrorType.NETWORK_ERROR);
      expect(error.message).toBe('Network failed');
      expect(error.timestamp).toBeDefined();
      expect(error.context.timestamp).toBe(error.timestamp);
    });

    it('should create an error with context', () => {
      const context: AgentErrorContext = {
        agentId: 'agent-123',
        toolName: 'test-tool',
        correlationId: 'corr-456',
        metadata: { key: 'value' },
        retryable: true,
        retryAfter: 5000
      };

      const error = new AgentError(
        AgentErrorType.AGENT_EXECUTION_FAILED,
        'Execution failed',
        context
      );

      expect(error.context).toMatchObject(context);
      expect(error.context.timestamp).toBe(error.timestamp);
    });

    it('should create an error with original error', () => {
      const originalError = new Error('Original error');
      const error = new AgentError(
        AgentErrorType.INTERNAL_ERROR,
        'Wrapped error',
        undefined,
        originalError
      );

      expect(error.originalError).toBe(originalError);
    });

    it('should log error creation', () => {
      new AgentError(AgentErrorType.TIMEOUT_ERROR, 'Timeout occurred');

      expect(logger.error).toHaveBeenCalledWith(
        '[AgentError] Error created',
        expect.objectContaining({
          type: AgentErrorType.TIMEOUT_ERROR,
          message: 'Timeout occurred',
          hasOriginalError: false
        })
      );
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable error types', () => {
      const retryableTypes = [
        AgentErrorType.NETWORK_ERROR,
        AgentErrorType.TIMEOUT_ERROR,
        AgentErrorType.RATE_LIMIT_EXCEEDED
      ];

      retryableTypes.forEach(type => {
        const error = new AgentError(type, 'Test error');
        expect(error.isRetryable()).toBe(true);
      });
    });

    it('should return false for non-retryable error types', () => {
      const nonRetryableTypes = [
        AgentErrorType.CIRCUIT_OPEN,
        AgentErrorType.INVALID_INPUT,
        AgentErrorType.CONFIGURATION_ERROR,
        AgentErrorType.TOOL_NOT_FOUND,
        AgentErrorType.AGENT_NOT_FOUND
      ];

      nonRetryableTypes.forEach(type => {
        const error = new AgentError(type, 'Test error');
        expect(error.isRetryable()).toBe(false);
      });
    });

    it('should respect context override for retryable', () => {
      const error1 = new AgentError(
        AgentErrorType.NETWORK_ERROR,
        'Network error',
        { retryable: false }
      );
      expect(error1.isRetryable()).toBe(false);

      const error2 = new AgentError(
        AgentErrorType.INVALID_INPUT,
        'Invalid input',
        { retryable: true }
      );
      expect(error2.isRetryable()).toBe(true);
    });
  });

  describe('getRetryDelay', () => {
    it('should return context retryAfter if provided', () => {
      const error = new AgentError(
        AgentErrorType.NETWORK_ERROR,
        'Network error',
        { retryAfter: 30000 }
      );
      expect(error.getRetryDelay()).toBe(30000);
    });

    it('should return type-specific delays', () => {
      const cases = [
        { type: AgentErrorType.RATE_LIMIT_EXCEEDED, expected: 60000 },
        { type: AgentErrorType.NETWORK_ERROR, expected: 5000 },
        { type: AgentErrorType.TIMEOUT_ERROR, expected: 10000 },
        { type: AgentErrorType.INTERNAL_ERROR, expected: 5000 } // default
      ];

      cases.forEach(({ type, expected }) => {
        const error = new AgentError(type, 'Test error');
        expect(error.getRetryDelay()).toBe(expected);
      });
    });
  });

  describe('getDetails', () => {
    it('should return comprehensive error details', () => {
      const originalError = new Error('Original');
      const context: AgentErrorContext = {
        agentId: 'agent-123',
        metadata: { key: 'value' }
      };

      const error = new AgentError(
        AgentErrorType.NETWORK_ERROR,
        'Network failed',
        context,
        originalError
      );

      const details = error.getDetails();

      expect(details).toMatchObject({
        type: AgentErrorType.NETWORK_ERROR,
        message: 'Network failed',
        timestamp: error.timestamp,
        context: expect.objectContaining(context),
        retryable: true,
        retryDelay: 5000,
        originalError: {
          name: 'Error',
          message: 'Original'
        }
      });
    });

    it('should handle missing original error', () => {
      const error = new AgentError(
        AgentErrorType.INVALID_INPUT,
        'Invalid input'
      );

      const details = error.getDetails();

      expect(details.originalError).toBeNull();
      expect(details.retryable).toBe(false);
      expect(details.retryDelay).toBeNull();
    });
  });

  describe('toJSON', () => {
    it('should return same as getDetails', () => {
      const error = new AgentError(
        AgentErrorType.TIMEOUT_ERROR,
        'Timeout'
      );

      expect(error.toJSON()).toEqual(error.getDetails());
    });
  });

  describe('getUserMessage', () => {
    it('should return user-friendly messages for each error type', () => {
      const cases = [
        { 
          type: AgentErrorType.NETWORK_ERROR, 
          expected: '通信エラーが発生しました。しばらくしてから再度お試しください。' 
        },
        { 
          type: AgentErrorType.TIMEOUT_ERROR, 
          expected: '処理がタイムアウトしました。しばらくしてから再度お試しください。' 
        },
        { 
          type: AgentErrorType.CIRCUIT_OPEN, 
          expected: 'サービスが一時的に利用できません。しばらくしてから再度お試しください。' 
        },
        { 
          type: AgentErrorType.RATE_LIMIT_EXCEEDED, 
          expected: 'リクエスト数が上限に達しました。しばらくしてから再度お試しください。' 
        },
        { 
          type: AgentErrorType.INVALID_INPUT, 
          expected: '入力データが正しくありません。内容を確認して再度お試しください。' 
        },
        { 
          type: AgentErrorType.AGENT_NOT_FOUND, 
          expected: '指定されたエージェントが見つかりません。' 
        },
        { 
          type: AgentErrorType.TOOL_NOT_FOUND, 
          expected: '指定されたツールが見つかりません。' 
        }
      ];

      cases.forEach(({ type, expected }) => {
        const error = new AgentError(type, 'Test');
        expect(error.getUserMessage()).toBe(expected);
      });
    });

    it('should return default message for unknown types', () => {
      const error = new AgentError(
        AgentErrorType.INTERNAL_ERROR,
        'Internal error'
      );
      expect(error.getUserMessage()).toBe(
        'エラーが発生しました。しばらくしてから再度お試しください。'
      );
    });
  });

  describe('static factory methods', () => {
    it('should create network error', () => {
      const original = new Error('Network issue');
      const error = AgentError.networkError(
        'Connection failed',
        { agentId: 'agent-1' },
        original
      );

      expect(error.type).toBe(AgentErrorType.NETWORK_ERROR);
      expect(error.message).toBe('Connection failed');
      expect(error.context.agentId).toBe('agent-1');
      expect(error.originalError).toBe(original);
    });

    it('should create timeout error', () => {
      const error = AgentError.timeoutError(
        'Request timed out',
        { correlationId: 'corr-1' }
      );

      expect(error.type).toBe(AgentErrorType.TIMEOUT_ERROR);
      expect(error.message).toBe('Request timed out');
      expect(error.context.correlationId).toBe('corr-1');
    });

    it('should create circuit open error', () => {
      const error = AgentError.circuitOpen('Circuit breaker open');

      expect(error.type).toBe(AgentErrorType.CIRCUIT_OPEN);
      expect(error.message).toBe('Circuit breaker open');
    });

    it('should create agent not found error', () => {
      const error = AgentError.agentNotFound('agent-123');

      expect(error.type).toBe(AgentErrorType.AGENT_NOT_FOUND);
      expect(error.message).toBe('Agent not found: agent-123');
      expect(error.context.agentId).toBe('agent-123');
    });

    it('should create agent execution failed error', () => {
      const original = new Error('Execution error');
      const error = AgentError.agentExecutionFailed(
        'agent-123',
        'Failed to execute',
        { toolName: 'tool-1' },
        original
      );

      expect(error.type).toBe(AgentErrorType.AGENT_EXECUTION_FAILED);
      expect(error.message).toBe('Failed to execute');
      expect(error.context.agentId).toBe('agent-123');
      expect(error.context.toolName).toBe('tool-1');
      expect(error.originalError).toBe(original);
    });

    it('should create tool not found error', () => {
      const error = AgentError.toolNotFound('missing-tool');

      expect(error.type).toBe(AgentErrorType.TOOL_NOT_FOUND);
      expect(error.message).toBe('Tool not found: missing-tool');
      expect(error.context.toolName).toBe('missing-tool');
    });

    it('should create tool execution failed error', () => {
      const error = AgentError.toolExecutionFailed(
        'my-tool',
        'Tool crashed'
      );

      expect(error.type).toBe(AgentErrorType.TOOL_EXECUTION_FAILED);
      expect(error.message).toBe('Tool crashed');
      expect(error.context.toolName).toBe('my-tool');
    });

    it('should create invalid input error', () => {
      const error = AgentError.invalidInput('Missing required field');

      expect(error.type).toBe(AgentErrorType.INVALID_INPUT);
      expect(error.message).toBe('Missing required field');
    });

    it('should create rate limit exceeded error', () => {
      const error = AgentError.rateLimitExceeded(30000);

      expect(error.type).toBe(AgentErrorType.RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.context.retryAfter).toBe(30000);
      expect(error.context.retryable).toBe(true);
    });

    it('should create internal error', () => {
      const original = new Error('Internal issue');
      const error = AgentError.internalError(
        'System failure',
        { metadata: { code: 500 } },
        original
      );

      expect(error.type).toBe(AgentErrorType.INTERNAL_ERROR);
      expect(error.message).toBe('System failure');
      expect(error.context.metadata).toEqual({ code: 500 });
      expect(error.originalError).toBe(original);
    });
  });
});

describe('isAgentError', () => {
  it('should return true for AgentError instances', () => {
    const error = new AgentError(
      AgentErrorType.NETWORK_ERROR,
      'Test error'
    );
    expect(isAgentError(error)).toBe(true);
  });

  it('should return false for regular Error instances', () => {
    const error = new Error('Regular error');
    expect(isAgentError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isAgentError(null)).toBe(false);
    expect(isAgentError(undefined)).toBe(false);
    expect(isAgentError('string')).toBe(false);
    expect(isAgentError(123)).toBe(false);
    expect(isAgentError({})).toBe(false);
    expect(isAgentError([])).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('should return true for retryable AgentError', () => {
    const error = new AgentError(
      AgentErrorType.NETWORK_ERROR,
      'Network error'
    );
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for non-retryable AgentError', () => {
    const error = new AgentError(
      AgentErrorType.INVALID_INPUT,
      'Invalid input'
    );
    expect(isRetryableError(error)).toBe(false);
  });

  it('should handle common retryable error codes', () => {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    
    retryableCodes.forEach(code => {
      const error = { code };
      expect(isRetryableError(error)).toBe(true);
    });
  });

  it('should return false for non-retryable error codes', () => {
    const error = { code: 'EACCES' };
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError('string')).toBe(false);
    expect(isRetryableError(123)).toBe(false);
    expect(isRetryableError({})).toBe(false);
  });
});