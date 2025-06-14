import { useCallback } from 'react';
import { useChat } from '@/store/chat.store';
import { useIsClient } from '@/hooks/use-is-client';
import { logger } from '@/lib/utils/logger';
import { safeParseOrWarn, CommonSchemas } from '@/lib/utils/validation';
import { streamToLines } from '@/lib/utils/stream-utils';

// Middleware function type for future Mastra integration
type AIMiddleware = (fn: () => Promise<void>) => Promise<void>;

// Middleware for store synchronization
const storeSync: AIMiddleware = async (fn) => {
  await fn();
};

// Middleware for retry logic (future expansion)
const retry: AIMiddleware = async (fn) => {
  try {
    await fn();
  } catch (error) {
    logger.warn('[useAIChat] Request failed, could implement retry logic here', error);
    throw error;
  }
};

// Middleware for tracing/logging (future expansion)
const trace: AIMiddleware = async (fn) => {
  const startTime = Date.now();
  logger.info('[useAIChat] Starting AI request');
  try {
    await fn();
    logger.info('[useAIChat] AI request completed', { 
      duration: Date.now() - startTime 
    });
  } catch (error) {
    logger.error('[useAIChat] AI request failed', { 
      duration: Date.now() - startTime 
    }, error);
    throw error;
  }
};

// Compose middleware functions - returns a function that applies all middleware
const compose = (...middlewares: AIMiddleware[]) => {
  return async (fn: () => Promise<void>) => {
    let composedFn = fn;
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const currentFn = composedFn;
      composedFn = () => middlewares[i](currentFn);
    }
    return composedFn();
  };
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useAIChat() {
  const isClient = useIsClient();
  const { 
    currentSessionId,
    messages,
    addMessage, 
    updateLastMessage, 
    setLoading, 
    setStreaming,
    setError,
    createSession 
  } = useChat();

  const send = useCallback(async (text: string) => {
    if (!isClient || !text.trim()) return;

    // Validate input
    const validatedInput = safeParseOrWarn(CommonSchemas.ChatMessage, text.trim(), 'useAIChat');
    if (!validatedInput) {
      setError('Message must be between 1-500 characters');
      return;
    }

    // Ensure we have a session
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    try {
      // Clear previous errors
      setError(null);

      // Middleware composition - ready for Mastra integration
      const runMiddlewares = compose(retry, trace, storeSync);
      
      await runMiddlewares(async () => {
        // 1. Optimistic updates - add user message immediately
        addMessage(sessionId!, {
          role: 'user',
          content: validatedInput,
        });

        // Add empty assistant message with typing indicator
        addMessage(sessionId!, {
          role: 'assistant',
          content: '',
          isTyping: true,
        });

        setLoading(true);
        setStreaming(true);

        // 2. Prepare request body (A2A-compatible structure)
        const requestBody = {
          message: validatedInput,     // A2A形式: 単一メッセージ
          sessionId: sessionId,        // A2A形式: 直接指定
          // 旧形式も送信（互換性のため）
          messages: [
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user' as const, content: validatedInput },
          ],
        };

        // 3. Call AI API
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // 4. Handle response (A2A returns JSON, not streaming)
        let accumulatedContent = '';
        
        // Check if response is JSON (A2A) or streaming
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          // A2A response
          const data = await response.json();
          
          // Check if this is a proposal response
          if (data.proposalGroup) {
            // Update the last assistant message with proposal instead of adding new
            const proposalMessage = {
              content: data.message || 'トレンドライン候補を生成しました',
              type: 'proposal' as const,
              proposalGroup: data.proposalGroup,
              isTyping: false,
            };
            
            updateLastMessage(sessionId!, proposalMessage);
            
            logger.info('[useAIChat] Proposal message updated', {
              proposalId: data.proposalGroup.id,
              proposalCount: data.proposalGroup.proposals?.length || 0,
              messageType: 'proposal',
              hasProposalGroup: true,
            });
          } else if (data.entryProposalGroup) {
            // Handle entry proposal response
            const entryProposalMessage = {
              content: data.message || 'エントリー提案を生成しました',
              type: 'entry' as const,
              entryProposalGroup: data.entryProposalGroup,
              isTyping: false,
            };
            
            updateLastMessage(sessionId!, entryProposalMessage);
            
            logger.info('[useAIChat] Entry proposal message updated', {
              proposalId: data.entryProposalGroup.id,
              proposalCount: data.entryProposalGroup.proposals?.length || 0,
              messageType: 'entry',
              hasEntryProposalGroup: true,
            });
          } else {
            accumulatedContent = data.message || data.analysis?.intent || 'Response received';
            updateLastMessage(sessionId!, {
              content: accumulatedContent,
              isTyping: false,
            });
          }
          
          // Log A2A metadata
          logger.info('[useAIChat] A2A response received', {
            selectedAgent: data.selectedAgent,
            confidence: data.analysis?.confidence,
            executionTime: data.execution?.executionTime,
            hasProposal: !!data.proposalGroup,
            hasEntryProposal: !!data.entryProposalGroup,
          });
        } else {
          // Legacy streaming response
          for await (const line of streamToLines(response)) {
            let chunk: { type: string; content?: string; metadata?: unknown };
            try {
              chunk = JSON.parse(line);
            } catch {
              logger.warn('[useAIChat] Failed to parse streaming JSON', { line });
              continue;
            }

            if (chunk.error) {
              throw new Error(chunk.error);
            }

            if (chunk.content) {
              accumulatedContent += chunk.content;
              updateLastMessage(sessionId!, {
                content: accumulatedContent,
                isTyping: false,
              });
            }

            if (chunk.done) {
              break;
            }
          }
        }

        logger.info('[useAIChat] Message sent successfully', { 
          sessionId, 
          messageLength: validatedInput.length,
          responseLength: accumulatedContent.length 
        });
      });

    } catch (error) {
      logger.error('[useAIChat] Failed to send message', { sessionId }, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to send message: ${errorMessage}`);
      
      // Update the last assistant message with error
      updateLastMessage(sessionId!, {
        content: `Sorry, I encountered an error: ${errorMessage}`,
        isTyping: false,
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [
    isClient,
    currentSessionId,
    messages,
    addMessage,
    updateLastMessage,
    setLoading,
    setStreaming,
    setError,
    createSession,
  ]);

  return {
    send,
    isReady: isClient, // sessionIdは自動作成されるので、クライアントサイドであればOK
  };
}