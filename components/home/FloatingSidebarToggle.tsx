'use client'

import { motion } from 'framer-motion'
import { PanelLeft, History, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import ChatSidebar from '@/components/chat/ChatSidebar'
import { useChat } from '@/store/chat.store'

interface FloatingSidebarToggleProps {
  className?: string
  onTransitionToChat?: () => void
}

export function FloatingSidebarToggle({ className, onTransitionToChat }: FloatingSidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)
  const { selectSession } = useChat()
  
  const handleSessionSelect = (sessionId?: string) => {
    if (sessionId) {
      selectSession(sessionId)
    }
    setIsOpen(false)
    onTransitionToChat?.()
  }

  return (
    <>
      {/* Floating Button */}
      <motion.div
        className={cn(
          "fixed left-4 top-4 z-50",
          className
        )}
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          delay: 0.5 
        }}
      >
        <div className="flex flex-col gap-2">
          {/* Main Toggle Button */}
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            onMouseEnter={() => setHoveredButton('toggle')}
            onMouseLeave={() => setHoveredButton(null)}
            className={cn(
              "relative group w-12 h-12 rounded-xl",
              "bg-gradient-to-br from-gray-900/90 to-gray-800/90",
              "border border-gray-700/50",
              "backdrop-blur-xl shadow-lg",
              "hover:shadow-xl hover:border-gray-600/50",
              "transition-all duration-200"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PanelLeft className={cn(
              "w-5 h-5 text-gray-400 group-hover:text-gray-200",
              "transition-all duration-200",
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              isOpen && "rotate-180"
            )} />
            
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:to-purple-500/10 transition-all duration-300" />
            
            {/* Tooltip */}
            {hoveredButton === 'toggle' && !isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap"
              >
                <div className="bg-gray-900/95 backdrop-blur-sm text-gray-200 text-xs px-3 py-1.5 rounded-lg border border-gray-700/50 shadow-lg">
                  チャット
                </div>
              </motion.div>
            )}
          </motion.button>

          {/* Quick Access Buttons */}
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col gap-2"
            >
              {/* History Button */}
              <motion.button
                onMouseEnter={() => setHoveredButton('history')}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => setIsOpen(true)}
                className={cn(
                  "relative group w-12 h-12 rounded-xl",
                  "bg-gray-900/80 border border-gray-800/50",
                  "hover:bg-gray-800/80 hover:border-gray-700/50",
                  "transition-all duration-200"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <History className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                
                {hoveredButton === 'history' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap"
                  >
                    <div className="bg-gray-900/95 backdrop-blur-sm text-gray-200 text-xs px-3 py-1.5 rounded-lg border border-gray-700/50 shadow-lg">
                      分析記録
                    </div>
                  </motion.div>
                )}
              </motion.button>

              {/* New Chat Button */}
              <motion.button
                onMouseEnter={() => setHoveredButton('new')}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => setIsOpen(true)}
                className={cn(
                  "relative group w-12 h-12 rounded-xl",
                  "bg-gray-900/80 border border-gray-800/50",
                  "hover:bg-gray-800/80 hover:border-gray-700/50",
                  "transition-all duration-200"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MessageSquare className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                
                {hoveredButton === 'new' && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap"
                  >
                    <div className="bg-gray-900/95 backdrop-blur-sm text-gray-200 text-xs px-3 py-1.5 rounded-lg border border-gray-700/50 shadow-lg">
                      新規チャット
                    </div>
                  </motion.div>
                )}
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30 
        }}
        className="fixed left-0 top-0 bottom-0 w-80 z-50 bg-gray-950 border-r border-gray-800"
      >
        <ChatSidebar onSessionSelect={handleSessionSelect} />
      </motion.div>
    </>
  )
}