// Mock dependencies before imports
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/logger');

// Mock global fetch
global.fetch = jest.fn();

import { ChartDrawingAPI, TimeframeState } from '../chart-drawing-api';
import { apiCache } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';
import type { ChartDrawing, PatternData } from '@/lib/validation/chart-drawing.schema';

describe('ChartDrawingAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (withRetry as jest.Mock).mockImplementation(async (fn) => fn());
  });

  describe('saveDrawings', () => {
    it('should save drawings successfully', async () => {
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'trendline',
          points: [
            { x: 100, y: 200 },
            { x: 200, y: 300 },
          ],
          style: {
            color: '#FF0000',
            width: 2,
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.saveDrawings('session-1', drawings);

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/drawings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drawings }),
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(ChartDrawingAPI.saveDrawings('session-1', [])).rejects.toThrow(
        'Failed to save drawings: Internal Server Error'
      );
      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingAPI] Failed to save drawings', {
        error: expect.any(Error),
      });
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(ChartDrawingAPI.saveDrawings('session-1', [])).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadDrawings', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should return cached drawings if available', async () => {
      const cachedDrawings: ChartDrawing[] = [
        {
          id: 'cached-drawing',
          type: 'rectangle',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ],
          style: { color: '#00FF00' },
        },
      ];

      mockApiCache.createKey.mockReturnValue('chart_drawings_session-1');
      mockApiCache.get.mockReturnValue(cachedDrawings);

      const result = await ChartDrawingAPI.loadDrawings('session-1');

      expect(result).toEqual(cachedDrawings);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('[ChartDrawingAPI] Returning cached drawings', {
        sessionId: 'session-1',
      });
    });

    it('should fetch drawings from API when cache is empty', async () => {
      const drawings: ChartDrawing[] = [
        {
          id: 'drawing-1',
          type: 'horizontalLine',
          points: [{ x: 0, y: 50 }],
          style: { color: '#0000FF', width: 1 },
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ drawings }),
      });

      const result = await ChartDrawingAPI.loadDrawings('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/drawings');
      expect(mockApiCache.set).toHaveBeenCalledWith('chart_drawings_session-1', drawings, {
        useLocalStorage: true,
      });
      expect(result).toEqual(drawings);
    });

    it('should handle retry mechanism', async () => {
      mockApiCache.get.mockReturnValue(null);

      (withRetry as jest.Mock).mockImplementation(async (fn, options) => {
        try {
          return await fn();
        } catch (error) {
          if (options?.onRetry) {
            options.onRetry(error, 1);
          }
          return await fn();
        }
      });

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ drawings: [] }),
        });

      await ChartDrawingAPI.loadDrawings('session-1');

      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingAPI] Retrying loadDrawings', {
        error: 'First attempt failed',
        attempt: 1,
        sessionId: 'session-1',
      });
    });

    it('should use stale cache when API fails', async () => {
      const staleDrawings: ChartDrawing[] = [
        {
          id: 'stale-drawing',
          type: 'text',
          points: [{ x: 50, y: 50 }],
          style: { color: '#000000' },
          text: 'Stale text',
        },
      ];

      mockApiCache.get
        .mockReturnValueOnce(null) // Fresh cache
        .mockReturnValueOnce(staleDrawings); // Stale cache

      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await ChartDrawingAPI.loadDrawings('session-1');

      expect(result).toEqual(staleDrawings);
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingAPI] Using stale cache due to API failure', {
        sessionId: 'session-1',
      });
    });

    it('should return empty array in development mode when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await ChartDrawingAPI.loadDrawings('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingAPI] Returning empty array in development mode');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(ChartDrawingAPI.loadDrawings('session-1')).rejects.toThrow('Failed to load drawings: API Error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('savePatterns', () => {
    it('should save patterns successfully', async () => {
      const patterns: PatternData[] = [
        {
          id: 'pattern-1',
          type: 'triangle',
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
          ],
          timeframe: '1h',
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.savePatterns('session-1', patterns);

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patterns }),
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(ChartDrawingAPI.savePatterns('session-1', [])).rejects.toThrow(
        'Failed to save patterns: Bad Request'
      );
    });
  });

  describe('loadPatterns', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should return cached patterns if available', async () => {
      const cachedPatterns: PatternData[] = [
        {
          id: 'cached-pattern',
          type: 'head-and-shoulders',
          points: [],
          timeframe: '4h',
          symbol: 'ETHUSDT',
          timestamp: Date.now(),
        },
      ];

      mockApiCache.createKey.mockReturnValue('chart_patterns_session-1');
      mockApiCache.get.mockReturnValue(cachedPatterns);

      const result = await ChartDrawingAPI.loadPatterns('session-1');

      expect(result).toEqual(cachedPatterns);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch patterns from API when cache is empty', async () => {
      const patterns: PatternData[] = [
        {
          id: 'pattern-1',
          type: 'flag',
          points: [],
          timeframe: '15m',
          symbol: 'BTCUSDT',
          timestamp: Date.now(),
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ patterns }),
      });

      const result = await ChartDrawingAPI.loadPatterns('session-1');

      expect(result).toEqual(patterns);
      expect(mockApiCache.set).toHaveBeenCalledWith('chart_patterns_session-1', patterns, {
        useLocalStorage: true,
      });
    });

    it('should handle API failure with retry', async () => {
      mockApiCache.get.mockReturnValue(null);

      let attemptCount = 0;
      (withRetry as jest.Mock).mockImplementation(async (fn, options) => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Network error');
          if (options?.onRetry) {
            options.onRetry(error, attemptCount);
          }
          throw error;
        }
        return fn();
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ patterns: [] }),
      });

      const result = await ChartDrawingAPI.loadPatterns('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[ChartDrawingAPI] Retrying loadPatterns', {
        error: 'Network error',
        attempt: 1,
        sessionId: 'session-1',
      });
    });
  });

  describe('saveTimeframeState', () => {
    it('should save timeframe state successfully', async () => {
      const state: TimeframeState = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.saveTimeframeState('session-1', state);

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/timeframe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state),
      });
    });

    it('should handle errors', async () => {
      const state: TimeframeState = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
      });

      await expect(ChartDrawingAPI.saveTimeframeState('session-1', state)).rejects.toThrow(
        'Failed to save timeframe state: Forbidden'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('loadTimeframeState', () => {
    it('should load timeframe state successfully', async () => {
      const state: TimeframeState = {
        symbol: 'ETHUSDT',
        timeframe: '4h',
        timestamp: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state }),
      });

      const result = await ChartDrawingAPI.loadTimeframeState('session-1');

      expect(result).toEqual(state);
      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/timeframe');
    });

    it('should return null for 404 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await ChartDrawingAPI.loadTimeframeState('session-1');

      expect(result).toBeNull();
    });

    it('should throw error for other HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(ChartDrawingAPI.loadTimeframeState('session-1')).rejects.toThrow(
        'Failed to load timeframe state: Internal Server Error'
      );
    });

    it('should return null in development mode on error', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await ChartDrawingAPI.loadTimeframeState('session-1');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(ChartDrawingAPI.loadTimeframeState('session-1')).rejects.toThrow(
        'Failed to load timeframe state: Network error'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('deleteDrawing', () => {
    it('should delete drawing successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.deleteDrawing('session-1', 'drawing-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/drawings/drawing-1', {
        method: 'DELETE',
      });
    });

    it('should handle delete errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(ChartDrawingAPI.deleteDrawing('session-1', 'drawing-1')).rejects.toThrow(
        'Failed to delete drawing: Not Found'
      );
    });
  });

  describe('deletePattern', () => {
    it('should delete pattern successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.deletePattern('session-1', 'pattern-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1/patterns/pattern-1', {
        method: 'DELETE',
      });
    });

    it('should handle delete errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(ChartDrawingAPI.deletePattern('session-1', 'pattern-1')).rejects.toThrow(
        'Failed to delete pattern: Unauthorized'
      );
    });
  });

  describe('migrateFromLocalStorage', () => {
    it('should migrate data successfully', async () => {
      const migrationData = {
        drawings: [
          {
            id: 'drawing-1',
            type: 'trendline' as const,
            points: [],
            style: {},
          },
        ],
        patterns: [
          {
            id: 'pattern-1',
            type: 'triangle' as const,
            points: [],
            timeframe: '1h',
            symbol: 'BTCUSDT',
            timestamp: Date.now(),
          },
        ],
        sessionId: 'session-1',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.migrateFromLocalStorage(migrationData);

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(migrationData),
      });
    });

    it('should handle migration errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(
        ChartDrawingAPI.migrateFromLocalStorage({
          drawings: [],
          patterns: [],
        })
      ).rejects.toThrow('Failed to migrate data: Service Unavailable');
      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingAPI] Failed to migrate from localStorage', {
        error: expect.any(Error),
      });
    });
  });

  describe('clearSession', () => {
    it('should clear session successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await ChartDrawingAPI.clearSession('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/chart/sessions/session-1', {
        method: 'DELETE',
      });
    });

    it('should handle clear session errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Conflict',
      });

      await expect(ChartDrawingAPI.clearSession('session-1')).rejects.toThrow('Failed to clear session: Conflict');
      expect(logger.error).toHaveBeenCalledWith('[ChartDrawingAPI] Failed to clear session', {
        error: expect.any(Error),
      });
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Connection refused');
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(ChartDrawingAPI.clearSession('session-1')).rejects.toThrow('Connection refused');
    });
  });
});