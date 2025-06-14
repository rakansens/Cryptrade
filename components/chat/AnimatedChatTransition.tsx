'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { HomeView } from '@/components/home/HomeView'
import ChatLayout from './ChatLayout'
import { MainLayout } from '@/components/MainLayout'
import { useChat } from '@/store/chat.store'
import { useViewPersistence } from '@/hooks/use-view-persistence-simple'

export function AnimatedChatTransition() {
  const { sessions, currentSessionId } = useChat()
  const { showHome, isClient, goToChat, goToHome } = useViewPersistence()

  const handleTransitionToChat = () => {
    goToChat()
  }

  const handleReturnToHome = () => {
    goToHome()
  }

  // Expose the return function globally for child components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { __returnToHome?: () => void }).__returnToHome = handleReturnToHome
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { __returnToHome?: () => void }).__returnToHome
      }
    }
  }, [])

  // Prevent hydration mismatch by showing loading state until client is ready
  if (!isClient) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-[hsl(var(--color-base))] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[hsl(var(--text-secondary))]">
          <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-[hsl(var(--color-accent))] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  return (
    <LayoutGroup>
      <div className="relative w-full h-screen overflow-hidden bg-[hsl(var(--color-base))]">
        <AnimatePresence mode="wait">
          {showHome ? (
            <motion.div
              key="home"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ 
                opacity: 0,
                scale: 0.95,
                transition: { duration: 0.4, ease: "easeInOut" }
              }}
            >
              <HomeView onTransitionComplete={handleTransitionToChat} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            >
              <MainLayout>
                <motion.div
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ 
                    duration: 0.6, 
                    ease: [0.25, 0.1, 0.25, 1],
                    delay: 0.3
                  }}
                  className="h-full"
                >
                  <ChatLayout className="h-full" />
                </motion.div>
              </MainLayout>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transition Effects Layer */}
        <AnimatePresence>
          {!showHome && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="absolute inset-0"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              >
                <div className="w-full h-full bg-gradient-to-r from-transparent via-[hsl(var(--color-accent)/0.2)] to-transparent skew-x-12" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  )
}