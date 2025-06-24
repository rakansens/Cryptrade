/**
 * UI Event Bus Tests
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { EventEmitter } from 'events'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('UI Event Bus', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Reset fetch implementation
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue('')
      } as any)
    )
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
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
    // console.log('Resolved path:', path) // Removed by test quality fix
        module = require('@/lib/server/uiEventBus')
    // console.log('Loaded module keys:', Object.keys(module || {})) // Removed by test quality fix
    // console.log('Module content:', module) // Removed by test quality fix
      } catch (error) {
    // console.error('Module loading error:', error) // Removed by test quality fix
        
        // Try relative path
        try {
          const relativePath = require.resolve('../../../../lib/server/uiEventBus')
    // console.log('Relative path resolved:', relativePath) // Removed by test quality fix
          module = require('../../../../lib/server/uiEventBus')
    // console.log('Module loaded with relative path:', module) // Removed by test quality fix
        } catch (relativeError) {
    // console.error('Relative path error:', relativeError) // Removed by test quality fix
        }
      }
      
      expect(module).toBeDefined()
    })
  })

  describe('uiEventBus', () => {
    it('exports EventEmitter instance', () => {
      const module = require('../../../../lib/server/uiEventBus')
    // console.log('Module in test:', module) // Removed by test quality fix
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
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const payload = {
        event: 'draw:trendline',
        data: { symbol: 'BTCUSDT', type: 'uptrend' }
      }

      await emitUIEvent(payload)

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
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const payload = {
        event: 'chart:update',
        data: { timeframe: '1h' }
      }

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      await emitUIEvent(payload)

      expect(mockFetch).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', 500)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('falls back to direct emit when fetch throws error', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      const fetchError = new Error('Network error')
      mockFetch.mockRejectedValue(fetchError)

      const payload = {
        event: 'indicator:add',
        data: { indicator: 'RSI' }
      }

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      await emitUIEvent(payload)

      expect(mockFetch).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', fetchError)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('handles error in direct emit gracefully', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockRejectedValue(new Error('Fetch failed'))

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
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

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

      await emitUIEvent(complexPayload)

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
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

      const minimalPayload = {
        event: 'ping',
        data: {}
      }

      await emitUIEvent(minimalPayload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(minimalPayload)
        })
      )
    })

    it('handles payload with various data types', async () => {
      const { emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response)

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
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

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
      
      const timeoutError = new Error('Request timeout')
      mockFetch.mockRejectedValue(timeoutError)

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload = {
        event: 'timeout:test',
        data: { timeout: true }
      }

      await emitUIEvent(payload)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST Error:', timeoutError)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })

    it('handles malformed response', async () => {
      const { uiEventBus, emitUIEvent } = require('../../../../lib/server/uiEventBus')
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: undefined
      } as any)

      const listener = jest.fn()
      uiEventBus.on('ui-event', listener)

      const payload = {
        event: 'malformed:response',
        data: {}
      }

      await emitUIEvent(payload)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[emitUIEvent] HTTP POST failed:', undefined)
      expect(listener).toHaveBeenCalledWith(payload)
      
      // Cleanup
      uiEventBus.off('ui-event', listener)
    })
  })
})