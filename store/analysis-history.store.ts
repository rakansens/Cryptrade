// Analysis history store with database integration

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { createStoreDebugger } from '@/lib/utils/zustand-helpers';
import { logger } from '@/lib/utils/logger';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import type { 
  AnalysisRecord, 
  TouchEvent, 
  PerformanceMetrics,
  TrackingData 
} from '@/types/analysis-history';
import { 
  validateAnalysisRecord, 
  validateTouchEvent,
  calculatePerformanceMetrics,
  calculateAccuracy 
} from '@/types/analysis-history';

// =============================================================================
// STATE INTERFACE
// =============================================================================

interface AnalysisHistoryState {
  // Data
  records: AnalysisRecord[];
  
  // UI state
  selectedRecord: string | null;
  filter: 'all' | 'active' | 'completed' | 'success' | 'failure';
  sortBy: 'timestamp' | 'accuracy' | 'symbol' | 'type';
  sortOrder: 'asc' | 'desc';
  
  // Performance cache
  performanceMetrics: PerformanceMetrics | null;
  lastCalculated: number;
  
  // DB sync state
  isDbEnabled: boolean;
  isSyncing: boolean;
  currentSessionId: string | null;
}

interface AnalysisHistoryActions {
  // Record management
  addRecord: (record: Omit<AnalysisRecord, 'id' | 'timestamp'>) => Promise<string>;
  updateRecord: (id: string, updates: Partial<AnalysisRecord>) => Promise<void>;
  deleteRecord: (id: string) => void;
  getRecord: (id: string) => AnalysisRecord | undefined;
  
  // Touch event management
  addTouchEvent: (recordId: string, touchEvent: Omit<TouchEvent, 'time'>) => Promise<void>;
  updateTrackingStatus: (recordId: string, status: TrackingData['status']) => void;
  completeTracking: (recordId: string, finalResult: 'success' | 'partial' | 'failure') => void;
  
  // Filtering and sorting
  setFilter: (filter: AnalysisHistoryState['filter']) => void;
  setSorting: (sortBy: AnalysisHistoryState['sortBy'], order?: AnalysisHistoryState['sortOrder']) => void;
  setSelectedRecord: (id: string | null) => void;
  
  // Performance analytics
  getPerformanceMetrics: () => PerformanceMetrics;
  refreshMetrics: () => void;
  getFilteredRecords: () => AnalysisRecord[];
  
  // Utility
  exportData: () => string;
  importData: (jsonData: string) => void;
  clearHistory: () => void;
  
  // DB sync
  enableDbSync: (sessionId?: string) => Promise<void>;
  disableDbSync: () => void;
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: (sessionId?: string) => Promise<void>;
  
  // DB preparation
  markForSync: (id: string) => void;
  getUnsyncedRecords: () => AnalysisRecord[];
}

type AnalysisHistoryStore = AnalysisHistoryState & AnalysisHistoryActions;

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

const debug = createStoreDebugger('AnalysisHistoryStore');

