/**
 * Chart Persistence Wrapper
 * 
 * This wrapper ensures all chart persistence operations use the database-enabled
 * version by default, with automatic fallback to localStorage
 */

import { ChartPersistenceManager as ChartPersistenceManagerBase } from './chart-persistence';
import { logger } from '@/lib/utils/logger';

// Export the manager as is (it already has DB functionality integrated)
export const ChartPersistenceManager = ChartPersistenceManagerBase;

// Export type-safe methods that ensure DB is used
export const chartPersistence = {
  saveDrawings: (drawings: Parameters<typeof ChartPersistenceManagerBase.saveDrawings>[0]) => 
    ChartPersistenceManagerBase.saveDrawings(drawings),
  loadDrawings: () => 
    ChartPersistenceManagerBase.loadDrawings(),
  savePatterns: (patterns: Parameters<typeof ChartPersistenceManagerBase.savePatterns>[0]) => 
    ChartPersistenceManagerBase.savePatterns(patterns),
  loadPatterns: () => 
    ChartPersistenceManagerBase.loadPatterns(),
  saveTimeframeState: (state: Parameters<typeof ChartPersistenceManagerBase.saveTimeframeState>[0]) => 
    ChartPersistenceManagerBase.saveTimeframeState(state),
  loadTimeframeState: () => 
    ChartPersistenceManagerBase.loadTimeframeState(),
  clearAll: () => 
    ChartPersistenceManagerBase.clearAll(),
  hasTimeframeChanged: (symbol: string, timeframe: string) => 
    ChartPersistenceManagerBase.hasTimeframeChanged(symbol, timeframe),
};

// Log initialization status
logger.info('[ChartPersistence] Database-enabled persistence initialized');