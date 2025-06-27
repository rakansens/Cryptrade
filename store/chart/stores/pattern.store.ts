/**
 * Pattern Store
 *
 * チャートパターンの状態管理
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/components/ui/toast';
import { chartPersistence } from '@/lib/storage/chart-persistence-wrapper';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import type {
  PatternState,
  PatternActions
} from '../types';
import type { PatternData } from '@/store/chart/types';
import { mapPatternDataArray, safePatternDataArray } from '@/store/types/pattern';

// Edge Runtime compatible UUID generation
function generateUUID(): string {
  // Use Web Crypto API if available (Edge Runtime compatible)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback to manual UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
          const patternsArray = await chartPersistence.loadPatterns();
          const patterns = new Map(patternsArray.map(p => [p.id || generateUUID(), p] as [string, PatternData]));
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
          chartPersistence.savePatterns(Array.from(newPatterns.values()));
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
            chartPersistence.savePatterns(Array.from(newPatterns.values()));
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
        chartPersistence.savePatterns([]);
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
        chartPersistence.savePatterns([]);
        logger.info('[PatternStore] Store reset to initial state');
      },
    })),
    {
      name: 'pattern-store',
    }
  )
);

// Note: initializePatterns should be called explicitly by components when needed