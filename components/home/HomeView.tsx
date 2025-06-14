'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, TrendingUp, LineChart, MessageCircle } from 'lucide-react'
import { useChat } from '@/store/chat.store'
import { useAIChat } from '@/hooks/use-ai-chat'
import { FloatingSidebarToggle } from './FloatingSidebarToggle'

interface HomeViewProps {
  onTransitionComplete?: () => void
}

const SUGGESTION_PROMPTS = [
  { icon: TrendingUp, text: 'BTCの価格動向を分析して', color: 'from-orange-500 to-pink-500' },
  { icon: LineChart, text: 'チャートにトレンドラインを描いて', color: 'from-blue-500 to-cyan-500' },
  { icon: MessageCircle, text: 'ETHの投資戦略を教えて', color: 'from-purple-500 to-pink-500' },
]

export function HomeView({ onTransitionComplete }: HomeViewProps) {
  const [inputValue, setInputValue] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 })
  const [showExamples, setShowExamples] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { createSession, setInputValue: setChatInput, currentSessionId } = useChat()
  const { send: sendAIMessage, isReady } = useAIChat()

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus()
  }, [])

  // Handle wheel event to show/hide examples
  useEffect(() => {
    let scrollAccumulator = 0
    const threshold = 100 // Amount of scroll needed to trigger

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      scrollAccumulator += e.deltaY
      
      // Show examples when scrolling down
      if (scrollAccumulator > threshold && !showExamples) {
        setShowExamples(true)
        scrollAccumulator = 0
      }
      // Hide examples when scrolling up
      else if (scrollAccumulator < -threshold && showExamples) {
        setShowExamples(false)
        scrollAccumulator = 0
      }
      
      // Reset accumulator if it gets too large
      if (Math.abs(scrollAccumulator) > threshold * 2) {
        scrollAccumulator = 0
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [showExamples])

  // Track mouse movement
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMousePosition({ x, y })
  }, [])

  const handleSubmit = async () => {
    if (!inputValue.trim() || !isReady || isTransitioning) return

    setIsTransitioning(true)
    const message = inputValue.trim()
    
    // Clear input immediately after capturing the value
    setInputValue('')
    
    // Only create new session if there's no current session
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = createSession()
    }
    
    // Set the input value in chat store with home screen flag
    setChatInput(message, true)
    
    // Trigger transition
    setTimeout(() => {
      onTransitionComplete?.()
      // Send message after transition starts
      setTimeout(() => {
        sendAIMessage(message)
      }, 300)
    }, 100)
  }

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt)
    setTimeout(() => {
      inputRef.current?.focus()
      // Move cursor to end
      if (inputRef.current) {
        const length = inputRef.current.value.length
        inputRef.current.setSelectionRange(length, length)
      }
    }, 10)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[hsl(var(--color-base))]">
      {/* Fixed Hero Section */}
      <motion.div 
        className="fixed inset-0 w-full h-screen flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onMouseMove={handleMouseMove}
      >
        {/* Floating Sidebar Toggle */}
        <FloatingSidebarToggle onTransitionToChat={onTransitionComplete} />
        
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--color-base))] via-[hsl(var(--color-base)/0.8)] to-[hsl(var(--color-base))]" />
          
          {/* Mouse-following gradient */}
          <motion.div 
            className="absolute inset-0 opacity-30 pointer-events-none"
            animate={{
              background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, hsl(var(--color-accent)) 0%, transparent 40%)`
            }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
          />
          
          {/* Additional animated gradient for depth */}
          <motion.div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            animate={{
              background: [
                `radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, hsl(var(--color-profit)) 0%, transparent 60%)`,
                `radial-gradient(circle at ${mousePosition.x}% ${100 - mousePosition.y}%, hsl(var(--color-profit)) 0%, transparent 60%)`,
                `radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, hsl(var(--color-profit)) 0%, transparent 60%)`,
              ]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Main Content */}
        <motion.div 
          className="relative z-10 w-full max-w-4xl px-6"
          animate={{
            scale: showExamples ? 0.9 : 1,
            y: showExamples ? -50 : 0,
            opacity: showExamples ? 0.7 : 1
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center mb-4">
              <motion.div
                className="relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-16 h-16 text-[hsl(var(--color-accent))]" />
              </motion.div>
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[hsl(var(--text-primary))] to-[hsl(var(--color-accent))] bg-clip-text text-transparent">
              Cryptrade
            </h1>
            <p className="text-xl text-[hsl(var(--text-secondary))]">
              暗号通貨の分析、チャート描画、投資戦略をAIがサポート
            </p>
          </motion.div>

          {/* Input Container */}
          <motion.div
            layoutId="chat-input"
            className="relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <motion.div 
              className="relative premium-glass rounded-2xl p-1 shadow-2xl"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <div className="relative flex items-end gap-2 p-4">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="何でも聞いてください..."
                  className="flex-1 resize-none bg-transparent text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-muted))] text-lg focus:outline-none min-h-[60px] max-h-[200px]"
                  rows={1}
                  disabled={isTransitioning}
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'hsl(var(--border)) transparent'
                  }}
                  onInput={(e) => {
                    // Auto-resize
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  }}
                />
                <motion.button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || !isReady || isTransitioning}
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] hover:from-[hsl(var(--color-profit))] hover:to-[hsl(var(--color-accent))] disabled:from-[hsl(var(--text-disabled))] disabled:to-[hsl(var(--text-disabled))] disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>

          {/* Suggestions */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-8 flex flex-wrap gap-3 justify-center"
          >
            {SUGGESTION_PROMPTS.map((prompt, index) => (
              <motion.button
                key={index}
                onClick={() => handleSuggestionClick(prompt.text)}
                className="group relative overflow-hidden rounded-full px-6 py-3 premium-glass-subtle border border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--border))] transition-all duration-200"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${prompt.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`} />
                <div className="relative flex items-center gap-2">
                  <prompt.icon className="w-4 h-4 text-[hsl(var(--text-secondary))] group-hover:text-[hsl(var(--text-primary))] transition-colors" />
                  <span className="text-sm text-[hsl(var(--text-secondary))] group-hover:text-[hsl(var(--text-primary))] transition-colors">
                    {prompt.text}
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>

          {/* Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center"
          >
            <div className="flex items-center justify-center gap-2 text-sm text-[hsl(var(--text-muted))]">
              <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-[hsl(var(--color-accent))]' : 'bg-[hsl(var(--color-warning))]'} animate-pulse`} />
              {isReady ? 'AI準備完了' : 'AI接続中...'}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Examples Overlay - Fixed position */}
      <AnimatePresence>
        {showExamples && (
          <motion.div 
            className="fixed inset-0 pointer-events-none z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Gradient overlay */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--color-base)/0.95)] via-[hsl(var(--color-base)/0.8)] to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
            
            {/* Example Cards Container */}
            <motion.div 
              className="absolute bottom-0 left-0 right-0 max-w-6xl mx-auto px-6 pb-10 pointer-events-auto"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Example Cards - Three Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Trend Line Analysis */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    setInputValue('BTCのトレンドラインを描いて')
                    setShowExamples(false)
                  }}
                >
                  <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-800 hover:border-cyan-700 transition-all duration-300">
                    {/* Chart Preview */}
                    <div className="relative h-40 bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 relative">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <motion.path
                              d="M 10,70 Q 30,30 50,40 T 90,20"
                              fill="none"
                              stroke="url(#gradient1)"
                              strokeWidth="2"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 2, delay: 0.5 }}
                            />
                            <motion.path
                              d="M 10,80 L 90,30"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="1.5"
                              strokeDasharray="4"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1.5, delay: 0.8 }}
                            />
                            <defs>
                              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#06b6d4" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">トレンドライン自動描画</h3>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed mb-4">
                        AIが最適なトレンドラインを自動で描画。過去データから重要ポイントを検出
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400">
                          精度92%
                        </span>
                        <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-400">
                          自動検出
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Support/Resistance */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    setInputValue('ETHのサポート・レジスタンスを表示して')
                    setShowExamples(false)
                  }}
                >
                  <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-700 transition-all duration-300">
                    {/* Chart Preview */}
                    <div className="relative h-40 bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 relative">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <motion.line
                              x1="10" y1="30" x2="90" y2="30"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="5"
                              initial={{ opacity: 0, x1: 50, x2: 50 }}
                              animate={{ opacity: 1, x1: 10, x2: 90 }}
                              transition={{ duration: 1, delay: 0.5 }}
                            />
                            <motion.line
                              x1="10" y1="70" x2="90" y2="70"
                              stroke="#10b981"
                              strokeWidth="2"
                              strokeDasharray="5"
                              initial={{ opacity: 0, x1: 50, x2: 50 }}
                              animate={{ opacity: 1, x1: 10, x2: 90 }}
                              transition={{ duration: 1, delay: 0.7 }}
                            />
                            {[20, 35, 50, 65, 80].map((x, i) => (
                              <motion.rect
                                key={i}
                                x={x - 2}
                                y={40 - i * 5}
                                width="4"
                                height={20 + i * 3}
                                fill="#6b7280"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 0.6, height: 20 + i * 3 }}
                                transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
                              />
                            ))}
                          </svg>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                          <LineChart className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">重要価格帯の検出</h3>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed mb-4">
                        過去の反発ポイントからサポート・レジスタンスを自動検出
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400">
                          $3,850
                        </span>
                        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                          $3,420
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card 3: Pattern Recognition */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    setInputValue('チャートパターンを分析して')
                    setShowExamples(false)
                  }}
                >
                  <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-800 hover:border-green-700 transition-all duration-300">
                    {/* Chart Preview */}
                    <div className="relative h-40 bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 relative">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            {/* Triangle pattern */}
                            <motion.path
                              d="M 20,70 L 50,30 L 80,70 Z"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1.5, delay: 0.5 }}
                            />
                            {/* Pattern lines */}
                            <motion.line
                              x1="20" y1="50" x2="65" y2="50"
                              stroke="#10b981"
                              strokeWidth="1"
                              strokeDasharray="3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.6 }}
                              transition={{ duration: 1, delay: 0.8 }}
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-green-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">パターン認識</h3>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed mb-4">
                        23種類のチャートパターンをAIが自動で検出・分析
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                          AI分析
                        </span>
                        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400">
                          23種類
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Scroll hint */}
              <motion.div 
                className="text-center mt-4 text-sm text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span>上にスクロールして戻る</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}