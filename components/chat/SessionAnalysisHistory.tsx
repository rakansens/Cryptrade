'use client'

// ============================================================
// 2025-06-11 🖼️ レイアウト改善
// - FullHeightLayout を使用して統計ヘッダーを固定
// - 上部に大きな余白が出る問題を解消
// ============================================================

import { BarChart3 } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAnalysisHistory } from '@/store/analysis-history.store'
import { AnalysisRecordItem } from '@/components/shared/analysis/AnalysisRecordItem'
import { useAnalysisFormatting } from '@/hooks/use-analysis-formatting'

interface SessionAnalysisHistoryProps {
  sessionId: string;
  resetKey?: number; // 変更トリガ
}

export function SessionAnalysisHistory({ sessionId, resetKey = 0 }: SessionAnalysisHistoryProps) {
  const records = useAnalysisHistory(state => state.records)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const { formatPercentage } = useAnalysisFormatting()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Filter records for current session
  const sessionRecords = useMemo(() => {
    return records
      .filter(record => record.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [records, sessionId])

  // Calculate session stats
  const sessionStats = useMemo(() => {
    const active = sessionRecords.filter(r => r.tracking.status === 'active').length
    const completed = sessionRecords.filter(r => r.tracking.status === 'completed').length
    const success = sessionRecords.filter(r => 
      r.tracking.status === 'completed' && r.tracking.finalResult === 'success'
    ).length
    
    const accuracy = completed > 0 ? (success / completed) : 0
    
    return { total: sessionRecords.length, active, completed, success, accuracy }
  }, [sessionRecords])

  // タブ切り替え時に上部へスクロール
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 })
  }, [resetKey])

  // Empty state
  if (sessionRecords.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <div className="p-8">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl premium-glass-subtle flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-[hsl(var(--text-muted))]" />
              </div>
              <p className="text-[hsl(var(--text-secondary))] text-sm font-medium mb-1 text-center">
                このチャットの分析記録はまだありません
              </p>
              <p className="text-[hsl(var(--text-muted))] text-xs leading-relaxed text-center">
                提案を承認すると分析記録に記録されます
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Stats header component (unused)
  (
    <div className="flex-shrink-0 p-4 border-b border-[hsl(var(--border))]">
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div className="text-center">
          <div className="text-[hsl(var(--text-muted))]">合計</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold text-sm">
            {sessionStats.total}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[hsl(var(--text-muted))]">アクティブ</div>
          <div className="text-blue-500 font-semibold text-sm">
            {sessionStats.active}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[hsl(var(--text-muted))]">成功</div>
          <div className="text-green-500 font-semibold text-sm">
            {sessionStats.success}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[hsl(var(--text-muted))]">精度</div>
          <div className="text-[hsl(var(--text-primary))] font-semibold text-sm">
            {formatPercentage(sessionStats.accuracy)}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Stats Header */}
      <div className="flex-shrink-0 p-4 border-b border-[hsl(var(--border))]">
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="text-center">
            <div className="text-[hsl(var(--text-muted))]">合計</div>
            <div className="text-[hsl(var(--text-primary))] font-semibold text-sm">
              {sessionStats.total}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[hsl(var(--text-muted))]">アクティブ</div>
            <div className="text-blue-500 font-semibold text-sm">
              {sessionStats.active}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[hsl(var(--text-muted))]">成功</div>
            <div className="text-green-500 font-semibold text-sm">
              {sessionStats.success}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[hsl(var(--text-muted))]">精度</div>
            <div className="text-[hsl(var(--text-primary))] font-semibold text-sm">
              {formatPercentage(sessionStats.accuracy)}
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="p-4 space-y-3">
          {sessionRecords.map((record) => (
            <AnalysisRecordItem
              key={record.id}
              record={record}
              isSelected={selectedRecordId === record.id}
              onSelect={(id) => setSelectedRecordId(id === selectedRecordId ? null : id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}