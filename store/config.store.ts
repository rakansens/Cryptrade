import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';

// Storage engine interface for future abstraction
interface StorageEngine {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// Default localStorage implementation
const defaultStorageEngine: StorageEngine = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

// Theme configuration
export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'red';

export interface ThemeConfig {
  mode: ThemeMode;
  accentColor: AccentColor;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
}

// Chart configuration
export interface ChartConfig {
  showGrid: boolean;
  showCrosshair: boolean;
  showVolume: boolean;
  candlestickStyle: 'candles' | 'hollow' | 'ohlc';
  timeFormat: '12h' | '24h';
  priceFormat: 'auto' | '2' | '4' | '6' | '8';
}

// Indicator configuration
export interface IndicatorConfig {
  showAdvancedIndicators: boolean;
  defaultPeriods: {
    rsi: number;
    macd: { short: number; long: number; signal: number };
    ma: number[];
    bollinger: { period: number; stdDev: number };
  };
  colors: {
    bullish: string;
    bearish: string;
    neutral: string;
  };
}

// Application configuration
export interface AppConfig {
  locale: string;
  currency: string;
  timezone: string;
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

// Performance configuration
export interface PerformanceConfig {
  maxDataPoints: number;
  batchSize: number;
  updateThrottle: number; // milliseconds
  enableAnimations: boolean;
  enableHardwareAcceleration: boolean;
}

interface ConfigState {
  // Configuration sections
  theme: ThemeConfig;
  chart: ChartConfig;
  indicators: IndicatorConfig;
  app: AppConfig;
  performance: PerformanceConfig;
  
  // Storage configuration
  storageEngine: StorageEngine;
  storageVersion: number;
  
  // Migration and initialization state
  isInitialized: boolean;
  migrationCompleted: boolean;
}

interface ConfigActions {
  // Theme actions
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  updateTheme: (config: Partial<ThemeConfig>) => void;
  
  // Chart actions
  updateChart: (config: Partial<ChartConfig>) => void;
  toggleGrid: () => void;
  toggleCrosshair: () => void;
  
  // Indicator actions
  updateIndicators: (config: Partial<IndicatorConfig>) => void;
  toggleAdvancedIndicators: () => void;
  
  // App actions
  updateApp: (config: Partial<AppConfig>) => void;
  setLocale: (locale: string) => void;
  setCurrency: (currency: string) => void;
  toggleAutoRefresh: () => void;
  
  // Performance actions
  updatePerformance: (config: Partial<PerformanceConfig>) => void;
  
  // Storage actions
  setStorageEngine: (engine: StorageEngine) => void;
  exportConfig: () => string;
  importConfig: (configJson: string) => boolean;
  
