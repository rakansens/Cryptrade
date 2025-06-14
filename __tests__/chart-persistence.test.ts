import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ChartPersistenceManager } from '@/lib/storage/chart-persistence';
import { ChartDrawingAPI } from '@/lib/api/chart-drawing-api';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';
import type { TimeframeState } from '@/lib/api/chart-drawing-api';
import { logger } from '@/lib/utils/logger';

// Mock dependencies
vi.mock('@/lib/api/chart-drawing-api');
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ChartPersistenceManager', () => {
  // Sample test data
  const mockDrawing: ChartDrawing = {
    id: 'drawing-1',
    type: 'trendline',
    points: [
      { time: 1234567890, value: 100 },
      { time: 1234567900, value: 110 },
    ],
    style: {
      color: '#FF0000',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true,
    },
    visible: true,
    interactive: true,
  };

  const mockPattern: PatternData = {
    id: 'pattern-1',
    type: 'headAndShoulders',
    symbol: 'BTCUSDT',
    interval: '1h',
    startTime: 1234567890,
    endTime: 1234567900,
    visualization: {
      lines: [{
        id: 'line-1',
        points: [
          { time: 1234567890, value: 100 },
          { time: 1234567900, value: 110 },
        ],
      }],
    },
    tradingImplication: 'bearish',
    confidence: 0.85,
  };

  const mockTimeframeState: TimeframeState = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    lastUpdate: Date.now(),
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset persistence configuration to defaults
    ChartPersistenceManager.configure({
      useDatabase: true,
      fallbackToLocal: true,
      sessionId: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should have database enabled by default', () => {
      expect(ChartPersistenceManager.isDatabaseEnabled()).toBe(true);
    });

    it('should update configuration', () => {
      ChartPersistenceManager.configure({
        useDatabase: false,
        sessionId: 'test-session',
      });

      expect(ChartPersistenceManager.isDatabaseEnabled()).toBe(false);
      expect(ChartPersistenceManager.getSessionId()).toBe('test-session');
    });

    it('should enable database with migration', async () => {
      // Add data to localStorage
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify([mockDrawing]));
      localStorageMock.setItem('cryptrade_chart_patterns', JSON.stringify([mockPattern]));

      await ChartPersistenceManager.enableDatabase('new-session');

      expect(ChartPersistenceManager.isDatabaseEnabled()).toBe(true);
      expect(ChartPersistenceManager.getSessionId()).toBe('new-session');
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Migration to database pending API implementation'
      );
    });

    it('should disable database', () => {
      ChartPersistenceManager.disableDatabase();

      expect(ChartPersistenceManager.isDatabaseEnabled()).toBe(false);
      expect(ChartPersistenceManager.getSessionId()).toBeUndefined();
    });
  });

  describe('Save Drawings', () => {
    it('should save drawings to database when enabled', async () => {
      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveDrawings([mockDrawing]);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalledWith('default', [mockDrawing]);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings saved to database',
        { count: 1 }
      );
    });

    it('should save drawings to localStorage when database is disabled', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      await ChartPersistenceManager.saveDrawings([mockDrawing]);

      const stored = localStorageMock.getItem('cryptrade_chart_drawings');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual([mockDrawing]);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings saved to localStorage',
        { count: 1 }
      );
    });

    it('should fallback to localStorage on database error', async () => {
      const dbError = new Error('Database connection failed');
      (ChartDrawingAPI.saveDrawings as Mock).mockRejectedValue(dbError);

      await ChartPersistenceManager.saveDrawings([mockDrawing]);

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Database save failed',
        { dbError }
      );
      
      const stored = localStorageMock.getItem('cryptrade_chart_drawings');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual([mockDrawing]);
    });

    it('should throw error when fallback is disabled', async () => {
      ChartPersistenceManager.configure({ fallbackToLocal: false });
      const dbError = new Error('Database connection failed');
      (ChartDrawingAPI.saveDrawings as Mock).mockRejectedValue(dbError);

      await ChartPersistenceManager.saveDrawings([mockDrawing]);

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save drawings',
        { error: dbError }
      );
    });

    it('should validate drawings before saving', async () => {
      const invalidDrawing = { ...mockDrawing, id: '' }; // Invalid: empty ID

      await ChartPersistenceManager.saveDrawings([invalidDrawing as ChartDrawing]);

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save drawings',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should save multiple drawings', async () => {
      const drawing2 = { ...mockDrawing, id: 'drawing-2' };
      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveDrawings([mockDrawing, drawing2]);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalledWith(
        'default',
        [mockDrawing, drawing2]
      );
    });
  });

  describe('Load Drawings', () => {
    it('should load drawings from database when enabled', async () => {
      (ChartDrawingAPI.loadDrawings as Mock).mockResolvedValue([mockDrawing]);

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(ChartDrawingAPI.loadDrawings).toHaveBeenCalledWith('default');
      expect(drawings).toEqual([mockDrawing]);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings loaded from database',
        { count: 1 }
      );
    });

    it('should load drawings from localStorage when database is disabled', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify([mockDrawing]));

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(drawings).toEqual([mockDrawing]);
    });

    it('should fallback to localStorage on database error', async () => {
      const dbError = new Error('Database connection failed');
      (ChartDrawingAPI.loadDrawings as Mock).mockRejectedValue(dbError);
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify([mockDrawing]));

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Database load failed',
        { dbError }
      );
      expect(drawings).toEqual([mockDrawing]);
    });

    it('should return empty array when no drawings exist', async () => {
      (ChartDrawingAPI.loadDrawings as Mock).mockResolvedValue([]);

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(drawings).toEqual([]);
    });

    it('should validate loaded drawings and skip invalid ones', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      const invalidDrawing = { ...mockDrawing, id: '' };
      localStorageMock.setItem(
        'cryptrade_chart_drawings',
        JSON.stringify([mockDrawing, invalidDrawing])
      );

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(drawings).toEqual([mockDrawing]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartPersistence] Invalid drawing skipped',
        expect.objectContaining({ drawing: invalidDrawing })
      );
    });

    it('should handle corrupted localStorage data', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      localStorageMock.setItem('cryptrade_chart_drawings', 'invalid-json');

      const drawings = await ChartPersistenceManager.loadDrawings();

      expect(drawings).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to load drawings from localStorage',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Save Patterns', () => {
    it('should save patterns to database when enabled', async () => {
      (ChartDrawingAPI.savePatterns as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.savePatterns([mockPattern]);

      expect(ChartDrawingAPI.savePatterns).toHaveBeenCalledWith('default', [mockPattern]);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Patterns saved to database',
        { count: 1 }
      );
    });

    it('should save patterns to localStorage when database is disabled', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      await ChartPersistenceManager.savePatterns([mockPattern]);

      const stored = localStorageMock.getItem('cryptrade_chart_patterns');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual([mockPattern]);
    });

    it('should validate patterns before saving', async () => {
      const invalidPattern = { ...mockPattern, id: '' }; // Invalid: empty ID

      await ChartPersistenceManager.savePatterns([invalidPattern as PatternData]);

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save patterns',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Load Patterns', () => {
    it('should load patterns from database when enabled', async () => {
      (ChartDrawingAPI.loadPatterns as Mock).mockResolvedValue([mockPattern]);

      const patterns = await ChartPersistenceManager.loadPatterns();

      expect(ChartDrawingAPI.loadPatterns).toHaveBeenCalledWith('default');
      expect(patterns).toEqual([mockPattern]);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Patterns loaded from database',
        { count: 1 }
      );
    });

    it('should load patterns from localStorage when database is disabled', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      localStorageMock.setItem('cryptrade_chart_patterns', JSON.stringify([mockPattern]));

      const patterns = await ChartPersistenceManager.loadPatterns();

      expect(patterns).toEqual([mockPattern]);
    });

    it('should validate loaded patterns and skip invalid ones', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      const invalidPattern = { ...mockPattern, type: 'invalid-type' };
      localStorageMock.setItem(
        'cryptrade_chart_patterns',
        JSON.stringify([mockPattern, invalidPattern])
      );

      const patterns = await ChartPersistenceManager.loadPatterns();

      expect(patterns).toEqual([mockPattern]);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartPersistence] Invalid pattern skipped',
        expect.objectContaining({ pattern: invalidPattern })
      );
    });
  });

  describe('Delete Operations', () => {
    it('should delete drawing from localStorage', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      const drawing2 = { ...mockDrawing, id: 'drawing-2' };
      localStorageMock.setItem(
        'cryptrade_chart_drawings',
        JSON.stringify([mockDrawing, drawing2])
      );

      await ChartPersistenceManager.deleteDrawing('drawing-1');

      const stored = localStorageMock.getItem('cryptrade_chart_drawings');
      expect(JSON.parse(stored!)).toEqual([drawing2]);
    });

    it('should log warning for unimplemented database delete', async () => {
      await ChartPersistenceManager.deleteDrawing('drawing-1');

      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartPersistence] Delete drawing API not yet implemented'
      );
    });

    it('should delete pattern from localStorage', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      const pattern2 = { ...mockPattern, id: 'pattern-2' };
      localStorageMock.setItem(
        'cryptrade_chart_patterns',
        JSON.stringify([mockPattern, pattern2])
      );

      await ChartPersistenceManager.deletePattern('pattern-1');

      const stored = localStorageMock.getItem('cryptrade_chart_patterns');
      expect(JSON.parse(stored!)).toEqual([pattern2]);
    });
  });

  describe('Timeframe State', () => {
    it('should save timeframe state to database', async () => {
      ChartPersistenceManager.setSessionId('test-session');
      (ChartDrawingAPI.saveTimeframeState as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveTimeframeState(mockTimeframeState);

      expect(ChartDrawingAPI.saveTimeframeState).toHaveBeenCalledWith(
        'test-session',
        mockTimeframeState
      );
    });

    it('should save timeframe state to localStorage when database is disabled', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      await ChartPersistenceManager.saveTimeframeState(mockTimeframeState);

      const stored = localStorageMock.getItem('cryptrade_timeframe_state');
      expect(JSON.parse(stored!)).toEqual(mockTimeframeState);
    });

    it('should load timeframe state from database', async () => {
      ChartPersistenceManager.setSessionId('test-session');
      (ChartDrawingAPI.loadTimeframeState as Mock).mockResolvedValue(mockTimeframeState);

      const state = await ChartPersistenceManager.loadTimeframeState();

      expect(ChartDrawingAPI.loadTimeframeState).toHaveBeenCalledWith('test-session');
      expect(state).toEqual(mockTimeframeState);
    });

    it('should load timeframe state from localStorage', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(mockTimeframeState));

      const state = await ChartPersistenceManager.loadTimeframeState();

      expect(state).toEqual(mockTimeframeState);
    });

    it('should detect timeframe changes', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(mockTimeframeState));

      const hasChanged1 = await ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '1h');
      expect(hasChanged1).toBe(false);

      const hasChanged2 = await ChartPersistenceManager.hasTimeframeChanged('ETHUSDT', '1h');
      expect(hasChanged2).toBe(true);

      const hasChanged3 = await ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '4h');
      expect(hasChanged3).toBe(true);
    });

    it('should return true when no previous state exists', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      const hasChanged = await ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '1h');
      expect(hasChanged).toBe(true);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all data from database and localStorage', async () => {
      ChartPersistenceManager.setSessionId('test-session');
      (ChartDrawingAPI.clearSession as Mock).mockResolvedValue(undefined);
      
      // Add data to localStorage
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify([mockDrawing]));
      localStorageMock.setItem('cryptrade_chart_patterns', JSON.stringify([mockPattern]));
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(mockTimeframeState));

      await ChartPersistenceManager.clearAll();

      expect(ChartDrawingAPI.clearSession).toHaveBeenCalledWith('test-session');
      expect(localStorageMock.getItem('cryptrade_chart_drawings')).toBeNull();
      expect(localStorageMock.getItem('cryptrade_chart_patterns')).toBeNull();
      expect(localStorageMock.getItem('cryptrade_timeframe_state')).toBeNull();
    });

    it('should handle database clear errors gracefully', async () => {
      ChartPersistenceManager.setSessionId('test-session');
      const error = new Error('Clear failed');
      (ChartDrawingAPI.clearSession as Mock).mockRejectedValue(error);

      await ChartPersistenceManager.clearAll();

      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to clear database',
        { error }
      );
    });
  });

  describe('Session Management', () => {
    it('should update session ID', () => {
      ChartPersistenceManager.setSessionId('new-session');

      expect(ChartPersistenceManager.getSessionId()).toBe('new-session');
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Session ID updated',
        { sessionId: 'new-session' }
      );
    });

    it('should use session ID for database operations', async () => {
      ChartPersistenceManager.setSessionId('custom-session');
      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveDrawings([mockDrawing]);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalledWith('custom-session', [mockDrawing]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', async () => {
      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);
      (ChartDrawingAPI.savePatterns as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveDrawings([]);
      await ChartPersistenceManager.savePatterns([]);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalledWith('default', []);
      expect(ChartDrawingAPI.savePatterns).toHaveBeenCalledWith('default', []);
    });

    it('should handle server-side environment', async () => {
      // Simulate server-side by removing window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      ChartPersistenceManager.configure({ useDatabase: false });
      
      const drawings = await ChartPersistenceManager.loadDrawings();
      expect(drawings).toEqual([]);

      await ChartPersistenceManager.saveDrawings([mockDrawing]);
      // Should not throw error

      // Restore window
      global.window = originalWindow;
    });

    it('should handle concurrent operations', async () => {
      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);
      (ChartDrawingAPI.savePatterns as Mock).mockResolvedValue(undefined);

      // Perform multiple operations concurrently
      await Promise.all([
        ChartPersistenceManager.saveDrawings([mockDrawing]),
        ChartPersistenceManager.savePatterns([mockPattern]),
        ChartPersistenceManager.saveTimeframeState(mockTimeframeState),
      ]);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalled();
      expect(ChartDrawingAPI.savePatterns).toHaveBeenCalled();
    });

    it('should handle large datasets', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...mockDrawing,
        id: `drawing-${i}`,
      }));

      (ChartDrawingAPI.saveDrawings as Mock).mockResolvedValue(undefined);

      await ChartPersistenceManager.saveDrawings(largeDataset);

      expect(ChartDrawingAPI.saveDrawings).toHaveBeenCalledWith('default', largeDataset);
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings saved to database',
        { count: 100 }
      );
    });
  });

  describe('Data Integrity', () => {
    it('should preserve drawing data integrity through save/load cycle', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      await ChartPersistenceManager.saveDrawings([mockDrawing]);
      const loaded = await ChartPersistenceManager.loadDrawings();

      expect(loaded).toEqual([mockDrawing]);
      expect(loaded[0]).toMatchObject({
        id: mockDrawing.id,
        type: mockDrawing.type,
        points: mockDrawing.points,
        style: mockDrawing.style,
      });
    });

    it('should preserve pattern data integrity through save/load cycle', async () => {
      ChartPersistenceManager.configure({ useDatabase: false });

      await ChartPersistenceManager.savePatterns([mockPattern]);
      const loaded = await ChartPersistenceManager.loadPatterns();

      expect(loaded).toEqual([mockPattern]);
      expect(loaded[0]).toMatchObject({
        id: mockPattern.id,
        type: mockPattern.type,
        symbol: mockPattern.symbol,
        visualization: mockPattern.visualization,
      });
    });

    it('should handle complex metadata', async () => {
      const complexDrawing: ChartDrawing = {
        ...mockDrawing,
        metadata: {
          creator: 'AI',
          confidence: 0.95,
          tags: ['support', 'resistance'],
          nested: {
            level1: 'value1',
            level2: 42,
          },
        },
      };

      ChartPersistenceManager.configure({ useDatabase: false });
      await ChartPersistenceManager.saveDrawings([complexDrawing]);
      const loaded = await ChartPersistenceManager.loadDrawings();

      expect(loaded[0].metadata).toEqual(complexDrawing.metadata);
    });
  });
});