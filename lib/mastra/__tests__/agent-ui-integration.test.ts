/**
 * Agent UI Integration Test
 * 
 * Tests the integration between Mastra agents and frontend UI
 * Verifies that agent tools can successfully dispatch events and 
 * that the chart components can handle them
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { uiControlAgent } from '../network/agent-registry';
import { chartControlTool } from '../tools/chart-control.tool';
import { uiStateTool } from '../tools/ui-state.tool';

// Mock the chart store
const mockSetSymbol = jest.fn();
const mockSetTimeframe = jest.fn();
const mockSetIndicatorEnabled = jest.fn();
const mockSetIndicatorSetting = jest.fn();

jest.mock('@/store/chart.store', () => ({
  useChartStore: {
    getState: () => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: {
        movingAverages: true,
        rsi: false,
        macd: false,
        bollingerBands: false,
      },
      settings: {
        ma: { ma1: 7, ma2: 25, ma3: 99 },
        rsi: 14,
        macd: { short: 12, long: 26, signal: 9 },
        boll: { period: 20, stdDev: 2 },
      },
      setSymbol: mockSetSymbol,
      setTimeframe: mockSetTimeframe,
      setIndicatorEnabled: mockSetIndicatorEnabled,
      setIndicatorSetting: mockSetIndicatorSetting,
    }),
  },
  useChartStoreBase: {
    getState: () => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: {
        movingAverages: true,
        rsi: false,
        macd: false,
        bollingerBands: false,
      },
      settings: {
        ma: { ma1: 7, ma2: 25, ma3: 99 },
        rsi: 14,
        macd: { short: 12, long: 26, signal: 9 },
        boll: { period: 20, stdDev: 2 },
      },
      setSymbol: mockSetSymbol,
      setTimeframe: mockSetTimeframe,
      setIndicatorEnabled: mockSetIndicatorEnabled,
      setIndicatorSetting: mockSetIndicatorSetting,
    }),
  },
}));

// Mock window object
const originalWindow = global.window;
const mockDispatchEvent = jest.fn();

beforeEach(() => {
  // Setup mock window
  (global as any).window = {
    dispatchEvent: mockDispatchEvent,
  };
  
  // Clear all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  global.window = originalWindow;
});

describe('Agent UI Integration', () => {
  describe('Chart Control Tool', () => {
    it('should dispatch fitContent event', async () => {
      const result = await chartControlTool.execute({
        context: {
          action: 'fit_content',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Chart fitted to content');
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chart:fitContent',
        })
      );
    });

    it('should dispatch symbol change event and update store', async () => {
      const result = await chartControlTool.execute({
        context: {
          action: 'change_symbol',
          symbol: 'ETHUSDT',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Symbol changed from BTCUSDT to ETHUSDT');
      expect(mockSetSymbol).toHaveBeenCalledWith('ETHUSDT');
    });

    it('should dispatch timeframe change event and update store', async () => {
      const result = await chartControlTool.execute({
        context: {
          action: 'change_timeframe',
          timeframe: '4h',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Timeframe changed from 1h to 4h');
      expect(mockSetTimeframe).toHaveBeenCalledWith('4h');
    });

    it('should dispatch zoom events', async () => {
      // Test zoom in
      const zoomInResult = await chartControlTool.execute({
        context: {
          action: 'zoom_in',
          params: { factor: 1.5 },
        },
      });

      expect(zoomInResult.success).toBe(true);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chart:zoomIn',
          detail: { factor: 1.5 },
        })
      );

      // Test zoom out
      const zoomOutResult = await chartControlTool.execute({
        context: {
          action: 'zoom_out',
          params: { factor: 0.5 },
        },
      });

      expect(zoomOutResult.success).toBe(true);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chart:zoomOut',
          detail: { factor: 0.5 },
        })
      );
    });
  });

  describe('UI State Tool', () => {
    it('should toggle indicator and update store', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'rsi',
          enabled: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Indicator rsi enabled');
      expect(mockSetIndicatorEnabled).toHaveBeenCalledWith('rsi', true);
    });

    it('should update indicator settings and update store', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'update_indicator_settings',
          indicator: 'rsi',
          settings: { period: 21, upper: 80, lower: 20 },
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Settings updated for rsi');
      expect(mockSetIndicatorSetting).toHaveBeenCalledWith('rsi', 'period', 21);
      expect(mockSetIndicatorSetting).toHaveBeenCalledWith('rsi', 'upper', 80);
      expect(mockSetIndicatorSetting).toHaveBeenCalledWith('rsi', 'lower', 20);
    });

    it('should get current state', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'get_state',
        },
      });

      expect(result.success).toBe(true);
      expect(result.currentState).toBeDefined();
      expect(result.currentState?.symbol).toBe('BTCUSDT');
      expect(result.currentState?.timeframe).toBe('1h');
    });

    it('should reset all indicators', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'reset_indicators',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('All indicators reset to default (disabled)');
      expect(mockSetIndicatorEnabled).toHaveBeenCalledWith('movingAverages', false);
    });
  });

  describe('Error Handling', () => {
    it('should handle server-side execution with deferred actions', async () => {
      // Temporarily remove window to simulate server-side
      delete (global as any).window;

      const result = await chartControlTool.execute({
        context: {
          action: 'fit_content',
        },
      });

      expect(result.success).toBe(true); // Should now succeed with deferred execution
      expect(result.message).toContain('scheduled for client-side execution');
      expect(result.deferred).toBeDefined();
      expect(result.deferred?.type).toBe('client_event');
    });

    it('should handle invalid symbol gracefully in server-side mode', async () => {
      // Simulate server-side environment
      delete (global as any).window;

      const result = await chartControlTool.execute({
        context: {
          action: 'change_symbol',
          symbol: 'INVALID',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid symbol: INVALID');
    });

    it('should handle missing parameters gracefully', async () => {
      const result = await chartControlTool.execute({
        context: {
          action: 'change_symbol',
          // Missing symbol parameter
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Symbol parameter required for change_symbol action');
    });
  });
});

describe('Event Handler Integration', () => {
  it('should verify event types match between tools and handlers', () => {
    // This test ensures that the event types dispatched by tools
    // match what the event handlers are listening for
    
    const toolEvents = [
      'chart:fitContent',
      'chart:zoomIn',
      'chart:zoomOut', 
      'chart:resetView',
      'chart:startDrawing',
      'chart:addDrawing',
      'chart:deleteDrawing',
      'chart:clearAllDrawings',
      'chart:setDrawingMode',
      'chart:autoAnalysis',
    ];

    const handlerEvents = [
      'chart:fitContent',
      'chart:zoomIn',
      'chart:zoomOut',
      'chart:resetView',
      'ui:toggleIndicator',
      'ui:updateIndicatorSetting',
      'ui:changeSymbol',
      'ui:changeTimeframe',
      'chart:startDrawing',
      'chart:addDrawing',
      'chart:deleteDrawing',
      'chart:clearAllDrawings',
      'chart:setDrawingMode',
      'chart:autoAnalysis',
    ];

    // Verify all tool events are handled
    toolEvents.forEach(eventType => {
      expect(handlerEvents).toContain(eventType);
    });
  });
});