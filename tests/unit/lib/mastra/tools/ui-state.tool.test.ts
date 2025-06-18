// Mock dependencies before imports
jest.mock('@/lib/utils/logger');

// Mock dynamic imports
const mockUseChartBaseStore = {
  getState: jest.fn(),
};

const mockUseIndicatorStore = {
  getState: jest.fn(),
};

jest.mock('@/store/chart', () => ({
  useChartBaseStore: mockUseChartBaseStore,
  useIndicatorStore: mockUseIndicatorStore,
}));

import { uiStateTool } from '@/lib/mastra/tools/ui-state.tool';

// Type cast the execute function to avoid TypeScript errors
const executeUIStateTool = uiStateTool.execute as any;

describe('uiStateTool', () => {
  const mockBaseState = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
  };

  const mockIndicatorState = {
    indicators: {
      ma: true,
      rsi: false,
      macd: false,
      boll: true,
    },
    settings: {
      ma: { period: 20 },
      rsi: { period: 14 },
      macd: { fast: 12, slow: 26, signal: 9 },
      boll: { period: 20, stdDev: 2 },
    },
    setIndicatorEnabled: jest.fn(),
    setIndicatorSetting: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUseChartBaseStore.getState.mockReturnValue(mockBaseState);
    mockUseIndicatorStore.getState.mockReturnValue(mockIndicatorState);
    
    // Mock window object
    global.window = {} as any;
  });

  afterEach(() => {
    delete (global as any).window;
  });

  describe('tool configuration', () => {
    it('should have correct metadata', () => {
      expect(uiStateTool.id).toBe('ui-state-control');
      expect(uiStateTool.description).toContain('UI state management tool');
      expect(uiStateTool.inputSchema).toBeDefined();
      expect(uiStateTool.outputSchema).toBeDefined();
    });
  });

  describe('execute - get_state action', () => {
    it('should retrieve current UI state', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'get_state',
        },
      });

      expect(result).toEqual({
        success: true,
        action: 'get_state',
        currentState: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          indicators: {
            ma: true,
            rsi: false,
            macd: false,
            boll: true,
          },
          settings: {
            ma: { period: 20 },
            rsi: { period: 14 },
            macd: { fast: 12, slow: 26, signal: 9 },
            boll: { period: 20, stdDev: 2 },
          },
        },
        message: 'Current UI state retrieved',
      });
    });
  });

  describe('execute - toggle_indicator action', () => {
    it('should toggle indicator on/off', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'toggle_indicator',
          indicator: 'rsi',
          enabled: true,
        },
      });

      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledWith('rsi', true);
      expect(result).toMatchObject({
        success: true,
        action: 'toggle_indicator',
        changes: ['rsi: false → true'],
        message: 'Indicator rsi enabled',
      });
    });

    it('should toggle indicator without explicit enabled value', async () => {
      await executeUIStateTool({
        context: {
          action: 'toggle_indicator',
          indicator: 'movingAverages',
        },
      });

      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledWith('ma', false);
    });

    it('should map indicator names correctly', async () => {
      const mappings = [
        { input: 'movingAverages', expected: 'ma' },
        { input: 'rsi', expected: 'rsi' },
        { input: 'macd', expected: 'macd' },
        { input: 'bollingerBands', expected: 'boll' },
      ];

      for (const mapping of mappings) {
        await executeUIStateTool({
          context: {
            action: 'toggle_indicator',
            indicator: mapping.input,
            enabled: true,
          },
        });

        expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledWith(
          mapping.expected,
          true
        );
      }
    });

    it('should return error for missing indicator parameter', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'toggle_indicator',
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Indicator parameter required for toggle_indicator action',
      });
    });

    it('should return error for unknown indicator', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'toggle_indicator',
          indicator: 'unknownIndicator' as any,
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Unknown indicator: unknownIndicator',
      });
    });
  });

  describe('execute - update_indicator_settings action', () => {
    it('should update indicator settings', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'update_indicator_settings',
          indicator: 'rsi',
          settings: {
            period: 21,
            overbought: 80,
            oversold: 20,
          },
        },
      });

      expect(mockIndicatorState.setIndicatorSetting).toHaveBeenCalledTimes(3);
      expect(mockIndicatorState.setIndicatorSetting).toHaveBeenCalledWith('rsi', 'period', 21);
      expect(mockIndicatorState.setIndicatorSetting).toHaveBeenCalledWith('rsi', 'overbought', 80);
      expect(mockIndicatorState.setIndicatorSetting).toHaveBeenCalledWith('rsi', 'oversold', 20);

      expect(result).toMatchObject({
        success: true,
        action: 'update_indicator_settings',
        changes: ['rsi.period: 21', 'rsi.overbought: 80', 'rsi.oversold: 20'],
        message: 'Settings updated for rsi',
      });
    });

    it('should return error when indicator is missing', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'update_indicator_settings',
          settings: { period: 21 },
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Both indicator and settings parameters required',
      });
    });

    it('should return error when settings are missing', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'update_indicator_settings',
          indicator: 'rsi',
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Both indicator and settings parameters required',
      });
    });

    it('should handle empty settings object', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'update_indicator_settings',
          indicator: 'macd',
          settings: {},
        },
      });

      expect(mockIndicatorState.setIndicatorSetting).not.toHaveBeenCalled();
      expect(result.changes).toEqual([]);
    });
  });

  describe('execute - get_indicators action', () => {
    it('should retrieve indicator states', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'get_indicators',
        },
      });

      expect(result).toEqual({
        success: true,
        action: 'get_indicators',
        currentState: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          indicators: mockIndicatorState.indicators,
          settings: mockIndicatorState.settings,
        },
        message: 'Indicator states retrieved',
      });
    });
  });

  describe('execute - reset_indicators action', () => {
    it('should reset all indicators to disabled', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'reset_indicators',
        },
      });

      // Should disable only enabled indicators
      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledTimes(2);
      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledWith('ma', false);
      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledWith('boll', false);

      expect(result).toMatchObject({
        success: true,
        action: 'reset_indicators',
        changes: ['ma: enabled → disabled', 'boll: enabled → disabled'],
        message: 'All indicators reset to default (disabled)',
      });
    });

    it('should handle case where all indicators are already disabled', async () => {
      mockIndicatorState.indicators = {
        ma: false,
        rsi: false,
        macd: false,
        boll: false,
      };

      const result = await executeUIStateTool({
        context: {
          action: 'reset_indicators',
        },
      });

      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledTimes(4);
      expect(result.changes).toEqual([]);
    });
  });

  describe('execute - server environment', () => {
    it('should return error when executed in server environment', async () => {
      delete (global as any).window;

      const result = await executeUIStateTool({
        context: {
          action: 'get_state',
        },
      });

      expect(result).toEqual({
        success: false,
        action: 'get_state',
        message: 'UI state control requires browser environment',
        error: 'Server-side execution not supported',
      });
    });
  });

  describe('execute - unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await executeUIStateTool({
        context: {
          action: 'unknown_action' as any,
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Unknown action: unknown_action',
      });
    });
  });

  describe('execute - error handling', () => {
    it('should handle store access errors', async () => {
      mockUseChartBaseStore.getState.mockImplementation(() => {
        throw new Error('Store access failed');
      });

      const result = await executeUIStateTool({
        context: {
          action: 'get_state',
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Store access failed',
        message: 'UI state operation failed: get_state',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockUseIndicatorStore.getState.mockImplementation(() => {
        throw 'String error';
      });

      const result = await executeUIStateTool({
        context: {
          action: 'get_indicators',
        },
      });

      expect(result).toMatchObject({
        success: false,
        error: 'String error',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle complex settings updates', async () => {
      const complexSettings = {
        period: 50,
        multiplier: 2.5,
        offset: -1,
        colors: ['#FF0000', '#00FF00'],
        enabled: true,
        style: { lineWidth: 2, opacity: 0.8 },
      };

      const result = await executeUIStateTool({
        context: {
          action: 'update_indicator_settings',
          indicator: 'bollingerBands',
          settings: complexSettings,
        },
      });

      expect(mockIndicatorState.setIndicatorSetting).toHaveBeenCalledTimes(6);
      expect(result.changes).toHaveLength(6);
    });

    it('should preserve state updates across multiple operations', async () => {
      // First operation
      await executeUIStateTool({
        context: {
          action: 'toggle_indicator',
          indicator: 'rsi',
          enabled: true,
        },
      });

      // Update mock state to reflect the change
      mockIndicatorState.indicators.rsi = true;

      // Second operation should see the updated state
      const result = await executeUIStateTool({
        context: {
          action: 'get_state',
        },
      });

      expect(result.currentState.indicators.rsi).toBe(true);
    });

    it('should handle rapid successive calls', async () => {
      const promises = [
        executeUIStateTool({ context: { action: 'get_state' } }),
        executeUIStateTool({ context: { action: 'get_indicators' } }),
        executeUIStateTool({ 
          context: { 
            action: 'toggle_indicator', 
            indicator: 'macd',
            enabled: true,
          } 
        }),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle all indicator types in reset', async () => {
      // Set all indicators to enabled
      mockIndicatorState.indicators = {
        ma: true,
        rsi: true,
        macd: true,
        boll: true,
      };

      const result = await executeUIStateTool({
        context: {
          action: 'reset_indicators',
        },
      });

      expect(mockIndicatorState.setIndicatorEnabled).toHaveBeenCalledTimes(4);
      expect(result.changes).toHaveLength(4);
    });

    it('should return consistent state format across all actions', async () => {
      const actions = ['get_state', 'get_indicators', 'toggle_indicator', 'reset_indicators'];
      
      for (const action of actions) {
        const context: any = { action };
        if (action === 'toggle_indicator') {
          context.indicator = 'rsi';
        }

        const result = await executeUIStateTool({ context });

        if (result.success && result.currentState) {
          expect(result.currentState).toHaveProperty('symbol');
          expect(result.currentState).toHaveProperty('timeframe');
          expect(result.currentState).toHaveProperty('indicators');
          expect(result.currentState).toHaveProperty('settings');
        }
      }
    });
  });
});