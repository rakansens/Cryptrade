/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { usePatternEventHandlers } from '@/hooks/chart/usePatternEventHandlers'
import { usePatternStore } from '@/store/chart'
import type { PatternData } from '@/store/chart/types'
import { logger } from '@/lib/utils/logger'

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('usePatternEventHandlers lineStyles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usePatternStore.setState({ patterns: new Map() })
  })

  it('updates only specified lines and re-renders pattern', () => {
    const patternId = 'pattern-1'
    const pattern: PatternData = {
      id: patternId,
      type: 'triangle',
      symbol: 'BTCUSDT',
      interval: '1h',
      startTime: 0,
      endTime: 0,
      visualization: {
        type: 'triangle',
        keyPoints: [
          { time: 1, price: 1 },
          { time: 2, price: 2 },
          { time: 3, price: 3 },
        ],
        lines: [
          { id: 'line1', from: 0, to: 1, type: 'outline', style: { color: '#000', lineWidth: 1 } },
          { id: 'line2', from: 1, to: 2, type: 'outline', style: { color: '#000', lineWidth: 1 } },
        ],
      },
    }

    usePatternStore.setState({ patterns: new Map([[patternId, pattern]]) })

    const mockRenderer = {
      removePattern: jest.fn(),
      renderPattern: jest.fn(),
    }

    const handlers = { patternRenderer: mockRenderer, getPatternRenderer: () => mockRenderer }
    renderHook(() => usePatternEventHandlers(handlers))

    const updateEvent = {
      patternId,
      lineStyles: [{ lineId: 'line1', style: { color: '#f00', lineWidth: 3 } }],
      immediate: true,
    }
    window.dispatchEvent(new CustomEvent('chart:updatePatternStyle', { detail: updateEvent }))

    const updated = usePatternStore.getState().patterns.get(patternId)
    expect(updated?.visualization.lines?.[0].style?.color).toBe('#f00')
    expect(updated?.visualization.lines?.[0].style?.lineWidth).toBe(3)
    expect(updated?.visualization.lines?.[1].style?.color).toBe('#000')

    expect(mockRenderer.removePattern).toHaveBeenCalledWith(patternId)
    expect(mockRenderer.renderPattern).toHaveBeenCalled()
  })
})
