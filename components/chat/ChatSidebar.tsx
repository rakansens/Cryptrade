'use client'

import { SimpleScrollArea } from '@/components/ui/simple-scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, MessageSquare, Clock, Archive, Sparkles, Home, BarChart3, AlertTriangle, Settings, Trash } from 'lucide-react'
import { useChat } from '@/store/chat.store'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import './ChatSidebar.css'
import { AnalysisHistoryPanel } from './AnalysisHistoryPanel'

interface ChatSidebarProps {
  className?: string
  onSessionSelect?: (sessionId?: string) => void
}

export default function ChatSidebar({ className, onSessionSelect }: ChatSidebarProps) {
  const [showTabs, setShowTabs] = useState(false)
  const [activeTab, setActiveTab] = useState('sessions')
  const {
    sessions,
    currentSessionId,
    messagesBySession,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    deleteAllSessions,
  } = useChat()

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)

  const handleCreateSession = useCallback(() => {
    createSession()
  }, [createSession])

  const handleRename = useCallback((sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditTitle(currentTitle)
  }, [])

  const handleSaveRename = useCallback(() => {
    if (editingSessionId && editTitle.trim()) {
      renameSession(editingSessionId, editTitle.trim())
    }
    setEditingSessionId(null)
    setEditTitle('')
  }, [editingSessionId, editTitle, renameSession])

  const handleCancelRename = useCallback(() => {
    setEditingSessionId(null)
    setEditTitle('')
  }, [])

  const handleDelete = useCallback((sessionId: string) => {
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDelete = useCallback(() => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete)
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    }
  }, [sessionToDelete, deleteSession])

  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false)
    setSessionToDelete(null)
  }, [])

  const sortedSessions = Object.values(sessions).sort(
    (a, b) => b.updatedAt - a.updatedAt
  )

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return '今日'
    } else if (diffInHours < 48) {
      return '昨日'
    } else if (diffInHours < 168) {
      return '今週'
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    }
  }

  const groupedSessions = sortedSessions.reduce((acc, session) => {
    const group = formatDate(session.updatedAt)
    if (!acc[group]) acc[group] = []
    acc[group].push(session)
    return acc
  }, {} as Record<string, typeof sortedSessions>)

  const handleReturnToHome = useCallback(() => {
    if (typeof window !== 'undefined' && (window as Window & { __returnToHome?: () => void }).__returnToHome) {
      (window as Window & { __returnToHome?: () => void }).__returnToHome()
    }
  }, [])

  return (
    <div className={cn('h-full bg-gradient-to-b from-[hsl(var(--color-secondary))] to-[hsl(var(--color-base))] flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 space-y-2">
        <Button 
          onClick={handleReturnToHome}
          variant="ghost"
          className="w-full h-10 justify-center gap-2 hover:bg-[hsl(var(--color-secondary)/0.6)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors interactive"
        >
          <Sparkles className="w-5 h-5 text-[hsl(var(--color-accent))]" />
          <span className="text-base font-semibold bg-gradient-to-r from-[hsl(var(--text-primary))] to-[hsl(var(--color-accent))] bg-clip-text text-transparent">Cryptrade</span>
        </Button>
        
        <Button 
          onClick={handleCreateSession}
          className="w-full h-11 justify-start gap-3 premium-glass border border-[hsl(var(--color-accent)/0.2)] hover:border-[hsl(var(--color-accent)/0.3)] text-[hsl(var(--text-primary))] font-medium btn-premium interactive"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[hsl(var(--color-accent))]" />
            <span className="text-sm tracking-wide">新しいチャット</span>
          </div>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Tab Header - Minimal line that expands on hover */}
        <div 
          className="relative px-2 mb-0"
          onMouseEnter={() => setShowTabs(true)}
          onMouseLeave={() => setShowTabs(false)}
        >
          {/* Hover trigger area */}
          <div className="absolute inset-x-0 -top-2 h-8 z-10" />
          
          {/* Minimal line indicator with glow effect */}
          <div className="relative h-[2px] overflow-hidden">
            {/* Background line */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--border))] to-transparent" />
            
            {/* Active indicator with glow */}
            <div 
              className="absolute h-full transition-all duration-500 ease-out"
              style={{
                left: activeTab === 'sessions' ? '0%' : '50%',
                width: '50%'
              }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-[hsl(var(--color-accent))] blur-md opacity-50" />
              {/* Main line */}
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))]" />
            </div>
          </div>
          
          {/* Expandable tabs with premium glass effect */}
          <div 
            className={`absolute top-0 left-0 right-0 z-20 px-2 transition-all duration-300 ease-out ${
              showTabs 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 -translate-y-3 pointer-events-none'
            }`}
          >
            <div className="premium-glass border border-[hsl(var(--border)/0.5)] backdrop-blur-xl rounded-lg">
              <TabsList className="w-full grid grid-cols-2 bg-transparent rounded-lg h-12 p-1 gap-1">
                <TabsTrigger 
                  value="sessions" 
                  className="relative flex items-center justify-center gap-2.5 text-sm rounded-md transition-all duration-300 group/tab data-[state=active]:text-white hover:bg-[hsl(var(--color-secondary)/0.3)]"
                >
                  {/* Active background with gradient */}
                  <div className="absolute inset-0 rounded-md overflow-hidden">
                    <div className={`absolute inset-0 transition-all duration-300 ${
                      activeTab === 'sessions' 
                        ? 'opacity-100 bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-accent)/0.8)]' 
                        : 'opacity-0'
                    }`} />
                    {/* Shimmer effect on active */}
                    {activeTab === 'sessions' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[tabShimmer_3s_ease-in-out_infinite]" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <MessageSquare className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                    activeTab === 'sessions' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
                  }`} />
                  <span className={`font-medium relative z-10 transition-all duration-300 ${
                    activeTab === 'sessions' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
                  }`}>
                    会話
                  </span>
                  
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-md opacity-0 group-hover/tab:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 bg-[hsl(var(--color-accent)/0.1)] rounded-md" />
                  </div>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="history" 
                  className="relative flex items-center justify-center gap-2.5 text-sm rounded-md transition-all duration-300 group/tab data-[state=active]:text-white hover:bg-[hsl(var(--color-secondary)/0.3)]"
                >
                  {/* Active background with gradient */}
                  <div className="absolute inset-0 rounded-md overflow-hidden">
                    <div className={`absolute inset-0 transition-all duration-300 ${
                      activeTab === 'history' 
                        ? 'opacity-100 bg-gradient-to-r from-[hsl(var(--color-profit))] to-[hsl(var(--color-profit)/0.8)]' 
                        : 'opacity-0'
                    }`} />
                    {/* Shimmer effect on active */}
                    {activeTab === 'history' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[tabShimmer_3s_ease-in-out_infinite]" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <BarChart3 className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                    activeTab === 'history' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
                  }`} />
                  <span className={`font-medium relative z-10 transition-all duration-300 ${
                    activeTab === 'history' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
                  }`}>
                    分析
                  </span>
                  
                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-md opacity-0 group-hover/tab:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 bg-[hsl(var(--color-profit)/0.1)] rounded-md" />
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>
        
        <TabsContent value="sessions" className="flex-1 mt-0 min-h-0">
          {/* Session List */}
          <SimpleScrollArea className="h-full chat-scrollbar">
        <div className="space-y-4 pb-4">
          {sortedSessions.length === 0 ? (
            <div className="text-center py-12 px-4 fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl premium-glass-subtle flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[hsl(var(--text-muted))]" />
              </div>
              <p className="text-[hsl(var(--text-secondary))] text-sm font-medium mb-1">まだ会話がありません</p>
              <p className="text-[hsl(var(--text-muted))] text-xs leading-relaxed">新しいチャットを始めましょう</p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([group, groupSessions]) => (
              <div key={group} className="space-y-1">
                <div className="text-xs font-semibold text-[hsl(var(--text-muted))] px-3 py-2 flex items-center gap-2 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-[hsl(var(--text-disabled))]" />
                  <span>{group}</span>
                </div>
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'group relative transition-all duration-[var(--transition-normal)] rounded-lg session-item',
                      currentSessionId === session.id && 'premium-glass-subtle shadow-sm'
                    )}
                    onMouseEnter={() => setHoveredSessionId(session.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                  >
                    {editingSessionId === session.id ? (
                      <div className="px-3 py-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveRename()
                            } else if (e.key === 'Escape') {
                              handleCancelRename()
                            }
                          }}
                          onBlur={handleSaveRename}
                          className="text-sm h-9 bg-[hsl(var(--color-secondary))] border-[hsl(var(--border))] text-[hsl(var(--text-primary))] focus:border-[hsl(var(--color-accent)/0.5)] focus-ring"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "group w-full text-left px-3 py-3 cursor-pointer rounded-lg interactive focus-ring",
                          currentSessionId === session.id
                            ? 'premium-glass-subtle'
                            : 'hover:bg-[hsl(var(--color-secondary)/0.4)]'
                        )}
                        onClick={() => {
                          switchSession(session.id)
                          onSessionSelect?.()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            switchSession(session.id)
                            onSessionSelect?.(session.id)
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-4 h-4 flex-shrink-0 transition-colors duration-[var(--transition-normal)]",
                            currentSessionId === session.id ? 'text-[hsl(var(--color-accent))]' : 'text-[hsl(var(--text-muted))]'
                          )}>
                            <MessageSquare className="w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[var(--font-sm)] truncate transition-colors leading-[var(--leading-tight)]",
                              currentSessionId === session.id ? 'text-[hsl(var(--text-primary))] font-semibold' : 'text-[hsl(var(--text-secondary))]'
                            )}>
                              {session.title}
                            </p>
                            {messagesBySession[session.id] && messagesBySession[session.id].length > 0 && (
                              <p className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] truncate mt-1 leading-[var(--leading-tight)]">
                                {messagesBySession[session.id].length} メッセージ
                              </p>
                            )}
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 transition-all duration-300",
                            hoveredSessionId === session.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
                          )}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRename(session.id, session.title)
                              }}
                              className="h-7 w-7 p-0 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--color-secondary)/0.6)] rounded-md interactive"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(session.id)
                              }}
                              className="h-7 w-7 p-0 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-loss))] hover:bg-[hsl(var(--color-loss)/0.1)] rounded-md interactive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </SimpleScrollArea>
        </TabsContent>
        
        <TabsContent value="history" className="flex-1 mt-0 min-h-0 h-full overflow-hidden p-0 flex flex-col">
          <AnalysisHistoryPanel />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[hsl(var(--border))] p-3 bg-gradient-to-t from-[hsl(var(--color-base))] to-transparent space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--color-secondary)/0.4)] h-10 font-medium interactive"
        >
          <Archive className="w-4 h-4 text-[hsl(var(--text-disabled))]" />
          <span className="text-sm tracking-wide">アーカイブ済み</span>
        </Button>
        
        {/* Settings Button with Clear All */}
        <Button
          variant="ghost"
          onClick={() => setClearAllDialogOpen(true)}
          className="w-full justify-start gap-3 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--color-loss))] hover:bg-[hsl(var(--color-loss)/0.1)] h-10 font-medium interactive transition-colors"
        >
          <Trash className="w-4 h-4" />
          <span className="text-sm tracking-wide">すべての会話を削除</span>
        </Button>
      </div>

      {/* Clear All Confirmation Modal */}
      <Dialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <DialogContent className="max-w-md premium-glass border border-[hsl(var(--border)/0.5)] bg-gradient-to-b from-[hsl(var(--color-secondary)/0.8)] to-[hsl(var(--color-base)/0.9)]">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[hsl(var(--color-loss)/0.2)] to-[hsl(var(--color-loss)/0.1)] border border-[hsl(var(--color-loss)/0.3)]">
              <AlertTriangle className="w-6 h-6 text-[hsl(var(--color-loss))]" />
            </div>
            <DialogTitle className="text-center text-[hsl(var(--text-primary))] text-lg font-semibold">
              すべての会話を削除
            </DialogTitle>
            <DialogDescription className="text-center text-[hsl(var(--text-secondary))] text-sm leading-relaxed">
              すべての会話を削除してもよろしいですか？
              <br />
              <span className="text-[hsl(var(--text-muted))] text-xs">
                この操作は取り消すことができません。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setClearAllDialogOpen(false)}
              className="w-full sm:w-auto h-10 px-6 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--color-secondary)/0.6)] border border-[hsl(var(--border)/0.5)] rounded-md interactive"
            >
              キャンセル
            </Button>
            <Button
              onClick={() => {
                deleteAllSessions()
                setClearAllDialogOpen(false)
              }}
              className="w-full sm:w-auto h-10 px-6 bg-gradient-to-r from-[hsl(var(--color-loss))] to-[hsl(var(--color-loss)/0.8)] hover:from-[hsl(var(--color-loss)/0.9)] hover:to-[hsl(var(--color-loss)/0.7)] text-white font-medium rounded-md interactive transition-all duration-[var(--transition-normal)]"
            >
              すべて削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md premium-glass border border-[hsl(var(--border)/0.5)] bg-gradient-to-b from-[hsl(var(--color-secondary)/0.8)] to-[hsl(var(--color-base)/0.9)]">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[hsl(var(--color-loss)/0.2)] to-[hsl(var(--color-loss)/0.1)] border border-[hsl(var(--color-loss)/0.3)]">
              <AlertTriangle className="w-6 h-6 text-[hsl(var(--color-loss))]" />
            </div>
            <DialogTitle className="text-center text-[hsl(var(--text-primary))] text-lg font-semibold">
              会話を削除
            </DialogTitle>
            <DialogDescription className="text-center text-[hsl(var(--text-secondary))] text-sm leading-relaxed">
              この会話を削除してもよろしいですか？
              <br />
              <span className="text-[hsl(var(--text-muted))] text-xs">
                削除された会話は復元できません。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-2 pt-2">
            <Button
              variant="ghost"
              onClick={cancelDelete}
              className="w-full sm:w-auto h-10 px-6 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--color-secondary)/0.6)] border border-[hsl(var(--border)/0.5)] rounded-md interactive"
            >
              キャンセル
            </Button>
            <Button
              onClick={confirmDelete}
              className="w-full sm:w-auto h-10 px-6 bg-gradient-to-r from-[hsl(var(--color-loss))] to-[hsl(var(--color-loss)/0.8)] hover:from-[hsl(var(--color-loss)/0.9)] hover:to-[hsl(var(--color-loss)/0.7)] text-white font-medium rounded-md interactive transition-all duration-[var(--transition-normal)]"
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

