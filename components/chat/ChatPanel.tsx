'use client'

import React, { useEffect, useState } from 'react'
import { MessageSquare, BarChart3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useChat } from '@/store/chat.store'
import { useAIChat } from '@/hooks/use-ai-chat'
import { SessionAnalysisHistory } from './SessionAnalysisHistory'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useMessageHandling } from '@/hooks/chat/use-message-handling'
import { useProposalManagement } from '@/hooks/chat/use-proposal-management'
import { FullHeightLayout } from '@/components/layout/FullHeightLayout'
import { logger } from '@/lib/utils/logger'

export default function ChatPanel() {
  const { 
    sessions,
    currentSessionId,
    messages, 
    inputValue, 
    isInputFromHomeScreen,
    isStreaming, 
    isLoading,
    setInputValue,
    createSession,
    error
  } = useChat()
  
  const { isReady } = useAIChat()
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat')
  const [showTabs, setShowTabs] = useState(false)
  const [historyResetKey, setHistoryResetKey] = useState(0)
  
  // Custom hooks for separated logic
  const {
    handleSendMessage,
    handleCopyMessage,
    handleAnalysisComplete,
    copiedMessageId,
    analysisInProgress
  } = useMessageHandling()
  
  const {
    approvedDrawingIds,
    handleApproveProposal,
    handleRejectProposal,
    handleApproveAllProposals,
    handleRejectAllProposals,
    handleCancelDrawing
  } = useProposalManagement()

  // Auto-send message if inputValue is set from home screen
  const [hasAutoSent, setHasAutoSent] = useState(false)

  useEffect(() => {
    if (isInputFromHomeScreen && inputValue && !hasAutoSent && isReady) {
      logger.info('[ChatPanel] Auto-sending message from home screen', { inputValue })
      setHasAutoSent(true)
      handleSendMessage()
    }
  }, [isInputFromHomeScreen, inputValue, hasAutoSent, isReady, handleSendMessage])

  const currentSession = sessions[currentSessionId || '']
  const sessionTitle = currentSession?.title || 'Trading Assistant'

  // Tab header component
  const TabHeader = (
    <div 
      className="relative group flex-shrink-0"
      onMouseEnter={() => setShowTabs(true)}
      onMouseLeave={() => setShowTabs(false)}
    >
      {/* Hover trigger area */}
      <div className="absolute inset-x-0 -top-2 h-8 z-10" />
      
      {/* Minimal line indicator with glow effect */}
      <div className="relative h-[2px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--border))] to-transparent" />
        <div 
          className="absolute h-full transition-all duration-500 ease-out"
          style={{
            left: activeTab === 'chat' ? '0%' : '50%',
            width: '50%'
          }}
        >
          <div className="absolute inset-0 bg-[hsl(var(--color-accent))] blur-md opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))]" />
        </div>
      </div>
      
      {/* Expandable tabs */}
      <div 
        className={`absolute top-0 left-0 right-0 z-20 transition-all duration-300 ease-out ${
          showTabs 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div className="premium-glass border-b border-[hsl(var(--border)/0.5)] backdrop-blur-xl">
          <TabsList className="w-full grid grid-cols-2 bg-transparent rounded-none h-12 p-1 gap-1">
            <TabsTrigger 
              value="chat" 
              className="relative flex items-center justify-center gap-2.5 text-sm rounded-lg transition-all duration-300 group/tab data-[state=active]:text-white hover:bg-[hsl(var(--color-secondary)/0.3)]"
            >
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className={`absolute inset-0 transition-all duration-300 ${
                  activeTab === 'chat' 
                    ? 'opacity-100 bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-accent)/0.8)]' 
                    : 'opacity-0'
                }`} />
                {activeTab === 'chat' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[tabShimmer_3s_ease-in-out_infinite]" />
                )}
              </div>
              <MessageSquare className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                activeTab === 'chat' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
              }`} />
              <span className={`font-medium relative z-10 transition-all duration-300 ${
                activeTab === 'chat' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
              }`}>
                会話
              </span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="history" 
              className="relative flex items-center justify-center gap-2.5 text-sm rounded-lg transition-all duration-300 group/tab data-[state=active]:text-white hover:bg-[hsl(var(--color-secondary)/0.3)]"
            >
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className={`absolute inset-0 transition-all duration-300 ${
                  activeTab === 'history' 
                    ? 'opacity-100 bg-gradient-to-r from-[hsl(var(--color-profit))] to-[hsl(var(--color-profit)/0.8)]' 
                    : 'opacity-0'
                }`} />
                {activeTab === 'history' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[tabShimmer_3s_ease-in-out_infinite]" />
                )}
              </div>
              <BarChart3 className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                activeTab === 'history' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
              }`} />
              <span className={`font-medium relative z-10 transition-all duration-300 ${
                activeTab === 'history' ? 'text-white' : 'text-[hsl(var(--text-secondary))]'
              }`}>
                分析
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
    </div>
  )

  return (
    <Tabs value={activeTab} onValueChange={(v) => {
      const val = v as 'chat' | 'history'
      setActiveTab(val)
      if (val === 'history') {
        setHistoryResetKey(k => k + 1)
      }
    }} className="flex flex-col h-full bg-[hsl(var(--color-base))] overflow-hidden">
      {TabHeader}
      
      {/* Chat Tab Content */}
      <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          error={error}
          copiedMessageId={copiedMessageId}
          analysisInProgress={analysisInProgress}
          approvedDrawingIds={approvedDrawingIds}
          onCopyMessage={handleCopyMessage}
          onApproveProposal={handleApproveProposal}
          onRejectProposal={handleRejectProposal}
          onApproveAllProposals={handleApproveAllProposals}
          onRejectAllProposals={handleRejectAllProposals}
          onCancelDrawing={handleCancelDrawing}
          onAnalysisComplete={handleAnalysisComplete}
        />
        
        <div className="flex-shrink-0">
          <MessageInput
            value={inputValue}
            onChange={(value) => setInputValue(value, false)}
            onSend={handleSendMessage}
            isLoading={isLoading}
            isReady={isReady}
          />
        </div>
      </TabsContent>
      
      {/* History Tab Content */}
      <TabsContent 
        value="history" 
        className="flex-1 min-h-0 overflow-hidden mt-0 p-0 data-[state=inactive]:hidden" 
        forceMount
      >
        {currentSessionId && (
          <SessionAnalysisHistory sessionId={currentSessionId} resetKey={historyResetKey} />
        )}
      </TabsContent>
    </Tabs>
  )
}