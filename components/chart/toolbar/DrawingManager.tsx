// 新規: 描画管理ツールバー
'use client'

import React, { useState } from 'react'
import { Trash2, List, X, Palette, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useChartDrawings, useChartPatterns, useDrawingActions, usePatternActions } from '@/store/chart.store'
import { StyleEditor } from '@/components/chat/StyleEditor'
import type { DrawingItem, DrawingWithMetadata } from '@/types/drawing-manager.types'
import type { DrawingStyle } from '@/types/ui-events.types'

interface DrawingManagerProps {
  className?: string
}

export default function DrawingManager({ className }: DrawingManagerProps) {
  const drawings = useChartDrawings()
  const patternsMap = useChartPatterns()
  const patternEntries = Array.from(patternsMap.entries())
  const { deleteDrawing, clearAllDrawings } = useDrawingActions()
  const { removePattern, clearPatterns } = usePatternActions()
  const [open, setOpen] = useState(false)

  const hasAny = drawings.length > 0 || patternEntries.length > 0

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {/* List & individual delete */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasAny}
            title="描画一覧"
            className="relative h-9 w-9 p-0 text-gray-400 hover:text-gray-200"
          >
            <List className="w-4 h-4" />
            {/* count badge */}
            {hasAny && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-red-600 text-[10px] leading-[16px] rounded-full text-white text-center">
                {(drawings.length + patternEntries.length) > 99 ? '99+' : (drawings.length + patternEntries.length)}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 max-h-72 overflow-y-auto bg-gray-900/95 backdrop-blur-sm border-gray-700" align="end">
          {/* header with clear all */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
            <span className="text-xs text-gray-400">描画数: {drawings.length + patternEntries.length}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                clearAllDrawings();
                clearPatterns();
                patternEntries.forEach(([id]) => {
                  window.dispatchEvent(new CustomEvent('chart:removePattern', { detail: { id } }))
                })
              }}
              disabled={!hasAny}
              className="h-6 w-6 p-0 text-red-400 hover:text-red-200"
              title="全削除"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          {drawings.length === 0 && patternEntries.length === 0 ? (
            <div className="text-center text-gray-500 py-4 text-xs">描画はありません</div>
          ) : (
            <div className="space-y-1">
              {[...drawings.map((d, idx)=>({ drawing:d, idx})).map(({drawing,idx})=>({
                  id: drawing.id,
                  isPattern:false,
                  idx,
                  color: drawing.style?.color || '#6b7280',
                  direction: drawing.points && drawing.points.length>1 && (drawing.points.slice(-1)[0].value - drawing.points[0].value) >=0 ? 'up':'down',
                  createdAt: (drawing as DrawingWithMetadata).metadata?.createdAt,
                })),
                ...patternEntries.map(([id, p], idx)=>({ id, isPattern:true, idx, color:'#ffffff', direction:null, createdAt:undefined }))].map((item: DrawingItem) => (
                <div key={item.id} className="text-xs px-1 py-1 rounded hover:bg-gray-800/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 max-w-[120px] mr-1">
                      {/* color swatch */}
                      <span className="w-2 h-2 rounded-full" style={{background:item.color}} />
                      {/* direction icon */}
                      {item.direction && (item.direction==='up' ? <ArrowUpRight className="w-3 h-3 text-green-400"/> : <ArrowDownRight className="w-3 h-3 text-red-400"/>) }
                      {/* label text */}
                      <span className="truncate">{item.isPattern ? `Pattern ${item.idx+1}`:`TL ${item.idx+1}`}</span>
                      {/* time */}
                      {item.createdAt && (
                        <span className="text-[10px] text-gray-500 ml-1">{new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      )}
                    </div>

                    {/* Style popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 text-blue-400 hover:text-blue-200"
                          title="スタイル変更"
                        >
                          <Palette className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 bg-gray-900/95 backdrop-blur-sm border-gray-700" align="start">
                        <StyleEditor
                          drawingId={item.id}
                          proposalId="manual"
                          currentStyle={undefined}
                          isPattern={item.isPattern}
                          embedded
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (item.isPattern) {
                          removePattern(item.id);
                          window.dispatchEvent(new CustomEvent('chart:removePattern', { detail: { id: item.id } }))
                        } else {
                          deleteDrawing(item.id);
                          window.dispatchEvent(new CustomEvent('chart:deleteDrawing', { detail: { id: item.id } }))
                        }
                      }}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-200"
                      title="削除"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
} 