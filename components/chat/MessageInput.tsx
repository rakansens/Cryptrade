'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isLoading: boolean
  isReady: boolean
  placeholder?: string
}

export function MessageInput({
  value,
  onChange,
  onSend,
  isLoading,
  isReady,
  placeholder = "メッセージ入力..."
}: MessageInputProps) {
  const [isComposing, setIsComposing] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換中（isComposing）はEnterキーでの送信を無効化
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      onSend()
    }
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    // Auto-resize textarea
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 200) + 'px'
  }

  return (
    <div className="flex-shrink-0 p-[var(--space-md)] border-t border-[hsl(var(--border))] bg-[hsl(var(--color-base))]">
      <div className="relative premium-glass rounded-2xl p-1 shadow-2xl">
        <div className="relative flex items-end gap-2 p-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-muted))] text-lg focus:outline-none min-h-[60px] max-h-[200px]"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--border)) transparent'
            }}
            onInput={handleInput}
          />
          <Button
            onClick={onSend}
            disabled={!value.trim() || isLoading || !isReady}
            size="sm"
            className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r from-[hsl(var(--color-accent))] to-[hsl(var(--color-profit))] hover:from-[hsl(var(--color-profit))] hover:to-[hsl(var(--color-accent))] disabled:from-[hsl(var(--text-disabled))] disabled:to-[hsl(var(--text-disabled))] disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg"
          >
            <Send className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-1 text-[var(--font-xs)] text-[hsl(var(--text-muted))] flex items-center gap-[var(--space-sm)]">
        <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-[hsl(var(--color-accent))]' : 'bg-[hsl(var(--color-warning))]'} ${isReady ? 'animate-pulse' : 'animate-pulse'}`} />
        {isReady ? 'AI準備完了' : 'AI接続中...'}
        {isLoading && (
          <>
            <span className="text-[hsl(var(--text-disabled))]">•</span>
            <span className="loading-shimmer">分析中...</span>
          </>
        )}
      </div>
    </div>
  )
}