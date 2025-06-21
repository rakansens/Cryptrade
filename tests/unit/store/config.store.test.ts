/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';;

// Import the base store directly for testing
import { useConfigStoreBase } from '@/store/config.store';

import { 
  useConfig,
  useConfigStore,
  useThemeConfig,
  useThemeMode,
  useAccentColor,
  useChartConfig,
  useIndicatorConfig,
  useAppConfig,
  usePerformanceConfig,
  useConfigActions,
  type ThemeMode,
  type AccentColor,
  type ChartConfig,
  type IndicatorConfig,
  type AppConfig,
  type PerformanceConfig
} from '@/store/config.store';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock zustand helpers
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: () => jest.fn()
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

import { resetAllStores } from '@/tests/setup/reset-stores';

describe('Store: ConfigStore', () => {
  // Helper to get initial state matching the actual store
  const getInitialState = () => ({
    theme: {
      mode: 'dark' as const,
      accentColor: 'blue' as const,
    },
    chart: {
      showGrid: true,
      showCrosshair: true,
      showVolume: true,
      candlestickStyle: 'candles' as const,
      timeFormat: '24h' as const,
      priceFormat: 'auto' as const,
    },
    indicators: {
      showAdvancedIndicators: false,
      defaultPeriods: {
        rsi: 14,
        macd: { short: 12, long: 26, signal: 9 },
        ma: [10, 20, 50],
        ema: [10, 20, 50],
        bollinger: { period: 20, stdDev: 2 },
      },
      colors: {
        bullish: '#16a34a',
        bearish: '#dc2626',
        neutral: '#6b7280',
      },
    },
    app: {
      locale: 'en-US',
      currency: 'USD',
      timezone: 'UTC',
      autoRefresh: true,
      refreshInterval: 1000,
      soundEnabled: false,
      notificationsEnabled: false,
    },
    performance: {
      maxDataPoints: 1000,
      batchSize: 10,
      updateThrottle: 50,
      enableAnimations: true,
    },
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    // Reset store state using the base store's setState
    const initialState = getInitialState();
    useConfigStoreBase.setState(initialState);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useConfig());
      
      // Theme defaults
      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.theme.accentColor).toBe('blue');
      
      // Chart defaults
      expect(result.current.chart.showGrid).toBe(true);
      expect(result.current.chart.showCrosshair).toBe(true);
      expect(result.current.chart.showVolume).toBe(true);
      expect(result.current.chart.candlestickStyle).toBe('candles');
      
      // Indicators defaults
      expect(result.current.indicators.showAdvancedIndicators).toBe(false);
      expect(result.current.indicators.defaultPeriods.rsi).toBe(14);
      
      // App defaults
      expect(result.current.app.locale).toBe('en-US');
      expect(result.current.app.currency).toBe('USD');
      expect(result.current.app.autoRefresh).toBe(true);
      expect(result.current.app.refreshInterval).toBe(1000);
      
      // Performance defaults
      expect(result.current.performance.maxDataPoints).toBe(1000);
      expect(result.current.performance.enableAnimations).toBe(true);
    });
  });

  describe('Theme Configuration', () => {
    it('should update theme mode', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.setThemeMode('light');
      });
      
      expect(result.current.theme.mode).toBe('light');
    });

    it('should update accent color', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.setAccentColor('green');
      });
      
      expect(result.current.theme.accentColor).toBe('green');
    });

    it('should update theme config', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateTheme({
          mode: 'system',
          accentColor: 'purple',
          customColors: {
            primary: '#6366f1',
            secondary: '#8b5cf6'
          }
        });
      });
      
      expect(result.current.theme.mode).toBe('system');
      expect(result.current.theme.accentColor).toBe('purple');
      expect(result.current.theme.customColors?.primary).toBe('#6366f1');
    });

    it('should work with useThemeMode hook', () => {
      const { result: modeResult } = renderHook(() => useThemeMode());
      const { result: actionsResult } = renderHook(() => useConfigActions());
      
      expect(modeResult.current).toBe('dark');
      
      act(() => {
        actionsResult.current.setThemeMode('light');
      });
      
      expect(modeResult.current).toBe('light');
    });
  });

  describe('Chart Configuration', () => {
    it('should update chart config', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateChart({
          showGrid: false,
          candlestickStyle: 'hollow',
          timeFormat: '12h'
        });
      });
      
      expect(result.current.chart.showGrid).toBe(false);
      expect(result.current.chart.candlestickStyle).toBe('hollow');
      expect(result.current.chart.timeFormat).toBe('12h');
    });

    it('should toggle grid', () => {
      const { result } = renderHook(() => useConfigActions());
      const { result: chartResult } = renderHook(() => useChartConfig());
      
      const initialGrid = chartResult.current.showGrid;
      
      act(() => {
        result.current.updateChart({ showGrid: !initialGrid });
      });
      
      expect(chartResult.current.showGrid).toBe(!initialGrid);
    });

    it('should toggle crosshair', () => {
      const { result } = renderHook(() => useConfigActions());
      const { result: chartResult } = renderHook(() => useChartConfig());
      
      const initialCrosshair = chartResult.current.showCrosshair;
      
      act(() => {
        result.current.updateChart({ showCrosshair: !initialCrosshair });
      });
      
      expect(chartResult.current.showCrosshair).toBe(!initialCrosshair);
    });
  });

  describe('Indicator Configuration', () => {
    it('should update indicators config', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateIndicators({
          defaultPeriods: {
            rsi: 21,
            macd: { short: 10, long: 20, signal: 7 },
            ma: [5, 20, 50],
            bollinger: { period: 25, stdDev: 2.5 }
          }
        });
      });
      
      expect(result.current.indicators.defaultPeriods.rsi).toBe(21);
      expect(result.current.indicators.defaultPeriods.macd.short).toBe(10);
      expect(result.current.indicators.defaultPeriods.ma).toEqual([5, 20, 50]);
    });

    it('should toggle advanced indicators', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.toggleAdvancedIndicators();
      });
      
      expect(result.current.indicators.showAdvancedIndicators).toBe(true);
      
      act(() => {
        result.current.toggleAdvancedIndicators();
      });
      
      expect(result.current.indicators.showAdvancedIndicators).toBe(false);
    });

    it('should update indicator colors', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateIndicators({
          colors: {
            bullish: '#00ff00',
            bearish: '#ff0000',
            neutral: '#808080'
          }
        });
      });
      
      expect(result.current.indicators.colors.bullish).toBe('#00ff00');
      expect(result.current.indicators.colors.bearish).toBe('#ff0000');
    });
  });

  describe('App Configuration', () => {
    it('should update app config', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateApp({
          locale: 'ja-JP',
          currency: 'JPY',
          soundEnabled: true,
          notificationsEnabled: true
        });
      });
      
      expect(result.current.app.locale).toBe('ja-JP');
      expect(result.current.app.currency).toBe('JPY');
      expect(result.current.app.soundEnabled).toBe(true);
      expect(result.current.app.notificationsEnabled).toBe(true);
    });

    it('should toggle auto refresh', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.toggleAutoRefresh();
      });
      
      expect(result.current.app.autoRefresh).toBe(false);
      
      act(() => {
        result.current.toggleAutoRefresh();
      });
      
      expect(result.current.app.autoRefresh).toBe(true);
    });

    it('should update refresh interval', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateApp({ refreshInterval: 5000 });
      });
      
      expect(result.current.app.refreshInterval).toBe(5000);
    });
  });

  describe('Performance Configuration', () => {
    it('should update performance config', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updatePerformance({
          maxDataPoints: 2000,
          batchSize: 20,
          updateThrottle: 33,
          enableAnimations: false
        });
      });
      
      expect(result.current.performance.maxDataPoints).toBe(2000);
      expect(result.current.performance.batchSize).toBe(20);
      expect(result.current.performance.updateThrottle).toBe(33);
      expect(result.current.performance.enableAnimations).toBe(false);
    });
  });

  describe('Import/Export Configuration', () => {
    it('should export config as JSON', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.setThemeMode('light');
        result.current.updateChart({ showGrid: false });
      });
      
      const exportedConfig = result.current.exportConfig();
      const parsed = JSON.parse(exportedConfig);
      
      expect(parsed.theme.mode).toBe('light');
      expect(parsed.chart.showGrid).toBe(false);
      expect(parsed.version).toBe(1);
      expect(parsed.exportDate).toBeDefined();
    });

    it('should import valid config', () => {
      const { result } = renderHook(() => useConfig());
      
      const configToImport = {
        version: 1,
        theme: { mode: 'system', accentColor: 'orange' },
        chart: { showGrid: false, showVolume: false },
        indicators: { showAdvancedIndicators: true },
        app: { locale: 'de-DE', currency: 'EUR' },
        performance: { maxDataPoints: 500 }
      };
      
      let success: boolean;
      act(() => {
        success = result.current.importConfig(JSON.stringify(configToImport));
      });
      
      expect(success!).toBe(true);
      expect(result.current.theme.mode).toBe('system');
      expect(result.current.theme.accentColor).toBe('orange');
      expect(result.current.chart.showGrid).toBe(false);
      expect(result.current.app.locale).toBe('de-DE');
    });

    it('should reject invalid config', () => {
      const { result } = renderHook(() => useConfig());
      
      let success: boolean;
      act(() => {
        success = result.current.importConfig('invalid json');
      });
      
      expect(success!).toBe(false);
    });

    it('should reject config without version', () => {
      const { result } = renderHook(() => useConfig());
      
      const configWithoutVersion = {
        theme: { mode: 'light' }
      };
      
      let success: boolean;
      act(() => {
        success = result.current.importConfig(JSON.stringify(configWithoutVersion));
      });
      
      expect(success!).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to defaults', () => {
      const { result } = renderHook(() => useConfig());
      
      // Change some settings
      act(() => {
        result.current.setThemeMode('light');
        result.current.updateChart({ showGrid: false });
        result.current.updateApp({ locale: 'fr-FR' });
      });
      
      // Reset
      act(() => {
        result.current.resetToDefaults();
      });
      
      // Check defaults restored
      expect(result.current.theme.mode).toBe('dark');
      expect(result.current.chart.showGrid).toBe(true);
      expect(result.current.app.locale).toBe('en-US');
    });
  });

  describe('Individual Hooks', () => {
    it('should work with useThemeConfig hook', () => {
      const { result: themeResult } = renderHook(() => useThemeConfig());
      const { result: actionsResult } = renderHook(() => useConfigActions());
      
      expect(themeResult.current.mode).toBe('dark');
      
      act(() => {
        actionsResult.current.updateTheme({ mode: 'light', accentColor: 'red' });
      });
      
      expect(themeResult.current.mode).toBe('light');
      expect(themeResult.current.accentColor).toBe('red');
    });

    it('should work with useIndicatorConfig hook', () => {
      const { result: indicatorResult } = renderHook(() => useIndicatorConfig());
      const { result: actionsResult } = renderHook(() => useConfigActions());
      
      expect(indicatorResult.current.showAdvancedIndicators).toBe(false);
      
      act(() => {
        actionsResult.current.toggleAdvancedIndicators();
      });
      
      expect(indicatorResult.current.showAdvancedIndicators).toBe(true);
    });
  });

  describe('Selector Hook', () => {
    it('should work with custom selectors', () => {
      const { result } = renderHook(() => 
        useConfigStore(state => ({
          isDarkMode: state.theme.mode === 'dark',
          gridEnabled: state.chart.showGrid,
          language: state.app.locale
        }))
      );
      
      expect(result.current.isDarkMode).toBe(true);
      expect(result.current.gridEnabled).toBe(true);
      expect(result.current.language).toBe('en-US');
    });
  });

  describe('State Persistence', () => {
    it('should persist state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useConfig());
      
      act(() => {
        result1.current.setThemeMode('light');
        result1.current.updateChart({ showGrid: false });
      });
      
      const { result: result2 } = renderHook(() => useConfig());
      
      expect(result2.current.theme.mode).toBe('light');
      expect(result2.current.chart.showGrid).toBe(false);
    });

    it('should save to localStorage', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.setThemeMode('light');
      });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cryptrade-config',
        expect.any(String)
      );
    });
  });
});
