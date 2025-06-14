import { uiStateTool } from '../ui-state.tool';

// Mock store modules
const mockBaseStore = {
  symbol: 'BTCUSDT',
  timeframe: '1h',
};

const mockIndicatorStore = {
  indicators: {
    ma: false,
    rsi: false,
    macd: false,
    boll: false,
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

// Mock the store imports
jest.mock('@/store/chart', () => ({
  useChartBaseStore: {
    getState: () => mockBaseStore,
  },
  useIndicatorStore: {
    getState: () => mockIndicatorStore,
  },
}));

describe('uiStateTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock store state
    mockIndicatorStore.indicators = {
      ma: false,
      rsi: false,
      macd: false,
      boll: false,
    };
    
    // Setup window object for browser environment check
    global.window = {} as any;
  });

  afterEach(() => {
    // Clean up window mock
    delete (global as any).window;
  });

  describe('server-side execution', () => {
    it('should return error when executed on server side', async () => {
      delete (global as any).window;

      const result = await uiStateTool.execute({
        context: {
          action: 'get_state',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server-side execution not supported');
      expect(result.message).toBe('UI state control requires browser environment');
    });
  });

  describe('get_state action', () => {
    it('should return current UI state', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'get_state',
        },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('get_state');
      expect(result.message).toBe('Current UI state retrieved');
      expect(result.currentState).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        indicators: {
          ma: false,
          rsi: false,
          macd: false,
          boll: false,
        },
        settings: {
          ma: { period: 20 },
          rsi: { period: 14 },
          macd: { fast: 12, slow: 26, signal: 9 },
          boll: { period: 20, stdDev: 2 },
        },
      });
    });
  });

  describe('toggle_indicator action', () => {
    it('should toggle moving averages indicator', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'movingAverages',
        },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('toggle_indicator');
      expect(result.message).toBe('Indicator movingAverages enabled');
      expect(result.changes).toEqual(['movingAverages: false → true']);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('ma', true);
    });

    it('should toggle RSI indicator', async () => {
      mockIndicatorStore.indicators.rsi = true;

      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'rsi',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Indicator rsi disabled');
      expect(result.changes).toEqual(['rsi: true → false']);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('rsi', false);
    });

    it('should enable indicator with explicit enabled parameter', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'macd',
          enabled: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Indicator macd enabled');
      expect(result.changes).toEqual(['macd: false → true']);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('macd', true);
    });

    it('should disable indicator with explicit enabled parameter', async () => {
      mockIndicatorStore.indicators.boll = true;

      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'bollingerBands',
          enabled: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Indicator bollingerBands disabled');
      expect(result.changes).toEqual(['bollingerBands: true → false']);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('boll', false);
    });

    it('should return error when indicator is missing', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Indicator parameter required for toggle_indicator action');
    });

    it('should return error for unknown indicator', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'unknown' as any,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown indicator: unknown');
    });
  });

  describe('update_indicator_settings action', () => {
    it('should update indicator settings', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'update_indicator_settings',
          indicator: 'movingAverages',
          settings: {
            period: 50,
            type: 'EMA',
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('update_indicator_settings');
      expect(result.message).toBe('Settings updated for movingAverages');
      expect(result.changes).toEqual([
        'movingAverages.period: 50',
        'movingAverages.type: EMA',
      ]);
      expect(mockIndicatorStore.setIndicatorSetting).toHaveBeenCalledWith('movingAverages', 'period', 50);
      expect(mockIndicatorStore.setIndicatorSetting).toHaveBeenCalledWith('movingAverages', 'type', 'EMA');
    });

    it('should return error when indicator is missing', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'update_indicator_settings',
          settings: { period: 30 },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Both indicator and settings parameters required');
    });

    it('should return error when settings is missing', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'update_indicator_settings',
          indicator: 'rsi',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Both indicator and settings parameters required');
    });
  });

  describe('get_indicators action', () => {
    it('should return all indicator states', async () => {
      mockIndicatorStore.indicators.ma = true;
      mockIndicatorStore.indicators.rsi = true;

      const result = await uiStateTool.execute({
        context: {
          action: 'get_indicators',
        },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('get_indicators');
      expect(result.message).toBe('Indicator states retrieved');
      expect(result.currentState?.indicators).toEqual({
        ma: true,
        rsi: true,
        macd: false,
        boll: false,
      });
    });
  });

  describe('reset_indicators action', () => {
    it('should reset all indicators to disabled', async () => {
      // Set some indicators as enabled
      mockIndicatorStore.indicators.ma = true;
      mockIndicatorStore.indicators.rsi = true;
      mockIndicatorStore.indicators.macd = true;

      const result = await uiStateTool.execute({
        context: {
          action: 'reset_indicators',
        },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('reset_indicators');
      expect(result.message).toBe('All indicators reset to default (disabled)');
      expect(result.changes).toEqual([
        'ma: enabled → disabled',
        'rsi: enabled → disabled',
        'macd: enabled → disabled',
      ]);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('ma', false);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('rsi', false);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('macd', false);
      expect(mockIndicatorStore.setIndicatorEnabled).toHaveBeenCalledWith('boll', false);
    });

    it('should not report changes for already disabled indicators', async () => {
      // Only one indicator enabled
      mockIndicatorStore.indicators.rsi = true;

      const result = await uiStateTool.execute({
        context: {
          action: 'reset_indicators',
        },
      });

      expect(result.success).toBe(true);
      expect(result.changes).toEqual(['rsi: enabled → disabled']);
    });
  });

  describe('unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await uiStateTool.execute({
        context: {
          action: 'unknown_action' as any,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown action: unknown_action');
    });
  });

  describe('error handling', () => {
    it('should handle store import errors', async () => {
      // Temporarily mock the import to throw an error
      jest.doMock('@/store/chart', () => {
        throw new Error('Failed to import store');
      });

      const result = await uiStateTool.execute({
        context: {
          action: 'get_state',
        },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('UI state operation failed: get_state');
      expect(result.error).toContain('Failed to import store');
    });

    it('should handle setIndicatorEnabled errors', async () => {
      mockIndicatorStore.setIndicatorEnabled.mockImplementation(() => {
        throw new Error('Failed to set indicator');
      });

      const result = await uiStateTool.execute({
        context: {
          action: 'toggle_indicator',
          indicator: 'rsi',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to set indicator');
    });
  });

  describe('return state consistency', () => {
    it('should always return currentState after successful operations', async () => {
      const actions = [
        { action: 'get_state' as const },
        { action: 'toggle_indicator' as const, indicator: 'rsi' as const },
        { action: 'update_indicator_settings' as const, indicator: 'ma' as const, settings: { period: 30 } },
        { action: 'get_indicators' as const },
        { action: 'reset_indicators' as const },
      ];

      for (const context of actions) {
        const result = await uiStateTool.execute({ context });
        
        if (result.success) {
          expect(result.currentState).toBeDefined();
          expect(result.currentState).toHaveProperty('symbol');
          expect(result.currentState).toHaveProperty('timeframe');
          expect(result.currentState).toHaveProperty('indicators');
          expect(result.currentState).toHaveProperty('settings');
        }
      }
    });
  });
});