// Setup test environment before any imports
import { mockTestEnv } from '@/config/testing/setupEnvMock';

const restoreEnv = mockTestEnv();

import { NextRequest } from 'next/server';
import { 
  validateChatRequest, 
  registerAgentsSafely,
  type ValidatedChatRequest 
} from '../request-validator';
import { ValidationError } from '../error-handler';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

jest.mock('@/lib/mastra/network/agent-registry', () => ({
  registerAllAgents: jest.fn(),
}));

describe('request-validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).OPENAI_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    restoreEnv();
  });

  describe('validateChatRequest', () => {
    it('should validate request with single message', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          sessionId: 'session-123'
        })
      });

      const result = await validateChatRequest(request);

      expect(result).toEqual({
        userMessage: 'Test message',
        sessionId: 'session-123',
        runtimeContext: undefined
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[Request Validator] Chat request validated',
        {
          sessionId: 'session-123',
          messageLength: 12,
          hasRuntimeContext: false,
        }
      );
    });

    it('should validate request with runtime context', async () => {
      const runtimeContext = {
        userTier: 'premium' as const,
        userLevel: 'expert' as const,
        marketStatus: 'open' as const,
        queryComplexity: 'complex' as const,
        isProposalMode: true,
      };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze market',
          runtimeContext
        })
      });

      const result = await validateChatRequest(request);

      expect(result).toEqual({
        userMessage: 'Analyze market',
        sessionId: undefined,
        runtimeContext
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[Request Validator] Chat request validated',
        {
          sessionId: undefined,
          messageLength: 14,
          hasRuntimeContext: true,
        }
      );
    });

    it('should handle legacy messages format', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'Response' },
            { role: 'user', content: 'Latest message' }
          ],
          sessionId: 'legacy-session'
        })
      });

      const result = await validateChatRequest(request);

      expect(result).toEqual({
        userMessage: 'Latest message',
        sessionId: 'legacy-session',
        runtimeContext: undefined
      });
    });

    it('should prioritize single message over messages array', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Priority message',
          messages: [
            { role: 'user', content: 'Should be ignored' }
          ]
        })
      });

      const result = await validateChatRequest(request);

      expect(result.userMessage).toBe('Priority message');
    });

    it('should throw ValidationError for invalid request format', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invalidField: 'value',
          runtimeContext: {
            userTier: 'invalid' // Invalid enum value to trigger validation error
          }
        })
      });

      await expect(validateChatRequest(request)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when no user message found', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'System only' },
            { role: 'assistant', content: 'Assistant only' }
          ]
        })
      });

      await expect(validateChatRequest(request)).rejects.toThrow('No user message found');
    });

    it('should throw error when OpenAI API key not configured', async () => {
      (env as any).OPENAI_API_KEY = '';

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test'
        })
      });

      await expect(validateChatRequest(request)).rejects.toThrow('OpenAI API key not configured');
    });

    it('should validate runtime context enums', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test',
          runtimeContext: {
            userTier: 'invalid' // Invalid enum value
          }
        })
      });

      await expect(validateChatRequest(request)).rejects.toThrow(ValidationError);
    });

    it('should handle partial runtime context', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test',
          runtimeContext: {
            userTier: 'free',
            isProposalMode: false
            // Other fields are optional
          }
        })
      });

      const result = await validateChatRequest(request);

      expect(result.runtimeContext).toEqual({
        userTier: 'free',
        isProposalMode: false
      });
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      await expect(validateChatRequest(request)).rejects.toThrow();
    });
  });

  describe('registerAgentsSafely', () => {
    it('should register agents successfully', () => {
      const { registerAllAgents } = require('@/lib/mastra/network/agent-registry');
      registerAllAgents.mockImplementation(() => {});

      registerAgentsSafely();

      expect(registerAllAgents).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[Request Validator] Agents registered successfully'
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', () => {
      const { registerAllAgents } = require('@/lib/mastra/network/agent-registry');
      registerAllAgents.mockImplementation(() => {
        throw new Error('Registration failed');
      });

      registerAgentsSafely();

      expect(registerAllAgents).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[Request Validator] Agent registration failed',
        { error: 'Error: Registration failed' }
      );
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});