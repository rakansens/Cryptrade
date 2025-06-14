'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConnectionStatusProps {
  className?: string
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [status, setStatus] = useState({
    connected: false,
    subscribedSymbols: new Set<string>(),
    lastUpdate: 0,
    reconnectCount: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    const checkConnection = async () => {
      try {
        // Dynamically import the WebSocket manager
        const { binanceWS } = await import('@/lib/binance/websocket-manager')
        const currentStatus = binanceWS.getStatus()
        setStatus(currentStatus)
        setIsLoading(false)
      } catch (error) {
        console.warn('WebSocket manager not available')
        setIsLoading(false)
      }
    }

    // Check status immediately
    checkConnection()

    // Check status every 5 seconds
    intervalId = setInterval(checkConnection, 5000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [])

  if (isLoading) {
    return null
  }

  const timeSinceUpdate = Date.now() - status.lastUpdate
  const isStale = timeSinceUpdate > 30000 // 30 seconds

  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <div className="flex items-center gap-1.5">
        {status.connected && !isStale ? (
          <div className="flex items-center gap-1 text-green-400">
            <div className="relative">
              <Wifi className="w-3 h-3" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="font-medium">リアルタイム</span>
          </div>
        ) : status.connected && isStale ? (
          <div className="flex items-center gap-1 text-yellow-400">
            <Activity className="w-3 h-3" />
            <span className="font-medium">接続中</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-400">
            <WifiOff className="w-3 h-3" />
            <span className="font-medium">オフライン</span>
          </div>
        )}
      </div>
      
      {status.subscribedSymbols.size > 0 && (
        <div className="text-gray-500">
          {status.subscribedSymbols.size}シンボル
        </div>
      )}
      
      {status.reconnectCount > 0 && (
        <div className="text-orange-400 text-xs">
          再接続 {status.reconnectCount}回
        </div>
      )}
    </div>
  )
}