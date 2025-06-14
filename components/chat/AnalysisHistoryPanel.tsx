'use client'

import { SimpleScrollArea } from '@/components/ui/simple-scroll-area'
import { Button } from '@/components/ui/button'
import { 
  BarChart3, 
  Activity,
  CheckCircle,
  TrendingUp, 
  TrendingDown,
  Filter,
  Download,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useAnalysisHistory,
  useAnalysisRecords,
  useAnalysisMetrics,
  useAnalysisActions
} from '@/store/analysis-history.store'
import { AnalysisRecordItem } from '@/components/shared/analysis/AnalysisRecordItem'
import { FullHeightLayout } from '@/components/layout/FullHeightLayout'
import { useAnalysisFormatting } from '@/hooks/use-analysis-formatting'

export function AnalysisHistoryPanel() {
  const records = useAnalysisRecords()
  const metrics = useAnalysisMetrics()
  const filter = useAnalysisHistory(state => state.filter)
  const selectedRecord = useAnalysisHistory(state => state.selectedRecord)
  const allRecords = useAnalysisHistory(state => state.records)
  const { setFilter, setSelectedRecord, exportData, clearHistory } = useAnalysisActions()
  const { formatPercentage } = useAnalysisFormatting()

  // Filter buttons configuration
  const filterButtons = [
    { value: 'all', label: 'すべて', icon: BarChart3 },
    { value: 'active', label: 'アクティブ', icon: Activity },
    { value: 'completed', label: '完了', icon: CheckCircle },
    { value: 'success', label: '成功', icon: TrendingUp },
    { value: 'failure', label: '失敗', icon: TrendingDown }
  ] as const

  const handleExport = () => {
    try {
      const data = exportData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analysis-history-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
    }
  }

  const handleClearHistory = () => {
    if (confirm('すべての分析記録を削除してもよろしいですか？この操作は取り消せません。')) {
      clearHistory()
    }
  }

  // Empty state for no records at all
  if (allRecords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl premium-glass-subtle flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-[hsl(var(--text-muted))]" />
          </div>
          <p className="text-[hsl(var(--text-secondary))] text-sm font-medium mb-1">
            まだ分析記録がありません
          </p>
          <p className="text-[hsl(var(--text-muted))] text-xs leading-relaxed">
            提案を承認すると分析記録に記録されます
          </p>
        </div>
      </div>
    )
  }

  // Header component with stats - only show if we have records to display
  const StatsHeader = metrics && metrics.totalRecords > 0 && records.length > 0 && (
    <div className="flex-shrink-0 p-2 border-b border-[hsl(var(--border))]">
      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-[hsl(var(--color-secondary)/0.5)] rounded p-1 text-center">
          <div className="text-[hsl(var(--text-muted))]">合計</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold">
            {metrics.totalRecords}
          </div>
        </div>
        <div className="bg-[hsl(var(--color-secondary)/0.5)] rounded p-1 text-center">
          <div className="text-[hsl(var(--text-muted))]">アクティブ</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold">
            {metrics.activeRecords}
          </div>
        </div>
        <div className="bg-[hsl(var(--color-secondary)/0.5)] rounded p-1 text-center">
          <div className="text-[hsl(var(--text-muted))]">成功</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold">
            {metrics.successfulRecords}
          </div>
        </div>
        <div className="bg-[hsl(var(--color-secondary)/0.5)] rounded p-1 text-center">
          <div className="text-[hsl(var(--text-muted))]">精度</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold">
            {formatPercentage(metrics.overallAccuracy)}
          </div>
        </div>
      </div>
    </div>
  )

  // Filter buttons component - only show if we have records
  const FilterButtons = allRecords.length > 0 && (
    <div className="flex-shrink-0 p-2 border-b border-[hsl(var(--border))]">
      <div className="flex flex-wrap gap-1">
        {filterButtons.map((btn) => (
          <Button
            key={btn.value}
            size="sm"
            variant={filter === btn.value ? 'default' : 'ghost'}
            onClick={() => setFilter(btn.value)}
            className={cn(
              "h-6 px-2 text-xs flex items-center gap-1",
              filter === btn.value && "bg-[hsl(var(--color-accent))] text-white"
            )}
          >
            <btn.icon className="w-3 h-3" />
            {btn.label}
          </Button>
        ))}
      </div>
    </div>
  )

  // Actions footer component - only show if we have records
  const ActionsFooter = allRecords.length > 0 && (
    <div className="flex-shrink-0 p-3 border-t border-[hsl(var(--border))] space-y-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExport}
          className="flex-1 text-xs"
        >
          <Download className="w-3 h-3 mr-1" />
          エクスポート
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClearHistory}
          className="flex-1 text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          クリア
        </Button>
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Summary Stats */}
      {StatsHeader}

      {/* Filter Buttons */}
      {FilterButtons}

      {/* Records List */}
      <div className="flex-1 overflow-auto">
        {records.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-[hsl(var(--text-muted))] text-sm">
              {filter === 'all' 
                ? 'レコードがありません' 
                : `${filterButtons.find(btn => btn.value === filter)?.label}のレコードがありません`}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {records.map((record) => (
              <AnalysisRecordItem
                key={record.id}
                record={record}
                isSelected={selectedRecord === record.id}
                onSelect={setSelectedRecord}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {ActionsFooter}
    </div>
  )
}