'use client';

import { useState, useCallback } from 'react';
import { useSSEStream } from '@/hooks/base/use-sse-stream';
import { logger } from '@/lib/utils/logger';
import { StreamMessage } from '@/types/shared/chat';

/**
 * React Hook for AI Streaming Chat
 * 
 * Uses EventSource-based SSE streaming for real-time responses from Mastra agents
 * with proper error handling and state management
 */

export interface UseAIStreamOptions {
  agentId?: string;
  sessionId?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseAIStreamReturn {
  messages: StreamMessage[];
  isStreaming: boolean;
  error: Error | null;
  sendMessage: (message: string, context?: Record<string, unknown>) => Promise<void>;
  clearMessages: () => void;
  stopStreaming: () => void;
}

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const {
    agentId = 'tradingAgent',
    sessionId,
    onStreamStart,
    onStreamEnd,
    onError,
  } = options;

  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  // Build SSE endpoint URL
  const buildEndpoint = (message: string, ctx?: Record<string, unknown>) => {
    const params = new URLSearchParams({
      message,
      agentId,
    });
    if (sessionId) params.append('sessionId', sessionId);
    if (ctx) params.append('context', JSON.stringify(ctx));
    return `/api/ai/stream?${params.toString()}`;
  };

  const sse = useSSEStream({
    url: currentUrl,
    autoConnect: false,
    onOpen: () => {
      logger.info('[useAIStream] SSE connection opened');
      onStreamStart?.();
    },
    onEvent: (_type: string, ev: MessageEvent) => {
      let payload: { type: string; content?: string; metadata?: unknown };
      try {
        payload = JSON.parse(ev.data);
      } catch (parseError) {
        logger.warn('[useAIStream] Failed to parse SSE data as JSON', { data: ev.data });
        // Fallback for non-JSON text chunks
        payload = { type: 'chunk', text: ev.data };
      }

      logger.debug('[useAIStream] SSE event received', { type: payload?.type, hasText: !!payload?.text });

      switch (payload?.type) {
        case 'connected':
          // Initial handshake - no action needed
          break;
        
        case 'heartbeat':
          // Keep-alive heartbeat - no action needed
          break;
        
        case 'chunk':
          if (typeof payload.text === 'string' && currentAssistantMessageId) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === currentAssistantMessageId
                  ? { ...msg, content: (msg.content || '') + payload.text }
                  : msg
              )
            );
          }
          break;
        
        case 'end':
          if (currentAssistantMessageId) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === currentAssistantMessageId
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            setCurrentAssistantMessageId(null);
          }
          onStreamEnd?.();
          sse.disconnect();
          break;
        
        case 'error':
          const err = new Error(payload.message || 'Streaming error');
          logger.error('[useAIStream] Server error', { error: err.message });
          if (currentAssistantMessageId) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === currentAssistantMessageId
                  ? { ...msg, content: msg.content || 'エラーが発生しました。', isStreaming: false }
                  : msg
              )
            );
            setCurrentAssistantMessageId(null);
          }
          onError?.(err);
          sse.disconnect();
          break;
        
        default:
          logger.warn('[useAIStream] Unknown SSE event type', { type: payload?.type });
      }
    },
    onError: (ev) => {
      const errObj = new Error('SSE connection error');
      logger.error('[useAIStream] SSE connection failed', { error: errObj });
      
      if (currentAssistantMessageId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === currentAssistantMessageId
              ? { ...msg, content: msg.content || 'エラーが発生しました。', isStreaming: false }
              : msg
          )
        );
        setCurrentAssistantMessageId(null);
      }
      onError?.(errObj);
    },
  });

  const sendMessage = useCallback(async (message: string, context?: Record<string, unknown>) => {
    try {
      // Stop any existing stream
      sse.disconnect();

      // Add user message
      const userMessage: StreamMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Create assistant message placeholder
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: StreamMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentAssistantMessageId(assistantMessageId);

      // Build SSE endpoint and set URL to trigger connection
      const url = buildEndpoint(message, context);
      logger.info('[useAIStream] Starting stream', { url, agentId, sessionId });
      
      // Setting the URL will trigger useSSEStream to reconnect
      setCurrentUrl(url);

    } catch (error) {
      logger.error('[useAIStream] Failed to send message', { error });
      const err = error instanceof Error ? error : new Error('Failed to send message');
      onError?.(err);
    }
  }, [agentId, sessionId, sse, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentAssistantMessageId(null);
    setCurrentUrl('');
    sse.disconnect();
  }, [sse]);

  const stopStreaming = useCallback(() => {
    if (currentAssistantMessageId) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === currentAssistantMessageId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
      setCurrentAssistantMessageId(null);
    }
    sse.disconnect();
  }, [sse, currentAssistantMessageId]);

  return {
    messages,
    isStreaming: sse.isStreaming,
    error: sse.error,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}

/**
 * Format streaming messages for display
 */
export function formatStreamMessage(content: string): string {
  // Handle markdown formatting
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

/**
 * Calculate typing speed for simulated typing effect
 */
export function getTypingDelay(content: string): number {
  // Base delay of 30ms per character, with some randomness
  const baseDelay = 30;
  const randomFactor = 0.5 + Math.random() * 0.5;
  return baseDelay * randomFactor;
}