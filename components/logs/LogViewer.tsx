'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Filter, Download, Search, Eye, Clock, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { LogLevel } from '@/lib/logs/types'
import type { LogEntry, LogFilters, LogPagination } from '@/types/log-viewer.types'
import { formatLogError } from '@/types/log-viewer.types'

interface LogViewerProps {
  className?: string
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  critical: 'text-pink-400 bg-pink-400/10',
  error: 'text-red-400 bg-red-400/10',
  warn: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
  debug: 'text-gray-400 bg-gray-400/10'
}

const LEVEL_ICONS: Record<LogLevel, React.ComponentType<{ className?: string }>> = {
  critical: XCircle,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
  debug: CheckCircle
}

export function LogViewer({ className }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  
  // Filters
  const [filters, setFilters] = useState<LogFilters>({
    level: undefined,
    component: undefined,
    search: undefined,
    startTime: undefined,
    endTime: undefined,
  })
  const [pagination, setPagination] = useState<LogPagination>({
    page: 1,
    limit: 50
  })
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch logs
  const [loading, setLoading] = useState(false)

  const fetchLogs = async () => {
    const params = new URLSearchParams()
    
    // Add filters
    if (filters.level) params.append('level', filters.level)
    if (filters.component) params.append('component', filters.component)
    if (filters.search) params.append('search', filters.search)
    if (filters.startTime) params.append('startTime', filters.startTime.toISOString())
    if (filters.endTime) params.append('endTime', filters.endTime.toISOString())
    
    // Add pagination
    params.append('page', pagination.page.toString())
    params.append('limit', pagination.limit.toString())
    
    try {
      const response = await fetch(`/api/logs?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      setLogs(data.logs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // Auto refresh effect
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000) // 5秒ごと
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, filters, pagination])

  // Initial fetch
  useEffect(() => {
    fetchLogs()
  }, [filters, pagination])

  // Export logs
  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Level,Component,Message,Context',
      ...logs.map(log => 
        `"${new Date(log.timestamp).toISOString()}","${log.level}","${log.component || ''}","${log.message.replace(/"/g, '""')}","${JSON.stringify(log.context || {}).replace(/"/g, '""')}"`
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Toggle log expansion
  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className={`bg-[hsl(var(--color-secondary))] rounded-xl border border-[hsl(var(--border))] ${className}`}>
      {/* Header Controls */}
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <div className="flex flex-col space-y-4">
          {/* Top Row - Title and Actions */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
              <Eye className="w-5 h-5" />
              ログビューア
            </h2>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-500/10 border-green-500/20 text-green-400' : ''}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? '自動更新中' : '自動更新'}
              </Button>
              
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
              
              <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                エクスポート
              </Button>
            </div>
          </div>
          
          {/* Filters Row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[hsl(var(--text-secondary))]" />
              <Input
                placeholder="メッセージ検索..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                className="w-48"
              />
            </div>
            
            <Select
              value={filters.level || 'all'}
              onValueChange={(value) => setFilters({ ...filters, level: value === 'all' ? undefined : value as LogLevel })}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="レベル" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全レベル</SelectItem>
                <SelectItem value="error">エラー</SelectItem>
                <SelectItem value="warn">警告</SelectItem>
                <SelectItem value="info">情報</SelectItem>
                <SelectItem value="debug">デバッグ</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder="コンポーネント"
              value={filters.component || ''}
              onChange={(e) => setFilters({ ...filters, component: e.target.value || undefined })}
              className="w-40"
            />
            
            <Select
              value={pagination.limit.toString()}
              onValueChange={(value) => setPagination({ ...pagination, limit: parseInt(value), page: 1 })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Logs Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">エラー:</span>
              {error}
            </div>
          </div>
        )}
        
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-[hsl(var(--text-secondary))]">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>ログを読み込み中...</span>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-[hsl(var(--text-secondary))]">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>ログが見つかりません</p>
              <p className="text-sm">フィルターを調整してみてください</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const isExpanded = expandedLogs.has(log.id)
              const LevelIcon = LEVEL_ICONS[log.level as LogLevel]
              
              return (
                <div
                  key={log.id}
                  className="bg-[hsl(var(--color-base))] border border-[hsl(var(--border))] rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-[hsl(var(--color-secondary))] transition-colors"
                    onClick={() => toggleLogExpansion(log.id)}
                  >
                    <div className="flex items-start gap-3">
                      <LevelIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${LEVEL_COLORS[log.level as LogLevel]}`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${LEVEL_COLORS[log.level as LogLevel]}`}>
                            {log.level.toUpperCase()}
                          </Badge>
                          
                          {log.component && (
                            <Badge variant="outline" className="text-xs">
                              {log.component}
                            </Badge>
                          )}
                          
                          <div className="flex items-center gap-1 text-xs text-[hsl(var(--text-secondary))] ml-auto">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </div>
                        
                        <p className="text-[hsl(var(--text-primary))] text-sm leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (log.context || log.error) && (
                    <div className="px-4 pb-4 border-t border-[hsl(var(--border))]">
                      <div className="mt-3 space-y-3">
                        {log.context && Object.keys(log.context).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-[hsl(var(--text-primary))] mb-2">コンテキスト:</h4>
                            <pre className="text-xs bg-[hsl(var(--color-secondary))] p-3 rounded border overflow-x-auto text-[hsl(var(--text-secondary))]">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {log.error && (
                          <div>
                            <h4 className="text-sm font-medium text-red-400 mb-2">エラー詳細:</h4>
                            <pre className="text-xs bg-red-500/5 border border-red-500/20 p-3 rounded overflow-x-auto text-red-300">
                              {formatLogError(log.error)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-[hsl(var(--border))]">
            <div className="text-sm text-[hsl(var(--text-secondary))]">
              ページ {pagination.page} • {logs.length} 件のログ
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                disabled={pagination.page <= 1}
              >
                前へ
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={logs.length < pagination.limit}
              >
                次へ
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}