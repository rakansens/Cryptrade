import { NextResponse } from 'next/server';
import { 
  ValidationError, 
  createErrorResponse, 
  errorHandler,
  createOrchestratorErrorResponse 
} from '../error-handler';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

jest.mock('@/lib/api/middleware', () => ({
  applyCorsHeaders: jest.fn((response) => response),
  applySecurityHeaders: jest.fn((response) => response),
}));

describe('error-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ValidationError', () => {
    it('should create validation error with message only', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.details).toBeUndefined();
    });

    it('should create validation error with details', () => {
      const details = { field: 'email', value: 'invalid-email' };
      const error = new ValidationError('Invalid email format', details);
      
      expect(error.message).toBe('Invalid email format');
      expect(error.details).toEqual(details);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response from string', async () => {
      const response = createErrorResponse('Test error', 400);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Test error',
        message: 'Test error',
        timestamp: expect.any(String),
      });
      expect(logger.warn).toHaveBeenCalledWith('[API Warning]', {
        error: 'Test error',
        status: 400,
        details: undefined,
      });
    });

    it('should create error response from Error object', async () => {
      const error = new Error('System error');
      const response = createErrorResponse(error, 500);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'System error',
        message: 'リクエストの処理中にエラーが発生しました。',
        timestamp: expect.any(String),
      });
      expect(logger.error).toHaveBeenCalledWith('[API Error]', {
        error: 'System error',
        status: 500,
        details: undefined,
      });
    });

    it('should include details in response', async () => {
      const details = { code: 'INVALID_FORMAT', field: 'username' };
      const response = createErrorResponse('Validation failed', 400, details);
      const data = await response.json();

      expect(data.details).toEqual(details);
    });

    it('should use default status 500', async () => {
      const response = createErrorResponse('Error');
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('リクエストの処理中にエラーが発生しました。');
    });

    it('should log errors for 5xx status codes', () => {
      createErrorResponse('Server error', 503);
      
      expect(logger.error).toHaveBeenCalledWith('[API Error]', {
        error: 'Server error',
        status: 503,
        details: undefined,
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should log warnings for 4xx status codes', () => {
      createErrorResponse('Client error', 404);
      
      expect(logger.warn).toHaveBeenCalledWith('[API Warning]', {
        error: 'Client error',
        status: 404,
        details: undefined,
      });
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('errorHandler', () => {
    it('should delegate to createErrorResponse', async () => {
      const response = errorHandler('Test error', 400);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Test error');
    });

    it('should handle Error objects', async () => {
      const error = new Error('Handler error');
      const response = errorHandler(error, 500);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Handler error');
    });

    it('should use default status when not provided', async () => {
      const response = errorHandler('Default error');
      
      expect(response.status).toBe(500);
    });
  });

  describe('createOrchestratorErrorResponse', () => {
    it('should create orchestrator error response from Error', () => {
      const error = new Error('Orchestrator failed');
      const response = createOrchestratorErrorResponse(error, 'session-123');

      expect(response).toEqual({
        message: 'システムで一時的な問題が発生しました。しばらく時間をおいて再度お試しください。',
        selectedAgent: 'error',
        analysis: {
          intent: 'error',
          confidence: 0,
          reasoning: 'System error occurred',
          analysisDepth: 'basic',
        },
        execution: {
          success: false,
          executionTime: 0,
          memoryContext: 'none',
        },
        data: null,
        metadata: {
          sessionId: 'session-123',
          timestamp: expect.any(String),
          a2aEnabled: true,
          error: 'Error: Orchestrator failed',
        }
      });
    });

    it('should create orchestrator error response from string', () => {
      const response = createOrchestratorErrorResponse('Network timeout');

      expect(response).toEqual({
        message: 'システムで一時的な問題が発生しました。しばらく時間をおいて再度お試しください。',
        selectedAgent: 'error',
        analysis: {
          intent: 'error',
          confidence: 0,
          reasoning: 'System error occurred',
          analysisDepth: 'basic',
        },
        execution: {
          success: false,
          executionTime: 0,
          memoryContext: 'none',
        },
        data: null,
        metadata: {
          sessionId: 'error-session',
          timestamp: expect.any(String),
          a2aEnabled: true,
          error: 'Network timeout',
        }
      });
    });

    it('should use default session ID when not provided', () => {
      const response = createOrchestratorErrorResponse('Error');

      expect(response.metadata.sessionId).toBe('error-session');
    });

    it('should preserve error details in metadata', () => {
      const error = new ValidationError('Invalid request', { field: 'message' });
      const response = createOrchestratorErrorResponse(error);

      expect(response.metadata.error).toBe('ValidationError: Invalid request');
    });
  });
});