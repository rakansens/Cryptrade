'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { ChatMessage } from '@/store/chat.store'
import { ProposalCard } from './ProposalCard'
import { EntryProposalCard } from './EntryProposalCard'
import { AnalysisResultCard } from './AnalysisResultCard'
import type { ProposalMessage } from '@/types/proposal'
import type { EntryProposalGroup } from '@/types/trading'
import { cn } from '@/lib/utils'
import { parseAnalysisText, isAnalysisMessage } from '@/lib/utils/parse-analysis'

interface MessageItemProps {
  message: ChatMessage
  copiedMessageId: string | null
  approvedDrawingIds: Map<string, string>
  onCopyMessage: (messageId: string, content: string) => void
  onApproveProposal?: (message: ProposalMessage, proposalId: string) => void
  onRejectProposal?: (message: ProposalMessage, proposalId: string) => void
  onApproveAllProposals?: (message: ProposalMessage) => void
  onRejectAllProposals?: (message: ProposalMessage) => void
  onCancelDrawing?: (drawingId: string) => void
}

export const MessageItem = React.memo(function MessageItem({
  message,
  copiedMessageId,
  approvedDrawingIds,
  onCopyMessage,
  onApproveProposal,
  onRejectProposal,
  onApproveAllProposals,
  onRejectAllProposals,
  onCancelDrawing
}: MessageItemProps) {
  const handleCopy = React.useCallback(() => {
    const content = message.role === 'assistant' 
      ? message.content.replace(/<[^>]*>/g, '') 
      : message.content
    onCopyMessage(message.id, content)
  }, [message, onCopyMessage])

  if (message.role === 'user') {
    return (
      <div className="flex items-start gap-2 justify-end">
        <div className="flex-1 flex justify-end">
          <div className="max-w-[80%] bg-gradient-to-br from-[hsl(var(--color-accent)/0.2)] to-[hsl(var(--color-accent)/0.1)] backdrop-blur-sm border border-[hsl(var(--color-accent)/0.3)] text-[hsl(var(--text-primary))] rounded-lg px-[var(--space-md)] py-[var(--space-sm)] relative group shadow-sm">
            <div className="text-[var(--font-sm)] leading-[var(--leading-normal)] whitespace-pre-wrap select-text cursor-text">
              {message.content}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(var(--color-secondary)/0.8)] hover:bg-[hsl(var(--color-secondary))] rounded interactive"
            >
              {copiedMessageId === message.id ? (
                <Check className="w-3 h-3 text-[hsl(var(--color-accent))]" />
              ) : (
                <Copy className="w-3 h-3 text-[hsl(var(--text-secondary))]" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Assistant message

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] flex items-center justify-center text-[hsl(var(--color-base))] font-bold text-[var(--font-xs)] flex-shrink-0 shadow-md shadow-[hsl(var(--color-accent)/0.2)]">
        AI
      </div>
      <div className="flex-1 max-w-[80%]">
        {message.type === 'proposal' && message.proposalGroup ? (
          <ProposalCard
            proposalGroup={message.proposalGroup}
            onApprove={(proposalId) => onApproveProposal?.(message as ProposalMessage, proposalId)}
            onReject={(proposalId) => onRejectProposal?.(message as ProposalMessage, proposalId)}
            onApproveAll={() => onApproveAllProposals?.(message as ProposalMessage)}
            onRejectAll={() => onRejectAllProposals?.(message as ProposalMessage)}
            onCancel={onCancelDrawing}
            approvedDrawingIds={approvedDrawingIds}
          />
        ) : message.type === 'entry' && message.entryProposalGroup ? (
          <EntryProposalCard
            proposalGroup={message.entryProposalGroup}
            onApprove={(proposalId) => onApproveProposal?.(message as ProposalMessage, proposalId)}
            onReject={(proposalId) => onRejectProposal?.(message as ProposalMessage, proposalId)}
            onApproveAll={() => onApproveAllProposals?.(message as ProposalMessage)}
            onRejectAll={() => onRejectAllProposals?.(message as ProposalMessage)}
          />
        ) : (() => {
          // Check if this is an analysis message
          const plainContent = message.content.replace(/<[^>]*>/g, '')
          const analysisData = isAnalysisMessage(plainContent) ? parseAnalysisText(plainContent) : null
          
          if (analysisData) {
            return <AnalysisResultCard data={analysisData} />
          }
          
          // Check if content contains JSON proposal data
          let displayContent = message.content
          try {
            // Check if the content is a JSON string that contains proposalGroup or entryProposalGroup
            if ((message.content.includes('"type":"proposalGroup"') || message.content.includes('"type":"entryProposalGroup"')) && message.content.includes('"data":')) {
              const parsed = JSON.parse(message.content)
              if (parsed.type === 'proposalGroup' && parsed.data) {
                // Create a proper ProposalMessage object
                const proposalMessage: ProposalMessage = {
                  id: message.id,
                  role: 'assistant',
                  content: 'トレンドライン提案が生成されました',
                  type: 'proposal',
                  proposalGroup: parsed.data,
                  timestamp: message.timestamp
                }
                
                // This is proposal data that should be shown as a card, not text
                return (
                  <ProposalCard
                    proposalGroup={parsed.data}
                    onApprove={onApproveProposal ? (proposalId) => {
                      console.log('[MessageItem] Approving proposal from JSON', { proposalId, proposalMessage });
                      onApproveProposal(proposalMessage, proposalId);
                    } : undefined}
                    onReject={onRejectProposal ? (proposalId) => {
                      console.log('[MessageItem] Rejecting proposal from JSON', { proposalId, proposalMessage });
                      onRejectProposal(proposalMessage, proposalId);
                    } : undefined}
                    onApproveAll={onApproveAllProposals ? () => {
                      console.log('[MessageItem] Approving all proposals from JSON', { proposalMessage });
                      onApproveAllProposals(proposalMessage);
                    } : undefined}
                    onRejectAll={onRejectAllProposals ? () => {
                      console.log('[MessageItem] Rejecting all proposals from JSON', { proposalMessage });
                      onRejectAllProposals(proposalMessage);
                    } : undefined}
                    onCancel={onCancelDrawing}
                    approvedDrawingIds={approvedDrawingIds}
                  />
                )
              } else if (parsed.type === 'entryProposalGroup' && parsed.data) {
                // This is entry proposal data that should be shown as a card
                return (
                  <EntryProposalCard
                    proposalGroup={parsed.data}
                    onApprove={onApproveProposal ? (proposalId) => {
                      const proposalMessage: ProposalMessage = {
                        id: message.id,
                        role: 'assistant',
                        content: 'エントリー提案が生成されました',
                        type: 'proposal',
                        proposalGroup: parsed.data,
                        timestamp: message.timestamp
                      };
                      onApproveProposal(proposalMessage, proposalId);
                    } : undefined}
                    onReject={onRejectProposal ? (proposalId) => {
                      const proposalMessage: ProposalMessage = {
                        id: message.id,
                        role: 'assistant',
                        content: 'エントリー提案が生成されました',
                        type: 'proposal',
                        proposalGroup: parsed.data,
                        timestamp: message.timestamp
                      };
                      onRejectProposal(proposalMessage, proposalId);
                    } : undefined}
                    onApproveAll={onApproveAllProposals ? () => {
                      const proposalMessage: ProposalMessage = {
                        id: message.id,
                        role: 'assistant',
                        content: 'エントリー提案が生成されました',
                        type: 'proposal',
                        proposalGroup: parsed.data,
                        timestamp: message.timestamp
                      };
                      onApproveAllProposals(proposalMessage);
                    } : undefined}
                    onRejectAll={onRejectAllProposals ? () => {
                      const proposalMessage: ProposalMessage = {
                        id: message.id,
                        role: 'assistant',
                        content: 'エントリー提案が生成されました',
                        type: 'proposal',
                        proposalGroup: parsed.data,
                        timestamp: message.timestamp
                      };
                      onRejectAllProposals(proposalMessage);
                    } : undefined}
                  />
                )
              }
            }
          } catch (e) {
            // Not JSON or parsing failed, show as regular content
          }
          
          // Show typing indicator for empty messages or when isTyping is true
          if (message.isTyping || (!message.content || message.content.trim() === '')) {
            return (
              <div className="flex items-center gap-[var(--space-sm)]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[hsl(var(--text-secondary))] text-[var(--font-xs)] animate-pulse">
                  考えています...
                </span>
              </div>
            )
          }
          
          return (
            <div className="premium-glass backdrop-blur-sm text-[hsl(var(--text-primary))] rounded-lg px-[var(--space-md)] py-[var(--space-sm)] shadow-sm relative group">
              <div 
                className="prose prose-sm max-w-none prose-invert text-[var(--font-sm)] leading-[var(--leading-normal)] select-text cursor-text"
                dangerouslySetInnerHTML={{ __html: displayContent }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(var(--color-secondary)/0.8)] hover:bg-[hsl(var(--color-secondary))] rounded interactive"
              >
                {copiedMessageId === message.id ? (
                  <Check className="w-3 h-3 text-[hsl(var(--color-accent))]" />
                ) : (
                  <Copy className="w-3 h-3 text-[hsl(var(--text-secondary))]" />
                )}
              </Button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.copiedMessageId === nextProps.copiedMessageId &&
    prevProps.approvedDrawingIds === nextProps.approvedDrawingIds
  )
})