// Mock dependencies before imports
jest.mock('@/lib/utils/api-cache');
jest.mock('@/lib/utils/retry');
jest.mock('@/lib/utils/logger');
jest.mock('@/lib/utils/db-conversions');

// Mock global fetch
global.fetch = jest.fn();

import { AnalysisAPI } from '../analysis-api';
import { apiCache } from '@/lib/utils/api-cache';
import { withRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';
import { convertDbAnalysisRecord } from '@/lib/utils/db-conversions';
import type { 
  AnalysisRecord, 
  TouchEvent,
  ProposalData,
  TrackingData,
  SentimentData
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
          proposals: [
            {
              symbol: 'BTCUSDT',
              action: 'BUY',
              timeframe: '1h',
              entry: 50000,
              targets: [51000],
              stopLoss: 49000,
              confidence: 0.8,
              reasoning: 'Support level test',
            },
          ],
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
          sentiment: 'bullish' as const,
          confidence: 0.85,
          reasoning: 'Strong uptrend pattern',
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
          price: 50000,
          distance: 100,
          touchCount: 3,
          strength: 0.9,
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
        price: 50000,
        timestamp: Date.now(),
        strength: 0.95,
        type: 'exact' as const,
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
          price: 50000,
          timestamp: Date.now(),
          strength: 0.5,
          type: 'near',
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
          sessionId: 'session-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          createdAt: Date.now(),
          touchEvents: [],
        },
      ];

      mockApiCache.createKey.mockReturnValue('analysis_session_session-1');
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
          sessionId: 'session-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'resistance',
          createdAt: Date.now(),
          touchEvents: [],
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
          sessionId: 'session-1',
          symbol: 'ETHUSDT',
          interval: '4h',
          type: 'pattern',
          createdAt: Date.now() - 3600000,
          touchEvents: [],
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
      process.env.NODE_ENV = 'development';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await AnalysisAPI.getSessionAnalyses('session-1');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('[AnalysisAPI] Returning empty array in development mode');

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw error in production when no cache available', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockApiCache.get.mockReturnValue(null);
      (withRetry as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(AnalysisAPI.getSessionAnalyses('session-1')).rejects.toThrow(
        'Failed to get session analyses for session-1: API Error'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getActiveAnalyses', () => {
    const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

    it('should fetch all active analyses when no symbol provided', async () => {
      const records: AnalysisRecord[] = [
        {
          id: 'record-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          createdAt: Date.now(),
          touchEvents: [],
        },
        {
          id: 'record-2',
          symbol: 'ETHUSDT',
          interval: '4h',
          type: 'resistance',
          createdAt: Date.now(),
          touchEvents: [],
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records }),
      });

      const result = await AnalysisAPI.getActiveAnalyses();

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/active');
      expect(mockApiCache.createKey).toHaveBeenCalledWith('analysis_active', { symbol: 'all' });
      expect(result).toEqual(records);
    });

    it('should fetch active analyses for specific symbol', async () => {
      const records: AnalysisRecord[] = [
        {
          id: 'record-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'trendline',
          createdAt: Date.now(),
          touchEvents: [],
        },
      ];

      mockApiCache.get.mockReturnValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records }),
      });

      const result = await AnalysisAPI.getActiveAnalyses('BTCUSDT');

      expect(global.fetch).toHaveBeenCalledWith('/api/analysis/active?symbol=BTCUSDT');
      expect(mockApiCache.createKey).toHaveBeenCalledWith('analysis_active', { symbol: 'BTCUSDT' });
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
          symbol: 'BTCUSDT',
          interval: '15m',
          type: 'fibonacci',
          createdAt: Date.now(),
          touchEvents: [],
        },
      ];

      mockApiCache.createKey.mockReturnValue('analysis_active_BTCUSDT');
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
          symbol: 'BTCUSDT',
          interval: '1d',
          type: 'volume',
          createdAt: Date.now() - 7200000,
          touchEvents: [],
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
        touchEvents: [],
      };

      const expectedRecord: AnalysisRecord = {
        id: 'db-record-1',
        sessionId: 'session-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        type: 'support',
        createdAt: Date.now(),
        touchEvents: [],
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
        proposalData: {
          proposals: [
            {
              symbol: 'ETHUSDT',
              action: 'SELL',
              timeframe: '4h',
              entry: 3000,
              targets: [2900, 2800],
              stopLoss: 3100,
              confidence: 0.7,
              reasoning: 'Bearish pattern',
            },
          ],
        },
        createdAt: new Date(),
      };

      const expectedRecord: AnalysisRecord = {
        id: 'db-record-2',
        symbol: 'ETHUSDT',
        interval: '4h',
        type: 'pattern',
        proposalData: dbRecord.proposalData,
        createdAt: Date.now(),
        touchEvents: [],
      };

      (convertDbAnalysisRecord as jest.Mock).mockReturnValue(expectedRecord);

      const result = AnalysisAPI.convertToAnalysisRecord(dbRecord);

      expect(result.proposalData).toBeDefined();
      expect(result.proposalData?.proposals).toHaveLength(1);
    });
  });
});