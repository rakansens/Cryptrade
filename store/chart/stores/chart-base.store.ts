/**
 * Chart Base Store
 * 
 * チャートの基本設定（symbol, timeframe）と状態管理
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { logger } from '@/lib/utils/logger';
import { ChartPersistenceManager, chartPersistence } from '@/lib/storage/chart-persistence-wrapper';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import type { 
  ChartBaseState, 
  ChartBaseActions
} from '../types';
import { DEFAULT_SYMBOL, DEFAULT_TIMEFRAME } from '../types';

const debug = createStoreDebugger('ChartBaseStore');

export const useChartBaseStore = create<ChartBaseState & ChartBaseActions>()(
  devtools(
    subscribeWithSelector<ChartBaseState & ChartBaseActions>((set, get) => ({
      // Initial state
      symbol: DEFAULT_SYMBOL,
      timeframe: DEFAULT_TIMEFRAME,
      isChartReady: false,
      isLoading: false,
      error: null,

      // Actions
      setSymbol: (symbol) => {
        debug('setSymbol');
        set({ symbol, error: null });
        logger.info('[ChartBaseStore] Symbol changed', { symbol });
      },

      setTimeframe: (timeframe) => {
        debug('setTimeframe');
        const currentState = get();
        
        // タイムフレーム変更前に状態を保存
        chartPersistence.saveTimeframeState({
          symbol: currentState.symbol,
          timeframe: timeframe,
          timestamp: Date.now()
        });
        
        set({ 
          timeframe, 
          error: null,
          isChartReady: false // タイムフレーム変更時はチャートを再初期化
        });
        
        logger.info('[ChartBaseStore] Timeframe changed', { 
          symbol: currentState.symbol,
          timeframe 
        });
      },

      setChartReady: (ready) => {
        debug('setChartReady');
        set({ isChartReady: ready });
        logger.info('[ChartBaseStore] Chart ready state changed', { ready });
      },

      setLoading: (loading) => {
        debug('setLoading');
        set({ isLoading: loading });
      },

      setError: (error) => {
        debug('setError');
        set({ error });
        if (error) {
          logger.error('[ChartBaseStore] Error set', { error });
        }
      },

      reset: () => {
        debug('reset');
        set({
          symbol: DEFAULT_SYMBOL,
          timeframe: DEFAULT_TIMEFRAME,
          isChartReady: false,
          isLoading: false,
          error: null,
        });
        logger.info('[ChartBaseStore] Store reset');
      },
    })),
    {
      name: 'chart-base-store',
    }
  )
);