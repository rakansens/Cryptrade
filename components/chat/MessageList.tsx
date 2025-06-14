'use client'

import React, { useRef, useEffect, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Activity } from 'lucide-react'
import { ChatMessage } from '@/store/chat.store'
import { MessageItem } from './MessageItem'
import { AnalysisProgress } from './AnalysisProgress'
import type { ProposalMessage } from '@/types/proposal'

// Empty map constant to prevent object recreation
const EMPTY_MAP = new Map<string, string>();

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  copiedMessageId: string | null
  analysisInProgress: {
    messageId: string
    symbol: string
    interval: string
    analysisType: 'trendline' | 'support-resistance' | 'fibonacci' | 'pattern' | 'all'
  } | null
  approvedDrawingIds: Map<string, Map<string, string>>
  onCopyMessage: (messageId: string, content: string) => void
  onApproveProposal: (message: ProposalMessage, proposalId: string) => void
  onRejectProposal: (message: ProposalMessage, proposalId: string) => void
  onApproveAllProposals: (message: ProposalMessage) => void
  onRejectAllProposals: (message: ProposalMessage) => void
  onCancelDrawing: (drawingId: string) => void
  onAnalysisComplete: (data: unknown) => void
}

export function MessageList({
  messages,
  isLoading,
  isStreaming,
  error,
  copiedMessageId,
  analysisInProgress,
  approvedDrawingIds,
  onCopyMessage,
  onApproveProposal,
  onRejectProposal,
  onApproveAllProposals,
  onRejectAllProposals,
  onCancelDrawing,
  onAnalysisComplete
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // Auto-scroll to bottom when messages change, or during streaming/analysis
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isStreaming, analysisInProgress])

  // Additional scroll trigger for progress updates
  useEffect(() => {
    if (analysisInProgress && messagesEndRef.current) {
      // Scroll immediately and then every 500ms while analysis is in progress
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      
      scrollTimeoutRef.current = setInterval(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 500)
      
      return () => {
        if (scrollTimeoutRef.current) {
          clearInterval(scrollTimeoutRef.current)
        }
      }
    }
  }, [analysisInProgress])

  if (messages.length === 0) {
    return (
      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-4">
          <div className="text-center py-8">
            <div className="mb-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] flex items-center justify-center mb-3 shadow-lg shadow-[hsl(var(--color-accent)/0.3)]">
                <span className="text-[var(--font-lg)] font-bold text-[hsl(var(--color-base))]">AI</span>
              </div>
            </div>
            <h3 className="text-[var(--font-base)] font-semibold mb-[var(--space-sm)] text-[hsl(var(--text-primary))]">AIアシスタント</h3>
            <p className="text-[hsl(var(--text-secondary))] text-[var(--font-sm)] px-[var(--space-lg)]">
              暗号通貨の市場分析、価格確認、取引アドバイスなど、何でもお気軽にご質問ください！
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 px-4">
              <div className="p-[var(--space-sm)] rounded-lg premium-glass-subtle border border-[hsl(var(--border))] text-[var(--font-xs)] text-[hsl(var(--text-secondary))] interactive">
                💰 "BTCの分析をして"
              </div>
              <div className="p-[var(--space-sm)] rounded-lg premium-glass-subtle border border-[hsl(var(--border))] text-[var(--font-xs)] text-[hsl(var(--text-secondary))] interactive">
                📊 "ETHの価格は？"
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="px-3 py-4">
          <div className="space-y-4 pb-4">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              copiedMessageId={copiedMessageId}
              approvedDrawingIds={approvedDrawingIds.get(message.id) || EMPTY_MAP}
              onCopyMessage={onCopyMessage}
              onApproveProposal={onApproveProposal}
              onRejectProposal={onRejectProposal}
              onApproveAllProposals={onApproveAllProposals}
              onRejectAllProposals={onRejectAllProposals}
              onCancelDrawing={onCancelDrawing}
            />
          ))}
          
          {/* Analysis in Progress */}
          {analysisInProgress && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] flex items-center justify-center text-[hsl(var(--color-base))] font-bold text-[var(--font-xs)] flex-shrink-0 shadow-md shadow-[hsl(var(--color-accent)/0.2)]">
                AI
              </div>
              <div className="flex-1">
                <AnalysisProgress
                  symbol={analysisInProgress.symbol}
                  interval={analysisInProgress.interval}
                  analysisType={analysisInProgress.analysisType}
                  onComplete={onAnalysisComplete}
                  autoStart={true}
                  className="max-w-lg"
                />
              </div>
            </div>
          )}
          
          {/* Typing Indicator - Removed in favor of message-based indicator */}
          
          {/* Error Message */}
          {error && (
            <div className="bg-[hsl(var(--color-loss)/0.1)] border border-[hsl(var(--color-loss)/0.3)] rounded-lg p-[var(--space-md)]">
              <p className="text-[hsl(var(--color-loss))] text-[var(--font-sm)]">
                {error}
              </p>
            </div>
          )}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}