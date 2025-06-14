'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palette, Sliders, Sparkles, ChevronDown } from 'lucide-react'
import { logger } from '@/lib/utils/logger'
import { showToast } from '@/components/ui/toast'
import { 
  EnhancedDrawingStyle, 
  PatternStyle, 
  DEFAULT_STYLE_PRESETS,
  ExtendedLineStyle,
  validateStyleUpdate,
  validatePatternStyleUpdate,
  StyleUpdateEvent,
  PatternStyleUpdateEvent
} from '@/types/style-editor'
import { DrawingStyle } from '@/types/drawing'

export interface StyleEditorProps {
  drawingId: string
  proposalId: string
  currentStyle?: DrawingStyle
  isPattern?: boolean
  patternType?: string
  onStyleChange?: (style: Partial<EnhancedDrawingStyle>) => void
  onPatternStyleChange?: (patternStyle: Partial<PatternStyle>) => void
  /** true の場合、Popover トリガーなしでエディタ UI を直接表示する */
  embedded?: boolean
}

export function StyleEditor({
  drawingId,
  proposalId,
  currentStyle,
  isPattern = false,
  patternType,
  onStyleChange,
  onPatternStyleChange,
  embedded = false
}: StyleEditorProps) {
  // State
  const [localStyle, setLocalStyle] = useState<EnhancedDrawingStyle>({
    color: currentStyle?.color || '#22c55e',
    lineWidth: currentStyle?.lineWidth || 2,
    lineStyle: (currentStyle?.lineStyle as ExtendedLineStyle) || 'solid',
    showLabels: currentStyle?.showLabels ?? true,
    lineCap: 'round',
    lineJoin: 'round',
    animated: false,
  })
  
  const [patternStyle, setPatternStyle] = useState<PatternStyle>({
    patternFillOpacity: 0.1,
    highlightKeyPoints: true,
    keyPointSize: 8,
    showMetricLabels: true,
    metricLabelPosition: 'right',
  })
  
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [previewColor, setPreviewColor] = useState(localStyle.color)

  // Handle color change with preview
  const handleColorChange = useCallback((color: string) => {
    setPreviewColor(color)
    
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      const newStyle = { ...localStyle, color }
      setLocalStyle(newStyle)
      applyStyleChange({ color })
    }
  }, [localStyle])

  // Handle line width change
  const handleLineWidthChange = useCallback((width: string) => {
    const lineWidth = parseInt(width)
    if (!isNaN(lineWidth) && lineWidth >= 1 && lineWidth <= 10) {
      const newStyle = { ...localStyle, lineWidth }
      setLocalStyle(newStyle)
      applyStyleChange({ lineWidth })
    }
  }, [localStyle])

  // Handle line style change
  const handleLineStyleChange = useCallback((lineStyle: ExtendedLineStyle) => {
    const newStyle = { ...localStyle, lineStyle }
    setLocalStyle(newStyle)
    applyStyleChange({ lineStyle })
  }, [localStyle])

  // Handle show labels change
  const handleShowLabelsChange = useCallback((showLabels: boolean) => {
    const newStyle = { ...localStyle, showLabels }
    setLocalStyle(newStyle)
    applyStyleChange({ showLabels })
  }, [localStyle])

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = DEFAULT_STYLE_PRESETS.find(p => p.id === presetId)
    if (preset) {
      setLocalStyle(preset.style)
      applyStyleChange(preset.style)
      showToast(`プリセット「${preset.name}」を適用しました`, 'success')
    }
  }, [])

  // Apply style change
  const applyStyleChange = useCallback((partialStyle: Partial<EnhancedDrawingStyle>) => {
    logger.info('[StyleEditor] Applying style change', { drawingId, partialStyle, isPattern })
    
    // Dispatch style update event
    try {
      // Extract only the basic DrawingStyle properties
      const basicStyle: Partial<DrawingStyle> = {
        ...(partialStyle.color !== undefined && { color: partialStyle.color }),
        ...(partialStyle.lineWidth !== undefined && { lineWidth: partialStyle.lineWidth }),
        ...(partialStyle.lineStyle !== undefined && { 
          lineStyle: partialStyle.lineStyle as 'solid' | 'dashed' | 'dotted'
        }),
        ...(partialStyle.showLabels !== undefined && { showLabels: partialStyle.showLabels }),
      }
      
      // Use different event for patterns vs regular drawings
      const eventName = isPattern ? 'chart:updatePatternStyle' : 'chart:updateDrawingStyle'
      const eventDetail = isPattern 
        ? {
            patternId: drawingId,
            patternStyle: { baseStyle: basicStyle },
            immediate: true,
          }
        : {
            drawingId,
            style: basicStyle,
            immediate: true,
          }
      
      const event = new CustomEvent(eventName, { detail: eventDetail })
      window.dispatchEvent(event)
      
      // Call callback if provided
      if (onStyleChange) {
        onStyleChange(partialStyle)
      }
    } catch (error) {
      logger.error('[StyleEditor] Failed to validate style update', { error })
      showToast('スタイルの更新に失敗しました', 'error')
    }
  }, [drawingId, isPattern, onStyleChange])

  // Pattern-specific style handlers
  const handlePatternFillOpacityChange = useCallback((opacity: string) => {
    const patternFillOpacity = parseFloat(opacity)
    if (!isNaN(patternFillOpacity) && patternFillOpacity >= 0 && patternFillOpacity <= 1) {
      const newPatternStyle = { ...patternStyle, patternFillOpacity }
      setPatternStyle(newPatternStyle)
      applyPatternStyleChange({ patternFillOpacity })
    }
  }, [patternStyle])

  const handleMetricLabelPositionChange = useCallback((position: 'left' | 'right' | 'center') => {
    const newPatternStyle = { ...patternStyle, metricLabelPosition: position }
    setPatternStyle(newPatternStyle)
    applyPatternStyleChange({ metricLabelPosition: position })
  }, [patternStyle])

  // Apply pattern style change
  const applyPatternStyleChange = useCallback((partialPatternStyle: Partial<PatternStyle>) => {
    if (!isPattern) return
    
    logger.info('[StyleEditor] Applying pattern style change', { drawingId, partialPatternStyle })
    
    try {
      const patternStyleUpdate: PatternStyleUpdateEvent = validatePatternStyleUpdate({
        patternId: drawingId,
        patternStyle: partialPatternStyle,
        immediate: true,
      })
      
      const event = new CustomEvent('chart:updatePatternStyle', {
        detail: patternStyleUpdate
      })
      window.dispatchEvent(event)
      
      if (onPatternStyleChange) {
        onPatternStyleChange(partialPatternStyle)
      }
    } catch (error) {
      logger.error('[StyleEditor] Failed to validate pattern style update', { error })
      showToast('パターンスタイルの更新に失敗しました', 'error')
    }
  }, [drawingId, isPattern, onPatternStyleChange])

  const editorBody = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-h-0">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic" className="text-[var(--font-xs)]">
          基本
        </TabsTrigger>
        <TabsTrigger value="presets" className="text-[var(--font-xs)]">
          プリセット
        </TabsTrigger>
        {isPattern && (
          <TabsTrigger value="pattern" className="text-[var(--font-xs)]">
            パターン
          </TabsTrigger>
        )}
      </TabsList>

      {/* Basic Settings Tab */}
      <TabsContent value="basic" className="p-3 space-y-3">
        {/* Color Picker */}
        <div className="space-y-2">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
            色
          </label>
          <div className="flex gap-2">
            <div 
              className="w-9 h-9 rounded border-2 border-[hsl(var(--border))] cursor-pointer"
              style={{ backgroundColor: previewColor }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'color'
                input.value = previewColor
                input.onchange = (e) => handleColorChange((e.target as HTMLInputElement).value)
                input.click()
              }}
            />
            <Input
              type="text"
              value={previewColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="flex-1 h-9"
              placeholder="#22c55e"
            />
          </div>
          <div className="flex gap-1">
            {['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#6b7280'].map(color => (
              <button
                key={color}
                className="w-6 h-6 rounded border border-[hsl(var(--border))] cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
              />
            ))}
          </div>
        </div>

        {/* Line Width */}
        <div className="space-y-2">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
            線の太さ
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="10"
              value={localStyle.lineWidth}
              onChange={(e) => handleLineWidthChange(e.target.value)}
              className="flex-1"
            />
            <span className="text-[var(--font-sm)] w-8 text-center">
              {localStyle.lineWidth}
            </span>
          </div>
        </div>

        {/* Line Style */}
        <div className="space-y-2">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
            線の種類
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleLineStyleChange('solid')}
              className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                localStyle.lineStyle === 'solid' 
                  ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                  : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
              }`}
            >
              <svg width="40" height="2" className="mx-auto">
                <line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <button
              onClick={() => handleLineStyleChange('dashed')}
              className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                localStyle.lineStyle === 'dashed' 
                  ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                  : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
              }`}
            >
              <svg width="40" height="2" className="mx-auto">
                <line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="6,3"/>
              </svg>
            </button>
            <button
              onClick={() => handleLineStyleChange('dotted')}
              className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                localStyle.lineStyle === 'dotted' 
                  ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                  : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
              }`}
            >
              <svg width="40" height="2" className="mx-auto">
                <line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="2,2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Show Labels */}
        <div className="flex items-center justify-between pr-1">
          <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
            価格ラベルを表示
          </label>
          <button
            className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
              localStyle.showLabels ? 'bg-[hsl(var(--color-accent))]' : 'bg-[hsl(var(--color-secondary))]'
            }`}
            onClick={() => handleShowLabelsChange(!localStyle.showLabels)}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              localStyle.showLabels ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </TabsContent>

      {/* Presets Tab */}
      <TabsContent value="presets" className="p-3 space-y-2">
        {DEFAULT_STYLE_PRESETS.map(preset => (
          <button
            key={preset.id}
            className="w-full p-2.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)] transition-colors text-left"
            onClick={() => applyPreset(preset.id)}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div 
                  className="w-8 h-8 rounded"
                  style={{ 
                    backgroundColor: preset.style.color,
                    opacity: preset.style.shadow ? 0.8 : 1
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="text-[var(--font-sm)] font-medium">
                  {preset.name}
                </div>
                {preset.description && (
                  <div className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
                    {preset.description}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </TabsContent>

      {/* Pattern Settings Tab */}
      {isPattern && (
        <TabsContent value="pattern" className="p-3 space-y-3">
          {/* Metric Lines Settings */}
          <div className="space-y-1.5">
            <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))] font-medium">
              メトリックライン設定
            </label>
            <div className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              基本タブで設定したスタイルがTP/SL/BOラインに適用されます
            </div>
          </div>

          {/* Pattern Fill Opacity */}
          <div className="space-y-1.5">
            <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              パターン塗りつぶしの透明度
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={patternStyle.patternFillOpacity}
                onChange={(e) => handlePatternFillOpacityChange(e.target.value)}
                className="flex-1"
              />
              <span className="text-[var(--font-sm)] w-12 text-center">
                {Math.round(patternStyle.patternFillOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* Metric Label Position */}
          <div className="space-y-1.5">
            <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              メトリクスラベルの位置
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleMetricLabelPositionChange('left')}
                className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                  patternStyle.metricLabelPosition === 'left' 
                    ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                    : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
                }`}
              >
                左
              </button>
              <button
                onClick={() => handleMetricLabelPositionChange('center')}
                className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                  patternStyle.metricLabelPosition === 'center' 
                    ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                    : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
                }`}
              >
                中央
              </button>
              <button
                onClick={() => handleMetricLabelPositionChange('right')}
                className={`flex-1 h-9 px-3 rounded-md border text-[var(--font-sm)] transition-colors ${
                  patternStyle.metricLabelPosition === 'right' 
                    ? 'bg-[hsl(var(--color-accent))] text-white border-[hsl(var(--color-accent))]' 
                    : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:bg-[hsl(var(--color-secondary)/0.5)]'
                }`}
              >
                右
              </button>
            </div>
          </div>

          {/* Show Metric Labels */}
          <div className="flex items-center justify-between pr-1">
            <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              メトリクスラベルを表示
            </label>
            <button
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                patternStyle.showMetricLabels ? 'bg-[hsl(var(--color-accent))]' : 'bg-[hsl(var(--color-secondary))]'
              }`}
              onClick={() => {
                const newValue = !patternStyle.showMetricLabels
                setPatternStyle({ ...patternStyle, showMetricLabels: newValue })
                applyPatternStyleChange({ showMetricLabels: newValue })
              }}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                patternStyle.showMetricLabels ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Highlight Key Points */}
          <div className="flex items-center justify-between pr-1">
            <label className="text-[var(--font-xs)] text-[hsl(var(--text-muted))]">
              キーポイントを強調
            </label>
            <button
              className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                patternStyle.highlightKeyPoints ? 'bg-[hsl(var(--color-accent))]' : 'bg-[hsl(var(--color-secondary))]'
              }`}
              onClick={() => {
                const newValue = !patternStyle.highlightKeyPoints
                setPatternStyle({ ...patternStyle, highlightKeyPoints: newValue })
                applyPatternStyleChange({ highlightKeyPoints: newValue })
              }}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                patternStyle.highlightKeyPoints ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </TabsContent>
      )}
    </Tabs>
  )

  if (embedded) {
    return <div className="w-80 p-0">{editorBody}</div>
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[var(--font-xs)] gap-1"
        >
          <Palette className="w-3 h-3" />
          スタイル
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="start" 
        alignOffset={-100}
        sideOffset={8} 
        className="min-w-[21rem] max-w-[90vw] max-h-[75vh] p-0 flex flex-col" 
      >
        <div className="overflow-y-auto flex-1">
          {editorBody}
        </div>
      </PopoverContent>
    </Popover>
  )
}