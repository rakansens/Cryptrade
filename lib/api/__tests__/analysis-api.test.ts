// Mock dependencies before imports
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/db-conversions');

// Mock global fetch
global.fetch = jest.fn();

import { AnalysisAPI } from '../analysis-api';
import { apiCache, createKey } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';
import { convertDbAnalysisRecord } from '@/lib/utils/db-conversions';
import type { 
  AnalysisRecord
} from '@/types/analysis-history';

describe('AnalysisAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (withRetry as jest.Mock).mockImplementation(async (fn) => fn());
  });

  describe('saveAnalysis', () => {
    it('should save analysis record successfully', async () => {
      const analysisData = {
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support' as const,
        proposalData: {
          price: 50000,
          confidence: 0.8,
          drawingData: {
            id: 'test-drawing',
            type: 'horizontal' as const,
            points: [{ time: Date.now() / 1000, value: 50000 }],
            style: { color: '#00FF00', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
          }
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: 'record-123' }),
      });

      const result = await AnalysisAPI.saveAnalysis(analysisData);

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
      });
      expect(result).toBe('record-123');
    });

    it('should handle optional fields correctly', async () => {
      const analysisData = {
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'resistance' as const,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: 'record-456' }),
      });

      await AnalysisAPI.saveAnalysis(analysisData);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody).toEqual(analysisData);
      expect(sentBody.sessionId).toBeUndefined();
      expect(sentBody.proposalData).toBeUndefined();
    });

    it('should include sentiment data when provided', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        interval: '1d',
        type: 'pattern' as const,
        sentimentData: {
          overall: 'bullish' as const,
          strength: 0.85,
          signals: [
            { type: 'pattern', value: 'uptrend', weight: 0.9 }
          ]
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: 'record-789' }),
      });

      await AnalysisAPI.saveAnalysis(analysisData);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.sentimentData).toEqual(analysisData.sentimentData);
    });

    it('should include tracking data when provided', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'trendline' as const,
        trackingData: {
          status: 'active' as const,
          startTime: Date.now(),
          touches: [
            { time: Date.now(), price: 50000, result: 'bounce' as const, strength: 0.9 }
          ]
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recordId: 'record-abc' }),
      });

      await AnalysisAPI.saveAnalysis(analysisData);

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.trackingData).toEqual(analysisData.trackingData);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(
        AnalysisAPI.saveAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
        })
      ).rejects.toThrow('Failed to save analysis: Bad Request');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(
        AnalysisAPI.saveAnalysis({
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('recordTouchEvent', () => {
    it('should record touch event successfully', async () => {
      const touchEvent = {
        time: Date.now(),
        price: 50000,
        result: 'bounce' as const,
        strength: 0.95
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await AnalysisAPI.recordTouchEvent('record-123', touchEvent);

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/records/record-123/touch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(touchEvent),
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(
        AnalysisAPI.recordTouchEvent('invalid-id', {
          time: Date.now(),
          price: 50000,
          result: 'test' as const,
          strength: 0.5
        })
      ).rejects.toThrow('Failed to record touch event: Not Found');
      expect(logger.error).toHaveBeenCalledWith('[AnalysisAPI] Failed to record touch event', {
        error: expect.any(Error),
        recordId: 'invalid-id',
      });
    });
  });

  describe('getSessionAnalyses', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should return cached analyses if available', async () => {
      const cachedRecords: AnalysisRecord[] = [
        {
          id: 'record-1',
          proposalId: 'proposal-1',
          sessionId: 'session-1',
          timestamp: Date.now(),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposal: {
            confidence: 0.8,
            drawingData: {
              id: 'drawing-1',
              type: 'horizontal' as const,
              points: [{ time: Date.now() / 1000, value: 50000 }],
              style: { color: '#00FF00', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: {
            status: 'active' as const,
            startTime: Date.now(),
            touches: []
          }
        },
      ];

      (createKey as jest.Mock).mockReturnValue('analysis_session_session-1');
      mockApiCache.get.mockReturnValue(cachedRecords);

      const result = await AnalysisAPI.getSessionAnalyses('session-1');

      expect(result).toEqual(cachedRecords);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('[AnalysisAPI] Returning cached session analyses', {
        sessionId: 'session-1',
      });
    });

    it('should fetch analyses from API when cache is empty', async () => {
      const records: AnalysisRecord[] = [
        {
          id: 'record-1',
          proposalId: 'proposal-1',
          sessionId: 'session-1',
          timestamp: Date.now(),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'resistance',
          proposal: {
            confidence: 0.8,
            drawingData: {
              id: 'drawing-1',
              type: 'horizontal' as const,
              points: [{ time: Date.now() / 1000, value: 51000 }],
              style: { color: '#FF0000', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: {
            status: 'active' as const,
            startTime: Date.now(),
            touches: []
          }
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records }),
      });

      const result = await AnalysisAPI.getSessionAnalyses('session-1');

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/sessions/session-1/records');
      expect(mockApiCache.set).toHaveBeenCalledWith('analysis_session_session-1', records, {
        useLocalStorage: true,
      });
      expect(result).toEqual(records);
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
          json: async () => ({ records: [] }),
        });

      await AnalysisAPI.getSessionAnalyses('session-1');

      expect(logger.warn).toHaveBeenCalledWith('[AnalysisAPI] Retrying getSessionAnalyses', {
        error: 'First attempt failed',
        attempt: 1,
        sessionId: 'session-1',
      });
    });

    it('should use stale cache when API fails', async () => {
      const staleRecords: AnalysisRecord[] = [
        {
          id: 'stale-record',
          proposalId: 'proposal-stale',
          sessionId: 'session-1',
          symbol: 'ETHUSDT',
          interval: '4h',
          type: 'pattern',
          timestamp: Date.now() - 3600000,
          proposal: {
            confidence: 0.75,
            drawingData: {
              id: 'drawing-stale',
              type: 'pattern' as const,
              points: [{ time: Date.now() / 1000, value: 3000 }],
              style: { color: '#0000FF', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
        },
      ];

      mockApiCache.get
        .mockReturnValueOnce(null) // Fresh cache
        .mockReturnValueOnce(staleRecords); // Stale cache

      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await AnalysisAPI.getSessionAnalyses('session-1');

      expect(result).toEqual(staleRecords);
      expect(logger.warn).toHaveBeenCalledWith('[AnalysisAPI] Using stale cache due to API failure', {
        sessionId: 'session-1',
      });
    });

    it('should return empty array in development when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await AnalysisAPI.getSessionAnalyses('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[AnalysisAPI] Returning empty array in development mode');

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true
      });
    });

    it('should throw error in production when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(AnalysisAPI.getSessionAnalyses('session-1')).rejects.toThrow(
        'Failed to get session analyses for session-1: API Error'
      );

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true
      });
    });
  });

  describe('getActiveAnalyses', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should fetch all active analyses when no symbol provided', async () => {
      const records: AnalysisRecord[] = [
        {
          id: 'record-1',
          proposalId: 'proposal-1',
          sessionId: 'session-active',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          timestamp: Date.now(),
          proposal: {
            confidence: 0.8,
            drawingData: {
              id: 'drawing-1',
              type: 'horizontal' as const,
              points: [{ time: Date.now() / 1000, value: 50000 }],
              style: { color: '#00FF00', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
        },
        {
          id: 'record-2',
          proposalId: 'proposal-2',
          sessionId: 'session-active',
          symbol: 'ETHUSDT',
          interval: '4h',
          type: 'resistance',
          timestamp: Date.now(),
          proposal: {
            confidence: 0.85,
            drawingData: {
              id: 'drawing-2',
              type: 'horizontal' as const,
              points: [{ time: Date.now() / 1000, value: 3000 }],
              style: { color: '#FF0000', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records }),
      });

      const result = await AnalysisAPI.getActiveAnalyses();

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/active');
      expect(createKey).toHaveBeenCalledWith('analysis_active', { symbol: 'all' });
      expect(result).toEqual(records);
    });

    it('should fetch active analyses for specific symbol', async () => {
      const records: AnalysisRecord[] = [
        {
          id: 'record-1',
          proposalId: 'proposal-1',
          sessionId: 'session-specific',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'trendline',
          timestamp: Date.now(),
          proposal: {
            confidence: 0.75,
            drawingData: {
              id: 'drawing-1',
              type: 'trendline' as const,
              points: [{ time: Date.now() / 1000, value: 50000 }, { time: (Date.now() / 1000) + 3600, value: 51000 }],
              style: { color: '#00FF00', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records }),
      });

      const result = await AnalysisAPI.getActiveAnalyses('BTCUSDT');

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/active?symbol=BTCUSDT');
      expect(createKey).toHaveBeenCalledWith('analysis_active', { symbol: 'BTCUSDT' });
      expect(result).toEqual(records);
    });

    it('should handle special characters in symbol', async () => {
      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [] }),
      });

      await AnalysisAPI.getActiveAnalyses('BTC/USDT');

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/active?symbol=BTC%2FUSDT');
    });

    it('should use cache when available', async () => {
      const cachedRecords: AnalysisRecord[] = [
        {
          id: 'cached-record',
          proposalId: 'proposal-cached',
          sessionId: 'session-cached',
          symbol: 'BTCUSDT',
          interval: '15m',
          type: 'fibonacci',
          timestamp: Date.now(),
          proposal: {
            confidence: 0.7,
            drawingData: {
              id: 'drawing-cached',
              type: 'fibonacci' as const,
              points: [{ time: Date.now() / 1000, value: 49000 }, { time: (Date.now() / 1000) + 7200, value: 52000 }],
              style: { color: '#FFA500', lineWidth: 1, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
        },
      ];

      (createKey as jest.Mock).mockReturnValue('analysis_active_BTCUSDT');
      mockApiCache.get.mockReturnValue(cachedRecords);

      const result = await AnalysisAPI.getActiveAnalyses('BTCUSDT');

      expect(result).toEqual(cachedRecords);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle API failure with retry', async () => {
      mockApiCache.get.mockReturnValue(null);

      let attemptCount = 0;
      (withRetry as jest.Mock).mockImplementation(async (fn, options) => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error(`Attempt ${attemptCount} failed`);
          if (options?.onRetry) {
            options.onRetry(error, attemptCount);
          }
          throw error;
        }
        return fn();
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [] }),
      });

      await AnalysisAPI.getActiveAnalyses();

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should use stale cache on failure', async () => {
      const staleRecords: AnalysisRecord[] = [
        {
          id: 'stale-active',
          proposalId: 'proposal-stale-active',
          sessionId: 'session-stale',
          symbol: 'BTCUSDT',
          interval: '1d',
          type: 'pattern',
          timestamp: Date.now() - 7200000,
          proposal: {
            confidence: 0.65,
            drawingData: {
              id: 'drawing-stale-active',
              type: 'pattern' as const,
              points: [{ time: (Date.now() / 1000) - 7200, value: 48000 }],
              style: { color: '#800080', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
            }
          },
          tracking: { status: "active" as const, startTime: Date.now() - 7200000, touches: [] },
        },
      ];

      mockApiCache.get
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(staleRecords);

      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const result = await AnalysisAPI.getActiveAnalyses();

      expect(result).toEqual(staleRecords);
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('[AnalysisAPI] Using stale cache due to API failure', {
        symbol: undefined,
      });
    });
  });

  describe('convertToAnalysisRecord', () => {
    it('should convert database record to client format', () => {
      const dbRecord = {
        id: 'db-record-1',
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        createdAt: new Date(),
        tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
      };

      const expectedRecord: AnalysisRecord = {
        id: 'db-record-1',
        proposalId: 'proposal-db-1',
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        timestamp: Date.now(),
        proposal: {
          confidence: 0.8,
          drawingData: {
            id: 'drawing-db-1',
            type: 'horizontal' as const,
            points: [{ time: Date.now() / 1000, value: 50000 }],
            style: { color: '#00FF00', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
          }
        },
        tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
      };

      (convertDbAnalysisRecord as jest.Mock).mockReturnValue(expectedRecord);

      const result = AnalysisAPI.convertToAnalysisRecord(dbRecord);

      expect(convertDbAnalysisRecord).toHaveBeenCalledWith(dbRecord);
      expect(result).toEqual(expectedRecord);
    });

    it('should handle records with proposal data', () => {
      const dbRecord = {
        id: 'db-record-2',
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'pattern',
        proposal: {
          confidence: 0.7,
          drawingData: {
            id: 'drawing-db-2',
            type: 'pattern' as const,
            points: [{ time: Date.now() / 1000, value: 3000 }],
            style: { color: '#FF0000', lineWidth: 2, lineStyle: "solid" as const, showLabels: true }
          }
        },
        createdAt: new Date(),
      };

      const expectedRecord: AnalysisRecord = {
        id: 'db-record-2',
        proposalId: 'proposal-db-2',
        sessionId: 'session-db',
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'pattern',
        proposal: dbRecord.proposal,
        timestamp: Date.now(),
        tracking: { status: "active" as const, startTime: Date.now(), touches: [] },
      };

      (convertDbAnalysisRecord as jest.Mock).mockReturnValue(expectedRecord);

      const result = AnalysisAPI.convertToAnalysisRecord(dbRecord);

      expect(result.proposal).toBeDefined();
      expect(result.proposal?.confidence).toBe(0.7);
    });
  });
});