/**
 * Pattern Store
 * 
 * チャートパターンの状態管理
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/components/ui/toast';
import { ChartPersistenceManager, chartPersistence } from '@/lib/storage/chart-persistence-wrapper';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import type { 
  PatternState, 
  PatternActions,
  PatternData
} from '../types';

const debug = createStoreDebugger('PatternStore');

// Define initial state for consistency
const initialState: PatternState = {
  patterns: new Map<string, PatternData>(),
};

export const usePatternStore = create<PatternState & PatternActions>()(
  devtools(
    subscribeWithSelector<PatternState & PatternActions>((set, get) => ({
      // Initial state with loaded patterns
      ...initialState,
      patterns: new Map(), // Will be loaded asynchronously

      // Initialize patterns asynchronously
      initializePatterns: async () => {
        try {
          const patterns = await chartPersistence.loadPatterns();
          set({ patterns });
          logger.info('[PatternStore] Patterns loaded', { count: patterns.size });
        } catch (error) {
          logger.error('[PatternStore] Failed to load patterns', { error });
        }
      },

      // Actions
      addPattern: (id, pattern) => {
        debug('addPattern');
        set((state) => {
          const newPatterns = new Map(state.patterns);
          newPatterns.set(id, pattern);
          chartPersistence.savePatterns(newPatterns);
          return { patterns: newPatterns };
        });
        
        showToast('Pattern added', 'success');
        logger.info('[PatternStore] Pattern added', { 
          id, 
          type: pattern.type,
          confidence: pattern.confidence 
        });
      },

      removePattern: (id) => {
        debug('removePattern');
        set((state) => {
          const newPatterns = new Map(state.patterns);
          const removed = newPatterns.delete(id);
          
          if (removed) {
            chartPersistence.savePatterns(newPatterns);
            showToast('Pattern removed', 'info');
            logger.info('[PatternStore] Pattern removed', { id });
          } else {
            logger.warn('[PatternStore] Pattern not found', { id });
          }
          
          return { patterns: newPatterns };
        });
      },

      clearPatterns: () => {
        debug('clearPatterns');
        const emptyPatterns = new Map<string, PatternData>();
        set({ patterns: emptyPatterns });
        chartPersistence.savePatterns(emptyPatterns);
        showToast('All patterns cleared', 'info');
        logger.info('[PatternStore] All patterns cleared');
      },

      getPattern: (id) => {
        const { patterns } = get();
        return patterns.get(id);
      },

      reset: () => {
        debug('reset');
        set(initialState);
        chartPersistence.savePatterns(new Map());
        logger.info('[PatternStore] Store reset to initial state');
      },
    })),
    {
      name: 'pattern-store',
    }
  )
);

// Initialize patterns on store creation
if (typeof window !== 'undefined') {
  usePatternStore.getState().initializePatterns();
}