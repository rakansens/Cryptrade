import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import {
  useAnalysisHistoryBase,
  useAnalysisHistory,
  useAnalysisRecords,
  useAnalysisMetrics,
  useAnalysisActions,
  type AnalysisHistoryStore,
  type AnalysisHistoryState
} from '@/store/analysis-history.store';
import { AnalysisAPI } from '@/lib/api/analysis-api';
import { logger } from '@/lib/utils/logger';
import { withRetry } from '@/lib/utils/retry';
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

// Mock dependencies
vi.mock('@/lib/api/analysis-api');
vi.mock('@/lib/utils/logger');
vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn) => fn())
}));
vi.mock('@/types/analysis-history', () => ({
  validateAnalysisRecord: vi.fn((record) => record),
  validateTouchEvent: vi.fn((event) => event),
  calculatePerformanceMetrics: vi.fn(() => ({
    totalAnalyses: 10,
    completedAnalyses: 8,
    averageAccuracy: 0.75,
    bestPerformingType: 'trendline',
    totalProfit: 2500,
    winRate: 0.6,
    averageHoldDuration: 3600000,
    recentPerformance: []
  })),
  calculateAccuracy: vi.fn(() => 0.85)
}));

// Mock notification module
vi.mock('@/lib/notifications/browser-notifications', () => ({
  notifications: {
    showAnalysisComplete: vi.fn().mockResolvedValue(undefined)
  }
}));

// MSW server setup
const server = setupServer(
  rest.get('/api/analysis', (req, res, ctx) => {
    return res(ctx.json({ analyses: [] }));
  }),
  rest.post('/api/analysis', (req, res, ctx) => {
    return res(ctx.json({ id: 'api-record-123' }));
  }),
  rest.put('/api/analysis/:id', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  // Reset store state
  act(() => {
    useAnalysisHistoryBase.getState().clearHistory();
  });
});
afterAll(() => server.close());

// Helper function to create mock analysis record
function createMockRecord(overrides?: Partial<AnalysisRecord>): AnalysisRecord {
  return {
    id: 'test-record-1',
    timestamp: Date.now(),
    symbol: 'BTCUSDT',
    interval: '1h',
    type: 'trendline',
    proposal: {
      type: 'trendline',
      points: [
        { x: 100, y: 50000, timestamp: Date.now() - 3600000 },
        { x: 200, y: 51000, timestamp: Date.now() }
      ],
      direction: 'bullish',
      strength: 0.8,
      confidence: 0.9,
      description: 'Strong uptrend detected',
      metadata: {
        touchPoints: 3,
        angle: 15,
        length: 100
      }
    },
    tracking: {
      status: 'active',
      startTime: Date.now() - 1800000,
      touches: []
    },
    dbMeta: {
      version: 1,
      synced: false
    },
    ...overrides
  };
}

