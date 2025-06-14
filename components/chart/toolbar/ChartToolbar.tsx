'use client'

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Settings, Maximize2 } from 'lucide-react'
import DrawingManager from './DrawingManager'
import { useCallback, memo, useMemo } from 'react'
import { SYMBOLS, TIMEFRAMES } from '@/constants/chart'
import { useChart } from '@/store/chart.store'
import IndicatorSettings from '../indicators/IndicatorSettings'
import PriceDisplay from './PriceDisplay'
import { useIndicatorValues } from '@/hooks/market/use-indicator-values'
import { CHART_COLORS } from '@/lib/chart/theme'

interface ChartToolbarProps {
  onFitContent?: () => void;
}

const ChartToolbar = memo(function ChartToolbar({ onFitContent }: ChartToolbarProps) {
  const { symbol, timeframe, setSymbol, setTimeframe, indicators } = useChart()
  const indicatorValues = useIndicatorValues(symbol, timeframe)

  const selectedSymbolInfo = useMemo(() => 
    SYMBOLS.find(s => s.value === symbol), [symbol]
  )
  
  const handleSymbolChange = useCallback((newSymbol: string) => {
    setSymbol(newSymbol)
  }, [setSymbol])
  
  const handleTimeframeChange = useCallback((tf: string) => {
    setTimeframe(tf)
  }, [setTimeframe])

  const handleFitContent = useCallback(() => {
    onFitContent?.()
  }, [onFitContent])


  return (
    <div className="bg-gradient-to-b from-gray-900/80 to-gray-950/80 backdrop-blur-sm border-b border-gray-800/50">
      {/* Top Row - Symbol and Price */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left - Symbol with dropdown */}
        <div className="flex items-center gap-2">
          <Select value={symbol} onValueChange={handleSymbolChange}>
            <SelectTrigger className="w-auto min-w-[140px] bg-gray-800/40 border-gray-700/50 text-gray-100 text-xl font-bold hover:bg-gray-800/60 hover:border-gray-600 px-4 py-2 rounded-lg transition-all duration-200">
              <SelectValue placeholder="BTC/USDT" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900/95 backdrop-blur-sm border-gray-700">
              {SYMBOLS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-gray-200 hover:bg-gray-800/60 hover:text-white transition-colors">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right - Price Display */}
        <PriceDisplay 
          symbol={symbol} 
          symbolName={selectedSymbolInfo?.label || symbol}
        />

        {/* Far Right - Toolbar Icons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleFitContent}
            className="h-9 w-9 p-0 hover:bg-gray-800/60 text-gray-400 hover:text-gray-200 rounded-lg transition-all duration-200"
            title="Fit chart to data"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-9 w-9 p-0 hover:bg-gray-800/60 text-gray-400 hover:text-gray-200 rounded-lg transition-all duration-200"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-900/95 backdrop-blur-sm border-gray-700" align="end">
              <IndicatorSettings />
            </PopoverContent>
          </Popover>

          {/* Drawing manager icons */}
          <DrawingManager />
        </div>
      </div>

      {/* Second Row - Indicators Info */}
      <div className="px-6 pb-3">
        <div className="flex items-center gap-6 text-xs">
          {indicators.ma && (
            <>
              <span className="text-gray-500">
                MA(7): 
                <span 
                  className="font-medium ml-1" 
                  style={{ color: CHART_COLORS.movingAverages.ma7 }}
                >
                  {indicatorValues.ma7 ? indicatorValues.ma7.toFixed(2) : '---'}
                </span>
              </span>
              <span className="text-gray-500">
                MA(25): 
                <span 
                  className="font-medium ml-1" 
                  style={{ color: CHART_COLORS.movingAverages.ma25 }}
                >
                  {indicatorValues.ma25 ? indicatorValues.ma25.toFixed(2) : '---'}
                </span>
              </span>
              <span className="text-gray-500">
                MA(99): 
                <span 
                  className="font-medium ml-1" 
                  style={{ color: CHART_COLORS.movingAverages.ma99 }}
                >
                  {indicatorValues.ma99 ? indicatorValues.ma99.toFixed(2) : '---'}
                </span>
              </span>
            </>
          )}
          
          {indicators.ma && (indicators.rsi || indicators.macd) && (
            <div className="h-3 w-px bg-gray-700"></div>
          )}
          
          {indicators.rsi && (
            <span className="text-gray-500">
              RSI(14): 
              <span 
                className="font-medium ml-1" 
                style={{ color: CHART_COLORS.indicators.rsi }}
              >
                {indicatorValues.rsi ? indicatorValues.rsi.toFixed(2) : '---'}
              </span>
            </span>
          )}
          
          {indicators.macd && (
            <span className="text-gray-500">
              MACD: 
              <span 
                className="font-medium ml-1" 
                style={{ 
                  color: indicatorValues.macdHistogram && indicatorValues.macdHistogram >= 0 
                    ? CHART_COLORS.indicators.macdHistogramBull 
                    : CHART_COLORS.indicators.macdHistogramBear 
                }}
              >
                {indicatorValues.macd ? indicatorValues.macd.toFixed(2) : '---'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Third Row - Timeframes */}
      <div className="flex items-center gap-2 px-6 pb-4">
        <div className="flex items-center gap-1 p-1 bg-gray-800/40 rounded-lg">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              variant="ghost"
              size="sm"
              onClick={() => handleTimeframeChange(tf)}
              className={`h-8 px-4 text-xs font-medium rounded-md transition-all duration-200 ${
                timeframe === tf 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm' 
                  : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
              }`}
            >
              {tf}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 rounded-md"
        >
          •••
        </Button>
      </div>
    </div>
  )
})

export default ChartToolbar