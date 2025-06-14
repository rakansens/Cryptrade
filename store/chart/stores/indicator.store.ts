/**
 * Indicator Store
 * 
 * インジケーターの状態と設定を管理
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { logger } from '@/lib/utils/logger';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import type { 
  IndicatorState, 
  IndicatorActions
} from '../types';
import { DEFAULT_INDICATORS, DEFAULT_SETTINGS } from '../types';

const debug = createStoreDebugger('IndicatorStore');

// Define initial state for consistency
const initialState: IndicatorState = {
  indicators: DEFAULT_INDICATORS,
  settings: DEFAULT_SETTINGS,
};

export const useIndicatorStore = create<IndicatorState & IndicatorActions>()(
  devtools(
    subscribeWithSelector<IndicatorState & IndicatorActions>((set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      setIndicators: (indicators) => {
        debug('setIndicators');
        set({ indicators });
        logger.info('[IndicatorStore] Indicators updated', { indicators });
      },

      updateIndicator: (key, enabled) => {
        debug('updateIndicator');
        set((state) => ({
          indicators: {
            ...state.indicators,
            [key]: enabled,
          },
        }));
        logger.info('[IndicatorStore] Indicator toggled', { key, enabled });
      },

      setIndicatorEnabled: (indicator, enabled) => {
        debug('setIndicatorEnabled');
        set((state) => ({
          indicators: {
            ...state.indicators,
            [indicator]: enabled,
          },
        }));
        logger.info('[IndicatorStore] Indicator enabled state changed', { 
          indicator, 
          enabled 
        });
      },

      setIndicatorSetting: (indicator, key, value) => {
        debug('setIndicatorSetting');
        set((state) => {
          const currentSettings = state.settings[indicator as keyof typeof state.settings];
          
          if (typeof currentSettings === 'object' && currentSettings !== null) {
            return {
              settings: {
                ...state.settings,
                [indicator]: {
                  ...currentSettings,
                  [key]: value,
                },
              },
            };
          } else {
            return {
              settings: {
                ...state.settings,
                [indicator]: value,
              },
            };
          }
        });
        logger.info('[IndicatorStore] Indicator setting changed', { 
          indicator, 
          key, 
          value 
        });
      },

      setSettings: (settings) => {
        debug('setSettings');
        set({ settings });
        logger.info('[IndicatorStore] All settings updated');
      },

      updateSetting: (key, value) => {
        debug('updateSetting');
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        }));
        logger.info('[IndicatorStore] Setting updated', { key, value });
      },

      reset: () => {
        debug('reset');
        set(initialState);
        logger.info('[IndicatorStore] Store reset to initial state');
      },
    })),
    {
      name: 'indicator-store',
    }
  )
);