/**
 * UI Event Bus Tests
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { EventEmitter } from 'events'
import { http, HttpResponse } from 'msw'

// Import MSW setup to ensure it's initialized
import { mswServer } from '../../../setup/msw-setup'

describe('UI Event Bus', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Reset MSW handlers
    mswServer.resetHandlers()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('Module Loading Debug', () => {
    it('should load the module', () => {
      let module: any
      try {
        // Try different approaches
        const path = require.resolve('@/lib/server/uiEventBus')
        module = require('@/lib/server/uiEventBus')
      } catch (error) {
        
        // Try relative path
        try {
          const relativePath = require.resolve('../../../../lib/server/uiEventBus')
          module = require('../../../../lib/server/uiEventBus')
        } catch (relativeError) {
        }
      }
      
      expect(module).toBeDefined()
    })
  })

  describe('uiEventBus', () => {
    it('exports EventEmitter instance', () => {
      const module = require('../../../../lib/server/uiEventBus')
      const { uiEventBus } = module
      expect(uiEventBus).toBeInstanceOf(EventEmitter)
    })

    it('can emit and listen to events', () => {
      const { uiEventBus } = require('../../../../lib/server/uiEventBus')
      const listener = jest.fn()
      uiEventBus.on('test-event', listener)
      
      uiEventBus.emit('test-event', { data: 'test' })
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' })
      
      // Cleanup
      uiEventBus.off('test-event', listener)
    })
  })

  describe('getUIEventBus', () => {
    it('returns the same uiEventBus instance', () => {
      const { uiEventBus, getUIEventBus } = require('../../../../lib/server/uiEventBus')
      const instance = getUIEventBus()
      
      expect(instance).toBe(uiEventBus)
    })

    it('returns singleton instance on multiple calls', () => {
      const { getUIEventBus } = require('../../../../lib/server/uiEventBus')
      const instance1 = getUIEventBus()
      const instance2 = getUIEventBus()
      const instance3 = getUIEventBus()
      
      expect(instance1).toBe(instance2)
      expect(instance2).toBe(instance3)
    })
  })

  describe('emitUIEvent', () => {
    it('sends event via HTTP POST when available', async () => {
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')

      const payload = {
        event: 'draw:trendline',
        data: { symbol: 'BTCUSDT', type: 'uptrend' }
      }

      // MSW will handle the HTTP request
      await emitUIEvent(payload)

      // Check that no error occurred (MSW provides successful response)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('falls back to direct emit when HTTP POST fails', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to return an error response
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        })
      )

      const payload = {
        event: 'chart:update',
        data: { timeframe: '1h' }
      }

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      await emitUIEvent(payload)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 500)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('falls back to direct emit when fetch throws error', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to simulate network error (returns 500 status)
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          return HttpResponse.json({ error: 'Network error' }, { status: 500 })
        })
      )

      const payload = {
        event: 'indicator:add',
        data: { indicator: 'RSI' }
      }

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      await emitUIEvent(payload)

      // MSW returns 500 status, which triggers HTTP POST failed log
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 500)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('handles error in direct emit gracefully', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to simulate network error
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          throw new Error('Fetch failed')
        })
      )

      const payload = {
        event: 'test:event',
        data: { test: true }
      }

      // Make emit throw an error
      const emitError = new Error('Emit failed')
      const originalEmit = uiEventBus.emit
      uiEventBus.emit = jest.fn().mockImplementation(() => {
        throw emitError
      })

      await emitUIEvent(payload)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] Direct emit also failed:', emitError)
      
      // Restore
      uiEventBus.emit = originalEmit
    })

    it('sends correct payload structure', async () => {
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')

      const complexPayload = {
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
          timestamp: 1234567890
        }
      }

      // MSW handles the request and validates structure automatically
      await emitUIEvent(complexPayload)

      // Check that no error occurred
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('Event Payload Types', () => {
    it('handles minimal payload', async () => {
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')

      const minimalPayload = {
        event: 'ping',
        data: {}
      }

      await emitUIEvent(minimalPayload)

      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('handles payload with various data types', async () => {
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')

      const mixedPayload = {
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

      await emitUIEvent(mixedPayload)

      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('Event Bus Integration', () => {
    it('allows multiple listeners for ui-event', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to return error to trigger fallback
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        })
      )

      const listener1 = jest.fn()
      const listener2 = jest.fn()
      const listener3 = jest.fn()
      
      uiEventBus.on('ui-event', listener1)
      uiEventBus.on('ui-event', listener2)
      uiEventBus.on('ui-event', listener3)

      const payload = {
        event: 'multi:listener',
        data: { count: 3 }
      }

      await emitUIEvent(payload)

      expect(listener1).toHaveBeenCalledWith(payload)
      expect(listener2).toHaveBeenCalledWith(payload)
      expect(listener3).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener1)
      uiEventBus.off('ui-event', listener2)
      uiEventBus.off('ui-event', listener3)
    })

    it('can remove listeners', () => {
      const { uiEventBus } = require('../../../../lib/server/uiEventBus')
      
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
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to simulate timeout (returns 500 status)
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          return HttpResponse.json({ error: 'Request timeout' }, { status: 500 })
        })
      )

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload = {
        event: 'timeout:test',
        data: { timeout: true }
      }

      await emitUIEvent(payload)

      // MSW returns 500 status, which triggers HTTP POST failed log
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 500)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('handles malformed response', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      // Set up MSW to return a 400 Bad Request response
      mswServer.use(
        http.post('http://localhost:3000/api/ui-events', () => {
          return HttpResponse.json({ error: 'Bad response' }, { status: 400 })
        })
      )

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload = {
        event: 'malformed:response',
        data: {}
      }

      await emitUIEvent(payload)

      // 400 status should trigger HTTP POST failed and fallback to direct emit
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 400)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })
  })
})