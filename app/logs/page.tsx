'use client'

import { useState, useEffect } from 'react'
import { LogViewer } from '@/components/logs/LogViewer'

export default function LogsPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--color-base))] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-2">
            システムログ管理
          </h1>
          <p className="text-[hsl(var(--text-secondary))]">
            アプリケーションのログを監視・分析できます
          </p>
        </div>
        
        <LogViewer />
      </div>
    </div>
  )
}