import {
  FallbackHandler,
  FallbackConfig,
  FallbackContext,
  ConversationMessage,
  fallbackHandler
} from '@/lib/mastra/utils/fallback-handler';
import { logger } from '@/lib/utils/logger';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Mock dependencies
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('ai', () => ({
  generateText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((modelId: string) => ({ modelId }))
}));

describe('FallbackHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    describe('static responses', () => {
      it('should return static response when useStaticResponse is true', async () => {
        const config: FallbackConfig = {
          agentType: 'price_inquiry',
          query: 'BTCの価格は？',
          useStaticResponse: true
        };

        const result = await FallbackHandler.handle(config);

        expect(result.response).toBe('ただいま価格データの取得ができません。しばらくしてから再度お試しください。');
        expect(result.metadata).toEqual({
          model: 'static-fallback',
          fallbackType: 'static',
          originalAgent: 'price_inquiry',
          timestamp: expect.any(Number)
        });
        expect(generateText).not.toHaveBeenCalled();
      });

      it('should return default static response for unknown agent type', async () => {
        const config: FallbackConfig = {
          agentType: 'unknown_agent',
          query: 'test query',
          useStaticResponse: true
        };

        const result = await FallbackHandler.handle(config);

        expect(result.response).toBe('リクエストの処理中にエラーが発生しました。しばらくしてから再度お試しください。');
        expect(result.metadata.originalAgent).toBe('unknown_agent');
      });

      it('should include error in metadata when provided', async () => {
        const error = new Error('Test error');
        const config: FallbackConfig = {
          agentType: 'ui_control',
          query: 'チャートを表示',
          useStaticResponse: true,
          error
        };

        const result = await FallbackHandler.handle(config);

        expect(result.metadata.error).toBe('Error: Test error');
      });

      it('should handle all static agent types', async () => {
        const agentTypes = ['price_inquiry', 'ui_control', 'trading_analysis', 'conversational'];
        
        for (const agentType of agentTypes) {
          const config: FallbackConfig = {
            agentType,
            query: 'test',
            useStaticResponse: true
          };

          const result = await FallbackHandler.handle(config);
          
          expect(result.response).toBeTruthy();
          expect(result.metadata.fallbackType).toBe('static');
        }
      });
    });

    describe('AI-generated responses', () => {
      it('should generate AI response when useStaticResponse is false', async () => {
        const mockResponse = { text: 'AI generated response' };
        (generateText as jest.Mock).mockResolvedValue(mockResponse);

        const config: FallbackConfig = {
          agentType: 'price_inquiry',
          query: 'BTCの価格は？',
          useStaticResponse: false
        };

        const result = await FallbackHandler.handle(config);

        expect(generateText).toHaveBeenCalledWith({
          model: { modelId: 'gpt-3.5-turbo' },
          prompt: expect.stringContaining('BTCの価格は？'),
          maxTokens: 300,
          temperature: 0.7
        });

        expect(result).toEqual({
          response: 'AI generated response',
          metadata: {
            model: 'gpt-3.5-turbo',
            fallbackType: 'ai',
            originalAgent: 'price_inquiry',
            timestamp: expect.any(Number)
          }
        });
      });

      it('should include conversation history in context', async () => {
        const conversationHistory: ConversationMessage[] = [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'user', content: 'What is BTC price?' }
        ];

        const context: FallbackContext = {
          conversationHistory
        };

        (generateText as jest.Mock).mockResolvedValue({ text: 'Response with context' });

        const config: FallbackConfig = {
          agentType: 'conversational',
          query: 'test query',
          context
        };

        await FallbackHandler.handle(config);

        expect(generateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Recent conversation:')
          })
        );
      });

      it('should include agent state in context', async () => {
        const context: FallbackContext = {
          agentState: { key: 'value', data: 123 }
        };

        (generateText as jest.Mock).mockResolvedValue({ text: 'Response' });

        const config: FallbackConfig = {
          agentType: 'trading_analysis',
          query: 'analyze market',
          context
        };

        await FallbackHandler.handle(config);

        expect(generateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Agent state:')
          })
        );
      });

      it('should include metadata in context', async () => {
        const context: FallbackContext = {
          metadata: { source: 'test', timestamp: Date.now() }
        };

        (generateText as jest.Mock).mockResolvedValue({ text: 'Response' });

        const config: FallbackConfig = {
          agentType: 'ui_control',
          query: 'show chart',
          context
        };

        await FallbackHandler.handle(config);

        expect(generateText).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining('Metadata:')
          })
        );
      });

      it('should fall back to static response if AI generation fails', async () => {
        (generateText as jest.Mock).mockRejectedValue(new Error('AI generation failed'));

        const config: FallbackConfig = {
          agentType: 'price_inquiry',
          query: 'test query'
        };

        const result = await FallbackHandler.handle(config);

        expect(logger.error).toHaveBeenCalledWith(
          '[FallbackHandler] AI fallback generation failed',
          expect.objectContaining({
            agentType: 'price_inquiry',
            error: 'Error: AI generation failed'
          })
        );

        expect(result.metadata.fallbackType).toBe('static');
        expect(result.response).toBe('ただいま価格データの取得ができません。しばらくしてから再度お試しください。');
      });

      it('should use appropriate prompts for each agent type', async () => {
        const agentTypes = ['price_inquiry', 'ui_control', 'trading_analysis', 'conversational'];
        
        (generateText as jest.Mock).mockResolvedValue({ text: 'AI response' });

        for (const agentType of agentTypes) {
          jest.clearAllMocks();
          
          const config: FallbackConfig = {
            agentType,
            query: 'test query'
          };

          await FallbackHandler.handle(config);

          const call = (generateText as jest.Mock).mock.calls[0][0];
          expect(call.prompt).toContain('test query');
          
          // Check for agent-specific content
          if (agentType === 'price_inquiry') {
            expect(call.prompt).toContain('暗号通貨価格専門');
          } else if (agentType === 'ui_control') {
            expect(call.prompt).toContain('チャートUI操作');
          } else if (agentType === 'trading_analysis') {
            expect(call.prompt).toContain('暗号通貨取引分析');
          } else if (agentType === 'conversational') {
            expect(call.prompt).toContain('Cryptradeプラットフォーム');
          }
        }
      });
    });

    describe('logging', () => {
      it('should log fallback handling', async () => {
        const config: FallbackConfig = {
          agentType: 'price_inquiry',
          query: 'test query',
          error: 'Some error',
          useStaticResponse: true
        };

        await FallbackHandler.handle(config);

        expect(logger.warn).toHaveBeenCalledWith(
          '[FallbackHandler] Handling fallback',
          expect.objectContaining({
            agentType: 'price_inquiry',
            queryLength: 10,
            hasContext: false,
            error: 'Some error',
            useStaticResponse: true
          })
        );
      });
    });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      const networkErrors = [
        'Network error occurred',
        'fetch failed',
        'ERR_NETWORK'
      ];

      networkErrors.forEach(error => {
        const result = FallbackHandler.classifyError(error);
        expect(result.type).toBe('network');
        expect(result.userMessage).toBe('ネットワーク接続に問題があります。インターネット接続をご確認ください。');
      });
    });

    it('should classify timeout errors', () => {
      const timeoutErrors = [
        'Request timeout',
        'Operation timed out',
        'ETIMEDOUT'
      ];

      timeoutErrors.forEach(error => {
        const result = FallbackHandler.classifyError(error);
        expect(result.type).toBe('timeout');
        expect(result.userMessage).toBe('処理がタイムアウトしました。しばらくしてから再度お試しください。');
      });
    });

    it('should classify auth errors', () => {
      const authErrors = [
        'Authentication failed',
        'Unauthorized',
        'Invalid auth token'
      ];

      authErrors.forEach(error => {
        const result = FallbackHandler.classifyError(error);
        expect(result.type).toBe('auth');
        expect(result.userMessage).toBe('認証エラーが発生しました。ログイン状態をご確認ください。');
      });
    });

    it('should classify unknown errors', () => {
      const unknownErrors = [
        'Something went wrong',
        'Internal server error',
        'Unknown error'
      ];

      unknownErrors.forEach(error => {
        const result = FallbackHandler.classifyError(error);
        expect(result.type).toBe('unknown');
        expect(result.userMessage).toBe('予期しないエラーが発生しました。しばらくしてから再度お試しください。');
      });
    });

    it('should handle Error objects', () => {
      const error = new Error('Network connection failed');
      const result = FallbackHandler.classifyError(error);
      
      expect(result.type).toBe('network');
    });

    it('should be case insensitive', () => {
      const result1 = FallbackHandler.classifyError('NETWORK ERROR');
      const result2 = FallbackHandler.classifyError('network error');
      
      expect(result1.type).toBe('network');
      expect(result2.type).toBe('network');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const config: FallbackConfig = {
        agentType: 'conversational',
        query: '',
        useStaticResponse: true
      };

      const result = await FallbackHandler.handle(config);
      
      expect(result.response).toBeTruthy();
      expect(result.metadata.fallbackType).toBe('static');
    });

    it('should handle very long conversation history', async () => {
      const longHistory: ConversationMessage[] = Array(10).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      const context: FallbackContext = {
        conversationHistory: longHistory
      };

      (generateText as jest.Mock).mockResolvedValue({ text: 'Response' });

      const config: FallbackConfig = {
        agentType: 'conversational',
        query: 'test',
        context
      };

      await FallbackHandler.handle(config);

      // Should only include last 3 messages
      const call = (generateText as jest.Mock).mock.calls[0][0];
      expect(call.prompt).toContain('Message 7');
      expect(call.prompt).toContain('Message 8');
      expect(call.prompt).toContain('Message 9');
      expect(call.prompt).not.toContain('Message 6');
    });

    it('should truncate long context data', async () => {
      const longData = 'x'.repeat(500);
      const context: FallbackContext = {
        agentState: { data: longData }
      };

      (generateText as jest.Mock).mockResolvedValue({ text: 'Response' });

      const config: FallbackConfig = {
        agentType: 'conversational',
        query: 'test',
        context
      };

      await FallbackHandler.handle(config);

      const call = (generateText as jest.Mock).mock.calls[0][0];
      expect(call.prompt).toContain('...');
      expect(call.prompt.length).toBeLessThan(1000);
    });

    it('should handle undefined in conversation history', async () => {
      const context: FallbackContext = {
        conversationHistory: [
          { role: 'user', content: 'test' },
          undefined as any,
          { role: 'assistant', content: 'response' }
        ]
      };

      (generateText as jest.Mock).mockResolvedValue({ text: 'Response' });

      const config: FallbackConfig = {
        agentType: 'conversational',
        query: 'test',
        context
      };

      // Should not throw
      await expect(FallbackHandler.handle(config)).resolves.toBeDefined();
    });
  });

  describe('singleton export', () => {
    it('should export singleton instance', () => {
      expect(fallbackHandler).toBeDefined();
      expect(fallbackHandler).toBeInstanceOf(FallbackHandler);
    });
  });
});