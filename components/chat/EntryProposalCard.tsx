'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Check, X, ChevronRight, TrendingUp, TrendingDown, AlertCircle, 
  Target, Shield, DollarSign, Clock, BarChart3 
} from 'lucide-react'
import type { EntryProposal, EntryProposalGroup, TradingDirection } from '@/types/proposals'

interface EntryProposalCardProps {
  proposalGroup: EntryProposalGroup
  onApprove: (proposalId: string) => void
  onReject: (proposalId: string) => void
  onApproveAll: () => void
  onRejectAll: () => void
}

// Memoize the component to prevent unnecessary re-renders
export const EntryProposalCard = React.memo(function EntryProposalCard({
  proposalGroup,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
}: EntryProposalCardProps) {
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  
  const handleApprove = (proposalId: string) => {
    setApprovedIds(prev => new Set(prev).add(proposalId))
    onApprove(proposalId)
  }
  
  const handleReject = (proposalId: string) => {
    setRejectedIds(prev => new Set(prev).add(proposalId))
    onReject(proposalId)
  }
  
  const handleApproveAll = () => {
    const allIds = new Set(proposalGroup.proposals.map(p => p.id))
    setApprovedIds(allIds)
    onApproveAll()
  }
  
  const handleRejectAll = () => {
    const allIds = new Set(proposalGroup.proposals.map(p => p.id))
    setRejectedIds(allIds)
    onRejectAll()
  }

  // Memoize expensive calculations
  const pendingCount = useMemo(() => 
    proposalGroup.proposals.filter(
      p => !approvedIds.has(p.id) && !rejectedIds.has(p.id)
    ).length,
    [proposalGroup.proposals, approvedIds, rejectedIds]
  );
  
  // Memoize the proposals to prevent unnecessary re-renders of child components
  const memoizedProposals = useMemo(() => 
    proposalGroup.proposals.map(p => ({ ...p })),
    [proposalGroup.proposals]
  )

  return (
    <div className="premium-glass border border-[hsl(var(--border))] rounded-lg p-[var(--space-lg)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-[var(--font-sm)] font-semibold text-[hsl(var(--text-primary))] flex items-center gap-[var(--space-sm)]">
              <Target className="w-4 h-4 text-[hsl(var(--color-accent))]" />
              {proposalGroup.title}
            </h3>
            <p className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))] mt-1">
              {proposalGroup.description}
            </p>
          </div>
          {pendingCount > 1 && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleApproveAll}
                className="h-7 px-[var(--space-sm)] text-[var(--font-xs)] bg-[hsl(var(--color-profit)/0.1)] text-[hsl(var(--color-profit))] border-[hsl(var(--color-profit)/0.3)] hover:bg-[hsl(var(--color-profit)/0.2)]"
                disabled={pendingCount === 0}
              >
                <Check className="w-3 h-3 mr-1" />
                全て承認
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRejectAll}
                className="h-7 px-[var(--space-sm)] text-[var(--font-xs)] bg-[hsl(var(--color-loss)/0.1)] text-[hsl(var(--color-loss))] border-[hsl(var(--color-loss)/0.3)] hover:bg-[hsl(var(--color-loss)/0.2)]"
                disabled={pendingCount === 0}
              >
                <X className="w-3 h-3 mr-1" />
                全て却下
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Market Summary */}
      {proposalGroup.summary && (
        <div className="mb-4 p-3 bg-[hsl(var(--color-secondary)/0.3)] rounded-lg">
          <div className="flex items-center justify-between text-[var(--font-xs)]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-[hsl(var(--text-muted))]" />
                <span className="text-[hsl(var(--text-secondary))]">市場バイアス:</span>
                <span className={`font-medium ${
                  proposalGroup.summary.marketBias === 'bullish' ? 'text-[hsl(var(--color-profit))]' :
                  proposalGroup.summary.marketBias === 'bearish' ? 'text-[hsl(var(--color-loss))]' :
                  'text-[hsl(var(--text-primary))]'
                }`}>
                  {proposalGroup.summary.marketBias === 'bullish' ? '上昇' :
                   proposalGroup.summary.marketBias === 'bearish' ? '下落' : '中立'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[hsl(var(--text-secondary))]">平均信頼度:</span>
                <span className="font-medium text-[hsl(var(--text-primary))]">
                  {Math.round(proposalGroup.summary.averageConfidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposals */}
      <div className="space-y-3">
        {memoizedProposals.map((proposal) => {
          const isApproved = approvedIds.has(proposal.id)
          const isRejected = rejectedIds.has(proposal.id)
          const status = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'
          
          return (
            <EntryProposalItem
              key={proposal.id}
              proposal={proposal}
              status={status}
              onApprove={status === 'pending' ? () => handleApprove(proposal.id) : undefined}
              onReject={status === 'pending' ? () => handleReject(proposal.id) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
})

interface EntryProposalItemProps {
  proposal: EntryProposal
  status?: 'pending' | 'approved' | 'rejected'
  onApprove?: () => void
  onReject?: () => void
}

function EntryProposalItem({ proposal, status = 'pending', onApprove, onReject }: EntryProposalItemProps) {
  const [expanded, setExpanded] = useState(false)

  const getDirectionIcon = (direction: TradingDirection) => {
    return direction === 'long' ? 
      <TrendingUp className="w-4 h-4 text-[hsl(var(--color-profit))]" /> :
      <TrendingDown className="w-4 h-4 text-[hsl(var(--color-loss))]" />
  }

  const getStrategyLabel = (strategy: string) => {
    const labels: Record<string, string> = {
      scalping: 'スキャルピング',
      dayTrading: 'デイトレード',
      swingTrading: 'スイング',
      position: 'ポジション',
    }
    return labels[strategy] || strategy
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-[hsl(var(--color-loss))]'
      case 'medium': return 'text-[hsl(var(--color-warning))]'
      case 'low': return 'text-[hsl(var(--color-profit))]'
      default: return 'text-[hsl(var(--text-muted))]'
    }
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
      {/* Main Content */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            {getDirectionIcon(proposal.direction)}
            <span className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              {proposal.direction === 'long' ? 'ロング' : 'ショート'}エントリー
            </span>
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] bg-[hsl(var(--color-secondary)/0.5)] px-2 py-0.5 rounded">
              {getStrategyLabel(proposal.strategy)}
            </span>
            <span className={`text-xs font-medium ${getPriorityColor(proposal.priority)}`}>
              {proposal.priority === 'high' ? '高優先' : proposal.priority === 'medium' ? '中優先' : '低優先'}
            </span>
            {status === 'approved' && (
              <span className="text-[var(--font-xs)] text-[hsl(var(--color-profit))] flex items-center gap-1">
                <Check className="w-3 h-3" />
                承認済み
              </span>
            )}
          </div>

          {/* Price Display */}
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                <Target className="w-3 h-3" />
                <span>エントリー</span>
              </div>
              <div className="text-[var(--font-md)] font-semibold text-[hsl(var(--text-primary))]">
                ${proposal.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {proposal.entryZone && (
                <div className="text-[10px] text-[hsl(var(--text-muted))]">
                  ${proposal.entryZone.min.toLocaleString()} - ${proposal.entryZone.max.toLocaleString()}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                <Shield className="w-3 h-3" />
                <span>ストップロス</span>
              </div>
              <div className="text-[var(--font-md)] font-semibold text-[hsl(var(--color-loss))]">
                ${proposal.riskParameters.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-[hsl(var(--text-muted))]">
                -{proposal.riskParameters.stopLossPercent.toFixed(2)}%
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                <DollarSign className="w-3 h-3" />
                <span>リスクリワード</span>
              </div>
              <div className="text-[var(--font-md)] font-semibold text-[hsl(var(--color-profit))]">
                1:{proposal.riskParameters.riskRewardRatio.toFixed(1)}
              </div>
              <div className="text-[10px] text-[hsl(var(--text-muted))]">
                推奨: {proposal.riskParameters.positionSizePercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Primary Reason */}
          <div className="flex items-start gap-1 mb-2">
            <ChevronRight className="w-3 h-3 text-[hsl(var(--text-muted))] mt-0.5 flex-shrink-0" />
            <p className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">
              {proposal.reasoning.primary}
            </p>
          </div>

          {/* Confidence Bar */}
          <div className="flex items-center gap-2">
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">信頼度</span>
            <div className="flex-1 h-1.5 bg-[hsl(var(--color-secondary))] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] transition-all duration-[var(--transition-normal)]"
                style={{ width: `${proposal.confidence * 100}%` }}
              />
            </div>
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              {Math.round(proposal.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Actions */}
        {status === 'pending' && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={onApprove}
              className="h-6 w-6 p-0 hover:bg-[hsl(var(--color-profit)/0.2)] rounded"
              title="承認"
            >
              <Check className="w-3.5 h-3.5 text-[hsl(var(--color-profit))]" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onReject}
              className="h-6 w-6 p-0 hover:bg-[hsl(var(--color-loss)/0.2)] rounded"
              title="却下"
            >
              <X className="w-3.5 h-3.5 text-[hsl(var(--color-loss))]" />
            </Button>
          </div>
        )}
      </div>

      {/* Expandable Details */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--font-xs)] text-[hsl(var(--color-accent))] hover:text-[hsl(var(--text-primary))] flex items-center gap-1"
        >
          {expanded ? '詳細を隠す' : '詳細を表示'}
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-[hsl(var(--border)/0.5)] pt-3">
            {/* Take Profit Targets */}
            <div>
              <h4 className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-primary))] mb-2">
                利確目標
              </h4>
              <div className="space-y-1">
                {proposal.riskParameters.takeProfitTargets.map((tp, index) => (
                  <div key={index} className="flex items-center justify-between text-[var(--font-xs)]">
                    <span className="text-[hsl(var(--text-muted))]">
                      TP{index + 1} ({tp.percentage}%)
                    </span>
                    <span className="text-[hsl(var(--color-profit))]">
                      ${tp.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Entry Conditions */}
            <div>
              <h4 className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-primary))] mb-2">
                エントリー条件
              </h4>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[var(--font-xs)]">
                  <Clock className="w-3 h-3 text-[hsl(var(--text-muted))]" />
                  <span className="text-[hsl(var(--text-muted))]">トリガー:</span>
                  <span className="text-[hsl(var(--text-secondary))]">
                    {proposal.conditions.trigger === 'market' ? '成行' :
                     proposal.conditions.trigger === 'limit' ? '指値' :
                     proposal.conditions.trigger === 'breakout' ? 'ブレイクアウト' :
                     proposal.conditions.trigger === 'bounce' ? '反発' : proposal.conditions.trigger}
                  </span>
                </div>
                {proposal.conditions.confirmationRequired && proposal.conditions.confirmationRequired.length > 0 && (
                  <div className="ml-4">
                    {proposal.conditions.confirmationRequired.map((conf, index) => (
                      <div key={index} className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                        • {conf.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Technical Factors */}
            <div>
              <h4 className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-primary))] mb-2">
                テクニカル要因
              </h4>
              <div className="space-y-1">
                {proposal.reasoning.technicalFactors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between text-[var(--font-xs)]">
                    <span className="text-[hsl(var(--text-muted))]">{factor.description}</span>
                    <span className="text-[hsl(var(--text-secondary))]">
                      {(factor.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks */}
            <div>
              <h4 className="text-[var(--font-xs)] font-medium text-[hsl(var(--text-primary))] mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-[hsl(var(--color-warning))]" />
                リスク要因
              </h4>
              <div className="space-y-1">
                {proposal.reasoning.risks.map((risk, index) => (
                  <div key={index} className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                    • {risk}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}