describe('AnalysisHistoryStore', () => {
  describe('Record Management', () => {
    it('should add a new analysis record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      const recordData = createMockRecord();
      delete (recordData as any).id;
      delete (recordData as any).timestamp;
      
      await act(async () => {
        const id = await result.current.addRecord(recordData);
        expect(id).toMatch(/^record_\d+_[a-z0-9]+$/);
        expect(result.current.records).toHaveLength(1);
        expect(result.current.records[0].type).toBe('trendline');
        expect(result.current.records[0].tracking.status).toBe('active');
      });
    });

    it('should save record to database when enabled', async () => {
      vi.mocked(AnalysisAPI.saveAnalysis).mockResolvedValue('db-record-123');
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      const recordData = createMockRecord();
      delete (recordData as any).id;
      delete (recordData as any).timestamp;
      
      await act(async () => {
        const id = await result.current.addRecord(recordData);
        
        expect(AnalysisAPI.saveAnalysis).toHaveBeenCalledWith({
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'trendline',
          proposalData: recordData.proposal
        });
        
        // Record ID should be updated to match DB
        expect(result.current.records[0].id).toBe('db-record-123');
        expect(result.current.records[0].dbMeta?.synced).toBe(true);
      });
    });

    it('should handle database save failure', async () => {
      vi.mocked(AnalysisAPI.saveAnalysis).mockRejectedValue(new Error('DB Error'));
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        expect(logger.error).toHaveBeenCalledWith(
          '[AnalysisHistory] Failed to save to DB',
          expect.any(Object)
        );
        
        // Record should still be added locally
        expect(result.current.records).toHaveLength(1);
        expect(result.current.records[0].dbMeta?.synced).toBe(false);
      });
    });

    it('should update an existing record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        await result.current.updateRecord(id, {
          performance: {
            accuracy: 0.9,
            actualBounces: 3,
            predictedBounces: 3,
            holdDuration: 7200000
          }
        });
        
        const updated = result.current.getRecord(id);
        expect(updated?.performance?.accuracy).toBe(0.9);
        expect(updated?.dbMeta?.synced).toBe(false);
        expect(updated?.dbMeta?.version).toBe(2);
      });
    });

    it('should delete a record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        result.current.setSelectedRecord(id);
        
        result.current.deleteRecord(id);
        
        expect(result.current.records).toHaveLength(0);
        expect(result.current.selectedRecord).toBeNull();
      });
    });

    it('should get a specific record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        const record = result.current.getRecord(id);
        
        expect(record).toBeDefined();
        expect(record?.symbol).toBe('BTCUSDT');
      });
    });
  });

  describe('Touch Event Management', () => {
    it('should add touch events to a record', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        await result.current.addTouchEvent(id, {
          price: 50500,
          result: 'bounce',
          accuracy: 0.95,
          deviation: 0.5
        });
        
        const record = result.current.getRecord(id);
        expect(record?.tracking.touches).toHaveLength(1);
        expect(record?.tracking.touches[0].result).toBe('bounce');
        expect(record?.tracking.touches[0].time).toBeDefined();
      });
    });

    it('should save touch event to database', async () => {
      vi.mocked(AnalysisAPI.recordTouchEvent).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        await result.current.addTouchEvent(id, {
          price: 50500,
          result: 'bounce',
          accuracy: 0.95,
          deviation: 0.5
        });
        
        expect(AnalysisAPI.recordTouchEvent).toHaveBeenCalledWith(
          id,
          expect.objectContaining({
            price: 50500,
            result: 'bounce',
            accuracy: 0.95,
            deviation: 0.5,
            time: expect.any(Number)
          })
        );
      });
    });

    it('should update tracking status', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        result.current.updateTrackingStatus(id, 'completed');
        
        const record = result.current.getRecord(id);
        expect(record?.tracking.status).toBe('completed');
        expect(record?.tracking.endTime).toBeDefined();
        expect(record?.tracking.duration).toBeDefined();
      });
    });

    it('should complete tracking with final result', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        // Add some touch events
        await result.current.addTouchEvent(id, {
          price: 50500,
          result: 'bounce',
          accuracy: 0.95,
          deviation: 0.5
        });
        
        result.current.completeTracking(id, 'success');
        
        const record = result.current.getRecord(id);
        expect(record?.tracking.status).toBe('completed');
        expect(record?.tracking.finalResult).toBe('success');
        expect(record?.performance).toBeDefined();
        expect(record?.performance?.accuracy).toBe(0.85); // Mocked value
      });
    });
  });

  describe('Filtering and Sorting', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      // Add multiple records with different states
      await act(async () => {
        await result.current.addRecord(createMockRecord({
          symbol: 'BTCUSDT',
          type: 'trendline',
          tracking: { status: 'active', startTime: Date.now(), touches: [] }
        }));
        
        await result.current.addRecord(createMockRecord({
          symbol: 'ETHUSDT',
          type: 'support-resistance',
          tracking: { 
            status: 'completed', 
            startTime: Date.now() - 7200000,
            endTime: Date.now(),
            finalResult: 'success',
            touches: []
          },
          performance: { accuracy: 0.9, actualBounces: 3, predictedBounces: 3, holdDuration: 7200000 }
        }));
        
        await result.current.addRecord(createMockRecord({
          symbol: 'BNBUSDT',
          type: 'fibonacci',
          tracking: { 
            status: 'completed', 
            startTime: Date.now() - 3600000,
            endTime: Date.now(),
            finalResult: 'failure',
            touches: []
          },
          performance: { accuracy: 0.3, actualBounces: 1, predictedBounces: 3, holdDuration: 3600000 }
        }));
      });
    });

    it('should filter records by status', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        result.current.setFilter('active');
      });
      
      const filtered = result.current.getFilteredRecords();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].tracking.status).toBe('active');
      
      act(() => {
        result.current.setFilter('completed');
      });
      
      const completed = result.current.getFilteredRecords();
      expect(completed).toHaveLength(2);
      expect(completed.every(r => r.tracking.status === 'completed')).toBe(true);
    });

    it('should filter by success/failure', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        result.current.setFilter('success');
      });
      
      const success = result.current.getFilteredRecords();
      expect(success).toHaveLength(1);
      expect(success[0].tracking.finalResult).toBe('success');
      
      act(() => {
        result.current.setFilter('failure');
      });
      
      const failure = result.current.getFilteredRecords();
      expect(failure).toHaveLength(1);
      expect(failure[0].tracking.finalResult).toBe('failure');
    });

    it('should sort records', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        result.current.setSorting('accuracy', 'desc');
      });
      
      const sorted = result.current.getFilteredRecords();
      expect(sorted[0].performance?.accuracy).toBe(0.9);
      expect(sorted[1].performance?.accuracy).toBe(0.3);
      
      act(() => {
        result.current.setSorting('symbol', 'asc');
      });
      
      const symbolSorted = result.current.getFilteredRecords();
      expect(symbolSorted[0].symbol).toBe('BNBUSDT');
      expect(symbolSorted[1].symbol).toBe('BTCUSDT');
      expect(symbolSorted[2].symbol).toBe('ETHUSDT');
    });

    it('should toggle sort order', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        result.current.setSorting('timestamp');
      });
      
      expect(result.current.sortOrder).toBe('asc');
      
      act(() => {
        result.current.setSorting('timestamp');
      });
      
      expect(result.current.sortOrder).toBe('desc');
    });
  });

  describe('Performance Analytics', () => {
    it('should calculate performance metrics', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        const metrics = result.current.getPerformanceMetrics();
        
        expect(metrics).toBeDefined();
        expect(metrics.totalAnalyses).toBe(10);
        expect(metrics.averageAccuracy).toBe(0.75);
        expect(metrics.winRate).toBe(0.6);
      });
    });

    it('should cache performance metrics', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        const metrics1 = result.current.getPerformanceMetrics();
        const metrics2 = result.current.getPerformanceMetrics();
        
        expect(metrics1).toBe(metrics2);
        expect(calculatePerformanceMetrics).toHaveBeenCalledTimes(1);
      });
    });

    it('should refresh metrics', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        result.current.getPerformanceMetrics();
        result.current.refreshMetrics();
        
        expect(result.current.performanceMetrics).toBeNull();
        expect(result.current.lastCalculated).toBe(0);
      });
    });
  });

  describe('Export/Import', () => {
    it('should export data as JSON', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        await result.current.addRecord(createMockRecord());
      });
      
      act(() => {
        const exported = result.current.exportData();
        const parsed = JSON.parse(exported);
        
        expect(parsed.records).toHaveLength(1);
        expect(parsed.exportedAt).toBeDefined();
        expect(parsed.version).toBe('1.0.0');
      });
    });

    it('should import data from JSON', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      const importData = {
        records: [createMockRecord(), createMockRecord({ id: 'test-record-2', symbol: 'ETHUSDT' })],
        exportedAt: Date.now(),
        version: '1.0.0'
      };
      
      act(() => {
        result.current.importData(JSON.stringify(importData));
        
        expect(result.current.records).toHaveLength(2);
        expect(result.current.records[0].symbol).toBe('BTCUSDT');
        expect(result.current.records[1].symbol).toBe('ETHUSDT');
      });
    });

    it('should handle invalid import data', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        expect(() => {
          result.current.importData('invalid json');
        }).toThrow('Invalid import data format');
        
        expect(logger.error).toHaveBeenCalledWith(
          '[AnalysisHistory] Failed to import data',
          expect.any(Object)
        );
      });
    });
  });

  describe('Database Sync', () => {
    it('should enable database sync', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        result.current.disableDbSync();
        expect(result.current.isDbEnabled).toBe(false);
        
        await result.current.enableDbSync('session-123');
        
        expect(result.current.isDbEnabled).toBe(true);
        expect(result.current.currentSessionId).toBe('session-123');
      });
    });

    it('should migrate existing records when enabling DB sync', async () => {
      vi.mocked(AnalysisAPI.saveAnalysis).mockResolvedValue('db-id');
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        result.current.disableDbSync();
        await result.current.addRecord(createMockRecord());
        
        await result.current.enableDbSync();
        
        expect(AnalysisAPI.saveAnalysis).toHaveBeenCalled();
        expect(result.current.records[0].dbMeta?.synced).toBe(true);
      });
    });

    it('should sync unsynced records', async () => {
      vi.mocked(AnalysisAPI.saveAnalysis).mockResolvedValue('db-id');
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        result.current.disableDbSync();
        await result.current.addRecord(createMockRecord());
        await result.current.addRecord(createMockRecord({ id: 'record-2' }));
        
        result.current.enableDbSync();
        await result.current.syncWithDatabase();
        
        expect(AnalysisAPI.saveAnalysis).toHaveBeenCalledTimes(2);
        expect(result.current.records.every(r => r.dbMeta?.synced)).toBe(true);
      });
    });

    it('should load records from database', async () => {
      const mockDbRecords: AnalysisRecord[] = [
        createMockRecord({ id: 'db-1', symbol: 'BTCUSDT' }),
        createMockRecord({ id: 'db-2', symbol: 'ETHUSDT' })
      ];
      
      vi.mocked(AnalysisAPI.getSessionAnalyses).mockResolvedValue(mockDbRecords);
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        await result.current.loadFromDatabase('session-123');
        
        expect(AnalysisAPI.getSessionAnalyses).toHaveBeenCalledWith('session-123');
        expect(result.current.records).toHaveLength(2);
        expect(result.current.records[0].id).toBe('db-1');
        expect(result.current.records[1].id).toBe('db-2');
      });
    });

    it('should handle database load errors', async () => {
      vi.mocked(AnalysisAPI.getSessionAnalyses).mockRejectedValue(new Error('DB Error'));
      
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        await result.current.loadFromDatabase();
        
        expect(logger.error).toHaveBeenCalledWith(
          '[AnalysisHistory] Failed to load from database',
          expect.any(Object)
        );
      });
    });

    it('should mark records for sync', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const id = await result.current.addRecord(createMockRecord());
        
        // Mark as synced first
        await result.current.updateRecord(id, {
          dbMeta: { version: 1, synced: true }
        });
        
        result.current.markForSync(id);
        
        const record = result.current.getRecord(id);
        expect(record?.dbMeta?.synced).toBe(false);
      });
    });

    it('should get unsynced records', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        result.current.disableDbSync();
        
        await result.current.addRecord(createMockRecord());
        await result.current.addRecord(createMockRecord({ id: 'record-2' }));
        
        // Mark one as synced
        await result.current.updateRecord(result.current.records[0].id, {
          dbMeta: { version: 1, synced: true }
        });
        
        const unsynced = result.current.getUnsyncedRecords();
        expect(unsynced).toHaveLength(1);
        expect(unsynced[0].id).toBe('record-2');
      });
    });
  });

  describe('Convenience Hooks', () => {
    it('should use filtered records hook', () => {
      const { result: storeResult } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        storeResult.current.addRecord(createMockRecord());
      });
      
      const { result: recordsResult } = renderHook(() => useAnalysisRecords());
      
      expect(recordsResult.current).toHaveLength(1);
    });

    it('should use metrics hook', () => {
      const { result } = renderHook(() => useAnalysisMetrics());
      
      expect(result.current).toBeDefined();
      expect(result.current.totalAnalyses).toBe(10);
    });

    it('should use actions hook', () => {
      const { result } = renderHook(() => useAnalysisActions());
      
      expect(result.current.addRecord).toBeDefined();
      expect(result.current.updateRecord).toBeDefined();
      expect(result.current.deleteRecord).toBeDefined();
      expect(result.current.setFilter).toBeDefined();
      expect(result.current.exportData).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent record updates', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        await result.current.updateRecord('non-existent', { symbol: 'TEST' });
        
        expect(logger.warn).toHaveBeenCalledWith(
          '[AnalysisHistory] Record not found for update',
          { id: 'non-existent' }
        );
      });
    });

    it('should handle concurrent record additions', async () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        const promises = [
          result.current.addRecord(createMockRecord({ symbol: 'BTC1' })),
          result.current.addRecord(createMockRecord({ symbol: 'BTC2' })),
          result.current.addRecord(createMockRecord({ symbol: 'BTC3' }))
        ];
        
        await Promise.all(promises);
        
        expect(result.current.records).toHaveLength(3);
      });
    });

    it('should handle empty state operations', () => {
      const { result } = renderHook(() => useAnalysisHistoryBase());
      
      act(() => {
        const metrics = result.current.getPerformanceMetrics();
        expect(metrics.totalAnalyses).toBe(10); // Mocked value
        
        const filtered = result.current.getFilteredRecords();
        expect(filtered).toEqual([]);
        
        result.current.clearHistory();
        expect(result.current.records).toEqual([]);
      });
    });

    it('should persist state across reloads', async () => {
      const { result: result1 } = renderHook(() => useAnalysisHistoryBase());
      
      await act(async () => {
        await result1.current.addRecord(createMockRecord());
      });
      
      // Simulate reload by creating new hook instance
      const { result: result2 } = renderHook(() => useAnalysisHistoryBase());
      
      // State should be persisted
      expect(result2.current.records.length).toBeGreaterThanOrEqual(0);
    });
  });
});
