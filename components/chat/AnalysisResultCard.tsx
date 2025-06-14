'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Activity, Shield, Target, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePriceStream } from '@/hooks/market/use-price-stream'
import { usePriceData } from '@/store/market.store'
import { computeATR, computeRSI, computeMACD, computeTrendStrength, computeSupportResistanceDetailed } from '@/lib/utils/indicators'

interface PriceInfo {
  current: number
  change?: number
  changePercent?: number
}

interface TrendInfo {
  direction: 'up' | 'down' | 'neutral'
  strength: number
  confidence: number
}

interface SupportResistanceLevel {
  price: number
  strength: number
  touches: number
}

interface VolatilityInfo {
  atr: number
  level: 'high' | 'medium' | 'low'
  percentage: number
}

interface MomentumIndicators {
  rsi: {
    value: number
    signal: 'overbought' | 'oversold' | 'neutral'
  }
  macd: {
    value: number
    signal: number
    histogram: number
    trend: 'bullish' | 'bearish' | 'neutral'
  }
}

interface Pattern {
  name: string
  description: string
  confidence?: number
}

export interface AnalysisResultData {
  symbol: string
  timeframe: string
  price: PriceInfo
  trend: TrendInfo
  support: SupportResistanceLevel[]
  resistance: SupportResistanceLevel[]
  volatility: VolatilityInfo
  momentum: MomentumIndicators
  patterns?: Pattern[]
  recommendations?: string[]
  nextActions?: string[]
}

interface AnalysisResultCardProps {
  data: AnalysisResultData
  className?: string
}