  // Reset and initialization
  resetToDefaults: () => void;
  initialize: () => void;
}

type ConfigStore = ConfigState & ConfigActions;

const debug = createStoreDebugger('ConfigStore');

// Default configurations
const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  accentColor: 'blue',
};

const DEFAULT_CHART: ChartConfig = {
  showGrid: true,
  showCrosshair: true,
  showVolume: true,
  candlestickStyle: 'candles',
  timeFormat: '24h',
  priceFormat: 'auto',
};

const DEFAULT_INDICATORS: IndicatorConfig = {
  showAdvancedIndicators: false,
  defaultPeriods: {
    rsi: 14,
    macd: { short: 12, long: 26, signal: 9 },
    ma: [7, 25, 99],
    bollinger: { period: 20, stdDev: 2 },
  },
  colors: {
    bullish: '#0ddfba',
    bearish: '#ff4d4d',
    neutral: '#8fa0aa',
  },
};

const DEFAULT_APP: AppConfig = {
  locale: 'en-US',
  currency: 'USD',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoRefresh: true,
  refreshInterval: 1000,
  soundEnabled: false,
  notificationsEnabled: false,
};

const DEFAULT_PERFORMANCE: PerformanceConfig = {
  maxDataPoints: 1000,
  batchSize: 10,
  updateThrottle: 16, // ~60fps
  enableAnimations: true,
  enableHardwareAcceleration: true,
};

const INITIAL_STATE: ConfigState = {
  theme: DEFAULT_THEME,
  chart: DEFAULT_CHART,
  indicators: DEFAULT_INDICATORS,
  app: DEFAULT_APP,
  performance: DEFAULT_PERFORMANCE,
  storageEngine: defaultStorageEngine,
  storageVersion: 1,
  isInitialized: false,
  migrationCompleted: false,
};

const useConfigStoreBase = create<ConfigStore>()(
  persist(
    subscribeWithSelector<ConfigStore>((set, get) => ({
      ...INITIAL_STATE,
      
      // Theme actions
      setThemeMode: (mode) => {
        debug('setThemeMode');
        set((state) => ({
          theme: { ...state.theme, mode },
        }));
        logger.info('[ConfigStore] Theme mode changed', { mode });
      },
      
      setAccentColor: (accentColor) => {
        debug('setAccentColor');
        set((state) => ({
          theme: { ...state.theme, accentColor },
        }));
        logger.info('[ConfigStore] Accent color changed', { accentColor });
      },
      
      updateTheme: (config) => {
        debug('updateTheme');
        set((state) => ({
          theme: { ...state.theme, ...config },
        }));
        logger.info('[ConfigStore] Theme updated', config);
      },
      
      // Chart actions
      updateChart: (config) => {
        debug('updateChart');
        set((state) => ({
          chart: { ...state.chart, ...config },
        }));
        logger.info('[ConfigStore] Chart config updated', config);
      },
      
      toggleGrid: () => {
        debug('toggleGrid');
        set((state) => ({
          chart: { ...state.chart, showGrid: !state.chart.showGrid },
        }));
      },
      
      toggleCrosshair: () => {
        debug('toggleCrosshair');
        set((state) => ({
          chart: { ...state.chart, showCrosshair: !state.chart.showCrosshair },
        }));
      },
      
      // Indicator actions
      updateIndicators: (config) => {
        debug('updateIndicators');
        set((state) => ({
          indicators: { ...state.indicators, ...config },
        }));
        logger.info('[ConfigStore] Indicators config updated', config);
      },
      
      toggleAdvancedIndicators: () => {
        debug('toggleAdvancedIndicators');
        set((state) => ({
          indicators: {
            ...state.indicators,
            showAdvancedIndicators: !state.indicators.showAdvancedIndicators,
          },
        }));
      },
      
      // App actions
      updateApp: (config) => {
        debug('updateApp');
        set((state) => ({
          app: { ...state.app, ...config },
        }));
        logger.info('[ConfigStore] App config updated', config);
      },
      
      setLocale: (locale) => {
        debug('setLocale');
        set((state) => ({
          app: { ...state.app, locale },
        }));
        logger.info('[ConfigStore] Locale changed', { locale });
      },
      
      setCurrency: (currency) => {
        debug('setCurrency');
        set((state) => ({
          app: { ...state.app, currency },
        }));
        logger.info('[ConfigStore] Currency changed', { currency });
      },
      
      toggleAutoRefresh: () => {
        debug('toggleAutoRefresh');
        set((state) => ({
          app: { ...state.app, autoRefresh: !state.app.autoRefresh },
        }));
      },
      
      // Performance actions
      updatePerformance: (config) => {
        debug('updatePerformance');
        set((state) => ({
          performance: { ...state.performance, ...config },
        }));
        logger.info('[ConfigStore] Performance config updated', config);
      },
      
      // Storage actions
      setStorageEngine: (engine) => {
        debug('setStorageEngine');
        set({ storageEngine: engine });
        logger.info('[ConfigStore] Storage engine changed');
      },
      
      exportConfig: () => {
        const state = get();
        const exportData = {
          theme: state.theme,
          chart: state.chart,
          indicators: state.indicators,
          app: state.app,
          performance: state.performance,
          version: state.storageVersion,
          exportDate: new Date().toISOString(),
        };
        return JSON.stringify(exportData, null, 2);
      },
      
      importConfig: (configJson) => {
        try {
          const importData = JSON.parse(configJson);
          
          // Basic validation
          if (!importData.version || typeof importData !== 'object') {
            logger.error('[ConfigStore] Invalid config format');
            return false;
          }
          
          // Apply imported configuration
          set((state) => ({
            theme: { ...DEFAULT_THEME, ...importData.theme },
            chart: { ...DEFAULT_CHART, ...importData.chart },
            indicators: { ...DEFAULT_INDICATORS, ...importData.indicators },
            app: { ...DEFAULT_APP, ...importData.app },
            performance: { ...DEFAULT_PERFORMANCE, ...importData.performance },
          }));
          
          logger.info('[ConfigStore] Config imported successfully');
          return true;
        } catch (error) {
          logger.error('[ConfigStore] Config import failed', error);
          return false;
        }
      },
      
      // Reset and initialization
      resetToDefaults: () => {
        debug('resetToDefaults');
        set({
          theme: DEFAULT_THEME,
          chart: DEFAULT_CHART,
          indicators: DEFAULT_INDICATORS,
          app: DEFAULT_APP,
          performance: DEFAULT_PERFORMANCE,
        });
        logger.info('[ConfigStore] Reset to defaults');
      },
      
      initialize: () => {
        debug('initialize');
        set({ isInitialized: true, migrationCompleted: true });
        logger.info('[ConfigStore] Initialized');
      },
    })),
    {
      name: 'cryptrade-config',
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        chart: state.chart,
        indicators: state.indicators,
        app: state.app,
        performance: state.performance,
        storageVersion: state.storageVersion,
      }),
      // Migration logic for future versions
      migrate: (persistedState: unknown, version: number) => {
        logger.info('[ConfigStore] Migrating config', { from: version, to: 1 });
        return persistedState;
      },
    }
  )
);

