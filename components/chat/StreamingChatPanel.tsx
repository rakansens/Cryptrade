'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAIStream, formatStreamMessage } from '@/hooks/use-ai-stream';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Loader2, Send, StopCircle, Trash2 } from 'lucide-react';

/**
 * Streaming Chat Panel Component
 * 
 * Real-time chat interface with streaming AI responses
 * Demonstrates the use of useAIStream hook
 */

interface StreamingChatPanelProps {
  className?: string;
  agentId?: string;
  sessionId?: string;
  placeholder?: string;
  welcomeMessage?: string;
}

export default function StreamingChatPanel({
  className,
  agentId = 'tradingAgent',
  sessionId,
  placeholder = 'メッセージを入力してください...',
  welcomeMessage = 'こんにちは！暗号通貨の取引についてお聞きください。',
}: StreamingChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
  } = useAIStream({
    agentId,
    sessionId,
    onStreamStart: () => {
      // Scroll to bottom when streaming starts
      setTimeout(scrollToBottom, 100);
    },
    onStreamEnd: () => {
      // Focus input after streaming ends
      inputRef.current?.focus();
    },
  });

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show welcome message if no messages
  const showWelcome = messages.length === 0;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">AI Trading Assistant (Streaming)</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearMessages}
          disabled={messages.length === 0 || isStreaming}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {showWelcome && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">{welcomeMessage}</p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {(() => {
                  // Check if content contains JSON proposal data
                  try {
                    if (message.content.includes('"type":"proposalGroup"') && message.content.includes('"data":')) {
                      const parsed = JSON.parse(message.content);
                      if (parsed.type === 'proposalGroup' && parsed.data) {
                        // For now, show a simple message instead of the JSON
                        return (
                          <div className="text-sm">
                            トレンドライン提案が生成されました。詳細はメインチャットパネルでご確認ください。
                          </div>
                        );
                      }
                    }
                  } catch (e) {
                    // Not JSON or parsing failed, show as regular content
                  }
                  
                  return (
                    <>
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: formatStreamMessage(message.content),
                        }}
                      />
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="text-center text-destructive text-sm mt-4">
            エラー: {error.message}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isStreaming}
            className="flex-1"
          />
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stopStreaming}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * Message Loading Indicator Component
 */
export function MessageLoadingIndicator() {
  return (
    <div className="flex items-center space-x-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">考えています...</span>
    </div>
  );
}

/**
 * Typing Indicator Component
 */
export function TypingIndicator() {
  return (
    <div className="flex space-x-1">
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}