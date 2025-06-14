'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Calendar,
  AlertCircle
} from 'lucide-react'
import type { AnalysisRecord } from '@/types/analysis-history'

interface AnalysisRecordItemProps {
  record: AnalysisRecord
  isSelected?: boolean
  onSelect?: (id: string) => void
  formatDate?: (timestamp: number) => string
}

export function AnalysisRecordItem({
  record,
  isSelected = false,
  onSelect,
  formatDate = defaultFormatDate
}: AnalysisRecordItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = () => {
    setIsExpanded(!isExpanded)
    onSelect?.(isSelected ? '' : record.id)
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        isSelected
          ? "bg-[hsl(var(--color-accent)/0.1)] border-[hsl(var(--color-accent)/0.3)]"
          : "bg-[hsl(var(--color-secondary)/0.3)] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]"
      )}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getTypeIcon(record.type)}
          <div>
            <div className="text-sm font-medium text-[hsl(var(--text-primary))]">
              {record.symbol} {getTypeLabel(record.type)}
            </div>
            <div className="text-xs text-[hsl(var(--text-muted))] flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(record.timestamp)}
            </div>
          </div>
        </div>
        <div className={cn("flex items-center gap-1", getStatusColor(record))}>
          {getStatusIcon(record)}
          <span className="text-xs font-medium">
            {getStatusLabel(record.tracking.status)}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        {record.proposal.price && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-[hsl(var(--text-muted))]">価格</span>
            <span className="font-mono text-[hsl(var(--text-primary))]">
              ${record.proposal.price.toLocaleString()}
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xs">
          <span className="text-[hsl(var(--text-muted))]">信頼度</span>
          <span className="font-semibold text-[hsl(var(--text-primary))]">
            {Math.round(record.proposal.confidence * 100)}%
          </span>
        </div>

        {record.proposal.mlPrediction && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-[hsl(var(--text-muted))]">ML予測</span>
            <span className={cn(
              "font-semibold",
              record.proposal.mlPrediction.successProbability > 0.7 ? "text-green-500" :
              record.proposal.mlPrediction.successProbability > 0.5 ? "text-yellow-500" : "text-red-500"
            )}>
              {Math.round(record.proposal.mlPrediction.successProbability * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Active Analysis Progress */}
      {record.tracking.status === 'active' && (
        <div className="mt-2 p-2 bg-[hsl(var(--color-secondary)/0.5)] rounded text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3 text-blue-500" />
            <span className="text-[hsl(var(--text-primary))]">分析中</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[hsl(var(--text-muted))]">タッチ数</span>
            <span className="text-[hsl(var(--text-primary))]">
              {record.tracking.touches.length}回
            </span>
          </div>
          {record.tracking.startTime && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-[hsl(var(--text-muted))]">経過時間</span>
              <span className="text-[hsl(var(--text-primary))]">
                {formatDuration(Date.now() - record.tracking.startTime)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Completed Results */}
      {record.tracking.status === 'completed' && record.performance && (
        <div className="mt-2 p-2 bg-[hsl(var(--color-secondary)/0.5)] rounded text-xs">
          <div className="flex items-center gap-2 mb-1">
            {record.tracking.finalResult === 'success' ? (
              <CheckCircle className="w-3 h-3 text-green-500" />
            ) : (
              <XCircle className="w-3 h-3 text-red-500" />
            )}
            <span className={cn(
              "font-semibold",
              record.tracking.finalResult === 'success' ? "text-green-500" : "text-red-500"
            )}>
              {record.tracking.finalResult === 'success' ? '成功' : '失敗'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <div className="text-[hsl(var(--text-muted))]">精度</div>
              <div className="font-semibold text-[hsl(var(--text-primary))]">
                {Math.round((record.performance.accuracy || 0) * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[hsl(var(--text-muted))]">実績</div>
              <div className="font-semibold text-[hsl(var(--text-primary))]">
                {record.performance.actualBounces || 0}回
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && isSelected && record.proposal.mlPrediction?.reasoning && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
          <div className="text-xs font-medium text-[hsl(var(--text-primary))] mb-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            分析根拠
          </div>
          <div className="space-y-1">
            {record.proposal.mlPrediction.reasoning.slice(0, 3).map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                  reason.impact === 'positive' ? "bg-green-500" :
                  reason.impact === 'negative' ? "bg-red-500" : "bg-gray-500"
                )} />
                <div className="text-[hsl(var(--text-muted))]">
                  {reason.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions
function getTypeIcon(type: string) {
  switch (type) {
    case 'support':
      return <TrendingUp className="w-3 h-3 text-green-500" />
    case 'resistance':
      return <TrendingDown className="w-3 h-3 text-red-500" />
    case 'trendline':
      return <Activity className="w-3 h-3 text-blue-500" />
    case 'pattern':
      return <Target className="w-3 h-3 text-purple-500" />
    default:
      return <BarChart3 className="w-3 h-3 text-gray-500" />
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'support':
      return 'サポート'
    case 'resistance':
      return 'レジスタンス'
    case 'trendline':
      return 'トレンドライン'
    case 'pattern':
      return 'パターン'
    default:
      return type
  }
}

function getStatusColor(record: AnalysisRecord) {
  switch (record.tracking.status) {
    case 'active':
      return 'text-blue-500'
    case 'completed':
      return record.tracking.finalResult === 'success' ? 'text-green-500' : 
             record.tracking.finalResult === 'failure' ? 'text-red-500' : 'text-yellow-500'
    case 'expired':
      return 'text-gray-500'
    default:
      return 'text-gray-400'
  }
}

function getStatusIcon(record: AnalysisRecord) {
  switch (record.tracking.status) {
    case 'active':
      return <Activity className="w-4 h-4" />
    case 'completed':
      return record.tracking.finalResult === 'success' ? 
        <CheckCircle className="w-4 h-4" /> : 
        <XCircle className="w-4 h-4" />
    case 'expired':
      return <Clock className="w-4 h-4" />
    default:
      return <BarChart3 className="w-4 h-4" />
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'アクティブ'
    case 'completed':
      return '完了'
    case 'expired':
      return '期限切れ'
    default:
      return status
  }
}

function defaultFormatDate(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 1) {
    return `${Math.round(diffInHours * 60)}分前`
  } else if (diffInHours < 24) {
    return `${Math.round(diffInHours)}時間前`
  } else if (diffInHours < 48) {
    return '昨日'
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }
}

function formatDuration(milliseconds: number) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}時間${minutes > 0 ? minutes + '分' : ''}`
  } else if (minutes > 0) {
    return `${minutes}分`
  } else {
    return '1分未満'
  }
}