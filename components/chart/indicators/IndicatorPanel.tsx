'use client'

import { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IndicatorPanelProps {
  title: string
  height: number | "auto"
  className?: string
  onClose?: () => void
  /**
   * コンテナがマウントされた後に呼び出されるチャート初期化関数
   * 戻り値はクリーンアップ関数
   */
  initChart?: (container: HTMLDivElement) => () => void
  children?: React.ReactNode
  'data-testid'?: string
}

export default function IndicatorPanel({
  title,
  height,
  className,
  onClose,
  initChart,
  children,
  'data-testid': dataTestId
}: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !initChart) return
    return initChart(containerRef.current)
  }, [initChart])

  return (
    <div
      className={cn('w-full premium-glass-subtle border-t border-[hsl(var(--border))] flex flex-col overflow-hidden', className)}
      style={height === "auto" ? { height: '100%' } : { height }}
      data-testid={dataTestId || `${title.toLowerCase()}-panel`}
    >
      <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)] border-b border-[hsl(var(--border))] bg-[hsl(var(--glass-bg))]">
        <span className="text-[var(--font-sm)] font-semibold text-[hsl(var(--text-primary))] tracking-wide">{title}</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--glass-bg))] rounded p-[var(--space-xs)] transition-all duration-[var(--transition-fast)]"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        </div>
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden bg-[hsl(var(--color-base))]"
      >
        {children}
      </div>
    </div>
  )
}