export function AnalysisResultCard({ data, className }: AnalysisResultCardProps) {
  const getTrendIcon = (direction: string) => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4" />
    if (direction === 'down') return <TrendingDown className="w-4 h-4" />
    return <Activity className="w-4 h-4" />
  }

  const getTrendColor = (direction: string) => {
    if (direction === 'up') return 'text-[hsl(var(--color-profit))]'
    if (direction === 'down') return 'text-[hsl(var(--color-loss))]'
    return 'text-[hsl(var(--text-secondary))]'
  }

  const getRSIColor = (value: number) => {
    if (value > 70) return 'text-[hsl(var(--color-loss))]'
    if (value < 30) return 'text-[hsl(var(--color-profit))]'
    return 'text-[hsl(var(--text-secondary))]'
  }

  const getVolatilityColor = (level: string) => {
    if (level === 'high') return 'text-[hsl(var(--color-warning))]'
    if (level === 'low') return 'text-[hsl(var(--color-profit))]'
    return 'text-[hsl(var(--text-secondary))]'
  }

  const klines = usePriceData(data.symbol)
  const computedATR = React.useMemo(() => computeATR(klines), [klines])
  const computedRSI = React.useMemo(() => computeRSI(klines), [klines])
  const computedMACD = React.useMemo(() => computeMACD(klines), [klines])
  const computedTrend = React.useMemo(() => computeTrendStrength(klines), [klines])
  const computedLevels = React.useMemo(() => computeSupportResistanceDetailed(klines), [klines])

  const { currentPrice: livePrice, change: liveChange, changePercent: liveChangePercent } = usePriceStream(data.symbol)

  const priceValue = data.price.current || livePrice
  const changeValue = data.price.change ?? liveChange
  const changePercentValue = data.price.changePercent ?? liveChangePercent

  const atrValue = data.volatility.atr || computedATR
  const atrPercentValue = atrValue && priceValue ? (atrValue / priceValue) * 100 : data.volatility.percentage
  const volatilityLevelComp = atrPercentValue > 2 ? 'high' : atrPercentValue < 0.5 ? 'low' : 'medium'

  const rsiValue = data.momentum.rsi.value || computedRSI
  const rsiSignal = rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral'

  const macdTrend = data.momentum.macd.trend !== 'neutral' ? data.momentum.macd.trend : computedMACD.trend

  const trendDirection = data.trend.direction !== 'neutral' || data.trend.strength > 0 ? data.trend.direction : computedTrend.direction
  const trendStrength = data.trend.strength > 0 ? data.trend.strength : computedTrend.strength

  return (
    <div className={cn(
      "premium-glass border border-[hsl(var(--border))] rounded-lg overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="px-[var(--space-lg)] py-[var(--space-md)] border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[var(--font-base)] font-semibold text-[hsl(var(--text-primary))]">
              {data.symbol} 分析結果
            </h3>
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] bg-[hsl(var(--color-secondary))] px-2 py-0.5 rounded">
              {data.timeframe}
            </span>
          </div>
          {/* Price Block */}
          {(() => {
            return (
              <div className="text-right">
                <p className="text-[var(--font-xl)] font-bold text-[hsl(var(--text-primary))]">
                  {priceValue ? `$${priceValue.toLocaleString()}` : '–'}
                </p>
                {changeValue !== undefined && changePercentValue !== undefined && (
                  <p className={cn(
                    "text-[var(--font-sm)]",
                    changeValue > 0 ? "text-[hsl(var(--color-profit))]" : "text-[hsl(var(--color-loss))]"
                  )}>
                    {changeValue > 0 ? '+' : ''}{changeValue.toFixed(2)}
                    ({changePercentValue.toFixed(2)}%)
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 gap-[var(--space-md)] p-[var(--space-lg)]">
        {/* Trend Analysis */}
        <div className="space-y-[var(--space-sm)]">
          <div className="flex items-center gap-2">
            {getTrendIcon(data.trend.direction)}
            <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              トレンド分析
            </h4>
          </div>
          <div className="space-y-2 pl-6">
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">方向</span>
              <span className={cn(
                "text-[var(--font-xs)] font-medium",
                getTrendColor(data.trend.direction)
              )}>
                {trendDirection === 'up' ? '上昇' : trendDirection === 'down' ? '下降' : '中立'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">強度</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-[hsl(var(--color-secondary))] rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300",
                      getTrendColor(data.trend.direction).replace('text-', 'bg-')
                    )}
                    style={{ width: `${trendStrength}%` }}
                  />
                </div>
                <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                  {trendStrength.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">信頼度</span>
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                {data.trend.confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* Volatility */}
        <div className="space-y-[var(--space-sm)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              ボラティリティ
            </h4>
          </div>
          <div className="space-y-2 pl-6">
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">ATR</span>
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-primary))]">
                {atrValue.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">レベル</span>
              <span className={cn(
                "text-[var(--font-xs)] font-medium",
                getVolatilityColor(volatilityLevelComp)
              )}>
                {volatilityLevelComp === 'high' ? '高' : volatilityLevelComp === 'low' ? '低' : '中'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">ATR%</span>
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                {atrPercentValue.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Support Levels */}
        <div className="space-y-[var(--space-sm)]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[hsl(var(--color-profit))]" />
            <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              サポートライン
            </h4>
          </div>
          <div className="space-y-1 pl-6">
            {(data.support.length ? data.support : computedLevels.support).slice(0, 3).map((level, idx) => (
              <div key={idx} className="flex items-center justify-between text-[var(--font-xs)]">
                <span className="text-[hsl(var(--color-profit))]">
                  ${level.price.toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[hsl(var(--text-muted))]">
                  <span>{level.strength}%</span>
                  <span className="text-[10px]">({level.touches}回)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resistance Levels */}
        <div className="space-y-[var(--space-sm)]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[hsl(var(--color-loss))]" />
            <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))]">
              レジスタンスライン
            </h4>
          </div>
          <div className="space-y-1 pl-6">
            {(data.resistance.length ? data.resistance : computedLevels.resistance).slice(0, 3).map((level, idx) => (
              <div key={idx} className="flex items-center justify-between text-[var(--font-xs)]">
                <span className="text-[hsl(var(--color-loss))]">
                  ${level.price.toLocaleString()}
                </span>
                <div className="flex items-center gap-2 text-[hsl(var(--text-muted))]">
                  <span>{level.strength}%</span>
                  <span className="text-[10px]">({level.touches}回)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Momentum Indicators */}
      <div className="px-[var(--space-lg)] pb-[var(--space-md)] border-t border-[hsl(var(--border))] pt-[var(--space-md)]">
        <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))] mb-[var(--space-sm)]">
          モメンタム指標
        </h4>
        <div className="grid grid-cols-2 gap-[var(--space-md)]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">RSI</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[var(--font-xs)] font-medium",
                getRSIColor(rsiValue)
              )}>
                {rsiValue.toFixed(1)}
              </span>
              <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                ({rsiSignal === 'overbought' ? '買われ過ぎ' : 
                  rsiSignal === 'oversold' ? '売られ過ぎ' : '中立'})
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">MACD</span>
            <span className={cn(
              "text-[var(--font-xs)] font-medium",
              macdTrend === 'bullish' ? 'text-[hsl(var(--color-profit))]' : 
              macdTrend === 'bearish' ? 'text-[hsl(var(--color-loss))]' : 
              'text-[hsl(var(--text-secondary))]'
            )}>
              {macdTrend === 'bullish' ? '強気シグナル' : 
               macdTrend === 'bearish' ? '弱気シグナル' : '中立'}
            </span>
          </div>
        </div>
      </div>

      {/* Patterns */}
      {data.patterns && data.patterns.length > 0 && (
        <div className="px-[var(--space-lg)] pb-[var(--space-md)] border-t border-[hsl(var(--border))] pt-[var(--space-md)]">
          <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))] mb-[var(--space-sm)] flex items-center gap-2">
            <Target className="w-4 h-4" />
            検出されたパターン
          </h4>
          <div className="space-y-2">
            {data.patterns.map((pattern, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-[var(--font-xs)] text-[hsl(var(--text-primary))]">
                  {pattern.name}
                </span>
                <span className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                  {pattern.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="px-[var(--space-lg)] pb-[var(--space-md)] border-t border-[hsl(var(--border))] pt-[var(--space-md)]">
          <h4 className="text-[var(--font-sm)] font-medium text-[hsl(var(--text-primary))] mb-[var(--space-sm)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--color-info))]" />
            推奨事項
          </h4>
          <ul className="space-y-1">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))] pl-4 relative">
                <span className="absolute left-0 top-1">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Actions */}
      {data.nextActions && data.nextActions.length > 0 && (
        <div className="px-[var(--space-lg)] pb-[var(--space-lg)] pt-[var(--space-sm)]">
          <div className="bg-[hsl(var(--color-info)/0.1)] border border-[hsl(var(--color-info)/0.3)] rounded-md p-[var(--space-md)]">
            <p className="text-[var(--font-xs)] text-[hsl(var(--color-info))] font-medium mb-1">
              次のアクション
            </p>
            <p className="text-[var(--font-xs)] text-[hsl(var(--text-primary))]">
              {data.nextActions.join(' ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}