const generateRecordId = () => `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const useAnalysisHistoryBase = create<AnalysisHistoryStore>()(
  persist(
    subscribeWithSelector<AnalysisHistoryStore>((set, get) => ({
      // Initial state
      records: [],
      selectedRecord: null,
      filter: 'all',
      sortBy: 'timestamp',
      sortOrder: 'desc',
      performanceMetrics: null,
      lastCalculated: 0,
      isDbEnabled: true,
      isSyncing: false,
      currentSessionId: null,
      
      // Record management with DB integration
      addRecord: async (recordData) => {
        debug('addRecord');
        const id = generateRecordId();
        const timestamp = Date.now();
        
        try {
          const record: AnalysisRecord = {
            ...recordData,
            id,
            timestamp,
            tracking: {
              ...recordData.tracking,
              status: 'active',
              startTime: timestamp,
              touches: []
            },
            dbMeta: {
              version: 1,
              synced: false
            }
          };
          
          // Validate record before adding
          const validatedRecord = validateAnalysisRecord(record);
          
          // Update local state immediately
          set((state) => ({
            records: [...state.records, validatedRecord],
            performanceMetrics: null, // Invalidate cache
          }));
          
          // Save to database if enabled
          const state = get();
          if (state.isDbEnabled) {
            try {
              const recordId = await AnalysisAPI.saveAnalysis({
                sessionId: state.currentSessionId || undefined,
                symbol: validatedRecord.symbol,
                interval: validatedRecord.interval,
                type: validatedRecord.type,
                proposalData: {
                  price: validatedRecord.proposal.price,
                  confidence: validatedRecord.proposal.confidence,
                  mlPrediction: validatedRecord.proposal.mlPrediction,
                  zones: validatedRecord.proposal.zones,
                  indicators: validatedRecord.proposal.indicators,
                  patterns: validatedRecord.proposal.patterns,
                  chartImageUrl: validatedRecord.proposal.chartImageUrl,
                },
              });
              
              // Update ID to match database
              set(state => ({
                records: state.records.map(r => 
                  r.id === id ? { ...r, id: recordId, dbMeta: { ...r.dbMeta, synced: true } } : r
                ),
              }));
              
              logger.info('[AnalysisHistory] Record saved to DB', { 
                id: recordId,
                type: validatedRecord.type 
              });
              
              return recordId;
            } catch (error) {
              logger.error('[AnalysisHistory] Failed to save to DB', { error });
              // Mark as unsynced
              set(state => ({
                records: state.records.map(r => 
                  r.id === id ? { ...r, dbMeta: { ...r.dbMeta, synced: false } } : r
                ),
              }));
            }
          }
          
          logger.info('[AnalysisHistory] Record added', { 
            id, 
            type: validatedRecord.type, 
            symbol: validatedRecord.symbol 
          });
          
          return id;
        } catch (error) {
          logger.error('[AnalysisHistory] Failed to add record', error);
          throw error;
        }
      },
      
      updateRecord: async (id, updates) => {
        debug('updateRecord');
        set((state) => {
          const recordIndex = state.records.findIndex(r => r.id === id);
          if (recordIndex === -1) {
            logger.warn('[AnalysisHistory] Record not found for update', { id });
            return state;
          }
          
          const updatedRecord = {
            ...state.records[recordIndex],
            ...updates,
            dbMeta: {
              ...state.records[recordIndex].dbMeta,
              synced: false, // Mark as needs sync
              version: ((state.records[recordIndex].dbMeta?.version || 1) + 1)
            }
          };
          
          const newRecords = [...state.records];
          newRecords[recordIndex] = updatedRecord;
          
          return {
            records: newRecords,
            performanceMetrics: null, // Invalidate cache
          };
        });
        
        // TODO: Update in database if enabled
        
        logger.info('[AnalysisHistory] Record updated', { id });
      },
      
      deleteRecord: (id) => {
        debug('deleteRecord');
        set((state) => ({
          records: state.records.filter(r => r.id !== id),
          selectedRecord: state.selectedRecord === id ? null : state.selectedRecord,
          performanceMetrics: null,
        }));
        
        logger.info('[AnalysisHistory] Record deleted', { id });
      },
      
      getRecord: (id) => {
        return get().records.find(r => r.id === id);
      },
      
      // Touch event management with DB integration
      addTouchEvent: async (recordId, touchEventData) => {
        debug('addTouchEvent');
        try {
          const touchEvent: TouchEvent = {
            ...touchEventData,
            time: Date.now()
          };
          
          // Validate touch event
          const validatedTouchEvent = validateTouchEvent(touchEvent);
          
          get().updateRecord(recordId, {
            tracking: {
              ...get().getRecord(recordId)?.tracking,
              touches: [
                ...(get().getRecord(recordId)?.tracking.touches || []),
                validatedTouchEvent
              ]
            } as TrackingData
          });
          
          // Save to database if enabled
          const state = get();
          if (state.isDbEnabled) {
            try {
              await AnalysisAPI.recordTouchEvent(recordId, {
                price: touchEventData.price,
                result: touchEventData.result as 'bounce' | 'break' | 'test',
                strength: touchEventData.strength,
                volume: touchEventData.volume,
              });
              
              logger.info('[AnalysisHistory] Touch event saved to DB', { recordId });
            } catch (error) {
              logger.error('[AnalysisHistory] Failed to save touch event to DB', { error });
            }
          }
          
          logger.info('[AnalysisHistory] Touch event added', { recordId, result: touchEvent.result });
        } catch (error) {
          logger.error('[AnalysisHistory] Failed to add touch event', error);
        }
      },
      
      updateTrackingStatus: (recordId, status) => {
        debug('updateTrackingStatus');
        const record = get().getRecord(recordId);
        if (!record) return;
        
        const updates: Partial<AnalysisRecord> = {
          tracking: {
            ...record.tracking,
            status,
            ...(status === 'completed' && { endTime: Date.now() })
          }
        };
        
        // Calculate duration if completing
        if (status === 'completed' && record.tracking.startTime) {
          updates.tracking!.duration = Date.now() - record.tracking.startTime;
        }
        
        get().updateRecord(recordId, updates);
      },
      
      completeTracking: (recordId, finalResult) => {
        debug('completeTracking');
        const record = get().getRecord(recordId);
        if (!record) return;
        
        const endTime = Date.now();
        const accuracy = calculateAccuracy({
          ...record,
          tracking: {
            ...record.tracking,
            status: 'completed',
            finalResult
          }
        });
        
        get().updateRecord(recordId, {
          tracking: {
            ...record.tracking,
            status: 'completed',
            endTime,
            finalResult,
            duration: endTime - record.tracking.startTime
          },
          performance: {
            accuracy,
            actualBounces: record.tracking.touches.filter(t => t.result === 'bounce').length,
            predictedBounces: record.proposal.mlPrediction?.expectedBounces || 0,
            holdDuration: endTime - record.tracking.startTime
          }
        });
        
        logger.info('[AnalysisHistory] Tracking completed', { recordId, finalResult, accuracy });
        
        // Show browser notification for completed analysis (only in client)
        if (typeof window !== 'undefined') {
          import('@/lib/notifications/browser-notifications').then(({ notifications }) => {
            notifications.showAnalysisComplete(record.symbol, finalResult, accuracy)
              .catch(error => logger.warn('[AnalysisHistory] Failed to show completion notification', error));
          });
        }
      },
      
      // UI state management
      setFilter: (filter) => {
        debug('setFilter');
        set({ filter });
      },
      
      setSorting: (sortBy, order) => {
        debug('setSorting');
        set((state) => ({
          sortBy,
          sortOrder: order || (state.sortBy === sortBy && state.sortOrder === 'desc' ? 'asc' : 'desc')
        }));
      },
      
      setSelectedRecord: (id) => {
        debug('setSelectedRecord');
        set({ selectedRecord: id });
      },
      
      // Performance analytics
      getPerformanceMetrics: () => {
        const state = get();
        const now = Date.now();
        
        // Use cache if recent (5 minutes)
        if (state.performanceMetrics && (now - state.lastCalculated) < 300000) {
          return state.performanceMetrics;
        }
        
        const metrics = calculatePerformanceMetrics(state.records);
        
        // Update cache
        set({
          performanceMetrics: metrics,
          lastCalculated: now
        });
        
        return metrics;
      },
      
      refreshMetrics: () => {
        debug('refreshMetrics');
        set({
          performanceMetrics: null,
          lastCalculated: 0
        });
      },
      
      getFilteredRecords: () => {
        const { records, filter, sortBy, sortOrder } = get();
        
        // Apply filter
        let filtered = records;
        switch (filter) {
          case 'active':
            filtered = records.filter(r => r.tracking.status === 'active');
            break;
          case 'completed':
            filtered = records.filter(r => r.tracking.status === 'completed');
            break;
          case 'success':
            filtered = records.filter(r => 
              r.tracking.status === 'completed' && 
              r.tracking.finalResult === 'success'
            );
            break;
          case 'failure':
            filtered = records.filter(r => 
              r.tracking.status === 'completed' && 
              r.tracking.finalResult === 'failure'
            );
            break;
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
          type SortValue = string | number | undefined;
          let aVal: SortValue, bVal: SortValue;
          
          switch (sortBy) {
            case 'timestamp':
              aVal = a.timestamp;
              bVal = b.timestamp;
              break;
            case 'accuracy':
              aVal = a.performance?.accuracy || 0;
              bVal = b.performance?.accuracy || 0;
              break;
            case 'symbol':
              aVal = a.symbol;
              bVal = b.symbol;
              break;
            case 'type':
              aVal = a.type;
              bVal = b.type;
              break;
            default:
              aVal = a.timestamp;
              bVal = b.timestamp;
          }
          
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        
        return filtered;
      },
      
      // Utility functions
      exportData: () => {
        debug('exportData');
        const data = {
          records: get().records,
          exportedAt: Date.now(),
          version: '1.0.0'
        };
        return JSON.stringify(data, null, 2);
      },
      
      importData: (jsonData) => {
        debug('importData');
        try {
          const data = JSON.parse(jsonData);
          if (data.records && Array.isArray(data.records)) {
            set({
              records: data.records.map((r: unknown) => validateAnalysisRecord(r as AnalysisRecord)),
              performanceMetrics: null
            });
            logger.info('[AnalysisHistory] Data imported', { count: data.records.length });
          }
        } catch (error) {
          logger.error('[AnalysisHistory] Failed to import data', error);
          throw new Error('Invalid import data format');
        }
      },
      
      clearHistory: () => {
        debug('clearHistory');
        set({
          records: [],
          selectedRecord: null,
          performanceMetrics: null,
          lastCalculated: 0
        });
        logger.info('[AnalysisHistory] History cleared');
      },
      
      // DB sync
      enableDbSync: async (sessionId) => {
        debug('enableDbSync');
        set({ 
          isDbEnabled: true,
          currentSessionId: sessionId || null,
        });
        
        // Migrate existing records to DB
        const state = get();
        if (state.records.length > 0) {
          try {
            set({ isSyncing: true });
            
            for (const record of state.records) {
              if (!record.dbMeta?.synced) {
                await AnalysisAPI.saveAnalysis({
                  sessionId: sessionId,
                  symbol: record.symbol,
                  interval: record.interval,
                  type: record.type,
                  proposalData: {
                    price: record.proposal.price,
                    confidence: record.proposal.confidence,
                    mlPrediction: record.proposal.mlPrediction,
                    zones: record.proposal.zones,
                    indicators: record.proposal.indicators,
                    patterns: record.proposal.patterns,
                    chartImageUrl: record.proposal.chartImageUrl,
                  },
                });
              }
            }
            
            set(state => ({
              isSyncing: false,
              records: state.records.map(r => ({ 
                ...r, 
                dbMeta: { ...r.dbMeta, synced: true } 
              })),
            }));
            
            logger.info('[AnalysisHistory] DB sync enabled and data migrated');
          } catch (error) {
            logger.error('[AnalysisHistory] Failed to migrate to DB', { error });
            set({ isSyncing: false });
          }
        }
      },
      
      disableDbSync: () => {
        debug('disableDbSync');
        set({ isDbEnabled: false, currentSessionId: null });
        logger.info('[AnalysisHistory] DB sync disabled');
      },
      
      syncWithDatabase: async () => {
        debug('syncWithDatabase');
        const state = get();
        
        if (!state.isDbEnabled) return;
        
        set({ isSyncing: true });
        
        try {
          // Sync unsynced records
          const unsynced = state.records.filter(r => !r.dbMeta?.synced);
          
          for (const record of unsynced) {
            await AnalysisAPI.saveAnalysis({
              sessionId: state.currentSessionId || undefined,
              symbol: record.symbol,
              interval: record.interval,
              type: record.type,
              proposalData: {
                price: record.proposal.price,
                confidence: record.proposal.confidence,
                mlPrediction: record.proposal.mlPrediction,
                zones: record.proposal.zones,
                indicators: record.proposal.indicators,
                patterns: record.proposal.patterns,
                chartImageUrl: record.proposal.chartImageUrl,
              },
            });
          }
          
          set((state) => {
            state.isSyncing = false;
            state.records = state.records.map(r => ({ 
              ...r, 
              dbMeta: { ...r.dbMeta, synced: true } 
            }));
          });
          
          logger.info('[AnalysisHistory] Synced with database', { count: unsynced.length });
        } catch (error) {
          logger.error('[AnalysisHistory] Sync failed', { error });
          set({ isSyncing: false });
        }
      },
      
      loadFromDatabase: async (sessionId) => {
        debug('loadFromDatabase');
        const state = get();
        
        if (!state.isDbEnabled) return;
        
        try {
          const dbRecords = await AnalysisAPI.getSessionAnalyses(
            sessionId || state.currentSessionId || ''
          );
          
          // Records are already converted by AnalysisAPI
          const records: AnalysisRecord[] = dbRecords;
          
          set({ records });
          
          logger.info('[AnalysisHistory] Loaded from database', { count: records.length });
        } catch (error) {
          logger.error('[AnalysisHistory] Failed to load from database', { error });
        }
      },
      
      // DB preparation
      markForSync: (id) => {
        const record = get().getRecord(id);
        if (record) {
          get().updateRecord(id, {
            dbMeta: {
              version: record.dbMeta?.version || 1,
              synced: false,
              ...record.dbMeta
            }
          });
        }
      },
      
      getUnsyncedRecords: () => {
        return get().records.filter(r => !r.dbMeta?.synced);
      }
    })),
    {
      name: 'analysis-history-storage',
      version: 2, // Increment for DB integration
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          // Migration from version 0 to 1
          // Add dbMeta to existing records
          const migratedState = persistedState ? { ...persistedState } : {};
          
          if (migratedState.records && Array.isArray(migratedState.records)) {
            migratedState.records = migratedState.records.map((record: AnalysisRecord) => ({
              ...record,
              dbMeta: {
                version: 1,
                synced: false
              }
            }));
          }
          
          return migratedState;
        }
        
        if (version === 1) {
          // Migration from version 1 to 2 (DB integration)
          return {
            ...persistedState,
            isDbEnabled: true,
            isSyncing: false,
            currentSessionId: null,
          };
        }
        
        return persistedState;
      },
      partialize: (state) => ({
        records: state.records,
        filter: state.filter,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        isDbEnabled: state.isDbEnabled,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

export const useAnalysisHistory = <T>(
  selector: (state: AnalysisHistoryStore) => T
) => {
  return useAnalysisHistoryBase(selector);
};

// Specific hooks for common use cases
export const useAnalysisRecords = () => {
  const getFilteredRecords = useAnalysisHistory(state => state.getFilteredRecords);
  return getFilteredRecords();
};

export const useAnalysisMetrics = () => {
  const getPerformanceMetrics = useAnalysisHistory(state => state.getPerformanceMetrics);
  return getPerformanceMetrics();
};

export const useAnalysisDbEnabled = () =>
  useAnalysisHistory(state => state.isDbEnabled);

export const useAnalysisSyncing = () =>
  useAnalysisHistory(state => state.isSyncing);

export const useAnalysisActions = () => {
  const addRecord = useAnalysisHistoryBase(state => state.addRecord);
  const updateRecord = useAnalysisHistoryBase(state => state.updateRecord);
  const deleteRecord = useAnalysisHistoryBase(state => state.deleteRecord);
  const addTouchEvent = useAnalysisHistoryBase(state => state.addTouchEvent);
  const updateTrackingStatus = useAnalysisHistoryBase(state => state.updateTrackingStatus);
  const completeTracking = useAnalysisHistoryBase(state => state.completeTracking);
  const setFilter = useAnalysisHistoryBase(state => state.setFilter);
  const setSorting = useAnalysisHistoryBase(state => state.setSorting);
  const setSelectedRecord = useAnalysisHistoryBase(state => state.setSelectedRecord);
  const refreshMetrics = useAnalysisHistoryBase(state => state.refreshMetrics);
  const exportData = useAnalysisHistoryBase(state => state.exportData);
  const importData = useAnalysisHistoryBase(state => state.importData);
  const clearHistory = useAnalysisHistoryBase(state => state.clearHistory);
  const enableDbSync = useAnalysisHistoryBase(state => state.enableDbSync);
  const disableDbSync = useAnalysisHistoryBase(state => state.disableDbSync);
  const syncWithDatabase = useAnalysisHistoryBase(state => state.syncWithDatabase);
  const loadFromDatabase = useAnalysisHistoryBase(state => state.loadFromDatabase);
  
  return {
    addRecord,
    updateRecord,
    deleteRecord,
    addTouchEvent,
    updateTrackingStatus,
    completeTracking,
    setFilter,
    setSorting,
    setSelectedRecord,
    refreshMetrics,
    exportData,
    importData,
    clearHistory,
    enableDbSync,
    disableDbSync,
    syncWithDatabase,
    loadFromDatabase,
  };
};

export default useAnalysisHistoryBase;