/**
 * @jest-environment jsdom
 */

import { ChartPersistenceManager } from '@/lib/storage/chart-persistence';
import { logger } from '@/lib/utils/logger';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };
})();

// Setup localStorage mock
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
});

describe('ChartPersistenceManager', () => {
  // Test data
  const validDrawing: ChartDrawing = {
    id: 'drawing-1',
    type: 'trendline',
    points: [
      { time: 1704067200, value: 45000 },
      { time: 1704153600, value: 47000 }
    ],
    style: {
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true
    },
    visible: true,
    interactive: true,
    metadata: { createdAt: Date.now() }
  };

  const validPattern: PatternData = {
    id: 'pattern-1',
    type: 'headAndShoulders',
    symbol: 'BTCUSDT',
    interval: '1h',
    startTime: 1704067200,
    endTime: 1704070800,
    visualization: {
      lines: [],
      zones: [],
      markers: []
    },
    metrics: {
      targetPrice: 48000,
      stopLoss: 44000
    },
    tradingImplication: 'bearish',
    confidence: 0.85
  };

  beforeEach(() => {
    // Clear localStorage and mocks
    localStorageMock.clear();
    jest.clearAllMocks();
    
    // Configure to use localStorage instead of database
    ChartPersistenceManager.configure({
      useDatabase: false,
      fallbackToLocal: true
    });
  });

  describe('saveDrawings', () => {
    it('saves valid drawings to localStorage', async () => {
      const drawings = [validDrawing];
      
      await ChartPersistenceManager.saveDrawings(drawings);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cryptrade_chart_drawings',
        expect.any(String)
      );
      
      const savedData = JSON.parse(localStorageMock.getItem('cryptrade_chart_drawings') || '[]');
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        id: 'drawing-1',
        type: 'trendline'
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings saved to localStorage',
        { count: 1 }
      );
    });

    it('validates drawings before saving', async () => {
      const invalidDrawing = {
        id: 'invalid',
        type: 'invalid-type', // Invalid type
        points: []
      };
      
      ChartPersistenceManager.saveDrawings([invalidDrawing as any]);
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save drawings',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('handles empty array', async () => {
      await ChartPersistenceManager.saveDrawings([]);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cryptrade_chart_drawings',
        '[]'
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings saved to localStorage',
        { count: 0 }
      );
    });

    it('handles localStorage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      
      await ChartPersistenceManager.saveDrawings([validDrawing]);
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save drawings',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('loadDrawings', () => {
    it('loads valid drawings from localStorage', async () => {
      const drawings = [validDrawing];
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify(drawings));
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        id: 'drawing-1',
        type: 'trendline'
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Drawings loaded from localStorage',
        { count: 1 }
      );
    });

    it('returns empty array when no data exists', async () => {
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toEqual([]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('skips invalid drawings and logs warning', async () => {
      const mixedDrawings = [
        validDrawing,
        { id: 'invalid', type: 'invalid-type' }, // Invalid
        {
          id: 'drawing-2',
          type: 'horizontal',
          points: [{ time: 1704067200, value: 46000 }],
          style: {
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 'dashed',
            showLabels: false
          },
          visible: true,
          interactive: true
        }
      ];
      
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify(mixedDrawings));
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toHaveLength(2); // Only valid drawings
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartPersistence] Invalid drawing skipped',
        expect.objectContaining({
          drawing: expect.objectContaining({ id: 'invalid' })
        })
      );
    });

    it('handles corrupted JSON data', async () => {
      localStorageMock.setItem('cryptrade_chart_drawings', 'invalid-json');
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to load drawings from localStorage',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('handles non-array data', async () => {
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify({ not: 'array' }));
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toEqual([]);
    });
  });

  describe('savePatterns', () => {
    it('saves patterns map to localStorage', async () => {
      const patterns = new Map<string, PatternData>([
        ['pattern-1', validPattern]
      ]);
      
      await ChartPersistenceManager.savePatterns(Array.from(patterns.values()));
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cryptrade_chart_patterns',
        expect.any(String)
      );
      
      const savedData = JSON.parse(localStorageMock.getItem('cryptrade_chart_patterns') || '[]');
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        id: 'pattern-1',
        data: expect.objectContaining({
          type: 'head-and-shoulders'
        })
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Patterns saved to localStorage',
        { count: 1 }
      );
    });

    it('validates patterns before saving', async () => {
      const invalidPattern = {
        type: '', // Invalid empty type
        visualization: null
      };
      
      const patterns = new Map([['invalid', invalidPattern as any]]);
      
      await ChartPersistenceManager.savePatterns(Array.from(patterns.values()));
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save patterns',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('handles empty map', async () => {
      await ChartPersistenceManager.savePatterns([]);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cryptrade_chart_patterns',
        '[]'
      );
    });
  });

  describe('loadPatterns', () => {
    it('loads patterns into Map from localStorage', async () => {
      const patternsArray = [validPattern];
      localStorageMock.setItem('cryptrade_chart_patterns', JSON.stringify(patternsArray));
      
      const loaded = await ChartPersistenceManager.loadPatterns();
      
      expect(loaded.length).toBe(1);
      expect(loaded[0]).toMatchObject({
        type: 'headAndShoulders'
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        '[ChartPersistence] Patterns loaded from local storage',
        { count: 1 }
      );
    });

    it('returns empty array when no data exists', async () => {
      const loaded = await ChartPersistenceManager.loadPatterns();
      
      expect(loaded).toEqual([]);
    });

    it('skips invalid patterns', async () => {
      const mixedPatterns = [
        validPattern,
        { type: '' }, // Invalid
        { ...validPattern, id: 'pattern-2', type: 'doubleTop' }
      ];
      
      localStorageMock.setItem('cryptrade_chart_patterns', JSON.stringify(mixedPatterns));
      
      const loaded = await ChartPersistenceManager.loadPatterns();
      
      expect(loaded.length).toBe(2);
      expect(loaded.find(p => p.type === '')).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[ChartPersistence] Invalid pattern skipped',
        expect.objectContaining({ pattern: expect.objectContaining({ type: '' }) })
      );
    });

    it('handles corrupted data', async () => {
      localStorageMock.setItem('cryptrade_chart_patterns', 'invalid-json');
      
      const loaded = await ChartPersistenceManager.loadPatterns();
      
      expect(loaded).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to load patterns from localStorage',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('saveTimeframeState', () => {
    it('saves timeframe state to localStorage', async () => {
      const mockDate = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(mockDate);
      
      ChartPersistenceManager.saveTimeframeState({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cryptrade_timeframe_state',
        JSON.stringify({
          symbol: 'BTCUSDT',
          timeframe: '1h',
          timestamp: Date.now()
        })
      );
    });

    it('handles localStorage errors', async () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      ChartPersistenceManager.saveTimeframeState({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save timeframe state',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('loadTimeframeState', () => {
    it('loads timeframe state from localStorage', async () => {
      const state = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      };
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(state));
      
      const loaded = ChartPersistenceManager.loadTimeframeState();
      
      expect(loaded).toEqual(state);
    });

    it('returns null when no state exists', async () => {
      const loaded = ChartPersistenceManager.loadTimeframeState();
      
      expect(loaded).toBeNull();
    });

    it('handles corrupted data', async () => {
      localStorageMock.setItem('cryptrade_timeframe_state', 'invalid-json');
      
      const loaded = ChartPersistenceManager.loadTimeframeState();
      
      expect(loaded).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to load timeframe state',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('clearAll', () => {
    it('removes all storage keys', async () => {
      // Set some data
      localStorageMock.setItem('cryptrade_chart_drawings', '[]');
      localStorageMock.setItem('cryptrade_chart_patterns', '[]');
      localStorageMock.setItem('cryptrade_timeframe_state', '{}');
      
      ChartPersistenceManager.clearAll();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cryptrade_chart_drawings');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cryptrade_chart_patterns');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cryptrade_timeframe_state');
      
      expect(logger.info).toHaveBeenCalledWith('[ChartPersistence] All data cleared');
    });

    it('handles errors during clearing', async () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove error');
      });
      
      ChartPersistenceManager.clearAll();
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to clear data',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('hasTimeframeChanged', () => {
    it('returns true when no previous state exists', async () => {
      const hasChanged = ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '1h');
      
      expect(hasChanged).toBe(true);
    });

    it('returns false when symbol and timeframe match', async () => {
      const state = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      };
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(state));
      
      const hasChanged = ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '1h');
      
      expect(hasChanged).toBe(false);
    });

    it('returns true when symbol changes', async () => {
      const state = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      };
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(state));
      
      const hasChanged = ChartPersistenceManager.hasTimeframeChanged('ETHUSDT', '1h');
      
      expect(hasChanged).toBe(true);
    });

    it('returns true when timeframe changes', async () => {
      const state = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now()
      };
      localStorageMock.setItem('cryptrade_timeframe_state', JSON.stringify(state));
      
      const hasChanged = ChartPersistenceManager.hasTimeframeChanged('BTCUSDT', '4h');
      
      expect(hasChanged).toBe(true);
    });
  });

  describe('Data Migration Scenarios', () => {
    it('handles legacy data format migration', async () => {
      // Simulate old format without required fields
      const legacyDrawings = [
        {
          id: 'old-1',
          type: 'trendline',
          points: [
            { time: 1704067200, value: 45000 },
            { time: 1704153600, value: 47000 }
          ],
          // Missing style, visible, interactive fields
        }
      ];
      
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify(legacyDrawings));
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      // Should skip invalid drawings
      expect(loaded).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('handles data with extra fields', async () => {
      const drawingWithExtra = {
        ...validDrawing,
        extraField: 'should-be-ignored',
        anotherExtra: { nested: 'data' }
      };
      
      localStorageMock.setItem('cryptrade_chart_drawings', JSON.stringify([drawingWithExtra]));
      
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toHaveLength(1);
      // Extra fields should be preserved in metadata
      expect(loaded[0]).toMatchObject({
        id: 'drawing-1',
        type: 'trendline'
      });
    });
  });

  describe('Concurrent Access', () => {
    it('handles rapid save/load operations', async () => {
      const drawings1 = [validDrawing];
      const drawings2 = [{ ...validDrawing, id: 'drawing-2' }];
      
      // Rapid saves
      ChartPersistenceManager.saveDrawings(drawings1);
      ChartPersistenceManager.saveDrawings(drawings2);
      
      // Should have the latest data
      const loaded = await ChartPersistenceManager.loadDrawings();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe('drawing-2');
    });
  });

  describe('Storage Quota Handling', () => {
    it('handles quota exceeded errors gracefully', async () => {
      const largeDrawing = {
        ...validDrawing,
        metadata: {
          ...validDrawing.metadata,
          // Simulate large data
          largeData: 'x'.repeat(1000000)
        }
      };
      
      localStorageMock.setItem.mockImplementationOnce(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });
      
      ChartPersistenceManager.saveDrawings([largeDrawing]);
      
      expect(logger.error).toHaveBeenCalledWith(
        '[ChartPersistence] Failed to save drawings',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'QuotaExceededError'
          })
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles drawings with minimal valid data', async () => {
      const minimalDrawing: ChartDrawing = {
        id: 'min',
        type: 'horizontal',
        points: [{ time: 1, value: 1 }],
        style: {
          color: '#000000',
          lineWidth: 1,
          lineStyle: 'solid',
          showLabels: false
        },
        visible: false,
        interactive: false
      };
      
      ChartPersistenceManager.saveDrawings([minimalDrawing]);
      const loaded = await ChartPersistenceManager.loadDrawings();
      
      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(minimalDrawing);
    });

    it('handles patterns with complex visualization data', async () => {
      const complexPattern: PatternData = {
        id: 'complex-pattern-1',
        type: 'headAndShoulders',
        symbol: 'BTCUSDT',
        interval: '1h',
        startTime: 1704067200,
        endTime: 1704070800,
        visualization: {
          lines: Array(50).fill(null).map((_, i) => ({
            id: `line-${i}`,
            points: [
              { time: 1704067200 + i * 3600, value: 45000 },
              { time: 1704067200 + (i + 1) * 3600, value: 45100 }
            ],
            style: { color: '#000000' }
          })),
          zones: [
            {
              id: 'zone-1',
              points: [
                { time: 1704067200, value: 45000 },
                { time: 1704070800, value: 45500 }
              ],
              style: { fillColor: 'rgba(0,0,0,0.1)' }
            }
          ]
        },
        tradingImplication: 'bearish',
        confidence: 0.95
      };
      
      const patterns = [{ ...complexPattern, id: 'complex' }];
      await ChartPersistenceManager.savePatterns(Array.from(patterns.values()));
      
      const loaded = await ChartPersistenceManager.loadPatterns();
      expect(loaded.length).toBe(1);
      expect(loaded[0]).toMatchObject({
        type: 'headAndShoulders',
        confidence: 0.95
      });
    });

    it('handles localStorage access errors', async () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorageMock.getItem;
      localStorageMock.getItem = jest.fn((_key: string) => {
        throw new Error('SecurityError: localStorage access denied');
      }) as any;
      
      // Should handle error gracefully
      const loaded = await ChartPersistenceManager.loadDrawings();
      expect(loaded).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
      
      // Restore
      localStorageMock.getItem = originalGetItem;
    });
  });
});