'use client'

import { cn } from '@/lib/utils'
import React from 'react'

interface FullHeightLayoutProps {
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerClassName?: string
  footerClassName?: string
  contentClassName?: string
}

/**
 * A reusable layout component that provides a full-height flex container
 * with optional header and footer sections that don't scroll.
 * The main content area fills the remaining space and can scroll if needed.
 */
export function FullHeightLayout({
  header,
  footer,
  children,
  className,
  headerClassName,
  footerClassName,
  contentClassName
}: FullHeightLayoutProps) {
  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)}>
      {header && (
        <div className={cn("flex-shrink-0", headerClassName)}>
          {header}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 overflow-hidden", contentClassName)}>
        {children}
      </div>
      {footer && (
        <div className={cn("flex-shrink-0", footerClassName)}>
          {footer}
        </div>
      )}
    </div>
  )
}