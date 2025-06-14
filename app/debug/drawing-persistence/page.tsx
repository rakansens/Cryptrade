'use client'

import { useEffect, useState } from 'react'
import type { ChartDrawing, DrawingPoint, DrawingStyle } from '@/types/drawing'

const STORAGE_KEYS = {
  DRAWINGS: 'cryptrade_chart_drawings',
  PATTERNS: 'cryptrade_chart_patterns',
  TIMEFRAME_STATE: 'cryptrade_timeframe_state'
}

export default function DrawingPersistenceDebug() {
  const [drawings, setDrawings] = useState<string>('Loading...')
  const [patterns, setPatterns] = useState<string>('Loading...')
  const [timeframe, setTimeframe] = useState<string>('Loading...')
  const [validation, setValidation] = useState<string>('')

  const loadData = () => {
    // Load drawings
    const drawingsData = localStorage.getItem(STORAGE_KEYS.DRAWINGS)
    if (drawingsData) {
      try {
        const parsed = JSON.parse(drawingsData)
        setDrawings(JSON.stringify(parsed, null, 2))
      } catch (e) {
        setDrawings(`Error parsing drawings: ${e}`)
      }
    } else {
      setDrawings('No drawings found')
    }

    // Load patterns
    const patternsData = localStorage.getItem(STORAGE_KEYS.PATTERNS)
    if (patternsData) {
      try {
        const parsed = JSON.parse(patternsData)
        setPatterns(JSON.stringify(parsed, null, 2))
      } catch (e) {
        setPatterns(`Error parsing patterns: ${e}`)
      }
    } else {
      setPatterns('No patterns found')
    }

    // Load timeframe state
    const timeframeData = localStorage.getItem(STORAGE_KEYS.TIMEFRAME_STATE)
    if (timeframeData) {
      try {
        const parsed = JSON.parse(timeframeData)
        setTimeframe(JSON.stringify(parsed, null, 2))
      } catch (e) {
        setTimeframe(`Error parsing timeframe: ${e}`)
      }
    } else {
      setTimeframe('No timeframe state found')
    }

    validateData()
  }

  const validateData = () => {
    let validationHtml = ''
    const drawingsData = localStorage.getItem(STORAGE_KEYS.DRAWINGS)
    
    if (drawingsData) {
      try {
        const drawings = JSON.parse(drawingsData)
        const results: string[] = []
        
        drawings.forEach((drawing: ChartDrawing, index: number) => {
          const issues: string[] = []
          
          if (!drawing.id) issues.push('Missing id')
          if (!drawing.type) issues.push('Missing type')
          if (!Array.isArray(drawing.points)) issues.push('Points is not an array')
          else {
            drawing.points.forEach((point: DrawingPoint, pIndex: number) => {
              if (typeof point.time !== 'number') {
                issues.push(`Point ${pIndex}: time is not a number (${typeof point.time})`)
              }
              if (typeof point.value !== 'number') {
                issues.push(`Point ${pIndex}: value is not a number (${typeof point.value})`)
              }
            })
          }
          
          if (!drawing.style) issues.push('Missing style')
          else {
            if (!drawing.style.color || !drawing.style.color.match(/^#[0-9A-Fa-f]{6}$/)) {
              issues.push('Invalid color format')
            }
          }
          
          if (issues.length > 0) {
            results.push(`❌ Drawing ${index} (${drawing.id || 'no-id'}): ${issues.join(', ')}`)
          } else {
            results.push(`✅ Drawing ${index} (${drawing.id}): Valid`)
          }
        })
        
        validationHtml = results.join('\n')
      } catch (e) {
        validationHtml = `Failed to validate drawings: ${e}`
      }
    } else {
      validationHtml = 'No data to validate'
    }
    
    setValidation(validationHtml)
  }

  const clearDrawings = () => {
    localStorage.removeItem(STORAGE_KEYS.DRAWINGS)
    loadData()
  }

  const clearPatterns = () => {
    localStorage.removeItem(STORAGE_KEYS.PATTERNS)
    loadData()
  }

  const clearAll = () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
    loadData()
  }

  const addTestTrendline = () => {
    const drawings = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAWINGS) || '[]')
    drawings.push({
      id: `test_trendline_${Date.now()}`,
      type: 'trendline',
      points: [
        { time: Math.floor(Date.now() / 1000) - 3600, value: 45000 },
        { time: Math.floor(Date.now() / 1000), value: 46000 }
      ],
      style: {
        color: '#2962ff',
        lineWidth: 2,
        lineStyle: 'solid',
        showLabels: true
      },
      visible: true,
      interactive: true
    })
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(drawings))
    loadData()
  }

  const addTestHorizontal = () => {
    const drawings = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAWINGS) || '[]')
    drawings.push({
      id: `test_horizontal_${Date.now()}`,
      type: 'horizontal',
      points: [
        { time: Math.floor(Date.now() / 1000), value: 45500 }
      ],
      style: {
        color: '#ff6d00',
        lineWidth: 2,
        lineStyle: 'dashed',
        showLabels: true
      },
      visible: true,
      interactive: true
    })
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(drawings))
    loadData()
  }

  const addInvalidDrawing = () => {
    const drawings = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAWINGS) || '[]')
    drawings.push({
      id: `invalid_${Date.now()}`,
      type: 'invalid-type',
      points: [
        { time: 'not-a-number', value: 'also-not-a-number' }
      ],
      style: {
        color: 'not-a-hex-color',
        lineWidth: 'not-a-number'
      }
    })
    localStorage.setItem(STORAGE_KEYS.DRAWINGS, JSON.stringify(drawings))
    loadData()
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-green-400">Drawing Persistence Debug</h1>
        
        <div className="bg-[#2a2a2a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-green-400">LocalStorage Data</h2>
          
          <div className="flex gap-2 mb-6">
            <button 
              onClick={loadData}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Refresh Data
            </button>
            <button 
              onClick={clearDrawings}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
            >
              Clear Drawings
            </button>
            <button 
              onClick={clearPatterns}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
            >
              Clear Patterns
            </button>
            <button 
              onClick={clearAll}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Drawings</h3>
              <pre className="bg-black p-4 rounded overflow-x-auto text-sm">
                {drawings}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Patterns</h3>
              <pre className="bg-black p-4 rounded overflow-x-auto text-sm">
                {patterns}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Timeframe State</h3>
              <pre className="bg-black p-4 rounded overflow-x-auto text-sm">
                {timeframe}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="bg-[#2a2a2a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Validation Results</h2>
          <pre className="bg-black p-4 rounded overflow-x-auto text-sm whitespace-pre">
            {validation || 'Loading...'}
          </pre>
        </div>
        
        <div className="bg-[#2a2a2a] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Add Test Drawing</h2>
          <div className="flex gap-2">
            <button 
              onClick={addTestTrendline}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Add Test Trendline
            </button>
            <button 
              onClick={addTestHorizontal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Add Test Horizontal
            </button>
            <button 
              onClick={addInvalidDrawing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              Add Invalid Drawing (Test Validation)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}