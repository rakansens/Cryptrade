/**
 * UI Event Bus Tests
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { EventEmitter } from 'events'
import type { UIEventPayload } from '@/lib/server/uiEventBus'

// Mock fetch
global.fetch = jest.fn()

describe('UI Event Bus', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('uiEventBus', () => {
    it('exports EventEmitter instance', async () => {
      const { uiEventBus } = await import('@/lib/server/uiEventBus')
      
      expect(uiEventBus).toBeInstanceOf(EventEmitter)
    })

    it('can emit and listen to events', async () => {
      const { uiEventBus } = await import('@/lib/server/uiEventBus')
      
      const listener = jest.fn()
      uiEventBus.on('test-event', listener)
      
      uiEventBus.emit('test-event', { data: 'test' })
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  describe('getUIEventBus', () => {
    it('returns the same uiEventBus instance', async () => {
      const { uiEventBus, getUIEventBus } = await import('@/lib/server/uiEventBus')
      
      const instance = getUIEventBus()
      
      expect(instance).toBe(uiEventBus)
    })

    it('returns singleton instance on multiple calls', async () => {
      const { getUIEventBus } = await import('@/lib/server/uiEventBus')
      
      const instance1 = getUIEventBus()
      const instance2 = getUIEventBus()
      const instance3 = getUIEventBus()
      
      expect(instance1).toBe(instance2)
      expect(instance2).toBe(instance3)
    })
  })

  describe('emitUIEvent', () => {
    it('sends event via HTTP POST when available', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const payload: UIEventPayload = {
        event: 'draw:trendline',
        data: { symbol: 'BTCUSDT', type: 'uptrend' }
      }

      // Act
      const { emitUIEvent } = await import('@/lib/server/uiEventBus')
      await emitUIEvent(payload)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/ui-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('falls back to direct emit when HTTP POST fails', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const payload: UIEventPayload = {
        event: 'chart:update',
        data: { timeframe: '1h' }
      }

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(mockFetch).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 500)
      expect(listener).toHaveBeenCalledWith(payload)
    })

    it('falls back to direct emit when fetch throws error', async () => {
      // Arrange
      const fetchError = new Error('Network error')
      mockFetch.mockRejectedValue(fetchError)

      const payload: UIEventPayload = {
        event: 'indicator:add',
        data: { indicator: 'RSI' }
      }

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(mockFetch).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', fetchError)
      expect(listener).toHaveBeenCalledWith(payload)
    })

    it('handles error in direct emit gracefully', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Fetch failed'))

      const payload: UIEventPayload = {
        event: 'test:event',
        data: { test: true }
      }

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      
      // Make emit throw an error
      const emitError = new Error('Emit failed')
      jest.spyOn(uiEventBus, 'emit').mockImplementation(() => {
        throw emitError
      })

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] Direct emit also failed:', emitError)
    })

    it('sends correct payload structure', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const complexPayload: UIEventPayload = {
        event: 'analysis:complete',
        data: {
          symbol: 'ETHUSDT',
          results: {
            trend: 'bullish',
            support: [3000, 2900],
            resistance: [3200, 3300],
            indicators: {
              rsi: 65,
              macd: { signal: 'buy' }
            }
          },
          timestamp: Date.now()
        }
      }

      // Act
      const { emitUIEvent } = await import('@/lib/server/uiEventBus')
      await emitUIEvent(complexPayload)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/ui-events',
        expect.objectContaining({
          body: JSON.stringify(complexPayload)
        })
      )
    })
  })

  describe('Event Payload Types', () => {
    it('handles minimal payload', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const minimalPayload: UIEventPayload = {
        event: 'ping',
        data: {}
      }

      // Act
      const { emitUIEvent } = await import('@/lib/server/uiEventBus')
      await emitUIEvent(minimalPayload)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(minimalPayload)
        })
      )
    })

    it('handles payload with various data types', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const mixedPayload: UIEventPayload = {
        event: 'mixed:data',
        data: {
          string: 'value',
          number: 123,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: {
            deep: {
              value: 'deep-value'
            }
          }
        }
      }

      // Act
      const { emitUIEvent } = await import('@/lib/server/uiEventBus')
      await emitUIEvent(mixedPayload)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(mixedPayload)
        })
      )
    })
  })

  describe('Event Bus Integration', () => {
    it('allows multiple listeners for ui-event', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      
      const listener1 = jest.fn()
      const listener2 = jest.fn()
      const listener3 = jest.fn()
      
      uiEventBus.on('ui-event', listener1)
      uiEventBus.on('ui-event', listener2)
      uiEventBus.on('ui-event', listener3)

      const payload: UIEventPayload = {
        event: 'multi:listener',
        data: { count: 3 }
      }

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(listener1).toHaveBeenCalledWith(payload)
      expect(listener2).toHaveBeenCalledWith(payload)
      expect(listener3).toHaveBeenCalledWith(payload)
    })

    it('can remove listeners', async () => {
      // Arrange
      const { uiEventBus } = await import('@/lib/server/uiEventBus')
      
      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)
      
      // Remove listener
      uiEventBus.off('ui-event', listener)
      
      // Emit event
      uiEventBus.emit('ui-event', { event: 'test', data: {} })

      // Assert
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('Error Scenarios', () => {
    it('handles timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout')
      mockFetch.mockRejectedValue(timeoutError)

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload: UIEventPayload = {
        event: 'timeout:test',
        data: { timeout: true }
      }

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', timeoutError)
      expect(listener).toHaveBeenCalledWith(payload) // Fallback worked
    })

    it('handles malformed response', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: undefined // Malformed response
      } as any)

      const { uiEventBus, emitUIEvent } = await import('@/lib/server/uiEventBus')
      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload: UIEventPayload = {
        event: 'malformed:response',
        data: {}
      }

      // Act
      await emitUIEvent(payload)

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', undefined)
      expect(listener).toHaveBeenCalledWith(payload)
    })
  })
})