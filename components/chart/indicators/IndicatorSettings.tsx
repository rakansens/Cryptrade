'use client'

import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useCallback, memo } from 'react'
import { useChart } from '@/store/chart.store'
import { type IndicatorOptions } from '@/types/market'
import { safeParseOrWarn, CommonSchemas } from '@/lib/utils/validation'

const IndicatorSettings = memo(function IndicatorSettings() {
  const { indicators, updateIndicator } = useChart()
  const typedIndicators = indicators as IndicatorOptions
  
  const handleIndicatorChange = useCallback((key: string, checked: boolean) => {
    const validatedToggle = safeParseOrWarn(
      CommonSchemas.IndicatorToggle, 
      { key, value: checked }, 
      'IndicatorSettings'
    )
    
    if (!validatedToggle) {
      return
    }
    
    updateIndicator(validatedToggle.key, validatedToggle.value)
  }, [updateIndicator])

  return (
    <div className="p-[var(--space-md)] space-y-[var(--space-md)] premium-glass rounded-lg">
      <h3 className="text-[var(--font-sm)] font-semibold text-[hsl(var(--text-primary))] tracking-wide">Technical Indicators</h3>
      
      {/* Moving Averages */}
      <div className="space-y-[var(--space-sm)]">
        <div className="flex items-center justify-between p-[var(--space-sm)] rounded-md hover:bg-[hsl(var(--glass-bg))] transition-colors duration-200">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">Moving Averages</label>
          <Switch
            checked={typedIndicators.ma}
            onCheckedChange={(checked) => handleIndicatorChange('ma', checked)}
          />
        </div>
      </div>

      <Separator className="opacity-20" />

      {/* RSI */}
      <div className="space-y-[var(--space-sm)]">
        <div className="flex items-center justify-between p-[var(--space-sm)] rounded-md hover:bg-[hsl(var(--glass-bg))] transition-colors duration-200">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">RSI (14)</label>
          <Switch
            checked={typedIndicators.rsi}
            onCheckedChange={(checked) => handleIndicatorChange('rsi', checked)}
          />
        </div>
      </div>

      <Separator className="opacity-20" />

      {/* MACD */}
      <div className="space-y-[var(--space-sm)]">
        <div className="flex items-center justify-between p-[var(--space-sm)] rounded-md hover:bg-[hsl(var(--glass-bg))] transition-colors duration-200">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">MACD (12, 26, 9)</label>
          <Switch
            checked={typedIndicators.macd}
            onCheckedChange={(checked) => handleIndicatorChange('macd', checked)}
          />
        </div>
      </div>

      <Separator className="opacity-20" />

      {/* Bollinger Bands */}
      <div className="space-y-[var(--space-sm)]">
        <div className="flex items-center justify-between p-[var(--space-sm)] rounded-md hover:bg-[hsl(var(--glass-bg))] transition-colors duration-200">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-secondary))]">Bollinger Bands (20, 2)</label>
          <Switch
            checked={typedIndicators.boll}
            onCheckedChange={(checked) => handleIndicatorChange('boll', checked)}
          />
        </div>
      </div>
    </div>
  )
})

export default IndicatorSettings