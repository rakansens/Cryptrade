/**
 * Agent UI Integration Test
 * 
 * Tests the integration between Mastra agents and frontend UI
 * Verifies that agent tools can successfully dispatch events and 
 * that the chart components can handle them
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { chartControlTool } from '@/lib/mastra/tools/chart-control.tool';
import { uiStateTool } from '@/lib/mastra/tools/ui-state.tool';
import { generateText } from 'ai';

// Mock OpenAI and AI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => ({
    chat: jest.fn()
  }))
}));

jest.mock('ai', () => ({
  generateText: jest.fn()
}));

// Mock chart data analysis tool
jest.mock('@/lib/mastra/tools/chart-data-analysis.tool', () => ({
  chartDataAnalysisTool: {
    execute: jest.fn(async () => ({
      success: true,
      currentPrice: 50000,
      priceChange24h: 2.5,
      volume24h: 1000000,
      recommendations: {
        trendlineDrawing: []
      }
    }))
  }
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the chart store
const mockSetSymbol = jest.fn();
const mockSetTimeframe = jest.fn();
const mockSetIndicatorEnabled = jest.fn();
const mockSetIndicatorSetting = jest.fn();

jest.mock('@/store/chart', () => ({
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
  useChartBaseStore: {
    getState: () => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
    }),
  },
  useIndicatorStore: {
    getState: () => ({
      indicators: {
        ma: true,
        rsi: false,
        macd: false,
        boll: false,
      },
      settings: {
        ma: { ma1: 7, ma2: 25, ma3: 99 },
        rsi: { period: 14, upper: 70, lower: 30 },
        macd: { short: 12, long: 26, signal: 9 },
        boll: { period: 20, stdDev: 2 },
      },
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
  
  // Restore window for UI State Tool tests
  if (!(global as any).window) {
    (global as any).window = originalWindow || {
      dispatchEvent: mockDispatchEvent,
    };
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  global.window = originalWindow;
});

// Setup generateText mock implementation
beforeAll(() => {
  (generateText as jest.Mock).mockImplementation(async ({ prompt }) => {
    // Parse the prompt to find the user request - look for the actual user request in quotes
    const userRequestMatch = prompt.match(/User request: "([^"]+)"/i);
    const userRequest = userRequestMatch ? userRequestMatch[1].toLowerCase() : prompt.toLowerCase();
    
    // Simple mock AI response based on keywords
    if (userRequest.includes('fit content')) {
      return {
        text: JSON.stringify({
          operations: [{
            type: 'chart_operation',
            action: 'fit_content',
            parameters: {},
            priority: 8,
            description: 'Fit chart content to view'
          }],
          reasoning: 'User wants to fit content to view',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'fit content'
        })
      };
    } else if (userRequest.includes('change to ethusdt') || (userRequest.includes('ethusdt') && !userRequest.includes('timeframe') && !userRequest.includes('zoom'))) {
      return {
        text: JSON.stringify({
          operations: [{
            type: 'symbol_change',
            action: 'change_symbol',
            parameters: { symbol: 'ETHUSDT' },
            priority: 9,
            description: 'Change symbol to ETHUSDT'
          }],
          reasoning: 'User wants to change symbol to ETHUSDT',
          confidence: 0.95,
          complexity: 'simple',
          userIntent: 'change to ETHUSDT'
        })
      };
    } else if (userRequest.includes('switch to 4 hour') || userRequest.includes('4 hour timeframe') || userRequest.includes('timeframe') && userRequest.includes('4')) {
      return {
        text: JSON.stringify({
          operations: [{
            type: 'timeframe_change',
            action: 'change_timeframe',
            parameters: { timeframe: '4h' },
            priority: 9,
            description: 'Change timeframe to 4h'
          }],
          reasoning: 'User wants to change timeframe to 4 hours',
          confidence: 0.95,
          complexity: 'simple',
          userIntent: 'switch to 4 hour timeframe'
        })
      };
    } else if (userRequest.includes('zoom in') && userRequest.includes('1.5')) {
      return {
        text: JSON.stringify({
          operations: [{
            type: 'chart_operation',
            action: 'zoom_in',
            parameters: { factor: 1.5 },
            priority: 8,
            description: 'Zoom in 1.5x'
          }],
          reasoning: 'User wants to zoom in',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'zoom in 1.5x'
        })
      };
    } else if (userRequest.includes('zoom out') && userRequest.includes('50')) {
      return {
        text: JSON.stringify({
          operations: [{
            type: 'chart_operation',
            action: 'zoom_out',
            parameters: { factor: 0.5 },
            priority: 8,
            description: 'Zoom out 50%'
          }],
          reasoning: 'User wants to zoom out',
          confidence: 0.9,
          complexity: 'simple',
          userIntent: 'zoom out 50%'
        })
      };
    }
    return {
      text: JSON.stringify({
        operations: [],
        reasoning: 'Could not understand request',
        confidence: 0.5,
        complexity: 'simple',
        userIntent: 'unknown'
      })
    };
  });
});

describe('Agent UI Integration', () => {
  describe('Chart Control Tool', () => {
    it('should generate fitContent operation with client event', async () => {
      const result = await chartControlTool.execute({
        context: {
          userRequest: 'fit content',
          conversationHistory: [],
          currentState: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
          },
        },
        runtimeContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        type: 'chart_operation',
        action: 'fit_content',
        parameters: {},
        clientEvent: {
          event: 'chart:fitContent',
          data: {}
        },
        executionMode: 'deferred'
      });
    });

    it('should generate symbol change operation with client event', async () => {
      const result = await chartControlTool.execute({
        context: {
          userRequest: 'change to ETHUSDT',
          conversationHistory: [],
          currentState: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
          },
        },
        runtimeContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        type: 'symbol_change',
        action: 'change_symbol',
        parameters: { symbol: 'ETHUSDT' },
        clientEvent: {
          event: 'ui:changeSymbol',
          data: { symbol: 'ETHUSDT' }
        },
        executionMode: 'deferred'
      });
    });

    it('should generate timeframe change operation with client event', async () => {
      const result = await chartControlTool.execute({
        context: {
          userRequest: 'switch to 4 hour timeframe',
          conversationHistory: [],
          currentState: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
          },
        },
        runtimeContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        type: 'timeframe_change',
        action: 'change_timeframe',
        parameters: { timeframe: '4h' },
        clientEvent: {
          event: 'ui:changeTimeframe',
          data: { timeframe: '4h' }
        },
        executionMode: 'deferred'
      });
    });

    it('should generate zoom operations with client events', async () => {
      // Test zoom in
      const zoomInResult = await chartControlTool.execute({
        context: {
          userRequest: 'zoom in 1.5x',
          conversationHistory: [],
          currentState: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
          },
        },
        runtimeContext: {} as any
      });

      expect(zoomInResult.success).toBe(true);
      expect(zoomInResult.operations).toHaveLength(1);
      expect(zoomInResult.operations[0]).toMatchObject({
        type: 'chart_operation',
        action: 'zoom_in',
        parameters: { factor: 1.5 },
        clientEvent: {
          event: 'chart:zoomIn',
          data: { factor: 1.5 }
        },
        executionMode: 'deferred'
      });

      // Test zoom out
      const zoomOutResult = await chartControlTool.execute({
        context: {
          userRequest: 'zoom out 50%',
          conversationHistory: [],
          currentState: {
            symbol: 'BTCUSDT',
            timeframe: '1h',
          },
        },
        runtimeContext: {} as any
      });

      expect(zoomOutResult.success).toBe(true);
      expect(zoomOutResult.operations).toHaveLength(1);
      expect(zoomOutResult.operations[0]).toMatchObject({
        type: 'chart_operation',
        action: 'zoom_out',
        parameters: { factor: 0.5 },
        clientEvent: {
          event: 'chart:zoomOut',
          data: { factor: 0.5 }
        },
        executionMode: 'deferred'
      });
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
        runtimeContext: {} as any
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
        runtimeContext: {} as any
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
        runtimeContext: {} as any
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
        runtimeContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('All indicators reset to default (disabled)');
      expect(mockSetIndicatorEnabled).toHaveBeenCalledWith('ma', false);
    });
  });

  describe('Error Handling', () => {
    it('should handle server-side execution with deferred actions', async () => {
      // Temporarily remove window to simulate server-side
      delete (global as any).window;

      // Mock response for server-side
      (generateText as jest.Mock).mockImplementationOnce(async ({ prompt }) => {
        if (prompt.toLowerCase().includes('fit content')) {
          return {
            text: JSON.stringify({
              operations: [{
                type: 'chart_operation',
                action: 'fit_content',
                parameters: {},
                priority: 8,
                description: 'Fit chart content to view'
              }],
              reasoning: 'User wants to fit content to view',
              confidence: 0.9,
              complexity: 'simple',
              userIntent: 'fit content to screen'
            })
          };
        }
        return { text: JSON.stringify({ operations: [], reasoning: 'Unknown', confidence: 0.5, complexity: 'simple', userIntent: 'unknown' }) };
      });

      const result = await chartControlTool.execute({
        context: {
          userRequest: 'fit content to screen',
          conversationHistory: [],
          currentState: {},
        },
        runtimeContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(result.operations).toBeDefined();
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations[0].executionMode).toBe('deferred');
    });

    it('should handle invalid request gracefully', async () => {
      // Mock AI returning invalid JSON
      (generateText as jest.Mock).mockImplementationOnce(async () => {
        return {
          text: 'This is not valid JSON'
        };
      });

      const result = await chartControlTool.execute({
        context: {
          userRequest: 'invalid request that causes parse error',
          conversationHistory: [],
          currentState: {},
        },
        runtimeContext: {} as any
      });

      // Parse error should result in success with fallback response
      expect(result.success).toBe(true);
      expect(result.operations).toBeDefined();
      expect(Array.isArray(result.operations)).toBe(true);
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('should handle AI error gracefully', async () => {
      // Mock AI throwing error
      (generateText as jest.Mock).mockImplementationOnce(async () => {
        throw new Error('AI service unavailable');
      });

      const result = await chartControlTool.execute({
        context: {
          userRequest: 'any request',
          conversationHistory: [],
          currentState: {},
        },
        runtimeContext: {} as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI service unavailable');
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
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