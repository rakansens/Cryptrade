'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import type { DrawingProposal, DrawingProposalGroup, ProposalGroup } from '@/types/proposals'
import { StyleEditor } from './StyleEditor'

interface ProposalCardProps {
  proposalGroup: DrawingProposalGroup
  onApprove: (proposalId: string) => void
  onReject: (proposalId: string) => void
  onApproveAll: () => void
  onRejectAll: () => void
  onCancel?: (drawingId: string) => void
  approvedDrawingIds?: Map<string, string> // proposalId -> drawingId
}

// Memoize the component to prevent unnecessary re-renders
export const ProposalCard = React.memo(function ProposalCard({
  proposalGroup,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  onCancel,
  approvedDrawingIds = new Map(),
}: ProposalCardProps) {
  // Track local approval states
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  
  const handleApprove = (proposalId: string) => {
    if (!onApprove) {
      console.warn('[ProposalCard] onApprove is not defined');
      return;
    }
    setApprovedIds(prev => new Set(prev).add(proposalId))
    onApprove(proposalId)
  }
  
  const handleReject = (proposalId: string) => {
    if (!onReject) {
      console.warn('[ProposalCard] onReject is not defined');
      return;
    }
    setRejectedIds(prev => new Set(prev).add(proposalId))
    onReject(proposalId)
  }
  
  const handleApproveAll = () => {
    if (!onApproveAll) {
      console.warn('[ProposalCard] onApproveAll is not defined');
      return;
    }
    const allIds = new Set(proposalGroup.proposals.map(p => p.id))
    setApprovedIds(allIds)
    onApproveAll()
  }
  
  const handleRejectAll = () => {
    if (!onRejectAll) {
      console.warn('[ProposalCard] onRejectAll is not defined');
      return;
    }
    const allIds = new Set(proposalGroup.proposals.map(p => p.id))
    setRejectedIds(allIds)
    onRejectAll()
  }
  
  const handleCancel = (proposalId: string, drawingId: string) => {
    // Remove from approved status
    setApprovedIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(proposalId)
      return newSet
    })
    // Call the parent cancel handler
    if (onCancel) {
      onCancel(drawingId)
    }
  }
  
  // Count proposals by status with memoization
  const { pendingCount, approvedCount, rejectedCount } = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    proposalGroup.proposals.forEach(p => {
      if (approvedIds.has(p.id)) approved++;
      else if (rejectedIds.has(p.id)) rejected++;
      else pending++;
    });
    return { pendingCount: pending, approvedCount: approved, rejectedCount: rejected };
  }, [proposalGroup.proposals, approvedIds, rejectedIds])

  // Memoize proposals to prevent unnecessary re-renders
  const memoizedProposals = useMemo(() => 
    proposalGroup.proposals.map(p => ({ ...p })),
    [proposalGroup.proposals]
  )

  if (proposalGroup.proposals.length === 0) {
    return (
      <div className="premium-glass border border-[hsl(var(--border))] rounded-lg p-[var(--space-lg)]">
        <div className="flex items-center gap-[var(--space-md)]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-600/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--foreground)]">{proposalGroup.title}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              現在の市場状況では、明確なトレンドラインを検出できませんでした。
              市場がレンジ相場になっているか、より短い時間枠での分析が必要かもしれません。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-glass border border-[hsl(var(--border))] rounded-lg p-[var(--space-lg)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-[var(--font-sm)] font-semibold text-[hsl(var(--text-primary))] flex items-center gap-[var(--space-sm)]">
              <AlertCircle className="w-4 h-4 text-[hsl(var(--color-info))]" />
              {proposalGroup.title}
            </h3>
            <p className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))] mt-1">{proposalGroup.description}</p>
          </div>
          {pendingCount > 1 && proposalGroup.proposals.length > 0 && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleApproveAll}
                className="h-7 px-[var(--space-sm)] text-[var(--font-xs)] bg-[hsl(var(--color-profit)/0.1)] text-[hsl(var(--color-profit))] border-[hsl(var(--color-profit)/0.3)] hover:bg-[hsl(var(--color-profit)/0.2)] interactive"
                disabled={pendingCount === 0}
              >
                <Check className="w-3 h-3 mr-1" />
                全て承認
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRejectAll}
                className="h-7 px-[var(--space-sm)] text-[var(--font-xs)] bg-[hsl(var(--color-loss)/0.1)] text-[hsl(var(--color-loss))] border-[hsl(var(--color-loss)/0.3)] hover:bg-[hsl(var(--color-loss)/0.2)] interactive"
                disabled={pendingCount === 0}
              >
                <X className="w-3 h-3 mr-1" />
                全て却下
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Proposals */}
      <div className="space-y-2">
        {memoizedProposals.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[hsl(var(--text-muted))]" />
            <p className="text-[var(--font-sm)] text-[hsl(var(--text-secondary))] mb-2">
              現在の市場状況では明確なトレンドラインを検出できませんでした
            </p>
            <p className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              レンジ相場のため、もう少し時間をおいて再度分析することをお勧めします
            </p>
          </div>
        ) : (
          /* Show all proposals in original order with their current status */
          memoizedProposals.map((proposal) => {
            const isApproved = approvedIds.has(proposal.id)
            const isRejected = rejectedIds.has(proposal.id)
            const status = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'
            
            return (
              <ProposalItem
                key={proposal.id}
                proposal={proposal}
                status={status}
                onApprove={status === 'pending' ? () => handleApprove(proposal.id) : undefined}
                onReject={status === 'pending' ? () => handleReject(proposal.id) : undefined}
                drawingId={approvedDrawingIds.get(proposal.id)}
                onCancel={status === 'approved' && onCancel && approvedDrawingIds.get(proposal.id) ? 
                  () => handleCancel(proposal.id, approvedDrawingIds.get(proposal.id)!) : undefined}
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-[var(--space-md)] pt-[var(--space-md)] border-t border-[hsl(var(--border))]">
        <div className="flex items-center justify-between text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
          <p>
            {pendingCount > 0 && `${pendingCount}件の提案待ち`}
            {approvedCount > 0 && ` • ${approvedCount}件承認済み`}
            {rejectedCount > 0 && ` • ${rejectedCount}件却下`}
          </p>
          {approvedCount > 0 && (
            <span className="text-[hsl(var(--color-profit))] flex items-center gap-1">
              <Check className="w-3 h-3" />
              チャートに描画済み
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

interface ProposalItemProps {
  proposal: DrawingProposal
  status?: 'pending' | 'approved' | 'rejected'
  onApprove?: () => void
  onReject?: () => void
  onCancel?: () => void
  drawingId?: string
}

function ProposalItem({ proposal, status = 'pending', onApprove, onReject, onCancel, drawingId }: ProposalItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-[hsl(var(--color-loss))]'
      case 'medium': return 'text-[hsl(var(--color-warning))]'
      case 'low': return 'text-[hsl(var(--color-profit))]'
      default: return 'text-[hsl(var(--text-muted))]'
    }
  }

  const getConfidenceBar = (confidence: number) => {
    const percentage = Math.round(confidence * 100)
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-[hsl(var(--color-secondary))] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] transition-all duration-[var(--transition-normal)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">{percentage}%</span>
      </div>
    )
  }

  const getTypeIcon = (type: string) => {
    if (type.includes('下降') || type.includes('レジスタンス')) {
      return <TrendingDown className="w-3.5 h-3.5 text-[hsl(var(--color-loss))]" />
    }
    return <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--color-profit))]" />
  }

  const getStatusStyles = () => {
    switch (status) {
      case 'approved':
        return 'bg-[hsl(var(--color-profit)/0.1)] border border-[hsl(var(--color-profit)/0.3)]'
      case 'rejected':
        return 'bg-[hsl(var(--color-loss)/0.1)] border border-[hsl(var(--color-loss)/0.3)] opacity-50'
      default:
        return 'premium-glass-subtle'
    }
  }
  
  return (
    <div className={`group rounded-lg p-[var(--space-md)] hover:bg-[hsl(var(--color-secondary)/0.4)] transition-all duration-[var(--transition-normal)] ${getStatusStyles()}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {getTypeIcon(proposal.title)}
            <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">{proposal.title}</h4>
            <span className={`text-xs ${getPriorityColor(proposal.priority)}`}>
              {proposal.priority === 'high' ? '高' : proposal.priority === 'medium' ? '中' : '低'}
            </span>
            {status === 'approved' && (
              <span className="text-[var(--font-xs)] text-[hsl(var(--color-profit))] flex items-center gap-1">
                <Check className="w-3 h-3" />
                承認済み
              </span>
            )}
            {status === 'rejected' && (
              <span className="text-[var(--font-xs)] text-[hsl(var(--color-loss))] flex items-center gap-1">
                <X className="w-3 h-3" />
                却下済み
              </span>
            )}
          </div>
          <p className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">{proposal.description}</p>
        </div>
        {status === 'pending' && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={onApprove}
              className="h-6 w-6 p-0 hover:bg-[hsl(var(--color-profit)/0.2)] rounded interactive"
              title="承認"
            >
              <Check className="w-3.5 h-3.5 text-[hsl(var(--color-profit))]" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onReject}
              className="h-6 w-6 p-0 hover:bg-[hsl(var(--color-loss)/0.2)] rounded interactive"
              title="却下"
            >
              <X className="w-3.5 h-3.5 text-[hsl(var(--color-loss))]" />
            </Button>
          </div>
        )}
        {status === 'approved' && onCancel && drawingId && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <StyleEditor
              drawingId={drawingId}
              proposalId={proposal.id}
              currentStyle={proposal.drawingData.style}
              isPattern={proposal.drawingData.type === 'pattern'}
              patternType={proposal.drawingData.metadata?.patternType}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-6 px-[var(--space-sm)] hover:bg-[hsl(var(--color-loss)/0.2)] text-[var(--font-xs)] rounded interactive"
              title="取り消し"
            >
              取り消し
            </Button>
          </div>
        )}
      </div>
      
      {/* Reason and Confidence */}
      <div className="space-y-2">
        <div className="flex items-start gap-1">
          <ChevronRight className="w-3 h-3 text-[hsl(var(--text-muted))] mt-0.5 flex-shrink-0" />
          <p className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">{proposal.reason}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">信頼度</span>
          {getConfidenceBar(proposal.confidence)}
        </div>
        {proposal.touches !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">タッチ回数</span>
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))] font-medium">{proposal.touches}回</span>
          </div>
        )}
      </div>

      {/* Price Info for trendline */}
      {proposal.drawingData.type === 'trendline' && proposal.drawingData.points && proposal.drawingData.points.length >= 2 && (
        <div className="mt-[var(--space-sm)] pt-[var(--space-sm)] border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center justify-between text-[var(--font-xs)]">
            <span className="text-[hsl(var(--text-muted))]">価格範囲</span>
            <span className="text-[hsl(var(--text-secondary))]">
              ${(proposal.drawingData.points[0].value || 0).toLocaleString()} → 
              ${(proposal.drawingData.points[1].value || 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}
      
      {/* Price Info for horizontal line */}
      {(proposal.drawingData.type === 'horizontal' || proposal.drawingData.type === 'horizontalLine') && proposal.drawingData.points && (
        <div className="mt-[var(--space-sm)] pt-[var(--space-sm)] border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center justify-between text-[var(--font-xs)]">
            <span className="text-[hsl(var(--text-muted))]">価格レベル</span>
            <span className="text-[hsl(var(--text-secondary))]">
              ${(proposal.drawingData.price || proposal.drawingData.points[0].value).toLocaleString()}
            </span>
          </div>
        </div>
      )}
      
      {/* Price Info for fibonacci */}
      {proposal.drawingData.type === 'fibonacci' && proposal.drawingData.points && (
        <div className="mt-[var(--space-sm)] pt-[var(--space-sm)] border-t border-[hsl(var(--border)/0.5)]">
          <div className="flex items-center justify-between text-[var(--font-xs)] mb-1">
            <span className="text-[hsl(var(--text-muted))]">価格範囲</span>
            <span className="text-[hsl(var(--text-secondary))]">
              ${proposal.drawingData.points[0].value.toLocaleString()} → 
              ${proposal.drawingData.points[1].value.toLocaleString()}
            </span>
          </div>
          {proposal.drawingData.levels && (
            <div className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              レベル: {proposal.drawingData.levels.map(l => `${(l * 100).toFixed(1)}%`).join(', ')}
            </div>
          )}
        </div>
      )}
      
      {/* Pattern Info */}
      {proposal.drawingData.type === 'pattern' && proposal.drawingData.metadata && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <div className="space-y-1 text-xs">
            {proposal.drawingData.metadata.metrics?.breakout_level && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">ブレイクアウト</span>
                <span className="text-gray-300">
                  ${proposal.drawingData.metadata.metrics.breakout_level.toLocaleString()}
                </span>
              </div>
            )}
            {proposal.drawingData.metadata.metrics?.target_level && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">目標価格</span>
                <span className="text-green-400">
                  ${proposal.drawingData.metadata.metrics.target_level.toLocaleString()}
                </span>
              </div>
            )}
            {proposal.drawingData.metadata.metrics?.stop_loss && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">ストップロス</span>
                <span className="text-red-400">
                  ${proposal.drawingData.metadata.metrics.stop_loss.toLocaleString()}
                </span>
              </div>
            )}
            {proposal.drawingData.metadata.tradingImplication && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500">シグナル:</span>
                <span className={`font-medium ${
                  proposal.drawingData.metadata.tradingImplication === 'bullish' ? 'text-green-400' :
                  proposal.drawingData.metadata.tradingImplication === 'bearish' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {proposal.drawingData.metadata.tradingImplication === 'bullish' ? '上昇' :
                   proposal.drawingData.metadata.tradingImplication === 'bearish' ? '下落' : '中立'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}