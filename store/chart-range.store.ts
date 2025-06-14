import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { LogicalRange } from 'lightweight-charts';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';

interface ChartRangeState {
  // Main chart visible range for synchronization
  visibleLogicalRange: LogicalRange | null;
  
  // Track which charts are registered for sync
  registeredCharts: Set<string>;
  
  // Prevent infinite sync loops
  isSyncing: boolean;
}

interface ChartRangeActions {
  // Range management
  setVisibleLogicalRange: (range: LogicalRange | null) => void;
  
  // Chart registration
  registerChart: (chartId: string) => void;
  unregisterChart: (chartId: string) => void;
  
  // Sync control
  setSyncing: (syncing: boolean) => void;
  
  // Reset
  reset: () => void;
}

type ChartRangeStore = ChartRangeState & ChartRangeActions;

const debug = createStoreDebugger('ChartRangeStore');

const useChartRangeStoreBase = create<ChartRangeStore>()(
  subscribeWithSelector<ChartRangeStore>((set, get) => ({
    // Initial state
    visibleLogicalRange: null,
    registeredCharts: new Set(),
    isSyncing: false,
    
    // Actions
    setVisibleLogicalRange: (range) => {
      const state = get();
      
      // Prevent sync loops
      if (state.isSyncing) return;
      
      debug('setVisibleLogicalRange');
      set({ visibleLogicalRange: range });
      
      logger.debug('[ChartRangeStore] Range updated', { 
        from: range?.from, 
        to: range?.to,
        registeredCharts: state.registeredCharts.size 
      });
    },
    
    registerChart: (chartId) => {
      debug('registerChart');
      set((state) => {
        const newRegisteredCharts = new Set(state.registeredCharts);
        newRegisteredCharts.add(chartId);
        
        logger.info('[ChartRangeStore] Chart registered', { 
          chartId, 
          totalCharts: newRegisteredCharts.size 
        });
        
        return { registeredCharts: newRegisteredCharts };
      });
    },
    
    unregisterChart: (chartId) => {
      debug('unregisterChart');
      set((state) => {
        const newRegisteredCharts = new Set(state.registeredCharts);
        newRegisteredCharts.delete(chartId);
        
        logger.info('[ChartRangeStore] Chart unregistered', { 
          chartId, 
          totalCharts: newRegisteredCharts.size 
        });
        
        return { registeredCharts: newRegisteredCharts };
      });
    },
    
    setSyncing: (syncing) => {
      set({ isSyncing: syncing });
    },
    
    reset: () => {
      debug('reset');
      set({
        visibleLogicalRange: null,
        registeredCharts: new Set(),
        isSyncing: false,
      });
    },
  }))
);

// Custom hooks
export const useChartRangeStore = <T>(
  selector: (state: ChartRangeStore) => T
) => {
  return useChartRangeStoreBase(selector);
};

// Convenience hooks
export const useVisibleLogicalRange = () => 
  useChartRangeStore(state => state.visibleLogicalRange);

export const useChartRangeSync = () => 
  useChartRangeStore(state => state.isSyncing);

export const useRegisteredChartsCount = () => 
  useChartRangeStore(state => state.registeredCharts.size);

// Actions hook
export const useChartRangeActions = () => {
  const setVisibleLogicalRange = useChartRangeStoreBase(state => state.setVisibleLogicalRange);
  const registerChart = useChartRangeStoreBase(state => state.registerChart);
  const unregisterChart = useChartRangeStoreBase(state => state.unregisterChart);
  const setSyncing = useChartRangeStoreBase(state => state.setSyncing);
  const reset = useChartRangeStoreBase(state => state.reset);
  
  return {
    setVisibleLogicalRange,
    registerChart,
    unregisterChart,
    setSyncing,
    reset,
  };
};

// Combined hook
export const useChartRange = () => {
  const visibleLogicalRange = useVisibleLogicalRange();
  const isSyncing = useChartRangeSync();
  const registeredChartsCount = useRegisteredChartsCount();
  const actions = useChartRangeActions();
  
  return {
    visibleLogicalRange,
    isSyncing,
    registeredChartsCount,
    ...actions,
  };
};