'use client'

import React, { memo, useMemo, useEffect, useState } from 'react'
import { usePriceStream } from '@/hooks/market/use-price-stream'
import { useMarketTicker } from '@/hooks/market/use-market-stats'
import { cn } from '@/lib/utils'

interface PriceDisplayProps {
  symbol: string
  symbolName: string
}

const PriceDisplay = memo(function PriceDisplay({ symbol, symbolName }: PriceDisplayProps) {
  const { currentPrice, change, changePercent, isConnected } = usePriceStream(symbol)
  const { high24h, low24h, volume } = useMarketTicker(symbol)
  const [prevPrice, setPrevPrice] = useState(currentPrice)
  const [priceAnimation, setPriceAnimation] = useState(false)

  const formattedPrice = useMemo(() => {
    return currentPrice > 0 ? currentPrice.toFixed(2) : '---'
  }, [currentPrice])

  const formattedChange = useMemo(() => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}`
  }, [change])

  const formattedChangePercent = useMemo(() => {
    const sign = changePercent >= 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(2)}%`
  }, [changePercent])

  const priceColor = useMemo(() => {
    return change >= 0 ? 'text-[hsl(var(--color-profit))]' : 'text-[hsl(var(--color-loss))]'
  }, [change])

  // Trigger animation when price changes
  useEffect(() => {
    if (currentPrice !== prevPrice && currentPrice > 0) {
      setPriceAnimation(true)
      setPrevPrice(currentPrice)
      const timer = setTimeout(() => setPriceAnimation(false), 500)
      return () => clearTimeout(timer)
    }
  }, [currentPrice, prevPrice])

  return (
    <div className="flex items-center gap-[var(--space-xl)]">
      {/* Connection Status */}
      <div className="flex items-center gap-[var(--space-sm)]">
        <div className={cn(
          "w-2 h-2 rounded-full animate-pulse",
          isConnected ? 'bg-[hsl(var(--color-profit))]' : 'bg-[hsl(var(--color-loss))]'
        )} />
        <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">{isConnected ? 'Live' : 'Offline'}</span>
      </div>

      {/* Large Price Display */}
      <div className="flex flex-col items-end">
        <div className="flex items-baseline gap-[var(--space-sm)]">
          <span className="text-[hsl(var(--text-muted))] text-[var(--font-sm)] font-medium">USD</span>
          <div className={cn(
            "text-[2rem] font-bold font-mono tracking-tight transition-all duration-[var(--transition-normal)]",
            priceColor,
            priceAnimation && "price-update"
          )}>
            ${formattedPrice}
          </div>
        </div>
        <div className={cn(
          "text-[var(--font-sm)] font-medium flex items-center gap-[var(--space-sm)] mt-[var(--space-xs)]",
          priceColor
        )}>
          <span className="font-mono">{formattedChange}</span>
          <span className={cn(
            "px-[var(--space-sm)] py-[var(--space-xs)] rounded-md text-[var(--font-xs)] font-medium",
            "premium-glass-subtle"
          )}>
            {formattedChangePercent}
          </span>
          <span className="text-[var(--font-sm)]">{change >= 0 ? '↑' : '↓'}</span>
        </div>
      </div>
      
      {/* 24h Volume */}
      <div className="hidden lg:flex items-center gap-[var(--space-lg)] text-[var(--font-sm)]">
        <div>
          <span className="text-[hsl(var(--text-muted))]">24h高値</span>
          <div className="text-[hsl(var(--text-primary))] font-medium">
            ${high24h ? parseFloat(high24h).toFixed(2) : '---'}
          </div>
        </div>
        <div>
          <span className="text-[hsl(var(--text-muted))]">24h安値</span>
          <div className="text-[hsl(var(--text-primary))] font-medium">
            ${low24h ? parseFloat(low24h).toFixed(2) : '---'}
          </div>
        </div>
        <div>
          <span className="text-[hsl(var(--text-muted))]">24h出来高</span>
          <div className="text-[hsl(var(--text-primary))] font-medium">
            {volume ? `${(parseFloat(volume) / 1000000).toFixed(2)}M USDT` : '---'}
          </div>
        </div>
      </div>
    </div>
  )
})

export default PriceDisplay