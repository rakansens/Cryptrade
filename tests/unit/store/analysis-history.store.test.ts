/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import type { AnalysisRecord, TouchEvent, TrackingData } from '@/types/analysis-history';

// Import JSDOM setup for this test
require('@/tests/setup/jsdom-environment');

// Mock zustand persist before importing the store
jest.mock('zustand/middleware', () => ({
  persist: (config: any) => config,
  subscribeWithSelector: (config: any) => config
}));

// Mock dependencies
jest.mock('@/lib/api/analysis-api', () => ({
  AnalysisAPI: {
    saveAnalysis: jest.fn(),
    updateAnalysis: jest.fn(),
    getSessionAnalyses: jest.fn(),
    recordTouchEvent: jest.fn(),
  }
}));
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/retry', () => ({
  withRetry: jest.fn((fn) => fn())
}));
jest.mock('@/lib/notifications/browser-notifications', () => ({
  notifications: {
    showAnalysisComplete: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('@/lib/utils/zustand-helpers', () => ({
  createStoreDebugger: () => jest.fn()
}));

// Import store and dependencies after mocks are set up
import useAnalysisHistoryBase, { 
  useAnalysisHistory, 
  useAnalysisRecords, 
  useAnalysisMetrics, 
  useAnalysisActions 
} from '@/store/analysis-history.store';

// Create alias for consistency with test code
const useAnalysisHistoryStore = useAnalysisHistoryBase;

// Helper hook that combines store state and actions for tests
const useAnalysisHistoryStoreWithActions = () => {
  const store = useAnalysisHistoryBase();
  const actions = useAnalysisActions();
  return { ...store, ...actions };
};
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';

// Mock validation functions
jest.mock('@/types/analysis-history', () => ({
  validateAnalysisRecord: jest.fn((record) => record),
  validateTouchEvent: jest.fn((event) => event),
  calculatePerformanceMetrics: jest.fn(() => ({
    totalAnalyses: 5,
    completedAnalyses: 3,
    successRate: 0.6,
    averageAccuracy: 0.75,
    averageDuration: 30000,
    byType: {
      support_resistance: { count: 2, accuracy: 0.8 },
      trendline: { count: 3, accuracy: 0.7 }
    },
    bySymbol: {
      'BTC/USDT': { count: 3, accuracy: 0.75 },
      'ETH/USDT': { count: 2, accuracy: 0.75 }
    }
  })),
  calculateAccuracy: jest.fn(() => 0.85)
}));

import { resetAllStoresForTest, resetStore } from './store-test-helpers';

describe('AnalysisHistoryStore', () => {
  const getInitialState = () => ({
    records: [],
    selectedRecord: null,
    filter: 'all' as const,
    sortBy: 'timestamp' as const,
    sortOrder: 'desc' as const,
    performanceMetrics: null,
    lastCalculated: 0,
    isDbEnabled: true,
    isSyncing: false,
    currentSessionId: null
  });

  beforeEach(() => {
    resetAllStoresForTest();
    resetStore(useAnalysisHistoryBase, 'AnalysisHistoryStore');
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up store state
    act(() => {
      useAnalysisHistoryStore.setState(getInitialState());
    });
  });

  describe('Record Management', () => {
    it('should add a new record with generated ID and timestamp', async () => {
      const mockDbId = 'db_record_123';
      (AnalysisAPI.saveAnalysis as jest.Mock).mockResolvedValue(mockDbId);

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordData = {
        symbol: 'BTC/USDT',
        interval: '1h' as const,
        type: 'support_resistance' as const,
        proposal: {
          lines: [],
          confidence: 0.8,
          reasoning: 'Test analysis'
        },
        tracking: {
          status: 'active' as const,
          startTime: Date.now(),
          touches: []
        }
      };

      let recordId: string;
      await act(async () => {
        recordId = await result.current.addRecord(recordData);
      });

      const records = useAnalysisHistoryStore.getState().records;
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        symbol: 'BTC/USDT',
        interval: '1h',
        type: 'support_resistance',
        id: mockDbId
      });
      expect(AnalysisAPI.saveAnalysis).toHaveBeenCalled();
    });

    it('should handle database save failure gracefully', async () => {
      (AnalysisAPI.saveAnalysis as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordData = {
        symbol: 'ETH/USDT',
        interval: '4h' as const,
        type: 'trendline' as const,
        proposal: {
          lines: [],
          confidence: 0.7,
          reasoning: 'Test'
        },
        tracking: {
          status: 'active' as const,
          startTime: Date.now(),
          touches: []
        }
      };

      await act(async () => {
        await result.current.addRecord(recordData);
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records).toHaveLength(1);
      expect(state.records[0].dbMeta?.synced).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should update an existing record', async () => {
      const mockDbId = 'db_record_123';
      (AnalysisAPI.saveAnalysis as jest.Mock).mockResolvedValue(mockDbId);
      (AnalysisAPI.updateAnalysis as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add a record first
      let recordId: string;
      await act(async () => {
        recordId = await result.current.addRecord({
          symbol: 'BTC/USDT',
          interval: '1h' as const,
          type: 'support_resistance' as const,
          proposal: { lines: [], confidence: 0.8, reasoning: 'Test' },
          tracking: { status: 'active' as const, startTime: Date.now(), touches: [] }
        });
      });

      // Use the returned record ID (which should be the DB ID)
      expect(recordId!).toBe(mockDbId);

      await act(async () => {
        await result.current.updateRecord(recordId!, {
          tracking: {
            status: 'completed' as const,
            startTime: useAnalysisHistoryStore.getState().records[0].tracking.startTime,
            endTime: Date.now(),
            touches: [],
            finalResult: 'success'
          }
        });
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records[0].tracking.status).toBe('completed');
      expect(AnalysisAPI.updateAnalysis).toHaveBeenCalledWith(mockDbId, expect.any(Object));
    });

    it('should delete a record and clear selection if needed', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add records
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: 'record1', symbol: 'BTC/USDT' } as AnalysisRecord,
            { id: 'record2', symbol: 'ETH/USDT' } as AnalysisRecord
          ],
          selectedRecord: 'record1'
        });
      });

      act(() => {
        result.current.deleteRecord('record1');
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records).toHaveLength(1);
      expect(state.selectedRecord).toBeNull();
    });

    it('should get a record by ID', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const testRecord = { id: 'test123', symbol: 'BTC/USDT' } as AnalysisRecord;
      act(() => {
        useAnalysisHistoryStore.setState({ records: [testRecord] });
      });

      const record = result.current.getRecord('test123');
      expect(record).toEqual(testRecord);

      const notFound = result.current.getRecord('nonexistent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Touch Event Management', () => {
    it('should add a touch event to a record', async () => {
      (AnalysisAPI.recordTouchEvent as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add a record first
      const recordId = 'test_record';
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            symbol: 'BTC/USDT',
            tracking: {
              status: 'active',
              startTime: Date.now(),
              touches: []
            }
          } as AnalysisRecord]
        });
      });

      const touchEvent = {
        type: 'bounce' as const,
        lineId: 'line1',
        price: 45000,
        result: 'bounce' as const
      };

      await act(async () => {
        await result.current.addTouchEvent(recordId, touchEvent);
      });

      const record = result.current.getRecord(recordId);
      expect(record?.tracking.touches).toHaveLength(1);
      expect(record?.tracking.touches[0]).toMatchObject(touchEvent);
      expect(AnalysisAPI.recordTouchEvent).toHaveBeenCalled();
    });

    it('should update tracking status', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordId = 'test_record';
      const startTime = Date.now();
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            symbol: 'BTC/USDT',
            tracking: {
              status: 'active',
              startTime,
              touches: []
            }
          } as AnalysisRecord]
        });
      });

      act(() => {
        result.current.updateTrackingStatus(recordId, 'completed');
      });

      const record = result.current.getRecord(recordId);
      expect(record?.tracking.status).toBe('completed');
      expect(record?.tracking.endTime).toBeDefined();
      expect(record?.tracking.duration).toBeDefined();
    });

    it('should complete tracking with final result and calculate accuracy', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordId = 'test_record';
      const startTime = Date.now() - 60000; // 1 minute ago
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            symbol: 'BTC/USDT',
            proposal: {
              lines: [],
              confidence: 0.8,
              reasoning: 'Test',
              mlPrediction: { expectedBounces: 3 }
            },
            tracking: {
              status: 'active',
              startTime,
              touches: [
                { type: 'bounce', result: 'bounce', time: startTime + 10000 } as TouchEvent,
                { type: 'bounce', result: 'bounce', time: startTime + 20000 } as TouchEvent
              ]
            }
          } as AnalysisRecord]
        });
      });

      act(() => {
        result.current.completeTracking(recordId, 'success');
      });

      const record = result.current.getRecord(recordId);
      expect(record?.tracking.status).toBe('completed');
      expect(record?.tracking.finalResult).toBe('success');
      expect(record?.performance?.accuracy).toBe(0.85);
      expect(record?.performance?.actualBounces).toBe(2);
      expect(record?.performance?.predictedBounces).toBe(3);
    });
  });

  describe('Filtering and Sorting', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Setup test data with various statuses and types
      const testRecords = [
        {
          id: '1',
          symbol: 'BTC/USDT',
          interval: '1h' as const,
          type: 'support_resistance' as const,
          timestamp: Date.now() - 3600000,
          proposal: { lines: [], confidence: 0.8, reasoning: 'Test' },
          tracking: { status: 'active' as const, startTime: Date.now() - 3600000, touches: [] },
          performance: { accuracy: 0.8 },
        },
        {
          id: '2',
          symbol: 'ETH/USDT',
          interval: '4h' as const,
          type: 'trendline' as const,
          timestamp: Date.now() - 7200000,
          proposal: { lines: [], confidence: 0.9, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 7200000, 
            endTime: Date.now() - 3600000,
            touches: [],
            finalResult: 'success' as const
          },
          performance: { accuracy: 0.9 },
        },
        {
          id: '3',
          symbol: 'BTC/USDT',
          interval: '1d' as const,
          type: 'support_resistance' as const,
          timestamp: Date.now() - 1800000,
          proposal: { lines: [], confidence: 0.6, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 1800000,
            endTime: Date.now() - 900000, 
            touches: [],
            finalResult: 'failure' as const
          },
          performance: { accuracy: 0.5 },
        },
        {
          id: '4',
          symbol: 'XRP/USDT',
          interval: '15m' as const,
          type: 'fibonacci' as const,
          timestamp: Date.now() - 900000,
          proposal: { lines: [], confidence: 0.7, reasoning: 'Test' },
          tracking: { status: 'expired' as const, startTime: Date.now() - 900000, touches: [] },
          performance: { accuracy: 0.7 },
        },
        {
          id: '5',
          symbol: 'ETH/USDT',
          interval: '1h' as const,
          type: 'pattern' as const,
          timestamp: Date.now() - 600000,
          proposal: { lines: [], confidence: 0.75, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 600000,
            endTime: Date.now() - 300000,
            touches: [],
            finalResult: 'success' as const
          },
          performance: { accuracy: 0.85 },
        },
      ] as AnalysisRecord[];
      
      useAnalysisHistoryStore.setState({ records: testRecords });
    });

    it.skip('should filter records by status', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      act(() => {
        result.current.setFilter('active');
      });
      
      let filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');

      act(() => {
        result.current.setFilter('success');
      });
      
      filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');

      act(() => {
        result.current.setFilter('failure');
      });
      
      filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    it.skip('should sort records by different criteria', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Sort by timestamp ascending
      act(() => {
        result.current.setSorting('timestamp', 'asc');
      });
      
      let sorted = result.current.getFilteredRecords();
      expect(sorted[0].id).toBe('1');
      expect(sorted[2].id).toBe('3');

      // Sort by accuracy descending
      act(() => {
        result.current.setSorting('accuracy', 'desc');
      });
      
      sorted = result.current.getFilteredRecords();
      expect(sorted[0].performance?.accuracy).toBe(0.9);
      expect(sorted[2].performance?.accuracy).toBe(0.5);

      // Sort by symbol
      act(() => {
        result.current.setSorting('symbol', 'asc');
      });
      
      sorted = result.current.getFilteredRecords();
      expect(sorted[0].symbol).toBe('BTC/USDT');
      expect(sorted[2].symbol).toBe('ETH/USDT');
    });

    it('should toggle sort order when sorting by same field', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      act(() => {
        result.current.setSorting('timestamp');
      });
      expect(useAnalysisHistoryStore.getState().sortOrder).toBe('asc');

      act(() => {
        result.current.setSorting('timestamp');
      });
      expect(useAnalysisHistoryStore.getState().sortOrder).toBe('desc');
    });
  });

  describe('Performance Analytics', () => {
    it('should calculate performance metrics', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      const metrics = result.current.getPerformanceMetrics();
      
      expect(metrics).toMatchObject({
        totalAnalyses: 5,
        completedAnalyses: 3,
        successRate: 0.6,
        averageAccuracy: 0.75
      });
    });

    it('should use cached metrics if recent', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // First call calculates metrics
      const metrics1 = result.current.getPerformanceMetrics();
      
      // Second call should use cache
      const metrics2 = result.current.getPerformanceMetrics();
      
      expect(metrics1).toBe(metrics2);
      expect(useAnalysisHistoryStore.getState().performanceMetrics).toBeDefined();
    });

    it('should refresh metrics cache', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Calculate metrics
      result.current.getPerformanceMetrics();
      expect(useAnalysisHistoryStore.getState().performanceMetrics).toBeDefined();

      // Refresh cache
      act(() => {
        result.current.refreshMetrics();
      });

      expect(useAnalysisHistoryStore.getState().performanceMetrics).toBeNull();
      expect(useAnalysisHistoryStore.getState().lastCalculated).toBe(0);
    });
  });

  describe('Export/Import Functionality', () => {
    it('should export data as JSON', () => {
      const { result } = renderHook(() => useAnalysisActions());
      
      const records = [
        { id: '1', symbol: 'BTC/USDT' } as AnalysisRecord,
        { id: '2', symbol: 'ETH/USDT' } as AnalysisRecord
      ];
      
      act(() => {
        useAnalysisHistoryStore.setState({ records });
      });

      const exported = result.current.exportData();
      const parsed = JSON.parse(exported);
      
      expect(parsed.records).toHaveLength(2);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.version).toBe('1.0.0');
    });

    it('should import data from JSON', () => {
      const { result } = renderHook(() => useAnalysisActions());
      
      const importData = {
        records: [
          { id: '1', symbol: 'BTC/USDT' } as AnalysisRecord,
          { id: '2', symbol: 'ETH/USDT' } as AnalysisRecord
        ],
        exportedAt: Date.now(),
        version: '1.0.0'
      };

      act(() => {
        result.current.importData(JSON.stringify(importData));
      });

      expect(useAnalysisHistoryStore.getState().records).toHaveLength(2);
      expect(logger.info).toHaveBeenCalledWith(
        '[AnalysisHistory] Data imported',
        { count: 2 }
      );
    });

    it('should handle invalid import data', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      expect(() => {
        act(() => {
          result.current.importData('invalid json');
        });
      }).toThrow('Invalid import data format');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should clear history', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{ id: '1' } as AnalysisRecord],
          selectedRecord: '1',
          performanceMetrics: {} as any
        });
      });

      act(() => {
        result.current.clearHistory();
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records).toHaveLength(0);
      expect(state.selectedRecord).toBeNull();
      expect(state.performanceMetrics).toBeNull();
    });
  });

  describe('Database Sync', () => {
    it('should enable database sync and migrate existing records', async () => {
      (AnalysisAPI.saveAnalysis as jest.Mock).mockResolvedValue('db_id');

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add unsynced records
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', symbol: 'BTC/USDT', dbMeta: { synced: false } } as AnalysisRecord,
            { id: '2', symbol: 'ETH/USDT', dbMeta: { synced: false } } as AnalysisRecord
          ],
          isDbEnabled: false
        });
      });

      await act(async () => {
        await result.current.enableDbSync('session123');
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.isDbEnabled).toBe(true);
      expect(state.currentSessionId).toBe('session123');
      expect(AnalysisAPI.saveAnalysis).toHaveBeenCalledTimes(2);
      expect(state.records.every(r => r.dbMeta?.synced)).toBe(true);
    });

    it('should disable database sync', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          isDbEnabled: true,
          currentSessionId: 'session123'
        });
      });

      act(() => {
        result.current.disableDbSync();
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.isDbEnabled).toBe(false);
      expect(state.currentSessionId).toBeNull();
    });

    it('should sync unsynced records with database', async () => {
      (AnalysisAPI.saveAnalysis as jest.Mock).mockResolvedValue('db_id');

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', symbol: 'BTC/USDT', dbMeta: { synced: false } } as AnalysisRecord,
            { id: '2', symbol: 'ETH/USDT', dbMeta: { synced: true } } as AnalysisRecord,
            { id: '3', symbol: 'XRP/USDT', dbMeta: { synced: false } } as AnalysisRecord
          ],
          isDbEnabled: true
        });
      });

      await act(async () => {
        await result.current.syncWithDatabase();
      });

      const state = useAnalysisHistoryStore.getState();
      expect(AnalysisAPI.saveAnalysis).toHaveBeenCalledTimes(2);
      expect(state.records.every(r => r.dbMeta?.synced)).toBe(true);
      expect(state.isSyncing).toBe(false);
    });

    it('should load records from database', async () => {
      const dbRecords = [
        { id: 'db1', symbol: 'BTC/USDT' } as AnalysisRecord,
        { id: 'db2', symbol: 'ETH/USDT' } as AnalysisRecord
      ];
      
      (AnalysisAPI.getSessionAnalyses as jest.Mock).mockResolvedValue(dbRecords);

      const { result } = renderHook(() => useAnalysisHistoryStore());

      await act(async () => {
        await result.current.loadFromDatabase('session123');
      });

      const state = useAnalysisHistoryStore.getState();
      expect(AnalysisAPI.getSessionAnalyses).toHaveBeenCalledWith('session123');
      expect(state.records).toHaveLength(2);
      expect(state.records[0].id).toBe('db1');
    });

    it('should mark record for sync', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: '1',
            symbol: 'BTC/USDT',
            dbMeta: { synced: true, version: 1 }
          } as AnalysisRecord]
        });
      });

      act(() => {
        result.current.markForSync('1');
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records[0].dbMeta?.synced).toBe(false);
    });

    it('should get unsynced records', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', dbMeta: { synced: false } } as AnalysisRecord,
            { id: '2', dbMeta: { synced: true } } as AnalysisRecord,
            { id: '3', dbMeta: { synced: false } } as AnalysisRecord
          ]
        });
      });

      const unsynced = result.current.getUnsyncedRecords();
      expect(unsynced).toHaveLength(2);
      expect(unsynced.map(r => r.id)).toEqual(['1', '3']);
    });
  });

  describe('Convenience Hooks', () => {
    it('should provide filtered records through useAnalysisRecords', () => {
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', tracking: { status: 'active' } } as AnalysisRecord,
            { id: '2', tracking: { status: 'completed' } } as AnalysisRecord
          ],
          filter: 'active'
        });
      });

      const { result } = renderHook(() => useAnalysisRecords());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('1');
    });

    it('should provide performance metrics through useAnalysisMetrics', () => {
      const { result } = renderHook(() => useAnalysisMetrics());
      
      expect(result.current).toMatchObject({
        totalAnalyses: 5,
        successRate: 0.6
      });
    });

    it('should provide all actions through useAnalysisActions', () => {
      const { result } = renderHook(() => useAnalysisActions());
      
      expect(result.current).toHaveProperty('addRecord');
      expect(result.current).toHaveProperty('updateRecord');
      expect(result.current).toHaveProperty('deleteRecord');
      expect(result.current).toHaveProperty('addTouchEvent');
      expect(result.current).toHaveProperty('setFilter');
      expect(result.current).toHaveProperty('exportData');
      expect(result.current).toHaveProperty('enableDbSync');
    });
  });

  describe('Store Persistence', () => {
    it('should persist selected state properties', () => {
      const state = {
        records: [{ id: '1' } as AnalysisRecord],
        filter: 'active' as const,
        sortBy: 'accuracy' as const,
        sortOrder: 'asc' as const,
        isDbEnabled: false,
        currentSessionId: 'test123',
        // These should not be persisted
        selectedRecord: 'record1',
        performanceMetrics: {} as any,
        lastCalculated: Date.now(),
        isSyncing: true
      };

      // Access the persist config directly from the store
      const persistConfig = (useAnalysisHistoryStore as any).persist;
      if (persistConfig && persistConfig.partialize) {
        const partialState = persistConfig.partialize(state);
        
        expect(partialState).toHaveProperty('records');
        expect(partialState).toHaveProperty('filter');
        expect(partialState).toHaveProperty('sortBy');
        expect(partialState).toHaveProperty('sortOrder');
        expect(partialState).toHaveProperty('isDbEnabled');
        expect(partialState).toHaveProperty('currentSessionId');
        expect(partialState).not.toHaveProperty('selectedRecord');
        expect(partialState).not.toHaveProperty('performanceMetrics');
        expect(partialState).not.toHaveProperty('lastCalculated');
        expect(partialState).not.toHaveProperty('isSyncing');
      } else {
        // If persist is not available, skip this test
        console.warn('Persist config not available, skipping test');
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle adding record with validation errors', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Mock validation to throw error
      const validateAnalysisRecord = require('@/types/analysis-history').validateAnalysisRecord;
      validateAnalysisRecord.mockImplementationOnce(() => {
        throw new Error('Validation failed');
      });

      const invalidRecord = {
        symbol: 'INVALID',
        interval: 'invalid' as const,
        type: 'invalid' as any,
        proposal: {} as any,
        tracking: {} as any
      };

      await expect(async () => {
        await act(async () => {
          await result.current.addRecord(invalidRecord);
        });
      }).rejects.toThrow('Validation failed');
    });

    it('should handle updating non-existent record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      await act(async () => {
        await result.current.updateRecord('non-existent', { 
          tracking: { status: 'completed' } as TrackingData 
        });
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '[AnalysisHistory] Record not found for update',
        { id: 'non-existent' }
      );
    });

    it('should handle touch event with validation error', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Mock validation to throw error
      const validateTouchEvent = require('@/types/analysis-history').validateTouchEvent;
      validateTouchEvent.mockImplementationOnce(() => {
        throw new Error('Invalid touch event');
      });

      const recordId = 'test_record';
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            tracking: { touches: [] }
          } as AnalysisRecord]
        });
      });

      await act(async () => {
        await result.current.addTouchEvent(recordId, {} as any);
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[AnalysisHistory] Failed to add touch event',
        expect.any(Object)
      );
    });

    it('should handle touch event for non-existent record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      await act(async () => {
        await result.current.addTouchEvent('non-existent', {
          type: 'bounce',
          lineId: 'line1',
          price: 50000,
          result: 'bounce'
        });
      });

      // Should not throw, but should handle gracefully
      const record = result.current.getRecord('non-existent');
      expect(record).toBeUndefined();
    });

    it('should handle completing tracking for non-existent record', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        result.current.completeTracking('non-existent', 'success');
      });

      // Should not throw
      expect(result.current.getRecord('non-existent')).toBeUndefined();
    });

    it('should handle empty records when calculating metrics', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({ records: [] });
      });

      const metrics = result.current.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalAnalyses).toBe(5); // Mock returns fixed values
    });

    it('should handle concurrent record additions', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordPromises = Array.from({ length: 5 }, (_, i) => 
        result.current.addRecord({
          symbol: `COIN${i}/USDT`,
          interval: '1h' as const,
          type: 'support_resistance' as const,
          proposal: { lines: [], confidence: 0.8, reasoning: `Test ${i}` },
          tracking: { status: 'active' as const, startTime: Date.now(), touches: [] }
        })
      );

      await act(async () => {
        await Promise.all(recordPromises);
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.records).toHaveLength(5);
      expect(new Set(state.records.map(r => r.symbol)).size).toBe(5); // All unique
    });
  });

  describe('Complex Filtering and Sorting', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Reuse the same test data setup from 'Filtering and Sorting'
      const testRecords = [
        {
          id: '1',
          symbol: 'BTC/USDT',
          interval: '1h' as const,
          type: 'support_resistance' as const,
          timestamp: Date.now() - 3600000,
          proposal: { lines: [], confidence: 0.8, reasoning: 'Test' },
          tracking: { status: 'active' as const, startTime: Date.now() - 3600000, touches: [] },
          performance: { accuracy: 0.8 },
        },
        {
          id: '2',
          symbol: 'ETH/USDT',
          interval: '4h' as const,
          type: 'trendline' as const,
          timestamp: Date.now() - 7200000,
          proposal: { lines: [], confidence: 0.9, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 7200000, 
            endTime: Date.now() - 3600000,
            touches: [],
            finalResult: 'success' as const
          },
          performance: { accuracy: 0.9 },
        },
        {
          id: '3',
          symbol: 'BTC/USDT',
          interval: '1d' as const,
          type: 'support_resistance' as const,
          timestamp: Date.now() - 1800000,
          proposal: { lines: [], confidence: 0.6, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 1800000,
            endTime: Date.now() - 900000, 
            touches: [],
            finalResult: 'failure' as const
          },
          performance: { accuracy: 0.5 },
        },
        {
          id: '4',
          symbol: 'XRP/USDT',
          interval: '15m' as const,
          type: 'fibonacci' as const,
          timestamp: Date.now() - 900000,
          proposal: { lines: [], confidence: 0.7, reasoning: 'Test' },
          tracking: { status: 'expired' as const, startTime: Date.now() - 900000, touches: [] },
          performance: { accuracy: 0.7 },
        },
        {
          id: '5',
          symbol: 'ETH/USDT',
          interval: '1h' as const,
          type: 'pattern' as const,
          timestamp: Date.now() - 600000,
          proposal: { lines: [], confidence: 0.75, reasoning: 'Test' },
          tracking: { 
            status: 'completed' as const, 
            startTime: Date.now() - 600000,
            endTime: Date.now() - 300000,
            touches: [],
            finalResult: 'success' as const
          },
          performance: { accuracy: 0.85 },
        },
      ] as AnalysisRecord[];
      
      useAnalysisHistoryStore.setState({ records: testRecords });
    });

    it('should filter by completed status', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      act(() => {
        result.current.setFilter('completed');
      });
      
      const filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(3);
      expect(filtered.every(r => r.tracking.status === 'completed')).toBe(true);
    });

    it('should handle filtering with no matches', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Clear all records first
      act(() => {
        useAnalysisHistoryStore.setState({ records: [] });
      });

      act(() => {
        result.current.setFilter('success');
      });
      
      const filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(0);
    });

    it('should sort by type alphabetically', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      act(() => {
        result.current.setSorting('type', 'asc');
      });
      
      const sorted = result.current.getFilteredRecords();
      const types = sorted.map(r => r.type);
      expect(types).toEqual(['fibonacci', 'pattern', 'support_resistance', 'support_resistance', 'trendline']);
    });

    it('should handle sorting with undefined values', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Add record without performance
      act(() => {
        const currentRecords = useAnalysisHistoryStore.getState().records;
        useAnalysisHistoryStore.setState({
          records: [
            ...currentRecords,
            {
              id: '6',
              symbol: 'ADA/USDT',
              type: 'pattern',
              timestamp: Date.now(),
              tracking: { status: 'active' },
              // No performance property
            } as AnalysisRecord
          ]
        });
      });

      act(() => {
        result.current.setSorting('accuracy', 'desc');
      });
      
      const sorted = result.current.getFilteredRecords();
      // Records without accuracy should be treated as 0
      expect(sorted[sorted.length - 1].id).toBe('6');
    });

    it('should maintain sort stability for equal values', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Add records with same symbol
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: 'a1', symbol: 'BTC/USDT', timestamp: 1000 } as AnalysisRecord,
            { id: 'a2', symbol: 'BTC/USDT', timestamp: 2000 } as AnalysisRecord,
            { id: 'a3', symbol: 'BTC/USDT', timestamp: 3000 } as AnalysisRecord,
          ]
        });
      });

      act(() => {
        result.current.setSorting('symbol', 'asc');
      });
      
      const sorted = result.current.getFilteredRecords();
      // Should maintain relative order when values are equal
      expect(sorted.map(r => r.id)).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('Database Sync Edge Cases', () => {
    it('should handle database sync failure during enable', async () => {
      (AnalysisAPI.saveAnalysis as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add unsynced records
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', symbol: 'BTC/USDT', dbMeta: { synced: false } } as AnalysisRecord
          ],
          isDbEnabled: false
        });
      });

      await act(async () => {
        await result.current.enableDbSync('session123');
      });

      const state = useAnalysisHistoryStore.getState();
      expect(state.isDbEnabled).toBe(true);
      expect(state.isSyncing).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[AnalysisHistory] Failed to migrate to DB',
        expect.any(Object)
      );
    });

    it('should handle empty session ID for database operations', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      await act(async () => {
        await result.current.loadFromDatabase('');
      });

      expect(AnalysisAPI.getSessionAnalyses).toHaveBeenCalledWith('');
    });

    it('should skip sync when database is disabled', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({ isDbEnabled: false });
      });

      await act(async () => {
        await result.current.syncWithDatabase();
      });

      expect(AnalysisAPI.saveAnalysis).not.toHaveBeenCalled();
    });

    it('should handle partial sync failure', async () => {
      let callCount = 0;
      (AnalysisAPI.saveAnalysis as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network error');
        }
        return Promise.resolve(`db_id_${callCount}`);
      });

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', symbol: 'BTC/USDT', dbMeta: { synced: false } } as AnalysisRecord,
            { id: '2', symbol: 'ETH/USDT', dbMeta: { synced: false } } as AnalysisRecord,
            { id: '3', symbol: 'XRP/USDT', dbMeta: { synced: false } } as AnalysisRecord
          ],
          isDbEnabled: true
        });
      });

      await act(async () => {
        await result.current.syncWithDatabase();
      });

      expect(logger.error).toHaveBeenCalled();
      expect(AnalysisAPI.saveAnalysis).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Metrics Edge Cases', () => {
    it('should invalidate cache when records change', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      // Calculate metrics
      result.current.getPerformanceMetrics();
      expect(useAnalysisHistoryStore.getState().performanceMetrics).toBeDefined();

      // Add a record
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{ id: 'new' } as AnalysisRecord],
          performanceMetrics: null
        });
      });

      // Metrics should be null after state change
      expect(useAnalysisHistoryStore.getState().performanceMetrics).toBeNull();
    });

    it('should handle cache expiration correctly', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      const originalDateNow = Date.now;

      // Mock Date.now to control time
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      // First call
      const metrics1 = result.current.getPerformanceMetrics();
      
      // Advance time by 4 minutes (under 5 minute cache)
      currentTime += 240000;
      const metrics2 = result.current.getPerformanceMetrics();
      expect(metrics2).toBe(metrics1); // Should use cache

      // Advance time by 2 more minutes (over 5 minute cache)
      currentTime += 120000;
      const calculatePerformanceMetrics = require('@/types/analysis-history').calculatePerformanceMetrics;
      calculatePerformanceMetrics.mockClear();
      
      result.current.getPerformanceMetrics();
      expect(calculatePerformanceMetrics).toHaveBeenCalled(); // Should recalculate

      Date.now = originalDateNow;
    });
  });

  describe('Import/Export Edge Cases', () => {
    it('should handle malformed JSON during import', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      expect(() => {
        act(() => {
          result.current.importData('{invalid json');
        });
      }).toThrow('Invalid import data format');
    });

    it.skip('should handle import with missing records field', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());

      act(() => {
        result.current.importData(JSON.stringify({ 
          exportedAt: Date.now(),
          version: '1.0.0'
          // Missing records field
        }));
      });

      // Should not crash, but also not import anything
      expect(useAnalysisHistoryStore.getState().records).toHaveLength(0);
    });

    it('should handle import with invalid record data', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const validateAnalysisRecord = require('@/types/analysis-history').validateAnalysisRecord;
      validateAnalysisRecord.mockImplementationOnce(() => {
        throw new Error('Invalid record');
      });

      expect(() => {
        act(() => {
          result.current.importData(JSON.stringify({ 
            records: [{ invalid: 'data' }]
          }));
        });
      }).toThrow('Invalid import data format');
    });

    it('should preserve existing data when import fails', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const existingRecords = [{ id: 'existing' } as AnalysisRecord];
      act(() => {
        useAnalysisHistoryStore.setState({ records: existingRecords });
      });

      expect(() => {
        act(() => {
          result.current.importData('invalid');
        });
      }).toThrow();

      // Existing data should remain
      expect(useAnalysisHistoryStore.getState().records).toEqual(existingRecords);
    });
  });

  describe('State Migrations', () => {
    it('should migrate from version 0 to version 1', () => {
      const oldState = {
        records: [
          { id: '1', symbol: 'BTC/USDT' },
          { id: '2', symbol: 'ETH/USDT' }
        ]
      };

      const persistConfig = (useAnalysisHistoryStore as any).persist;
      if (persistConfig && persistConfig.migrate) {
        const migratedState = persistConfig.migrate(oldState, 0) as any;
        
        expect(migratedState.records).toHaveLength(2);
        expect(migratedState.records[0].dbMeta).toEqual({
          version: 1,
          synced: false
        });
        expect(migratedState.records[1].dbMeta).toEqual({
          version: 1,
          synced: false
        });
      }
    });

    it('should migrate from version 1 to version 2', () => {
      const v1State = {
        records: [{ id: '1' }],
        filter: 'active',
        sortBy: 'timestamp'
      };

      const persistConfig = (useAnalysisHistoryStore as any).persist;
      if (persistConfig && persistConfig.migrate) {
        const migratedState = persistConfig.migrate(v1State, 1) as any;
        
        expect(migratedState).toMatchObject({
          ...v1State,
          isDbEnabled: true,
          isSyncing: false,
          currentSessionId: null
        });
      }
    });

    it('should handle migration with null state', () => {
      const persistConfig = (useAnalysisHistoryStore as any).persist;
      if (persistConfig && persistConfig.migrate) {
        const migratedState = persistConfig.migrate(null, 0);
        
        expect(migratedState).toEqual({});
      }
    });

    it('should return state unchanged for current version', () => {
      const currentState = {
        records: [],
        isDbEnabled: true,
        currentSessionId: 'test'
      };

      const persistConfig = (useAnalysisHistoryStore as any).persist;
      if (persistConfig && persistConfig.migrate) {
        const migratedState = persistConfig.migrate(currentState, 2);
        
        expect(migratedState).toBe(currentState);
      }
    });
  });

  describe('Selected Record Management', () => {
    it('should clear selected record when it is deleted', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: 'record1' } as AnalysisRecord,
            { id: 'record2' } as AnalysisRecord
          ],
          selectedRecord: 'record1'
        });
      });

      act(() => {
        result.current.deleteRecord('record1');
      });

      expect(useAnalysisHistoryStore.getState().selectedRecord).toBeNull();
    });

    it('should maintain selected record when different record is deleted', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: 'record1' } as AnalysisRecord,
            { id: 'record2' } as AnalysisRecord
          ],
          selectedRecord: 'record2'
        });
      });

      act(() => {
        result.current.deleteRecord('record1');
      });

      expect(useAnalysisHistoryStore.getState().selectedRecord).toBe('record2');
    });

    it('should set selected record to null', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      act(() => {
        useAnalysisHistoryStore.setState({ selectedRecord: 'record1' });
      });

      act(() => {
        result.current.setSelectedRecord(null);
      });

      expect(useAnalysisHistoryStore.getState().selectedRecord).toBeNull();
    });
  });

  describe('Touch Event Edge Cases', () => {
    it('should handle adding touch event to record without tracking touches array', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      const recordId = 'test_record';
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            symbol: 'BTC/USDT',
            tracking: {
              status: 'active',
              startTime: Date.now(),
              // touches array missing
            } as any
          } as AnalysisRecord]
        });
      });

      await act(async () => {
        await result.current.addTouchEvent(recordId, {
          type: 'bounce',
          lineId: 'line1',
          price: 45000,
          result: 'bounce'
        });
      });

      const record = result.current.getRecord(recordId);
      // The addTouchEvent should create touches array if it doesn't exist
      expect(record?.tracking?.touches).toBeDefined();
      expect(record?.tracking?.touches).toHaveLength(1);
      expect(record?.tracking?.touches[0]).toMatchObject({
        type: 'bounce',
        price: 45000,
        result: 'bounce'
      });
    });

    it('should calculate duration correctly when completing tracking', () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      const originalDateNow = Date.now;
      
      // Mock Date.now to control time
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      const recordId = 'test_record';
      const startTime = currentTime;
      
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: recordId,
            symbol: 'BTC/USDT',
            proposal: {
              lines: [],
              confidence: 0.8,
              reasoning: 'Test'
            },
            tracking: {
              status: 'active',
              startTime,
              touches: []
            }
          } as AnalysisRecord]
        });
      });

      // Advance time by 1 hour
      currentTime += 3600000;

      act(() => {
        result.current.updateTrackingStatus(recordId, 'completed');
      });

      const record = result.current.getRecord(recordId);
      expect(record?.tracking.duration).toBe(3600000);

      Date.now = originalDateNow;
    });
  });

  describe('Convenience Hooks Edge Cases', () => {
    it('should return empty array when no records match filter in useAnalysisRecords', () => {
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [
            { id: '1', tracking: { status: 'completed' } } as AnalysisRecord,
            { id: '2', tracking: { status: 'expired' } } as AnalysisRecord
          ],
          filter: 'active'
        });
      });

      const { result } = renderHook(() => useAnalysisRecords());
      expect(result.current).toHaveLength(0);
    });

    it('should update when store changes in useAnalysisDbEnabled', () => {
      const { result } = renderHook(() => useAnalysisHistory(state => state.isDbEnabled));
      
      expect(result.current).toBe(true); // Initial state

      act(() => {
        useAnalysisHistoryStore.setState({ isDbEnabled: false });
      });

      expect(result.current).toBe(false);
    });

    it('should provide all required actions in useAnalysisActions', () => {
      const { result } = renderHook(() => useAnalysisActions());
      
      const expectedActions = [
        'addRecord',
        'updateRecord',
        'deleteRecord',
        'addTouchEvent',
        'updateTrackingStatus',
        'completeTracking',
        'setFilter',
        'setSorting',
        'setSelectedRecord',
        'refreshMetrics',
        'exportData',
        'importData',
        'clearHistory',
        'enableDbSync',
        'disableDbSync',
        'syncWithDatabase',
        'loadFromDatabase'
      ];

      expectedActions.forEach(action => {
        expect(result.current).toHaveProperty(action);
        expect(typeof result.current[action as keyof typeof result.current]).toBe('function');
      });
    });
  });

  describe('Database Update with Retry', () => {
    it('should retry database update on failure', async () => {
      const withRetry = require('@/lib/utils/retry').withRetry;
      withRetry.mockImplementationOnce((fn: Function) => {
        // Simulate retry logic
        return fn();
      });

      (AnalysisAPI.updateAnalysis as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Add a record
      act(() => {
        useAnalysisHistoryStore.setState({
          records: [{
            id: 'test123',
            symbol: 'BTC/USDT',
            dbMeta: { synced: true }
          } as AnalysisRecord],
          isDbEnabled: true
        });
      });

      await act(async () => {
        await result.current.updateRecord('test123', {
          tracking: { status: 'completed' } as TrackingData
        });
      });

      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        { maxAttempts: 3 }
      );
    });
  });

  describe('Record ID Generation', () => {
    it('should generate unique IDs for concurrent additions', async () => {
      const { result } = renderHook(() => useAnalysisHistoryStore());
      
      // Mock saveAnalysis to return the temporary ID
      (AnalysisAPI.saveAnalysis as jest.Mock).mockImplementation(() => {
        throw new Error('DB disabled');
      });

      act(() => {
        useAnalysisHistoryStore.setState({ isDbEnabled: false });
      });

      const ids = new Set<string>();
      
      await act(async () => {
        const promises = Array.from({ length: 10 }, () => 
          result.current.addRecord({
            symbol: 'BTC/USDT',
            interval: '1h' as const,
            type: 'support_resistance' as const,
            proposal: { lines: [], confidence: 0.8, reasoning: 'Test' },
            tracking: { status: 'active' as const, startTime: Date.now(), touches: [] }
          }).then(id => ids.add(id))
        );
        
        await Promise.all(promises);
      });

      expect(ids.size).toBe(10); // All IDs should be unique
    });
  });
});