// Custom hooks
export const useConfigStore = <T>(
  selector: (state: ConfigStore) => T
) => {
  return useConfigStoreBase(selector);
};

// Theme hooks
export const useThemeConfig = () => 
  useConfigStore(state => state.theme);

export const useThemeMode = () => 
  useConfigStore(state => state.theme.mode);

export const useAccentColor = () => 
  useConfigStore(state => state.theme.accentColor);

// Chart hooks
export const useChartConfig = () => 
  useConfigStore(state => state.chart);

// Indicator hooks
export const useIndicatorConfig = () => 
  useConfigStore(state => state.indicators);

export const useAdvancedIndicators = () => 
  useConfigStore(state => state.indicators.showAdvancedIndicators);

// App hooks
export const useAppConfig = () => 
  useConfigStore(state => state.app);

export const useLocale = () => 
  useConfigStore(state => state.app.locale);

// Performance hooks
export const usePerformanceConfig = () => 
  useConfigStore(state => state.performance);

// Actions hooks
export const useConfigActions = () => {
  const setThemeMode = useConfigStoreBase(state => state.setThemeMode);
  const setAccentColor = useConfigStoreBase(state => state.setAccentColor);
  const updateTheme = useConfigStoreBase(state => state.updateTheme);
  const updateChart = useConfigStoreBase(state => state.updateChart);
  const updateIndicators = useConfigStoreBase(state => state.updateIndicators);
  const updateApp = useConfigStoreBase(state => state.updateApp);
  const updatePerformance = useConfigStoreBase(state => state.updatePerformance);
  const toggleAdvancedIndicators = useConfigStoreBase(state => state.toggleAdvancedIndicators);
  const toggleAutoRefresh = useConfigStoreBase(state => state.toggleAutoRefresh);
  const resetToDefaults = useConfigStoreBase(state => state.resetToDefaults);
  const exportConfig = useConfigStoreBase(state => state.exportConfig);
  const importConfig = useConfigStoreBase(state => state.importConfig);
  
  return {
    setThemeMode,
    setAccentColor,
    updateTheme,
    updateChart,
    updateIndicators,
    updateApp,
    updatePerformance,
    toggleAdvancedIndicators,
    toggleAutoRefresh,
    resetToDefaults,
    exportConfig,
    importConfig,
  };
};

// Combined hook
export const useConfig = () => {
  const theme = useThemeConfig();
  const chart = useChartConfig();
  const indicators = useIndicatorConfig();
  const app = useAppConfig();
  const performance = usePerformanceConfig();
  const actions = useConfigActions();
  
  return {
    theme,
    chart,
    indicators,
    app,
    performance,
    ...actions,
  };
};