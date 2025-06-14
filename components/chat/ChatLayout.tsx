'use client'

import { useState, useEffect, useMemo } from 'react'
import { PanelLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChatSidebar from './ChatSidebar'
import ChatPanel from './ChatPanel'
import { cn } from '@/lib/utils'
import { useLineTracking, usePriceStream } from '@/hooks/use-line-tracking'
import { ConnectionStatus } from './ConnectionStatus'

interface ChatLayoutProps {
  className?: string
}

export default function ChatLayout({ className }: ChatLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Enable line tracking for approved proposals
  const { activeRecords } = useLineTracking()
  
  // Enable real-time price streaming for active symbols
  const activeSymbols = useMemo(
    () => [...new Set(activeRecords.map(r => r.symbol))],
    [activeRecords]
  )
  usePriceStream(activeSymbols)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className={cn("h-full flex relative bg-gray-950", className)}>
      {/* Overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-[var(--transition-normal)] ease-[var(--easing)] border-r border-[hsl(var(--border))] flex-shrink-0",
          isMobile 
            ? cn("fixed inset-y-0 left-0 z-[var(--z-modal)]", isSidebarOpen ? "w-80" : "w-0")
            : isSidebarOpen ? "w-64" : "w-0",
          !isSidebarOpen && "overflow-hidden"
        )}
      >
        <div className={cn("h-full overflow-hidden", isMobile ? "w-80" : "w-64")}>
          <ChatSidebar onSessionSelect={() => isMobile && setIsSidebarOpen(false)} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header with toggle button */}
        <div className="h-16 border-b border-[hsl(var(--border))] flex items-center px-[var(--space-lg)] premium-glass">
          <div className="relative group">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "relative group w-12 h-12 p-0 rounded-xl",
                "bg-gradient-to-br from-gray-900/90 to-gray-800/90",
                "border border-gray-700/50",
                "backdrop-blur-xl shadow-lg",
                "hover:shadow-xl hover:border-gray-600/50",
                "transition-all duration-200"
              )}
              title={isSidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
            >
              <PanelLeft className={cn(
                "w-5 h-5 text-gray-400 group-hover:text-gray-200",
                "transition-all duration-200",
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                isSidebarOpen && "rotate-180"
              )} />
              
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:to-purple-500/10 transition-all duration-300" />
            </Button>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-green-400" />
            </div>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300">
              AI Trading Assistant
            </h1>
          </div>
          <div className="ml-auto">
            <ConnectionStatus />
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}